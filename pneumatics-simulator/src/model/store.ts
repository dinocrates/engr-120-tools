/**
 * Diagram model store: the single source of truth for the circuit, current
 * selection, and edit/run mode. Mutations emit `circuit:changed` so the
 * renderer and panels can refresh. Simulation runtime lives in the Engine, not
 * here (SDD §30, §46).
 */

import { getDef } from "@/components/defs.ts";
import type { EventBus } from "@/events/bus.ts";
import type { Circuit, ComponentInstance, Connection, ConnectionEnd, Rotation, Vec2 } from "./types.ts";
import { emptyCircuit } from "./types.ts";

export type Mode = "edit" | "run";

let seq = 0;
const uid = (prefix: string): string => `${prefix}${(++seq).toString(36)}${Date.now().toString(36).slice(-3)}`;

const HISTORY_LIMIT = 60;

export class Store {
  circuit: Circuit = emptyCircuit();
  selection: string | null = null;
  mode: Mode = "edit";

  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private batching = false;
  private batchBaseline = "";
  private batchDirty = false;

  constructor(private bus: EventBus) {}

  private changed(): void {
    this.bus.emit("circuit:changed");
  }

  /* -------------------------------------------------------------- history */

  private pushUndo(state: string): void {
    this.undoStack.push(state);
    if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
    this.redoStack.length = 0;
    this.bus.emit("history:changed");
  }

  /** Record the pre-mutation state. Inside a batch, only marks it dirty so the
   *  whole run collapses into one undo step. */
  private snapshot(): void {
    if (this.batching) {
      this.batchDirty = true;
      return;
    }
    this.pushUndo(JSON.stringify(this.circuit));
  }

  /** Group a run of mutations (e.g. a drag) into one undo step. */
  beginBatch(): void {
    if (this.batching) return;
    this.batching = true;
    this.batchDirty = false;
    this.batchBaseline = JSON.stringify(this.circuit);
  }

  endBatch(): void {
    if (this.batching && this.batchDirty) this.pushUndo(this.batchBaseline);
    this.batching = false;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(): void {
    const prev = this.undoStack.pop();
    if (prev === undefined) return;
    this.redoStack.push(JSON.stringify(this.circuit));
    this.circuit = JSON.parse(prev) as Circuit;
    this.selection = null;
    this.bus.emit("history:changed");
    this.changed();
  }

  redo(): void {
    const next = this.redoStack.pop();
    if (next === undefined) return;
    this.undoStack.push(JSON.stringify(this.circuit));
    this.circuit = JSON.parse(next) as Circuit;
    this.selection = null;
    this.bus.emit("history:changed");
    this.changed();
  }

  private clearHistory(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.bus.emit("history:changed");
  }

  setMode(mode: Mode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.bus.emit("mode:changed", mode);
  }

  select(id: string | null): void {
    if (this.selection === id) return;
    this.selection = id;
    this.bus.emit("selection:changed", id);
  }

  getComponent(id: string): ComponentInstance | undefined {
    return this.circuit.components.find((c) => c.id === id);
  }

  addComponent(type: string, position: Vec2): ComponentInstance {
    this.snapshot();
    const def = getDef(type);
    const prefix = labelPrefix(def);
    const count =
      this.circuit.components.filter((c) => (c.label ?? "").startsWith(prefix)).length + 1;
    const inst: ComponentInstance = {
      id: uid(prefix),
      type,
      position,
      rotation: 0,
      label: `${prefix}${count}`,
      params: { ...(def.defaultParams ?? {}) },
    };
    this.circuit.components.push(inst);
    this.changed();
    return inst;
  }

  moveComponent(id: string, position: Vec2): void {
    const c = this.getComponent(id);
    if (!c) return;
    this.snapshot();
    c.position = position;
    this.changed();
  }

  rotateComponent(id: string, delta: 90 | -90): void {
    const c = this.getComponent(id);
    if (!c) return;
    this.snapshot();
    c.rotation = (((c.rotation + delta) % 360) + 360) % 360 as Rotation;
    this.changed();
  }

  setParam(id: string, key: string, value: string | number | boolean): void {
    const c = this.getComponent(id);
    if (!c) return;
    this.snapshot();
    c.params[key] = value;
    this.changed();
  }

  setLabel(id: string, label: string): void {
    const c = this.getComponent(id);
    if (!c) return;
    this.snapshot();
    c.label = label;
    this.changed();
  }

  removeComponent(id: string): void {
    if (!this.getComponent(id)) return;
    this.snapshot();
    this.circuit.components = this.circuit.components.filter((c) => c.id !== id);
    this.circuit.connections = this.circuit.connections.filter(
      (w) => w.from.component !== id && w.to.component !== id,
    );
    if (this.selection === id) this.selection = null;
    this.changed();
  }

  private sameEnd(a: ConnectionEnd, b: ConnectionEnd): boolean {
    return a.component === b.component && a.port === b.port;
  }

  canConnect(from: ConnectionEnd, to: ConnectionEnd): boolean {
    if (this.sameEnd(from, to)) return false;
    if (from.component === to.component) return false;
    return !this.circuit.connections.some(
      (w) =>
        (this.sameEnd(w.from, from) && this.sameEnd(w.to, to)) ||
        (this.sameEnd(w.from, to) && this.sameEnd(w.to, from)),
    );
  }

  addConnection(from: ConnectionEnd, to: ConnectionEnd): Connection | null {
    if (!this.canConnect(from, to)) return null;
    this.snapshot();
    const conn: Connection = { id: uid("w"), from, to };
    this.circuit.connections.push(conn);
    this.changed();
    return conn;
  }

  removeConnection(id: string): void {
    if (!this.circuit.connections.some((w) => w.id === id)) return;
    this.snapshot();
    this.circuit.connections = this.circuit.connections.filter((w) => w.id !== id);
    this.changed();
  }

  clear(): void {
    this.circuit = emptyCircuit();
    this.selection = null;
    this.clearHistory();
    this.bus.emit("circuit:loaded");
    this.changed();
  }

  serialize(): string {
    return JSON.stringify(this.circuit, null, 2);
  }

  load(json: string): void {
    const parsed = JSON.parse(json) as Circuit;
    if (parsed.version !== 1 || !Array.isArray(parsed.components)) {
      throw new Error("Not a valid circuit file.");
    }
    this.circuit = normalizeCircuit(parsed);
    this.selection = null;
    this.clearHistory();
    this.bus.emit("circuit:loaded");
    this.changed();
  }
}

/** Defensive fixups on a loaded file (UI_DESIGN_BIBLE §11). */
function normalizeCircuit(c: Circuit): Circuit {
  return {
    version: 1,
    components: (c.components ?? []).map((comp) => ({
      id: String(comp.id),
      type: String(comp.type),
      position: { x: Number(comp.position?.x ?? 0), y: Number(comp.position?.y ?? 0) },
      rotation: ([0, 90, 180, 270].includes(comp.rotation as number) ? comp.rotation : 0) as Rotation,
      label: comp.label ? String(comp.label) : undefined,
      params: comp.params && typeof comp.params === "object" ? comp.params : {},
    })),
    connections: (c.connections ?? []).filter(
      (w) => w?.id && w.from?.component && w.from?.port && w.to?.component && w.to?.port,
    ),
  };
}

function labelPrefix(def: ReturnType<typeof getDef>): string {
  if (def.valve) return "V";
  if (def.cylinder) return "C";
  if (def.supply) return "SUP";
  if (def.exhaust) return "EX";
  if (def.gauge) return "PG";
  return "P";
}
