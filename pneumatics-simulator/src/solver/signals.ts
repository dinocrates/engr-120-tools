/**
 * Control-signal solver (SDD §8, §32; UI_DESIGN_BIBLE §7, §10).
 *
 * A parallel, boolean version of the pneumatic solver: signal ports are
 * partitioned into nets, and a net is *energised* if any member is an active
 * signal source (a pressed electrical button, a tripped sensor). Solenoid coils
 * and lamps read the net state.
 *
 * No explicit power rail — a source component IS the supply while it's active
 * (implicit power model).
 */

import { getDef } from "@/components/defs.ts";
import { nodeKey } from "@/model/geometry.ts";
import type { Circuit, ConnectionEnd } from "@/model/types.ts";
import { UnionFind } from "./unionfind.ts";

export interface SignalInput {
  circuit: Circuit;
  /** componentId -> manual signal source held on (electrical pushbutton) */
  manualOn: Map<string, boolean>;
  /** componentId -> sensor tripped (roller switch / proximity sensor) */
  sensorOn: Map<string, boolean>;
}

/** "component:port" -> energised */
export type SignalStates = Map<string, boolean>;

function isSignalPort(circuit: Circuit, end: ConnectionEnd): boolean {
  const comp = circuit.components.find((c) => c.id === end.component);
  if (!comp) return false;
  return getDef(comp.type).ports.find((p) => p.id === end.port)?.kind === "signal";
}

export function solveSignals({ circuit, manualOn, sensorOn }: SignalInput): SignalStates {
  const uf = new UnionFind();

  for (const c of circuit.components) {
    for (const p of getDef(c.type).ports) {
      if (p.kind === "signal") uf.add(nodeKey(c.id, p.id));
    }
  }

  for (const conn of circuit.connections) {
    if (isSignalPort(circuit, conn.from) && isSignalPort(circuit, conn.to)) {
      uf.union(nodeKey(conn.from.component, conn.from.port), nodeKey(conn.to.component, conn.to.port));
    }
  }

  const energisedRoots = new Set<string>();
  for (const c of circuit.components) {
    const sig = getDef(c.type).signal;
    if (sig?.role !== "source") continue;
    const active = sig.trigger === "manual" ? (manualOn.get(c.id) ?? false) : (sensorOn.get(c.id) ?? false);
    if (active) energisedRoots.add(uf.find(nodeKey(c.id, sig.port)));
  }

  const out: SignalStates = new Map();
  for (const c of circuit.components) {
    for (const p of getDef(c.type).ports) {
      if (p.kind !== "signal") continue;
      const key = nodeKey(c.id, p.id);
      out.set(key, energisedRoots.has(uf.find(key)));
    }
  }
  return out;
}
