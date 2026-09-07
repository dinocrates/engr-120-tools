/** Circuit validation (SDD §24; UI_DESIGN_BIBLE §11, §24). */

import { getDef } from "@/components/defs.ts";
import { nodeKey } from "@/model/geometry.ts";
import type { Circuit } from "@/model/types.ts";

export interface Issue {
  severity: "error" | "warning";
  message: string;
  component?: string;
}

/** Valve air-supply port id, per the manifest (Festo port 1). */
const VALVE_SUPPLY_PORT = "1";

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
      const ports = [def.cylinder.capPort, def.cylinder.rodPort].filter(Boolean) as string[];
      for (const portId of ports) {
        if (!connected.has(nodeKey(c.id, portId))) {
          issues.push({
            severity: "error",
            message: `${name}: port ${portId} is not connected.`,
            component: c.id,
          });
        }
      }
    }

    if (def.valve && !connected.has(nodeKey(c.id, VALVE_SUPPLY_PORT))) {
      issues.push({
        severity: "warning",
        message: `${name}: supply port ${VALVE_SUPPLY_PORT} has no pressure source.`,
        component: c.id,
      });
    }
  }

  return issues;
}
