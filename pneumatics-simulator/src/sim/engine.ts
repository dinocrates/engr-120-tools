/**
 * Simulation engine (SDD §11, §31, §35).
 *
 * Operates purely on the circuit model — no screen coordinates. Each tick runs
 * the ordered phases from SDD §11, iterating the logical state to a fixed point
 * before advancing physical (cylinder) motion over elapsed time.
 */

import { getDef } from "@/components/defs.ts";
import type { EventBus } from "@/events/bus.ts";
import { nodeKey } from "@/model/geometry.ts";
import type { Circuit } from "@/model/types.ts";
import { solve, type PressureState } from "@/solver/solver.ts";
import { solveSignals } from "@/solver/signals.ts";

const MAX_LOGICAL_ITERATIONS = 20; // SDD §11 phase 8

export type CylinderDirection = "extending" | "retracting" | "holding";

export interface RuntimeState {
  time: number;
  /** componentId -> active spool position index */
  valvePositions: Map<string, number>;
  /** componentId -> normalized rod position, 0 = retracted, 1 = extended */
  cylinderPos: Map<string, number>;
  cylinderDir: Map<string, CylinderDirection>;
  /** componentId -> manual actuator momentarily held (press & hold on canvas) */
  inputs: Map<string, boolean>;
  /** componentId -> control-panel latch (click on / click off) */
  latched: Map<string, boolean>;
  /** limit-valve componentId -> tripped by its linked cylinder (SDD §11 phase 7) */
  sensorTripped: Map<string, boolean>;
  /** supply componentId -> air turned on (default true) */
  supplyOn: Map<string, boolean>;
  /** "component:port" -> pressure state */
  portStates: Map<string, PressureState>;
  /** "component:port" -> region id (for path queries like flow control) */
  regionOf: Map<string, number>;
  /** "component:port" -> control signal energised (electro-pneumatic layer) */
  signalStates: Map<string, boolean>;
  /** connectionId -> pressure state */
  connStates: Map<string, PressureState>;
  /** connectionId -> signal energised (for signal-wire rendering) */
  signalConnStates: Map<string, boolean>;
  /** check-valve componentId -> currently open */
  checkOpen: Map<string, boolean>;
  warnings: string[];
}

function freshRuntime(circuit: Circuit): RuntimeState {
  const rt: RuntimeState = {
    time: 0,
    valvePositions: new Map(),
    cylinderPos: new Map(),
    cylinderDir: new Map(),
    inputs: new Map(),
    latched: new Map(),
    sensorTripped: new Map(),
    supplyOn: new Map(),
    portStates: new Map(),
    regionOf: new Map(),
    signalStates: new Map(),
    connStates: new Map(),
    signalConnStates: new Map(),
    checkOpen: new Map(),
    warnings: [],
  };
  for (const c of circuit.components) {
    const def = getDef(c.type);
    if (def.valve) rt.valvePositions.set(c.id, def.valve.restPosition);
    if (def.trigger) rt.sensorTripped.set(c.id, false);
    if (def.supply) rt.supplyOn.set(c.id, true);
    if (def.cylinder) {
      rt.cylinderPos.set(c.id, 0);
      rt.cylinderDir.set(c.id, "holding");
    }
  }
  return rt;
}

export class Engine {
  running = false;
  speed = 1;
  runtime: RuntimeState;

  constructor(
    private getCircuit: () => Circuit,
    private bus: EventBus,
  ) {
    this.runtime = freshRuntime(this.getCircuit());
    this.solveLogical();
  }

  reset(): void {
    this.running = false;
    this.runtime = freshRuntime(this.getCircuit());
    this.solveLogical();
    this.bus.emit("sim:reset");
  }

  start(): void {
    this.running = true;
    this.bus.emit("sim:started");
  }

  pause(): void {
    this.running = false;
    this.bus.emit("sim:paused");
  }

  /** Momentary press & hold (canvas). */
  setInput(componentId: string, held: boolean): void {
    if (this.runtime.inputs.get(componentId) === held) return;
    this.runtime.inputs.set(componentId, held);
    this.settle();
  }

  /** Latched control-panel toggle. */
  setLatch(componentId: string, on: boolean): void {
    if ((this.runtime.latched.get(componentId) ?? false) === on) return;
    this.runtime.latched.set(componentId, on);
    this.settle();
  }

  toggleLatch(componentId: string): void {
    this.setLatch(componentId, !(this.runtime.latched.get(componentId) ?? false));
  }

