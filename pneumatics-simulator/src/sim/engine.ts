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
  /** supply componentId -> air turned on (default true) */
  supplyOn: Map<string, boolean>;
  /** "component:port" -> pressure state */
  portStates: Map<string, PressureState>;
  /** connectionId -> pressure state */
  connStates: Map<string, PressureState>;
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
    supplyOn: new Map(),
    portStates: new Map(),
    connStates: new Map(),
    warnings: [],
  };
  for (const c of circuit.components) {
    const def = getDef(c.type);
    if (def.valve) rt.valvePositions.set(c.id, def.valve.restPosition);
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
    this.runtime.time += scaled;
    this.bus.emit("sim:tick");
  }

  /** Phases 1–4 & 7: iterate valve + pressure state to a fixed point. */
  private solveLogical(): void {
    const circuit = this.getCircuit();
    const rt = this.runtime;

    for (let i = 0; i < MAX_LOGICAL_ITERATIONS; i++) {
      let changed = false;

      // Phase 2 — determine valve positions from inputs. A valve is actuated
      // while its button is held on the canvas OR latched in the control panel.
      for (const c of circuit.components) {
        const def = getDef(c.type);
        if (!def.valve || !def.actuation) continue;
        const actuated = (rt.inputs.get(c.id) ?? false) || (rt.latched.get(c.id) ?? false);
        const next = actuated ? def.actuation.actuatedPosition : def.valve.restPosition;
        if (next !== rt.valvePositions.get(c.id)) {
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
      rt.warnings = result.warnings;

      // connection states for rendering
      rt.connStates = new Map();
      for (const conn of circuit.connections) {
        const s = result.portStates.get(nodeKey(conn.from.component, conn.from.port));
        if (s) rt.connStates.set(conn.id, s);
      }

      // Phase 7 — sensors would update here and could feed back; none in MVP.
      if (!changed) break;
    }
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
      const extendSpeed = Number(c.params.extendSpeed ?? def.defaultParams?.extendSpeed ?? 0.6);
      const retractSpeed = Number(c.params.retractSpeed ?? def.defaultParams?.retractSpeed ?? 0.6);

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
