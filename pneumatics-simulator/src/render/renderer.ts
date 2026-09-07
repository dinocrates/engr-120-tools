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

import { getDef, isManuallyOperable, isSupported } from "@/components/defs.ts";
import type { EventBus } from "@/events/bus.ts";
import { instanceTransformAttr, nodeKey, worldPort, worldPortDir, worldSize } from "@/model/geometry.ts";
import type { ComponentInstance, ConnectionEnd, Vec2 } from "@/model/types.ts";
import type { Store } from "@/model/store.ts";
import type { Engine } from "@/sim/engine.ts";
import { kitComponent } from "@/kit/manifest.ts";
import { applyContinuousState, componentSvg, type ContinuousState } from "@/kit/render-state.ts";
import type { KitView } from "@/kit/manifest.ts";
import type { PressureState } from "@/solver/solver.ts";
import { group, parseSvg, svg } from "./svg.ts";

const GRID = 8;
const PORT_HIT = 14;
const ZOOM_MIN = 0.35;
const ZOOM_MAX = 3;

const snap = (n: number): number => Math.round(n / GRID) * GRID;

const portKind = (type: string, portId: string): "air" | "signal" =>
  getDef(type).ports.find((p) => p.id === portId)?.kind ?? "air";

const TUBE_STATE: Record<PressureState, string> = {
  UNPRESSURIZED: "inactive",
  PRESSURIZED: "pressurized",
  EXHAUSTING: "exhaust",
  TRAPPED: "trapped",
  SHORT: "pressurized",
};

export class Renderer {
  readonly svgEl: SVGSVGElement;
  private camera: SVGGElement;
  private wires: SVGGElement;
  private comps: SVGGElement;
  private labels: SVGGElement;
  private overlay: SVGGElement;

  private cam = { x: 0, y: 0, zoom: 1 };
  private view: KitView = "symbol";
  private compGroups = new Map<string, SVGGElement>();
  private renderKey = new Map<string, string>(); // id -> "view|state" currently drawn

  private pendingType: string | null = null;
  private ghost: SVGGElement | null = null;
  private connectFrom: ConnectionEnd | null = null;
  private connectRubber: SVGPathElement | null = null;
  private drag: { id: string; grabDX: number; grabDY: number } | null = null;
  private panFrom: { px: number; py: number; camX: number; camY: number } | null = null;
  private activeActuator: string | null = null;

  constructor(
    private host: HTMLElement,
    private store: Store,
    private engine: Engine,
    private bus: EventBus,
  ) {
    this.svgEl = svg("svg", { class: "ws-svg", preserveAspectRatio: "xMinYMin slice" });
    this.camera = group("camera");
    this.wires = group("layer layer-wires");
    this.comps = group("layer layer-components");
    this.labels = group("layer layer-labels");
    this.overlay = group("layer layer-overlay");
    this.camera.append(this.wires, this.comps, this.labels, this.overlay);
    this.svgEl.append(this.camera);
    host.append(this.svgEl);

    this.svgEl.dataset.mode = this.store.mode;
    this.svgEl.dataset.view = this.view;

    this.syncViewBox();
    new ResizeObserver(() => this.syncViewBox()).observe(host);

    this.bindPointer();
    this.bindEvents();
    this.rebuild();
  }

  /* ---------------------------------------------------------------- camera */

  private syncViewBox(): void {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.svgEl.setAttribute("viewBox", `0 0 ${w} ${h}`);
  }

  private applyCamera(): void {
    this.camera.setAttribute("transform", `translate(${this.cam.x} ${this.cam.y}) scale(${this.cam.zoom})`);
  }