  /** Turn a supply's air on or off from the control panel. */
  setSupply(componentId: string, on: boolean): void {
    if ((this.runtime.supplyOn.get(componentId) ?? true) === on) return;
    this.runtime.supplyOn.set(componentId, on);
    this.settle();
  }

  /** Re-settle logic immediately so the circuit responds to a control change. */
  private settle(): void {
    this.solveLogical();
    this.bus.emit("valve:changed");
  }

  /** One logical + physical step. `dt` is real seconds; sim speed is applied here. */
  tick(dt: number): void {
    const scaled = dt * this.speed;
    this.solveLogical();
    this.advanceMotion(scaled);
    // Phase 7 — sensors read the new cylinder positions; if a limit valve
    // trips, re-settle the logic so the resulting valve shift shows this tick.
    if (this.updateSensors()) this.solveLogical();
    this.runtime.time += scaled;
    this.bus.emit("sim:tick");
  }

  /** Phases 1–4 & 7: iterate valve + pressure state to a fixed point. */
  private solveLogical(): void {
    const circuit = this.getCircuit();
    const rt = this.runtime;

    for (let i = 0; i < MAX_LOGICAL_ITERATIONS; i++) {
      let changed = false;

      // Phase 1.5 — control signals (electro-pneumatic layer). A manual signal
      // source is active while held or latched; a sensor source follows its
      // trip state.
      const manualOn = new Map<string, boolean>();
      for (const c of circuit.components) {
        if (getDef(c.type).signal?.trigger === "manual") {
          manualOn.set(c.id, (rt.inputs.get(c.id) ?? false) || (rt.latched.get(c.id) ?? false));
        }
      }
      rt.signalStates = solveSignals({ circuit, manualOn, sensorOn: rt.sensorTripped });

      // Phase 2 — determine each valve's spool position from its actuation.
      for (const c of circuit.components) {
        const def = getDef(c.type);
        if (!def.valve || !def.actuation) continue;
        const cur = rt.valvePositions.get(c.id) ?? def.valve.restPosition;
        const a = def.actuation;
        const restPos = a.restPosition ?? def.valve.restPosition;
        let next = cur;

        switch (a.kind) {
          case "momentary":
          case "detent":
            next = (rt.inputs.get(c.id) ?? false) || (rt.latched.get(c.id) ?? false)
              ? a.actuatedPosition
              : restPos;
            break;
          case "mechanical":
            next = (rt.sensorTripped.get(c.id) ?? false) ? a.actuatedPosition : restPos;
            break;
          case "pilot": {
            const pa = a.pilotActuate ? rt.portStates.get(nodeKey(c.id, a.pilotActuate)) === "PRESSURIZED" : false;
            const pr = a.pilotRest ? rt.portStates.get(nodeKey(c.id, a.pilotRest)) === "PRESSURIZED" : false;
            if (pa && !pr) next = a.actuatedPosition;
            else if (pr && !pa) next = restPos;
            else if (!a.bistable) next = restPos; // spring-centred single pilot
            break;
          }
          case "solenoid": {
            const sa = a.signalActuate ? rt.signalStates.get(nodeKey(c.id, a.signalActuate)) ?? false : false;
            const sr = a.signalRest ? rt.signalStates.get(nodeKey(c.id, a.signalRest)) ?? false : false;
            if (sa && !sr) next = a.actuatedPosition;
            else if (sr && !sa) next = restPos;
            else if (!a.bistable) next = restPos; // single solenoid, spring return
            break;
          }
        }

        if (next !== cur) {
          rt.valvePositions.set(c.id, next);
          changed = true;
        }
      }

      // Phases 3 & 4 — active paths + pressure propagation.
      const result = solve({
        circuit,
        valvePositions: rt.valvePositions,
        supplyOn: rt.supplyOn,
      });
      rt.portStates = result.portStates;
      rt.regionOf = result.regionOf;
      rt.checkOpen = result.checkOpen;
      rt.warnings = result.warnings;

      // connection states for rendering
      rt.connStates = new Map();
      rt.signalConnStates = new Map();
      for (const conn of circuit.connections) {
        const air = result.portStates.get(nodeKey(conn.from.component, conn.from.port));
        if (air) rt.connStates.set(conn.id, air);
        const sig = rt.signalStates.get(nodeKey(conn.from.component, conn.from.port));
        if (sig !== undefined) rt.signalConnStates.set(conn.id, sig);
      }

      // Phase 7 — sensors would update here and could feed back; none in MVP.
      if (!changed) break;
    }
  }

