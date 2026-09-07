/**
 * SVG renderer + pointer interaction (SDD §6, §21, §43).
 *
 * Owns the workspace <svg>. Rebuilds structure on circuit changes; on each sim
 * tick it only pushes runtime state into existing nodes (`syncDynamic`).
 */

import { getDef } from "@/components/defs.ts";
import type { EventBus } from "@/events/bus.ts";
import { nodeKey, worldPort } from "@/model/geometry.ts";
import type { ComponentInstance, ConnectionEnd, Vec2 } from "@/model/types.ts";
import type { Store } from "@/model/store.ts";
import type { Engine } from "@/sim/engine.ts";
import { getSymbol, type SymbolRuntime } from "./symbols.ts";
import { group, svg } from "./svg.ts";

const VIEW_W = 760;
const VIEW_H = 470;
const GRID = 8;
const PORT_HIT_RADIUS = 12;

const snap = (n: number): number => Math.round(n / GRID) * GRID;

function instanceTransform(inst: ComponentInstance): string {
  const { x: w, y: h } = getDef(inst.type).size;
  const shift =
    inst.rotation === 90
      ? { x: h, y: 0 }
      : inst.rotation === 180
        ? { x: w, y: h }
        : inst.rotation === 270
          ? { x: 0, y: w }
          : { x: 0, y: 0 };
  return `translate(${inst.position.x + shift.x} ${inst.position.y + shift.y}) rotate(${inst.rotation})`;
}

export class Renderer {
  readonly svgEl: SVGSVGElement;
  private wires: SVGGElement;
  private comps: SVGGElement;
  private overlay: SVGGElement;

  private compGroups = new Map<string, SVGGElement>();
  private pendingType: string | null = null;
  private ghost: SVGGElement | null = null;
  private connectFrom: ConnectionEnd | null = null;
  private connectRubber: SVGLineElement | null = null;
  private drag: { id: string; grabDX: number; grabDY: number } | null = null;

  constructor(
    host: HTMLElement,
    private store: Store,
    private engine: Engine,
    private bus: EventBus,
  ) {
    this.svgEl = svg("svg", {
      class: "ws-svg",
      viewBox: `0 0 ${VIEW_W} ${VIEW_H}`,
      preserveAspectRatio: "xMidYMid meet",
    });
    this.svgEl.append(defs());
    this.wires = group("layer layer-wires");
    this.comps = group("layer layer-components");
    this.overlay = group("layer layer-overlay");
    this.svgEl.append(this.wires, this.comps, this.overlay);
    host.append(this.svgEl);

    this.bindPointer();
    this.bindEvents();
    this.rebuild();
  }

  /* --------------------------------------------------------------- events */

  private bindEvents(): void {
    this.bus.on("circuit:changed", () => this.rebuild());
    this.bus.on("selection:changed", () => this.applySelection());
    this.bus.on("mode:changed", () => {
      this.svgEl.dataset.mode = this.store.mode;
      this.cancelConnect();
      this.rebuild();
    });
    const sync = () => this.syncDynamic();
    this.bus.on("sim:tick", sync);
    this.bus.on("sim:reset", sync);
    this.bus.on("valve:changed", sync);
    this.svgEl.dataset.mode = this.store.mode;
  }

  setPendingType(type: string | null): void {
    this.pendingType = type;
    if (!type && this.ghost) {
      this.ghost.remove();
      this.ghost = null;
    }
    this.bus.emit("pending:changed", type);
  }

  /* -------------------------------------------------------------- rebuild */

  private rebuild(): void {
    this.wires.replaceChildren();
    this.comps.replaceChildren();
    this.compGroups.clear();

    for (const inst of this.store.circuit.components) {
      const def = getDef(inst.type);
      const g = group(`component type-${inst.type}`);
      g.dataset.id = inst.id;
      g.setAttribute("transform", instanceTransform(inst));
      g.append(getSymbol(inst.type).build(def, inst));

      // port hotspots
      const ports = group("ports");
      for (const p of def.ports) {
        ports.append(
          svg("circle", {
            cx: p.offset.x,
            cy: p.offset.y,
            r: 4,
            class: "port",
            "data-port": p.id,
          }),
        );
      }
      g.append(ports);

      // run-mode actuator hit area
      if (this.store.mode === "run" && def.actuation) {
        const s = def.size;
        g.append(
          svg("rect", {
            x: -14,
            y: -6,
            width: s.x + 28,
            height: s.y + 12,
            class: "actuator-hit",
            "data-actuate": inst.id,
          }),
        );
      }

      this.comps.append(g);
      this.compGroups.set(inst.id, g);
    }

    for (const conn of this.store.circuit.connections) {
      const from = this.store.getComponent(conn.from.component);
      const to = this.store.getComponent(conn.to.component);
      if (!from || !to) continue;
      const a = worldPort(from, conn.from.port);
      const b = worldPort(to, conn.to.port);
      const path = svg("path", {
        d: wirePath(a, b),
        class: "wire",
        "data-id": conn.id,
      });
      this.wires.append(path);
    }

    this.applySelection();
    this.syncDynamic();
  }

