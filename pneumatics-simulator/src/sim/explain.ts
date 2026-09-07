/**
 * Explain mode (SDD §26; UI_DESIGN_BIBLE §12). Turns the current solved state
 * into a plain-language causal chain for one selected component or connection.
 *
 * Reads only from the circuit model and the engine's RuntimeState — no physics
 * here. Traces are shallow (a few hops) and degrade gracefully on circuits it
 * can't fully narrate.
 */

import { getDef, type ComponentDef } from "@/components/defs.ts";
import { nodeKey } from "@/model/geometry.ts";
import type { Circuit } from "@/model/types.ts";
import type { RuntimeState } from "./engine.ts";
import type { PressureState } from "@/solver/solver.ts";

export interface Explanation {
  headline: string;
  steps: string[];
}

const STATE_PHRASE: Record<PressureState, string> = {
  PRESSURIZED: "pressurised",
  EXHAUSTING: "venting to exhaust",
  TRAPPED: "holding trapped air",
  UNPRESSURIZED: "at atmospheric pressure",
  SHORT: "short-circuited to exhaust",
};

export function explain(circuit: Circuit, rt: RuntimeState, id: string): Explanation | null {
  const comp = circuit.components.find((c) => c.id === id);
  if (comp) return explainComponent(circuit, rt, comp.id);

  const conn = circuit.connections.find((c) => c.id === id);
  if (conn) {
    const s = rt.connStates.get(conn.id) ?? "UNPRESSURIZED";
    const from = `${labelOf(circuit, conn.from.component)} · ${conn.from.port}`;
    const to = `${labelOf(circuit, conn.to.component)} · ${conn.to.port}`;
    return {
      headline: `This line is ${STATE_PHRASE[s]}.`,
      steps: [
        `It links ${from} and ${to}.`,
        traceRegion(circuit, rt, conn.from.component, conn.from.port, 3),
      ],
    };
  }
  return null;
}

function explainComponent(circuit: Circuit, rt: RuntimeState, id: string): Explanation | null {
  const comp = circuit.components.find((c) => c.id === id)!;
  const def = getDef(comp.type);
  const name = comp.label ?? def.name;

  if (def.cylinder) return explainCylinder(circuit, rt, id);
  if (def.valve) return explainValve(circuit, rt, id);

  if (def.supply) {
    const on = rt.supplyOn.get(id) ?? true;
    const p = Number(comp.params.pressure ?? 600);
    return {
      headline: on ? `${name} is supplying ${p} kPa.` : `${name} is turned off.`,
      steps: on
        ? ["Everything it feeds through open valve paths is pressurised."]
        : ["No air reaches the circuit. Turn it on in the control panel."],
    };
  }

  if (def.exhaust) {
    return {
      headline: `${name} vents air to atmosphere.`,
      steps: ["Anything connected to it through an open path reads as venting."],
    };
  }

  if (def.checkValve) {
    const open = rt.checkOpen.get(id) ?? true;
    return {
      headline: `${name} is ${open ? "open" : "closed"}.`,
      steps: open
        ? [`Upstream (port ${def.checkValve.inPort}) pressure is pushing forward through it.`]
        : [
            `Downstream (port ${def.checkValve.outPort}) pressure is higher than upstream,`,
            "so it seals and holds that pressure — reverse flow is blocked.",
          ],
    };
  }

  if (def.flowControl) {
    const r = Math.max(0, Math.min(100, Number(comp.params.restriction ?? 60)));
    return {
      headline: `${name} is restricting flow to ${r}%.`,
      steps: [
        `Any cylinder moving air through this line runs at about ${Math.round((1 - r / 100) * 100)}% speed.`,
        "The check-valve side lets the other direction flow freely.",
      ],
    };
  }

  if (def.signal?.role === "sink") {
    const on = rt.signalStates.get(nodeKey(id, def.signal.port)) ?? false;
    return {
      headline: `${name} is ${on ? "lit" : "off"}.`,
      steps: [on ? "Its signal line is energised." : "Its signal line has no power."],
    };
  }

  if (def.signal?.role === "source") {
    const on = rt.signalStates.get(nodeKey(id, def.signal.port)) ?? false;
    if (def.signal.trigger === "manual") {
      return {
        headline: `${name} is ${on ? "pressed" : "released"}.`,
        steps: [on ? "It is energising its output signal." : "Its output signal is off."],
      };
    }
    const cyl = String(comp.params.triggerCylinder || "its cylinder");
    const at = Number(comp.params.triggerAt ?? 95);
    const now = Math.round((rt.cylinderPos.get(String(comp.params.triggerCylinder || "")) ?? 0) * 100);
    return {
      headline: `${name} is ${on ? "triggered" : "clear"}.`,
      steps: [
        on
          ? `${cyl} has reached ${now}% (trigger ${at}%), so it energises its output signal.`
          : `${cyl} is at ${now}%, short of the ${at}% trigger.`,
      ],
    };
  }

  return { headline: `${name}.`, steps: [`Type: ${def.name}.`] };
}