  /**
   * Phase 7 — mechanical sensors. A limit valve trips when its linked cylinder
   * reaches the configured position. Returns whether any trip state changed.
   */
  private updateSensors(): boolean {
    const rt = this.runtime;
    let changed = false;
    for (const c of this.getCircuit().components) {
      if (!getDef(c.type).trigger) continue;
      const cylId = String(c.params.triggerCylinder ?? "");
      const pos = rt.cylinderPos.get(cylId);
      const at = Number(c.params.triggerAt ?? 95) / 100;
      const edge = String(c.params.triggerEdge ?? "extend");
      const tripped = pos == null ? false : edge === "retract" ? pos <= at : pos >= at;
      if (tripped !== (rt.sensorTripped.get(c.id) ?? false)) {
        rt.sensorTripped.set(c.id, tripped);
        changed = true;
      }
    }
    return changed;
  }

  /**
   * Speed multiplier from any one-way flow control sharing a region with a
   * cylinder chamber (UI_DESIGN_BIBLE §16 — a restriction multiplier, no real
   * volumetric flow). Simplification: restricts motion in both directions.
   */
  private flowFactor(cylId: string, capPort: string, rodPort?: string): number {
    const rt = this.runtime;
    const regions = new Set<number>();
    for (const port of [capPort, rodPort]) {
      if (!port) continue;
      const r = rt.regionOf.get(nodeKey(cylId, port));
      if (r !== undefined) regions.add(r);
    }
    if (regions.size === 0) return 1;

    let factor = 1;
    for (const c of this.getCircuit().components) {
      if (!getDef(c.type).flowControl) continue;
      const inChamber =
        regions.has(rt.regionOf.get(nodeKey(c.id, "1")) ?? -1) ||
        regions.has(rt.regionOf.get(nodeKey(c.id, "2")) ?? -1);
      if (inChamber) {
        const restriction = Math.max(0, Math.min(100, Number(c.params.restriction ?? 60)));
        factor = Math.min(factor, Math.max(0.03, 1 - restriction / 100));
      }
    }
    return factor;
  }

  /** Phases 5 & 6 — actuator intent and motion integration. */
  private advanceMotion(dt: number): void {
    const circuit = this.getCircuit();
    const rt = this.runtime;

    for (const c of circuit.components) {
      const def = getDef(c.type);
      if (!def.cylinder) continue;

      const cap = rt.portStates.get(nodeKey(c.id, def.cylinder.capPort)) ?? "UNPRESSURIZED";
      const rod = def.cylinder.rodPort
        ? rt.portStates.get(nodeKey(c.id, def.cylinder.rodPort)) ?? "UNPRESSURIZED"
        : "UNPRESSURIZED";
      const vented = (s: PressureState) => s === "EXHAUSTING" || s === "UNPRESSURIZED";

      // SDD §14: single-acting cylinders are spring-returned — cap pressure
      // extends, anything else lets the spring retract them.
      let dir: CylinderDirection = "holding";
      if (def.cylinder.springReturn) {
        dir = cap === "PRESSURIZED" ? "extending" : "retracting";
      } else if (cap === "PRESSURIZED" && vented(rod)) {
        dir = "extending";
      } else if (rod === "PRESSURIZED" && vented(cap)) {
        dir = "retracting";
      }

      const pos = rt.cylinderPos.get(c.id) ?? 0;
      const flow = this.flowFactor(c.id, def.cylinder.capPort, def.cylinder.rodPort);
      const extendSpeed = Number(c.params.extendSpeed ?? def.defaultParams?.extendSpeed ?? 0.6) * flow;
      const retractSpeed = Number(c.params.retractSpeed ?? def.defaultParams?.retractSpeed ?? 0.6) * flow;

      let next = pos;
      if (dir === "extending") next = Math.min(1, pos + extendSpeed * dt);
      else if (dir === "retracting") next = Math.max(0, pos - retractSpeed * dt);

      if (next !== pos) {
        rt.cylinderPos.set(c.id, next);
        this.bus.emit("cylinder:moved", { id: c.id, position: next });
      }
      // report "holding" only once motion has actually stopped at an end / stall
      const settled =
        (dir === "extending" && next >= 1) || (dir === "retracting" && next <= 0);
      rt.cylinderDir.set(c.id, settled ? "holding" : dir);
    }
  }
}
