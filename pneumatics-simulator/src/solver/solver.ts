/**
 * Network-state pneumatic solver (SDD §9, §10, §33).
 *
 * The circuit is a graph of port nodes. Edges come from (a) external connections
 * drawn by the student, (b) internal component pathways that depend on the
 * current component state (valve spool position, check-valve direction), and
 * (c) transparent pass-throughs (flow control).
 *
 * The solver partitions the nodes into connected regions and assigns each a
 * discrete pressure state. Check valves are resolved by iterating to a fixed
 * point — a check valve is open unless its downstream side is pressurised and
 * its upstream side isn't pushing (SDD §17).
 */

import { getDef } from "@/components/defs.ts";
import { nodeKey } from "@/model/geometry.ts";
import type { Circuit } from "@/model/types.ts";
import { UnionFind } from "./unionfind.ts";

export type PressureState = "UNPRESSURIZED" | "PRESSURIZED" | "EXHAUSTING" | "TRAPPED" | "SHORT";

export interface SolveInput {
  circuit: Circuit;
  /** componentId -> active spool position index. */
  valvePositions: Map<string, number>;
  /** supply componentId -> air turned on (absent / true = on). */
  supplyOn?: Map<string, boolean>;
}

export interface SolveResult {
  /** "component:port" -> pressure state */
  portStates: Map<string, PressureState>;
  /** "component:port" -> region id */
  regionOf: Map<string, number>;
  regionStates: Map<number, PressureState>;
  /** check-valve componentId -> currently open */
  checkOpen: Map<string, boolean>;
  warnings: string[];
}

const RANK: Record<PressureState, number> = {
  SHORT: 3,
  PRESSURIZED: 3,
  TRAPPED: 2,
  UNPRESSURIZED: 1,
  EXHAUSTING: 0,
};

export function solve({ circuit, valvePositions, supplyOn }: SolveInput): SolveResult {
  const checks = circuit.components.filter((c) => getDef(c.type).checkValve);

  // Start with every check valve closed, then open the ones whose upstream side
  // can push into (or equalise with) the downstream side. Iterate to a fixed
  // point (SDD §17).
  let open = new Set<string>();
  let regions = partition(open);

  for (let i = 0; i < 8 && checks.length > 0; i++) {
    const next = new Set<string>();
    for (const c of checks) {
      const cv = getDef(c.type).checkValve!;
      const up = regions.portStates.get(nodeKey(c.id, cv.inPort)) ?? "UNPRESSURIZED";
      const down = regions.portStates.get(nodeKey(c.id, cv.outPort)) ?? "UNPRESSURIZED";
      if (RANK[up] >= RANK[down]) next.add(c.id);
    }
    if (sameSet(next, open)) break;
    open = next;
    regions = partition(open);
  }

  const warnings: string[] = [];
  if ([...regions.regionStates.values()].includes("SHORT")) {
    warnings.push("Supply is connected directly to exhaust (short circuit).");
  }

  return {
    ...regions,
    checkOpen: new Map(checks.map((c) => [c.id, open.has(c.id)])),
    warnings,
  };

  function partition(openChecks: Set<string>): Omit<SolveResult, "checkOpen" | "warnings"> {
    const uf = new UnionFind();

    // 1. air ports become nodes (signal ports are a separate graph)
    for (const c of circuit.components) {
      for (const p of getDef(c.type).ports) if (p.kind === "air") uf.add(nodeKey(c.id, p.id));
    }

    // 2. external connections
    for (const conn of circuit.connections) {
      uf.union(nodeKey(conn.from.component, conn.from.port), nodeKey(conn.to.component, conn.to.port));
    }

    // 3. internal pathways
    for (const c of circuit.components) {
      const def = getDef(c.type);
      if (def.valve) {
        const pos = valvePositions.get(c.id) ?? def.valve.restPosition;
        const position = def.valve.positions[pos] ?? def.valve.positions[def.valve.restPosition];
        for (const [a, b] of position!.connections) uf.union(nodeKey(c.id, a), nodeKey(c.id, b));
      }
      if (def.flowControl) {
        // transparent to pressure — only affects actuator speed
        uf.union(nodeKey(c.id, "1"), nodeKey(c.id, "2"));
      }
      if (def.checkValve && openChecks.has(c.id)) {
        uf.union(nodeKey(c.id, def.checkValve.inPort), nodeKey(c.id, def.checkValve.outPort));
      }
    }

    // 4. classify regions
    interface RegionInfo {
      hasSource: boolean;
      hasExhaust: boolean;
      hasWorking: boolean;
    }
    const info = new Map<string, RegionInfo>();
    const ensure = (root: string): RegionInfo => {
      let r = info.get(root);
      if (!r) info.set(root, (r = { hasSource: false, hasExhaust: false, hasWorking: false }));
      return r;
    };

    for (const c of circuit.components) {
      const def = getDef(c.type);
      for (const p of def.ports) {
        if (p.kind !== "air") continue;
        const r = ensure(uf.find(nodeKey(c.id, p.id)));
        if (def.supply?.port === p.id && (supplyOn?.get(c.id) ?? true)) r.hasSource = true;
        if (def.exhaust?.port === p.id) r.hasExhaust = true;
        if (def.cylinder) r.hasWorking = true;
      }
    }

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
          const state: PressureState =
            r.hasSource && r.hasExhaust
              ? "SHORT"
              : r.hasSource
                ? "PRESSURIZED"
                : r.hasExhaust
                  ? "EXHAUSTING"
                  : r.hasWorking
                    ? "TRAPPED"
                    : "UNPRESSURIZED";
          regionStates.set(id, state);
        }
        regionOf.set(key, id);
      }
    }

    const portStates = new Map<string, PressureState>();
    for (const [key, id] of regionOf) portStates.set(key, regionStates.get(id)!);

    return { portStates, regionOf, regionStates };
  }
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x));
}