  private screenPoint(e: { clientX: number; clientY: number }): Vec2 {
    const r = this.svgEl.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  zoomBy(factor: number, about?: { clientX: number; clientY: number }): void {
    const s = about ? this.screenPoint(about) : { x: this.host.clientWidth / 2, y: this.host.clientHeight / 2 };
    const wx = (s.x - this.cam.x) / this.cam.zoom;
    const wy = (s.y - this.cam.y) / this.cam.zoom;
    this.cam.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, this.cam.zoom * factor));
    this.cam.x = s.x - wx * this.cam.zoom;
    this.cam.y = s.y - wy * this.cam.zoom;
    this.applyCamera();
  }

  fitView(): void {
    const comps = this.store.circuit.components;
    const pad = 60;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const inst of comps) {
      const s = worldSize(inst);
      minX = Math.min(minX, inst.position.x);
      minY = Math.min(minY, inst.position.y);
      maxX = Math.max(maxX, inst.position.x + s.x);
      maxY = Math.max(maxY, inst.position.y + s.y);
    }
    const W = this.host.clientWidth;
    const H = this.host.clientHeight;
    if (!comps.length || !isFinite(minX)) {
      this.cam = { x: 0, y: 0, zoom: 1 };
      this.applyCamera();
      return;
    }
    const bw = maxX - minX + pad * 2;
    const bh = maxY - minY + pad * 2;
    const zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.min(W / bw, H / bh)));
    this.cam.zoom = zoom;
    this.cam.x = (W - (maxX + minX) * zoom) / 2;
    this.cam.y = (H - (maxY + minY) * zoom) / 2;
    this.applyCamera();
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
    this.bus.on("circuit:loaded", () => {
      this.rebuild();
      this.fitView();
    });
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
    this.store.circuit.connections.forEach((conn, i) => this.buildWire(conn.id, i));

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

    if (this.store.mode === "run" && isManuallyOperable(def)) {
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

  private buildWire(id: string, index = 0): void {
    const conn = this.store.circuit.connections.find((c) => c.id === id);
    if (!conn) return;
    const from = this.store.getComponent(conn.from.component);
    const to = this.store.getComponent(conn.to.component);
    if (!from || !to) return;
    const a = worldPort(from, conn.from.port);
    const b = worldPort(to, conn.to.port);
    const d = routeWire(
      a,
      worldPortDir(from, conn.from.port),
      b,
      worldPortDir(to, conn.to.port),
      ((index % 5) - 2) * 16,
    );
    const isSignal = portKind(from.type, conn.from.port) === "signal";
    const wire = group(isSignal ? "wire wire-sig" : "wire");
    wire.dataset.id = id;
    if (isSignal) wire.dataset.signal = "1";
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
      } else if (def.signal?.role === "sink" && def.signal.port) {
        stateName = live && rt.signalStates.get(nodeKey(inst.id, def.signal.port)) ? "on" : "off";
      } else if (def.signal?.role === "contact") {
        const closed =
          def.signal.closedBy === "cylinder"
            ? !!rt.sensorTripped.get(inst.id)
            : !!rt.inputs.get(inst.id) || !!rt.latched.get(inst.id);
        stateName = live && closed !== Boolean(def.signal.normallyClosed) ? "actuated" : "rest";
      }
      const key = `${this.view}|${stateName}`;
      if (this.renderKey.get(inst.id) !== key) {
        const art = g.querySelector<SVGGElement>(".artwork")!;
        art.replaceChildren(this.makeArtwork(inst.type, stateName));
        this.renderKey.set(inst.id, key);
      }

      // control-panel state -> component styling
      const solOn =
        !!def.actuation?.signalActuate &&
        !!rt.signalStates.get(nodeKey(inst.id, def.actuation.signalActuate));
      const isSource = !!def.supply || def.signal?.role === "source";
      g.classList.toggle("input-off", live && isSource && !(rt.supplyOn.get(inst.id) ?? true));
      g.classList.toggle(
        "latched-on",
        live && (!!rt.latched.get(inst.id) || !!rt.sensorTripped.get(inst.id) || solOn),
      );

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
      if (wire.dataset.signal) {
        const on = live && (rt.signalConnStates.get(conn.id) ?? false);
        wire.setAttribute("class", `wire wire-sig sig-${live ? (on ? "on" : "off") : "idle"}`);
      } else {
        const state: PressureState = live ? rt.connStates.get(conn.id) ?? "UNPRESSURIZED" : "UNPRESSURIZED";
        wire.setAttribute("class", `wire tube-${live ? TUBE_STATE[state] : "idle"}`);
      }
    }
  }

  private makeArtwork(type: string, stateName: string): SVGSVGElement {
    if (!isSupported(type)) return placeholderArtwork(type);
    try {
      const el = parseSvg(componentSvg(kitComponent(type), this.view, stateName));
      el.setAttribute("overflow", "visible");
      el.removeAttribute("role");
      return el;
    } catch {
      return placeholderArtwork(type);
    }
  }

  /* -------------------------------------------------------------- pointer */

  private clientToWorld(evt: { clientX: number; clientY: number }): Vec2 {
    const s = this.screenPoint(evt);
    return { x: (s.x - this.cam.x) / this.cam.zoom, y: (s.y - this.cam.y) / this.cam.zoom };
  }

  private capture(id: number): void {
    try {
      this.svgEl.setPointerCapture(id);
    } catch {
      /* synthetic or already-released pointer */
    }
  }

  private bindPointer(): void {
    this.svgEl.addEventListener("pointermove", (e) => this.onMove(e));
    this.svgEl.addEventListener("pointerdown", (e) => this.onDown(e));
    this.svgEl.addEventListener("pointerup", () => this.onUp());
    this.svgEl.addEventListener("pointercancel", () => this.endActuation());
    this.svgEl.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, e);
      },
      { passive: false },
    );
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
      const inst = this.store.getComponent(this.connectFrom.component)!;
      const a = worldPort(inst, this.connectFrom.port);
      const da = worldPortDir(inst, this.connectFrom.port);
      this.connectRubber.setAttribute("d", rubberPath(a, da, w));
    }

    if (this.panFrom) {
      const s = this.screenPoint(e);
      this.cam.x = this.panFrom.camX + (s.x - this.panFrom.px);
      this.cam.y = this.panFrom.camY + (s.y - this.panFrom.py);
      this.applyCamera();
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
      this.capture(e.pointerId);
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
      this.store.beginBatch();
      this.capture(e.pointerId);
      return;
    }

    const wire = target.closest<SVGGElement>(".wire");
    if (wire?.dataset.id) {
      this.store.select(wire.dataset.id);
      return;
    }

    // empty space — deselect and start panning the camera
    this.cancelConnect();
    this.store.select(null);
    const s = this.screenPoint(e);
    this.panFrom = { px: s.x, py: s.y, camX: this.cam.x, camY: this.cam.y };
    this.capture(e.pointerId);
    this.svgEl.classList.add("panning");
  }

  private onUp(): void {
    if (this.drag) this.store.endBatch();
    this.drag = null;
    this.panFrom = null;
    this.svgEl.classList.remove("panning");
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
    const inst = this.store.getComponent(end.component)!;
    const wp = worldPort(inst, end.port);
    this.connectRubber = svg("path", {
      d: rubberPath(wp, worldPortDir(inst, end.port), wp),
      class: "wire-rubber",
    });
    this.overlay.append(this.connectRubber);
    this.capture(e.pointerId);

    const finish = (ev: PointerEvent): void => {
      this.svgEl.removeEventListener("pointerup", finish);
      const targetEnd = this.nearestPort(this.clientToWorld(ev));
      if (targetEnd && this.connectFrom) {
        const fromKind = portKind(this.store.getComponent(this.connectFrom.component)!.type, this.connectFrom.port);
        const toKind = portKind(this.store.getComponent(targetEnd.component)!.type, targetEnd.port);
        if (fromKind !== toKind) {
          this.bus.emit("status:changed", {
            error:
              fromKind === "signal"
                ? "That's a control signal — connect it to another signal port, not an air port."
                : "That's an air port — connect it to another air port, not a control signal.",
          });
        } else if (this.store.addConnection(this.connectFrom, targetEnd)) {
          this.bus.emit("status:changed");
        }
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

const LEAD = 20; // tube stub length before routing (UI_DESIGN_BIBLE §10)

/**
 * Orthogonal route between two ports. Each end gets a short perpendicular
 * lead-out so it's always clear which port a tube belongs to; the mid corridor
 * is nudged by `channel` so parallel runs don't stack on top of each other.
 */
function routeWire(a: Vec2, da: Vec2, b: Vec2, db: Vec2, channel: number): string {
  const a1 = { x: a.x + da.x * LEAD, y: a.y + da.y * LEAD };
  const b1 = { x: b.x + db.x * LEAD, y: b.y + db.y * LEAD };
  const aHoriz = da.x !== 0;
  const bHoriz = db.x !== 0;

  const mids: Vec2[] = [];
  if (aHoriz && bHoriz) {
    const midX = (a1.x + b1.x) / 2 + channel;
    mids.push({ x: midX, y: a1.y }, { x: midX, y: b1.y });
  } else if (!aHoriz && !bHoriz) {
    const midY = (a1.y + b1.y) / 2 + channel;
    mids.push({ x: a1.x, y: midY }, { x: b1.x, y: midY });
  } else if (aHoriz) {
    mids.push({ x: b1.x, y: a1.y });
  } else {
    mids.push({ x: a1.x, y: b1.y });
  }

  return toPath(simplify([a, a1, ...mids, b1, b]));
}

/** Rubber-band route while dragging a new connection. */
function rubberPath(a: Vec2, da: Vec2, cursor: Vec2): string {
  const a1 = { x: a.x + da.x * LEAD, y: a.y + da.y * LEAD };
  const corner = da.x !== 0 ? { x: cursor.x, y: a1.y } : { x: a1.x, y: cursor.y };
  return toPath(simplify([a, a1, corner, cursor]));
}

/** Drop repeated points and collinear midpoints. */
function simplify(points: Vec2[]): Vec2[] {
  const out: Vec2[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.x - p.x) < 0.5 && Math.abs(last.y - p.y) < 0.5) continue;
    out.push(p);
  }
  for (let i = out.length - 2; i > 0; i--) {
    const [prev, cur, next] = [out[i - 1]!, out[i]!, out[i + 1]!];
    const cross = (cur.x - prev.x) * (next.y - prev.y) - (cur.y - prev.y) * (next.x - prev.x);
    if (Math.abs(cross) < 0.5) out.splice(i, 1);
  }
  return out;
}

function toPath(points: Vec2[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
}

/** Neutral stand-in for an unsupported component type (UI_DESIGN_BIBLE §11). */
function placeholderArtwork(type: string): SVGSVGElement {
  const def = getDef(type);
  const [, , w, h] = def.viewBox;
  const el = svg("svg", { viewBox: `0 0 ${w} ${h}`, width: w, height: h, class: "unknown-art" });
  el.append(
    svg("rect", { x: 6, y: 6, width: w - 12, height: h - 12, rx: 4, class: "unknown-box" }),
    svg("text", { x: w / 2, y: h / 2 - 6, "text-anchor": "middle", class: "unknown-q" }, ["?"]),
    svg("text", { x: w / 2, y: h - 16, "text-anchor": "middle", class: "unknown-label" }, [type]),
  );
  return el as unknown as SVGSVGElement;
}
