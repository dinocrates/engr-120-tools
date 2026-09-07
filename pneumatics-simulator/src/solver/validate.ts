/** Circuit validation (SDD §24). MVP subset. */

import { getDef } from "@/components/defs.ts";
import { nodeKey } from "@/model/geometry.ts";
import type { Circuit } from "@/model/types.ts";

export interface Issue {
  severity: "error" | "warning";
  message: string;
  component?: string;
}

export function validate(circuit: Circuit): Issue[] {
  const issues: Issue[] = [];
  const connected = new Set<string>();
  for (const conn of circuit.connections) {
    connected.add(nodeKey(conn.from.component, conn.from.port));
    connected.add(nodeKey(conn.to.component, conn.to.port));
  }

  const hasSupply = circuit.components.some((c) => getDef(c.type).supply);
  if (circuit.components.length > 0 && !hasSupply) {
    issues.push({ severity: "error", message: "Circuit has no air supply." });
  }

  for (const c of circuit.components) {
    const def = getDef(c.type);
    const name = c.label || def.name;

    if (def.cylinder) {
      for (const portId of [def.cylinder.capPort, def.cylinder.rodPort]) {
        if (!connected.has(nodeKey(c.id, portId))) {
          issues.push({
            severity: "error",
            message: `${name}: port ${portId} is not connected.`,
            component: c.id,
          });
        }
      }
    }

    if (def.valve) {
      const pPort = def.ports.find((p) => p.kind === "pressure");
      if (pPort && !connected.has(nodeKey(c.id, pPort.id))) {
        issues.push({
          severity: "warning",
          message: `${name}: pressure port ${pPort.id} has no supply.`,
          component: c.id,
        });
      }
    }
  }

  return issues;
}