  private applySelection(): void {
    this.svgEl.querySelectorAll(".selected").forEach((n) => n.classList.remove("selected"));
    if (!this.store.selection) return;
    const g = this.compGroups.get(this.store.selection);
    g?.classList.add("selected");
    this.wires
      .querySelector(`[data-id="${this.store.selection}"]`)
      ?.classList.add("selected");
  }

  /* --------------------------------------------------------- dynamic sync */

  syncDynamic(): void {
    const rt = this.engine.runtime;
    // Pressure/flow visualisation is a simulation feature (SDD §2.3): in edit
    // mode the schematic stays neutral, valves show their rest position.
    const live = this.store.mode === "run";

    for (const inst of this.store.circuit.components) {
      const g = this.compGroups.get(inst.id);
      if (!g) continue;
      const def = getDef(inst.type);
      const symRt: SymbolRuntime = { portStates: new Map() };
      if (live) {
        for (const p of def.ports) {
          const s = rt.portStates.get(nodeKey(inst.id, p.id));
          if (s) symRt.portStates.set(p.id, s);
        }
      }
      if (def.valve) {
        symRt.valvePosition = live
          ? rt.valvePositions.get(inst.id) ?? def.valve.restPosition
          : def.valve.restPosition;
        symRt.pressed = live && (rt.inputs.get(inst.id) ?? false);
      }
      if (def.cylinder) symRt.cylinderPos = live ? rt.cylinderPos.get(inst.id) ?? 0 : 0;
      getSymbol(inst.type).update(g.querySelector<SVGGElement>(".sym")!, def, inst, symRt);
    }

    for (const conn of this.store.circuit.connections) {
      const path = this.wires.querySelector<SVGPathElement>(`[data-id="${conn.id}"]`);
      if (!path) continue;
      const s = live ? rt.connStates.get(conn.id) ?? "UNPRESSURIZED" : "none";
      path.setAttribute("class", `wire wire-${s.toLowerCase()}`);
    }
  }

  /* -------------------------------------------------------------- pointer */

  private clientToWorld(evt: PointerEvent | MouseEvent): Vec2 {
    const pt = this.svgEl.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const ctm = this.svgEl.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const w = pt.matrixTransform(ctm.inverse());
    return { x: w.x, y: w.y };
  }

  private bindPointer(): void {
    this.svgEl.addEventListener("pointermove", (e) => this.onMove(e));
    this.svgEl.addEventListener("pointerdown", (e) => this.onDown(e));
    this.svgEl.addEventListener("pointerup", (e) => this.onUp(e));
    this.svgEl.addEventListener("pointerleave", (e) => this.onUp(e));
    this.svgEl.addEventListener("pointercancel", () => this.endActuation());
  }

  private onMove(e: PointerEvent): void {
    const w = this.clientToWorld(e);

    if (this.pendingType) {
      if (!this.ghost) {
        this.ghost = group("component ghost");
        this.ghost.append(
          getSymbol(this.pendingType).build(getDef(this.pendingType), {
            id: "ghost",
            type: this.pendingType,
            position: { x: 0, y: 0 },
            rotation: 0,
            params: {},
          }),
        );
        this.overlay.append(this.ghost);
      }
      const s = getDef(this.pendingType).size;
      this.ghost.setAttribute("transform", `translate(${snap(w.x - s.x / 2)} ${snap(w.y - s.y / 2)})`);
      return;
    }

    if (this.drag && this.store.mode === "edit") {
      this.store.moveComponent(this.drag.id, {
        x: snap(w.x - this.drag.grabDX),
        y: snap(w.y - this.drag.grabDY),
      });
      return;
    }

    if (this.connectFrom && this.connectRubber) {
      this.connectRubber.setAttribute("x2", String(w.x));
      this.connectRubber.setAttribute("y2", String(w.y));
    }
  }