/* --------------------------------------------------------------- cylinder */

function explainCylinder(circuit: Circuit, rt: RuntimeState, id: string): Explanation {
  const comp = circuit.components.find((c) => c.id === id)!;
  const def = getDef(comp.type);
  const name = comp.label ?? def.name;
  const dir = rt.cylinderDir.get(id) ?? "holding";
  const pos = Math.round((rt.cylinderPos.get(id) ?? 0) * 100);

  const capPort = def.cylinder!.capPort;
  const rodPort = def.cylinder!.rodPort;
  const cap = rt.portStates.get(nodeKey(id, capPort)) ?? "UNPRESSURIZED";
  const rod = rodPort ? rt.portStates.get(nodeKey(id, rodPort)) ?? "UNPRESSURIZED" : "UNPRESSURIZED";

  const steps: string[] = [
    `Cap side (${capPort}) is ${STATE_PHRASE[cap]} — ${traceRegion(circuit, rt, id, capPort, 3)}.`,
  ];
  if (rodPort) {
    steps.push(`Rod side (${rodPort}) is ${STATE_PHRASE[rod]} — ${traceRegion(circuit, rt, id, rodPort, 3)}.`);
  } else {
    steps.push("A return spring pushes the rod back whenever the cap side isn't pressurised.");
  }

  let headline: string;
  if (dir === "extending") {
    headline = `${name} is extending (${pos}%).`;
    steps.push("Cap pressure drives the piston out while the other side vents.");
  } else if (dir === "retracting") {
    headline = `${name} is retracting (${pos}%).`;
    steps.push(
      def.cylinder!.springReturn
        ? "With no cap pressure the spring pulls the rod back in."
        : "Rod pressure drives the piston back while the cap side vents.",
    );
  } else {
    headline = `${name} is holding at ${pos}%.`;
    if (pos >= 100) steps.push("It has reached the end of its stroke.");
    else if (pos <= 0) steps.push("It is fully retracted.");
    else steps.push("Neither side has a clear pressure advantage, so it stays put.");
  }
  return { headline, steps };
}

/* ------------------------------------------------------------------ valve */

function explainValve(circuit: Circuit, rt: RuntimeState, id: string): Explanation {
  const comp = circuit.components.find((c) => c.id === id)!;
  const def = getDef(comp.type);
  const name = comp.label ?? def.name;
  const idx = rt.valvePositions.get(id) ?? def.valve!.restPosition;
  const position = def.valve!.positions[idx] ?? def.valve!.positions[def.valve!.restPosition]!;

  const steps: string[] = [`Because ${whyValve(rt, comp.id, comp.params, def)}.`];
  const paths = position.connections.map(([a, b]) => `${a}→${b}`).join(", ");
  steps.push(paths ? `In this position it connects ${paths}.` : "In this position all ports are blocked.");
  if (position.blocked.length === 1) steps.push(`Port ${position.blocked[0]} is sealed.`);
  else if (position.blocked.length > 1) steps.push(`Ports ${position.blocked.join(", ")} are sealed.`);

  return { headline: `${name} is in the ${position.name} position.`, steps };
}

