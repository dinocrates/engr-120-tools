/** Circuit validation (SDD §24; UI_DESIGN_BIBLE §11, §24). */

import { getDef, isSupported } from "@/components/defs.ts";
import { nodeKey } from "@/model/geometry.ts";
import type { Circuit } from "@/model/types.ts";

export interface Issue {
  severity: "error" | "warning";
  message: string;
  component?: string;
}

const VALVE_SUPPLY_PORT = "1";

export function validate(circuit: Circuit): Issue[] {
  const issues: Issue[] = [];
  const connected = new Set<string>();
  for (const conn of circuit.connections) {
    connected.add(nodeKey(conn.from.component, conn.from.port));
    connected.add(nodeKey(conn.to.component, conn.to.port));
  }
  const isConn = (c: string, p: string): boolean => connected.has(nodeKey(c, p));

  if (circuit.components.length > 0 && !circuit.components.some((c) => getDef(c.type).supply)) {
    issues.push({ severity: "error", message: "Circuit has no air supply." });
  }

  for (const c of circuit.components) {
    const name = c.label || c.type;

    if (!isSupported(c.type)) {
      issues.push({ severity: "error", message: `${name}: unsupported component type "${c.type}".`, component: c.id });
      continue;
    }

    const def = getDef(c.type);

    if (def.cylinder) {
      for (const port of [def.cylinder.capPort, def.cylinder.rodPort].filter(Boolean) as string[]) {
        if (!isConn(c.id, port)) {
          issues.push({ severity: "error", message: `${name}: port ${port} is not connected.`, component: c.id });
        }
      }
    }

    if (def.valve) {
      if (!isConn(c.id, VALVE_SUPPLY_PORT)) {
        issues.push({
          severity: "warning",
          message: `${name}: supply port ${VALVE_SUPPLY_PORT} has no pressure source.`,
          component: c.id,
        });
      }
      if (def.actuation?.kind === "pilot") {
        for (const p of [def.actuation.pilotActuate, def.actuation.pilotRest].filter(Boolean) as string[]) {
          if (!isConn(c.id, p)) {
            issues.push({
              severity: "warning",
              message: `${name}: pilot port ${p} is not connected — the spool can't be shifted that way.`,
              component: c.id,
            });
          }
        }
      }
    }

    if (def.trigger && !c.params.triggerCylinder) {
      issues.push({
        severity: "warning",
        message: `${name}: no trigger cylinder chosen — set it in the inspector.`,
        component: c.id,
      });
    }

    if ((def.flowControl || def.checkValve) && (!isConn(c.id, "1") || !isConn(c.id, "2"))) {
      issues.push({ severity: "warning", message: `${name}: only one side is connected.`, component: c.id });
    }
  }

  return issues;
}