  private onDown(e: PointerEvent): void {
    const target = e.target as SVGElement;

    // place pending component
    if (this.pendingType) {
      const w = this.clientToWorld(e);
      const s = getDef(this.pendingType).size;
      const inst = this.store.addComponent(this.pendingType, {
        x: snap(w.x - s.x / 2),
        y: snap(w.y - s.y / 2),
      });
      this.store.select(inst.id);
      this.setPendingType(null);
      this.bus.emit("status:changed");
      return;
    }

    // run mode: actuate
    const actuate = target.closest<SVGElement>("[data-actuate]");
    if (this.store.mode === "run" && actuate) {
      const id = actuate.dataset.actuate!;
      this.store.select(id);
      this.engine.setInput(id, true);
      this.svgEl.setPointerCapture(e.pointerId);
      this.activeActuator = id;
      return;
    }
    if (this.store.mode === "run") return;

    // edit mode: port -> begin connection
    const portCircle = target.closest<SVGCircleElement>(".port");
    if (portCircle) {
      const compG = portCircle.closest<SVGGElement>(".component");
      const end: ConnectionEnd = {
        component: compG!.dataset.id!,
        port: portCircle.dataset.port!,
      };
      this.beginConnect(end, e);
      return;
    }

    // edit mode: component -> select + drag
    const compG = target.closest<SVGGElement>(".component");
    if (compG?.dataset.id) {
      const id = compG.dataset.id;
      this.store.select(id);
      const inst = this.store.getComponent(id)!;
      const w = this.clientToWorld(e);
      this.drag = { id, grabDX: w.x - inst.position.x, grabDY: w.y - inst.position.y };
      this.svgEl.setPointerCapture(e.pointerId);
      return;
    }

    // wire -> select
    const wire = target.closest<SVGPathElement>(".wire");
    if (wire?.dataset.id) {
      this.store.select(wire.dataset.id);
      return;
    }

    // empty space
    this.cancelConnect();
    this.store.select(null);
  }

  private activeActuator: string | null = null;

  private onUp(_e: PointerEvent): void {
    this.drag = null;
    this.endActuation();
  }

  private endActuation(): void {
    if (this.activeActuator) {
      this.engine.setInput(this.activeActuator, false);
      this.activeActuator = null;
    }
  }

  /* --------------------------------------------------------- connections */

  private nearestPort(w: Vec2): ConnectionEnd | null {
    let best: { end: ConnectionEnd; d: number } | null = null;
    for (const inst of this.store.circuit.components) {
      for (const p of getDef(inst.type).ports) {
        const wp = worldPort(inst, p.id);
        const d = Math.hypot(wp.x - w.x, wp.y - w.y);
        if (d <= PORT_HIT_RADIUS && (!best || d < best.d)) {
          best = { end: { component: inst.id, port: p.id }, d };
        }
      }
    }
    return best?.end ?? null;
  }

  private beginConnect(end: ConnectionEnd, e: PointerEvent): void {
    this.connectFrom = end;
    const inst = this.store.getComponent(end.component)!;
    const wp = worldPort(inst, end.port);
    this.connectRubber = svg("line", {
      x1: wp.x,
      y1: wp.y,
      x2: wp.x,
      y2: wp.y,
      class: "wire rubber",
    });
    this.overlay.append(this.connectRubber);
    this.svgEl.setPointerCapture(e.pointerId);

    const finish = (ev: PointerEvent) => {
      this.svgEl.removeEventListener("pointerup", finish);
      const targetEnd = this.nearestPort(this.clientToWorld(ev));
      if (targetEnd && this.connectFrom) {
        const made = this.store.addConnection(this.connectFrom, targetEnd);
        if (made) this.bus.emit("status:changed");
      }
      this.cancelConnect();
    };
    this.svgEl.addEventListener("pointerup", finish);
  }

  private cancelConnect(): void {
    this.connectFrom = null;
    this.connectRubber?.remove();
    this.connectRubber = null;
  }
}

/* ------------------------------------------------------------------ utils */

function wirePath(a: Vec2, b: Vec2): string {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  if (dy >= dx) {
    const my = (a.y + b.y) / 2;
    return `M ${a.x} ${a.y} L ${a.x} ${my} L ${b.x} ${my} L ${b.x} ${b.y}`;
  }
  const mx = (a.x + b.x) / 2;
  return `M ${a.x} ${a.y} L ${mx} ${a.y} L ${mx} ${b.y} L ${b.x} ${b.y}`;
}

function defs(): SVGDefsElement {
  const d = svg("defs");
  const marker = svg("marker", {
    id: "arrow",
    viewBox: "0 0 10 10",
    refX: 8,
    refY: 5,
    markerWidth: 6,
    markerHeight: 6,
    orient: "auto-start-reverse",
  });
  marker.append(svg("path", { d: "M0 0 L10 5 L0 10 z", class: "arrowhead" }));
  d.append(marker);
  return d;
}
