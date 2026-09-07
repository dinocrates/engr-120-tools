/**
 * SVG renderer + pointer interaction (SDD §6, §21, §43; UI_DESIGN_BIBLE §5–9).
 *
 * Owns the workspace <svg>. Component artwork is inlined from the trusted UI-kit
 * assets and swapped by view (symbol / hardware) + discrete state. On each sim
 * tick only runtime state is pushed into existing nodes (`syncDynamic`).
 *
 * The view toggle is a presentation preference: it never changes circuit data,
 * selection, camera, or simulation state (UI_DESIGN_BIBLE §2).
 */

import { getDef } from "@/components/defs.ts";
import type { EventBus } from "@/events/bus.ts";
import { instanceTransformAttr, nodeKey, worldPort, worldSize } from "@/model/geometry.ts";
import type { ComponentInstance, ConnectionEnd, Vec2 } from "@/model/types.ts";
import type { Store } from "@/model/store.ts";
import type { Engine } from "@/sim/engine.ts";
import { kitComponent } from "@/kit/manifest.ts";
import { applyContinuousState, componentSvg, type ContinuousState } from "@/kit/render-state.ts";
import type { KitView } from "@/kit/manifest.ts";
import type { PressureState } from "@/solver/solver.ts";
import { group, parseSvg, svg } from "./svg.ts";

const VIEW_W = 760;
const VIEW_H = 600;
const GRID = 8;
const PORT_HIT = 14;

const snap = (n: number): number => Math.round(n / GRID) * GRID;

const TUBE_STATE: Record<PressureState, string> = {
  UNPRESSURIZED: "inactive",
  PRESSURIZED: "pressurized",
  EXHAUSTING: "exhaust",
  TRAPPED: "trapped",
  SHORT: "pressurized",
};

export class Renderer {
  readonly svgEl: SVGSVGElement;
  private wires: SVGGElement;
  private comps: SVGGElement;
  private labels: SVGGElement;
  private overlay: SVGGElement;

  private view: KitView = "symbol";
  private compGroups = new Map<string, SVGGElement>();
  private renderKey = new Map<string, string>(); // id -> "view|state" currently drawn

  private pendingType: string | null = null;
  private ghost: SVGGElement | null = null;
  private connectFrom: ConnectionEnd | null = null;
  private connectRubber: SVGPathElement | null = null;
  private drag: { id: string; grabDX: number; grabDY: number } | null = null;
  private activeActuator: string | null = null;

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
    this.wires = group("layer layer-wires");
    this.comps = group("layer layer-components");
    this.labels = group("layer layer-labels");
    this.overlay = group("layer layer-overlay");
    this.svgEl.append(this.wires, this.comps, this.labels, this.overlay);
    host.append(this.svgEl);

    this.svgEl.dataset.mode = this.store.mode;
    this.svgEl.dataset.view = this.view;

