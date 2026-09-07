/**
 * Control-signal solver (SDD §8, §32; UI_DESIGN_BIBLE §7, §10).
 *
 * A boolean version of the pneumatic solver. Single-rail model: a DC supply has
 * one output terminal (24 V present), the common 0 V is implied. A net is
 * *energised* if it connects — through closed contacts — back to an on supply.
 *
 * - source  : DC / current supply. Its output net is live while the supply is on.
 * - contact : pushbutton, roller switch, proximity sensor. Passes the signal
 *             `in` <-> `out` while closed (pressed or cylinder-triggered).
 * - sink    : solenoid coil, lamp. Reads whether its net is energised.
 */

import { getDef } from "@/components/defs.ts";
import { nodeKey } from "@/model/geometry.ts";
import type { Circuit, ConnectionEnd } from "@/model/types.ts";
import { UnionFind } from "./unionfind.ts";

export interface SignalInput {
  circuit: Circuit;
  /** componentId -> a manual contact is held closed (pushbutton pressed) */
  manualOn: Map<string, boolean>;
  /** componentId -> a sensor contact is closed (roller switch / proximity tripped) */
  sensorOn: Map<string, boolean>;
  /** supply componentId -> switched on (shared with the pneumatic supply map) */
  supplyOn: Map<string, boolean>;
}

/** "component:port" -> energised */
export type SignalStates = Map<string, boolean>;

function isSignalPort(circuit: Circuit, end: ConnectionEnd): boolean {
  const comp = circuit.components.find((c) => c.id === end.component);
  if (!comp) return false;
  return getDef(comp.type).ports.find((p) => p.id === end.port)?.kind === "signal";
}

export function solveSignals({ circuit, manualOn, sensorOn, supplyOn }: SignalInput): SignalStates {
  const uf = new UnionFind();

  for (const c of circuit.components) {
    for (const p of getDef(c.type).ports) {
      if (p.kind === "signal") uf.add(nodeKey(c.id, p.id));
    }
  }

  // external signal wiring
  for (const conn of circuit.connections) {
    if (isSignalPort(circuit, conn.from) && isSignalPort(circuit, conn.to)) {
      uf.union(nodeKey(conn.from.component, conn.from.port), nodeKey(conn.to.component, conn.to.port));
    }
  }

  // closed contacts pass the signal through
  for (const c of circuit.components) {
    const sig = getDef(c.type).signal;
    if (sig?.role !== "contact" || !sig.inPort || !sig.outPort) continue;
    const closed = sig.closedBy === "cylinder" ? (sensorOn.get(c.id) ?? false) : (manualOn.get(c.id) ?? false);
    if (closed !== Boolean(sig.normallyClosed)) {
      uf.union(nodeKey(c.id, sig.inPort), nodeKey(c.id, sig.outPort));
    }
  }

  // live nets: those touching an on supply's output
  const liveRoots = new Set<string>();
  for (const c of circuit.components) {
    const sig = getDef(c.type).signal;
    if (sig?.role !== "source" || !sig.port) continue;
    if (supplyOn.get(c.id) ?? true) liveRoots.add(uf.find(nodeKey(c.id, sig.port)));
  }

  const out: SignalStates = new Map();
  for (const c of circuit.components) {
    for (const p of getDef(c.type).ports) {
      if (p.kind !== "signal") continue;
      const key = nodeKey(c.id, p.id);
      out.set(key, liveRoots.has(uf.find(key)));
    }
  }
  return out;
}
