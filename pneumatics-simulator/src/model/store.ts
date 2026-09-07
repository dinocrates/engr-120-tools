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

export class Store {
  circuit: Circuit = emptyCircuit();
  selection: string | null = null;
  mode: Mode = "edit";

  constructor(private bus: EventBus) {}

  private changed(): void {
    this.bus.emit("circuit:changed");
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
    const def = getDef(type);
    const count = this.circuit.components.filter((c) => c.type === type).length + 1;
    const inst: ComponentInstance = {
      id: uid(type[0]!.toUpperCase()),
      type,
      position,
      rotation: 0,
      label: `${abbrev(def.name)}${count}`,
      params: { ...(def.defaultParams ?? {}) },
    };
    this.circuit.components.push(inst);
    this.changed();
    return inst;
  }

  moveComponent(id: string, position: Vec2): void {
    const c = this.getComponent(id);
    if (!c) return;
    c.position = position;
    this.changed();
  }

  rotateComponent(id: string, delta: 90 | -90): void {
    const c = this.getComponent(id);
    if (!c) return;
    c.rotation = (((c.rotation + delta) % 360) + 360) % 360 as Rotation;
    this.changed();
  }

  setParam(id: string, key: string, value: string | number | boolean): void {
    const c = this.getComponent(id);
    if (!c) return;
    c.params[key] = value;
    this.changed();
  }

  setLabel(id: string, label: string): void {
    const c = this.getComponent(id);
    if (!c) return;
    c.label = label;
    this.changed();
  }

  removeComponent(id: string): void {
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
    const conn: Connection = { id: uid("w"), from, to };
    this.circuit.connections.push(conn);
    this.changed();
    return conn;
  }

  removeConnection(id: string): void {
    this.circuit.connections = this.circuit.connections.filter((w) => w.id !== id);
    this.changed();
  }

  clear(): void {
    this.circuit = emptyCircuit();
    this.selection = null;
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
    this.circuit = parsed;
    this.selection = null;
    this.changed();
  }
}

function abbrev(name: string): string {
  const words = name.split(/\s+/);
  if (words.length === 1) return name.slice(0, 2).toUpperCase();
  return words.map((w) => w[0]!.toUpperCase()).join("");
}