    this.bindPointer();
    this.bindEvents();
    this.rebuild();
  }

  get currentView(): KitView {
    return this.view;
  }

  setView(view: KitView): void {
    if (this.view === view) return;
    this.view = view;
    this.svgEl.dataset.view = view;
    this.renderKey.clear();
    this.rebuild();
    this.bus.emit("view:changed", view);
  }

  setPendingType(type: string | null): void {
    this.pendingType = type;
    if (!type && this.ghost) {
      this.ghost.remove();
      this.ghost = null;
    }
    this.bus.emit("pending:changed", type);
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
  }

  /* -------------------------------------------------------------- rebuild */

  private rebuild(): void {
    this.wires.replaceChildren();
    this.comps.replaceChildren();
    this.labels.replaceChildren();
    this.compGroups.clear();
    this.renderKey.clear();

    for (const inst of this.store.circuit.components) this.buildComponent(inst);
    for (const conn of this.store.circuit.connections) this.buildWire(conn.id);

    this.applySelection();
    this.syncDynamic();
  }

  private buildComponent(inst: ComponentInstance): void {
    const def = getDef(inst.type);
    const g = group(`component type-${inst.type}`);
    g.dataset.id = inst.id;
    g.setAttribute("transform", instanceTransformAttr(inst));

    const [, , vw, vh] = def.viewBox;
    g.append(
      svg("rect", { x: -5, y: -5, width: vw + 10, height: vh + 10, class: "sel-box" }),
      svg("g", { class: "artwork" }),
    );

    const ports = group("ports");
    for (const p of def.ports) {
      const dot = group(`port-dot kind-${p.kind}`);
      dot.dataset.port = p.id;
      dot.append(
        svg("circle", { cx: p.offset.x, cy: p.offset.y, r: PORT_HIT, class: "port-hit" }),
        svg("circle", { cx: p.offset.x, cy: p.offset.y, r: 4, class: "port-mark" }),
      );
      ports.append(dot);
    }
    g.append(ports);

    if (this.store.mode === "run" && def.actuation) {
      const [, , w, h] = def.viewBox;
      g.append(
        svg("rect", {
          x: -8,
          y: -8,
          width: w + 16,
          height: h + 16,
          class: "actuator-hit",
          "data-actuate": inst.id,
        }),
      );
    }

    this.comps.append(g);
    this.compGroups.set(inst.id, g);

    // upright label in its own layer
    const size = worldSize(inst);
    const label = svg("text", {
      x: inst.position.x + size.x / 2,
      y: inst.position.y - 10,
      class: "node-label",
      "text-anchor": "middle",
    });
    label.textContent = inst.label ?? def.name;
    label.dataset.for = inst.id;
    this.labels.append(label);
  }

  private buildWire(id: string): void {
    const conn = this.store.circuit.connections.find((c) => c.id === id);
    if (!conn) return;
    const from = this.store.getComponent(conn.from.component);
    const to = this.store.getComponent(conn.to.component);
    if (!from || !to) return;
    const a = worldPort(from, conn.from.port);
    const b = worldPort(to, conn.to.port);
    const d = wirePath(a, b);
    const wire = group("wire");
    wire.dataset.id = id;
    wire.append(
      svg("path", { d, class: "wire-halo" }),
      svg("path", { d, class: "wire-line" }),
    );
    this.wires.append(wire);
  }

  private applySelection(): void {
    this.svgEl.querySelectorAll(".selected").forEach((n) => n.classList.remove("selected"));
    const sel = this.store.selection;
    if (!sel) return;
    this.compGroups.get(sel)?.classList.add("selected");
    this.wires.querySelector(`[data-id="${sel}"]`)?.classList.add("selected");
    this.labels.querySelector(`[data-for="${sel}"]`)?.classList.add("selected");
  }

  /* --------------------------------------------------------- dynamic sync */

  syncDynamic(): void {
    const rt = this.engine.runtime;
    const live = this.store.mode === "run";

    for (const inst of this.store.circuit.components) {
      const g = this.compGroups.get(inst.id);
      if (!g) continue;
      const def = getDef(inst.type);

      // discrete state -> artwork
      let stateName = def.defaultState;
      if (def.valve) {
        const idx = live
          ? rt.valvePositions.get(inst.id) ?? def.valve.restPosition
          : def.valve.restPosition;
        stateName = def.valve.positions[idx]?.name ?? def.defaultState;
      }
      const key = `${this.view}|${stateName}`;
      if (this.renderKey.get(inst.id) !== key) {
        const art = g.querySelector<SVGGElement>(".artwork")!;
        art.replaceChildren(this.makeArtwork(inst.type, stateName));
        this.renderKey.set(inst.id, key);
      }

      // control-panel state -> component styling
      g.classList.toggle("input-off", live && !!def.supply && !(rt.supplyOn.get(inst.id) ?? true));
      g.classList.toggle("latched-on", live && !!def.actuation && !!rt.latched.get(inst.id));

      // continuous state -> piston / needle
      const artSvg = g.querySelector<SVGElement>(".artwork > svg");
      if (artSvg) {
        const cs: ContinuousState = { view: this.view };
        if (def.cylinder) cs.position01 = live ? rt.cylinderPos.get(inst.id) ?? 0 : 0;
        if (def.gauge) {
          cs.pressure = live ? rt.portStates.get(nodeKey(inst.id, "1")) === "PRESSURIZED" ? 600 : 0 : undefined;
          cs.rangeMax = Number(inst.params.rangeMax ?? 1000);
        }
        applyContinuousState(artSvg, inst.type, cs);
      }
    }

    for (const conn of this.store.circuit.connections) {
      const wire = this.wires.querySelector<SVGGElement>(`[data-id="${conn.id}"]`);
      if (!wire) continue;
      const state: PressureState = live ? rt.connStates.get(conn.id) ?? "UNPRESSURIZED" : "UNPRESSURIZED";
      wire.setAttribute("class", `wire tube-${live ? TUBE_STATE[state] : "idle"}`);
    }
  }

  private makeArtwork(type: string, stateName: string): SVGSVGElement {
    const el = parseSvg(componentSvg(kitComponent(type), this.view, stateName));
    el.setAttribute("overflow", "visible");
    el.removeAttribute("role");
    return el;
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
    this.svgEl.addEventListener("pointerup", () => this.onUp());
    this.svgEl.addEventListener("pointercancel", () => this.endActuation());
    window.addEventListener("blur", () => this.endActuation());
  }

  private onMove(e: PointerEvent): void {
    const w = this.clientToWorld(e);

    if (this.pendingType) {
      const def = getDef(this.pendingType);
      if (!this.ghost) {
        this.ghost = group("component ghost");
        this.ghost.append(this.makeArtwork(this.pendingType, def.defaultState));
        this.overlay.append(this.ghost);
      }
      const [, , gw, gh] = def.viewBox;
      this.ghost.setAttribute("transform", `translate(${snap(w.x - gw / 2)} ${snap(w.y - gh / 2)})`);
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
      const a = worldPort(this.store.getComponent(this.connectFrom.component)!, this.connectFrom.port);
      this.connectRubber.setAttribute("d", wirePath(a, w));
    }
  }

  private onDown(e: PointerEvent): void {
    const target = e.target as SVGElement;

    if (this.pendingType) {
      const def = getDef(this.pendingType);
      const w = this.clientToWorld(e);
      const [, , pw, ph] = def.viewBox;
      const inst = this.store.addComponent(this.pendingType, {
        x: snap(w.x - pw / 2),
        y: snap(w.y - ph / 2),
      });
      this.store.select(inst.id);
      this.setPendingType(null);
      this.bus.emit("status:changed");
      return;
    }

    const actuate = target.closest<SVGElement>("[data-actuate]");
    if (this.store.mode === "run" && actuate) {
      const id = actuate.dataset.actuate!;
      this.store.select(id);
      this.engine.setInput(id, true);
      this.svgEl.setPointerCapture(e.pointerId);
      this.activeActuator = id;
      return;
    }
    if (this.store.mode === "run") {
      const compG = target.closest<SVGGElement>(".component");
      if (compG?.dataset.id) this.store.select(compG.dataset.id);
      return;
    }

    const portDot = target.closest<SVGGElement>(".port-dot");
    if (portDot) {
      const compG = portDot.closest<SVGGElement>(".component");
      this.beginConnect({ component: compG!.dataset.id!, port: portDot.dataset.port! }, e);
      return;
    }

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

    const wire = target.closest<SVGGElement>(".wire");
    if (wire?.dataset.id) {
      this.store.select(wire.dataset.id);
      return;
    }

    this.cancelConnect();
    this.store.select(null);
  }

  private onUp(): void {
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
        if (d <= PORT_HIT * 1.5 && (!best || d < best.d)) {
          best = { end: { component: inst.id, port: p.id }, d };
        }
      }
    }
    return best?.end ?? null;
  }

  private beginConnect(end: ConnectionEnd, e: PointerEvent): void {
    this.connectFrom = end;
    const wp = worldPort(this.store.getComponent(end.component)!, end.port);
    this.connectRubber = svg("path", { d: wirePath(wp, wp), class: "wire-rubber" });
    this.overlay.append(this.connectRubber);
    this.svgEl.setPointerCapture(e.pointerId);

    const finish = (ev: PointerEvent): void => {
      this.svgEl.removeEventListener("pointerup", finish);
      const targetEnd = this.nearestPort(this.clientToWorld(ev));
      if (targetEnd && this.connectFrom && this.store.addConnection(this.connectFrom, targetEnd)) {
        this.bus.emit("status:changed");
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

/** Orthogonal 3-segment route between two world points (UI_DESIGN_BIBLE §10). */
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
