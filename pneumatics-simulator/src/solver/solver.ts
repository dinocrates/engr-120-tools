/**
 * Network-state pneumatic solver (SDD §9, §10, §33).
 *
 * The circuit is a graph of port nodes. Edges come from (a) external pneumatic
 * connections drawn by the student and (b) internal component pathways that
 * depend on the current component state (valve spool position).
 *
 * The solver partitions the nodes into connected regions and assigns each
 * region a discrete pressure state. No numerical fluid model yet.
 */

import { getDef } from "@/components/defs.ts";
import { nodeKey } from "@/model/geometry.ts";
import type { Circuit } from "@/model/types.ts";

export type PressureState =
  | "UNPRESSURIZED"
  | "PRESSURIZED"
  | "EXHAUSTING"
  | "TRAPPED"
  | "SHORT";

export interface SolveInput {
  circuit: Circuit;
  /** componentId -> active spool position index. */
  valvePositions: Map<string, number>;
}

export interface SolveResult {
  /** "component:port" -> pressure state */
  portStates: Map<string, PressureState>;
  /** "component:port" -> region id */
  regionOf: Map<string, number>;
  regionStates: Map<number, PressureState>;
  warnings: string[];
}

class UnionFind {
  private parent = new Map<string, string>();

  add(x: string): void {
    if (!this.parent.has(x)) this.parent.set(x, x);
  }

  find(x: string): string {
    this.add(x);
    let root = x;
    while (this.parent.get(root) !== root) root = this.parent.get(root)!;
    // path compression
    let cur = x;
    while (this.parent.get(cur) !== root) {
      const next = this.parent.get(cur)!;
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

export function solve({ circuit, valvePositions }: SolveInput): SolveResult {
  const uf = new UnionFind();
  const warnings: string[] = [];

  // 1. every air port is a node (control-signal ports are a separate graph)
  for (const c of circuit.components) {
    for (const p of getDef(c.type).ports) {
      if (p.kind === "air") uf.add(nodeKey(c.id, p.id));
    }
  }

  // 2. external connections
  for (const conn of circuit.connections) {
    uf.union(nodeKey(conn.from.component, conn.from.port), nodeKey(conn.to.component, conn.to.port));
  }

  // 3. internal pathways from current component state
  for (const c of circuit.components) {
    const def = getDef(c.type);
    if (!def.valve) continue;
    const pos = valvePositions.get(c.id) ?? def.valve.restPosition;
    const position = def.valve.positions[pos] ?? def.valve.positions[def.valve.restPosition];
    for (const [a, b] of position!.connections) {
      uf.union(nodeKey(c.id, a), nodeKey(c.id, b));
    }
  }

  // 4. classify each region. Supply / exhaust are component roles, not port
  //    kinds (UI_DESIGN_BIBLE §7): an air-supply feeds pressure, an exhaust
  //    component is an open path to atmosphere. An unconnected valve port is a
  //    dead end, not a vent.
  interface RegionInfo {
    hasSource: boolean;
    hasExhaust: boolean;
    hasWorking: boolean;
    hasCylinder: boolean;
  }
  const info = new Map<string, RegionInfo>();
  const ensure = (root: string): RegionInfo => {
    let r = info.get(root);
    if (!r) {
      r = { hasSource: false, hasExhaust: false, hasWorking: false, hasCylinder: false };
      info.set(root, r);
    }
    return r;
  };

  for (const c of circuit.components) {
    const def = getDef(c.type);
    for (const p of def.ports) {
      if (p.kind !== "air") continue;
      const root = uf.find(nodeKey(c.id, p.id));
      const r = ensure(root);
      if (def.supply?.port === p.id) r.hasSource = true;
      if (def.exhaust?.port === p.id) r.hasExhaust = true;
      if (def.cylinder) {
        r.hasCylinder = true;
        r.hasWorking = true;
      }
    }
  }

  // 5. assign region ids + states
  const regionOf = new Map<string, number>();
  const regionStates = new Map<number, PressureState>();
  const idOfRoot = new Map<string, number>();
  let nextId = 0;

  for (const c of circuit.components) {
    for (const p of getDef(c.type).ports) {
      if (p.kind !== "air") continue;
      const key = nodeKey(c.id, p.id);
      const root = uf.find(key);
      let id = idOfRoot.get(root);
      if (id === undefined) {
        id = nextId++;
        idOfRoot.set(root, id);
        const r = ensure(root);
        let state: PressureState;
        if (r.hasSource && r.hasExhaust) {
          state = "SHORT";
        } else if (r.hasSource) {
          state = "PRESSURIZED";
        } else if (r.hasExhaust) {
          state = "EXHAUSTING";
        } else if (r.hasCylinder || r.hasWorking) {
          state = "TRAPPED";
        } else {
          state = "UNPRESSURIZED";
        }
        regionStates.set(id, state);
      }
      regionOf.set(key, id);
    }
  }

  // 6. port states + warnings
  const portStates = new Map<string, PressureState>();
  for (const [key, id] of regionOf) portStates.set(key, regionStates.get(id)!);

  if ([...regionStates.values()].includes("SHORT")) {
    warnings.push("Supply is connected directly to exhaust (short circuit).");
  }

  return { portStates, regionOf, regionStates, warnings };
}