function whyValve(
  rt: RuntimeState,
  id: string,
  params: Record<string, string | number | boolean>,
  def: ComponentDef,
): string {
  const a = def.actuation;
  if (!a) return "of its fixed configuration";

  switch (a.kind) {
    case "momentary":
    case "detent":
      if (rt.latched.get(id)) return "it is latched on in the control panel";
      if (rt.inputs.get(id)) return "its button is held down";
      return "its button is released and the spring returns it to rest";
    case "mechanical": {
      const cyl = String(params.triggerCylinder || "its cylinder");
      const at = Number(params.triggerAt ?? 95);
      const now = Math.round((rt.cylinderPos.get(String(params.triggerCylinder || "")) ?? 0) * 100);
      return rt.sensorTripped.get(id)
        ? `${cyl} has reached ${now}% and tripped the roller (trigger ${at}%)`
        : `${cyl} is at ${now}%, below the ${at}% trigger, so the roller is clear`;
    }
    case "pilot": {
      const pa = a.pilotActuate && rt.portStates.get(nodeKey(id, a.pilotActuate)) === "PRESSURIZED";
      const pr = a.pilotRest && rt.portStates.get(nodeKey(id, a.pilotRest)) === "PRESSURIZED";
      if (pa) return `pilot port ${a.pilotActuate} is pressurised`;
      if (pr) return `pilot port ${a.pilotRest} is pressurised`;
      return a.bistable
        ? "neither pilot is pressurised, so it holds its last position"
        : "neither pilot is pressurised, so it springs back to rest";
    }
    case "solenoid": {
      const sa = a.signalActuate && rt.signalStates.get(nodeKey(id, a.signalActuate));
      const sr = a.signalRest && rt.signalStates.get(nodeKey(id, a.signalRest));
      if (sa) return `solenoid ${a.signalActuate} is energised`;
      if (sr) return `solenoid ${a.signalRest} is energised`;
      return a.bistable
        ? "neither solenoid is energised, so it holds its last position"
        : "its solenoid is de-energised, so the spring returns it to rest";
    }
  }
}

/* ------------------------------------------------------------ region trace */

function traceRegion(
  circuit: Circuit,
  rt: RuntimeState,
  fromComp: string,
  fromPort: string,
  depth: number,
): string {
  const region = rt.regionOf.get(nodeKey(fromComp, fromPort));
  if (region == null) return "it isn't connected to anything";

  const members: Array<{ id: string; port: string; def: ComponentDef }> = [];
  for (const c of circuit.components) {
    for (const p of getDef(c.type).ports) {
      if (p.kind !== "air") continue;
      if (c.id === fromComp && p.id === fromPort) continue;
      if (rt.regionOf.get(nodeKey(c.id, p.id)) === region) {
        members.push({ id: c.id, port: p.id, def: getDef(c.type) });
      }
    }
  }

  const src = members.find((m) => m.def.supply?.port === m.port && (rt.supplyOn.get(m.id) ?? true));
  if (src) return `fed by ${labelOf(circuit, src.id)}`;

  const exh = members.find((m) => m.def.exhaust?.port === m.port);
  if (exh) return `open to atmosphere through ${labelOf(circuit, exh.id)}`;

  const vp = members.find((m) => m.def.valve && !m.def.supply);
  if (vp) {
    const vIdx = rt.valvePositions.get(vp.id) ?? vp.def.valve!.restPosition;
    const vPos = vp.def.valve!.positions[vIdx]!;
    const pair = vPos.connections.find(([x, y]) => x === vp.port || y === vp.port);
    const vName = labelOf(circuit, vp.id);
    if (!pair) return `blocked at ${vName} port ${vp.port} (${vPos.name} position)`;
    const other = pair[0] === vp.port ? pair[1] : pair[0];
    const tail =
      depth > 0 ? `, and ${traceRegion(circuit, rt, vp.id, other, depth - 1)}` : "";
    return `routed through ${vName} port ${vp.port} from port ${other}${tail}`;
  }

  const cyl = members.find((m) => m.def.cylinder);
  if (cyl) return `shared with ${labelOf(circuit, cyl.id)}`;

  return "in a closed region with no path to supply or exhaust";
}

function labelOf(circuit: Circuit, id: string): string {
  const c = circuit.components.find((x) => x.id === id);
  return c?.label ?? id;
}
