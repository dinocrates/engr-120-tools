/**
 * Component definitions (SDD §7, §44; UI_DESIGN_BIBLE §8).
 *
 * Geometry, ports, viewBoxes and valve truth tables come straight from the UI
 * kit's `manifest.json` — this module adds only the *engine-facing* behaviour
 * the manifest doesn't describe: actuation style, cylinder spring return,
 * supply / exhaust roles, default parameters.
 *
 * Adding a component that the kit already ships (flow control, check valve,
 * regulator, gauge, limit valve, signal glyphs) is a matter of adding an entry
 * to `BEHAVIOURS` below plus whatever solver support it needs.
 */

import { kitComponent, manifest, type KitComponent, type KitView } from "@/kit/manifest.ts";
import type { Vec2 } from "@/model/types.ts";

export interface PortDef {
  id: string;
  kind: "air" | "signal";
  offset: Vec2;
}

export interface ValvePositionDef {
  /** state name — also selects the artwork (`rest`, `actuated`, ...) */
  name: string;
  /** port id pairs internally connected in this spool position */
  connections: Array<[string, string]>;
  /** ports sealed in this position (display / validation only) */
  blocked: string[];
}

export interface ComponentDef {
  type: string;
  name: string;
  category: string;
  viewBox: [number, number, number, number];
  size: Vec2;
  ports: PortDef[];
  defaultView: KitView;
  defaultState: string;
  defaultParams: Record<string, string | number | boolean>;

  valve?: {
    positions: ValvePositionDef[];
    restPosition: number;
  };
  actuation?: {
    kind: "momentary" | "detent";
    actuatedPosition: number;
    control: string;
  };
  cylinder?: {
    capPort: string;
    /** absent for single-acting (spring return) cylinders */
    rodPort?: string;
    springReturn: boolean;
  };
  supply?: { port: string };
  exhaust?: { port: string };
  gauge?: { pivot: [number, number] };
}

interface Behaviour {
  actuation?: ComponentDef["actuation"];
  cylinder?: ComponentDef["cylinder"];
  supply?: ComponentDef["supply"];
  exhaust?: ComponentDef["exhaust"];
  gauge?: ComponentDef["gauge"];
  defaultParams?: Record<string, string | number | boolean>;
}

/** Engine behaviour, keyed by kit component id. Only listed components are usable. */
const BEHAVIOURS: Record<string, Behaviour> = {
  "air-supply": { supply: { port: "1" }, defaultParams: { pressure: 600 } },
  exhaust: { exhaust: { port: "1" } },
  "valve-5-2": {
    actuation: { kind: "momentary", actuatedPosition: 1, control: "Pushbutton" },
    defaultParams: { return: "spring" },
  },
  "valve-3-2-nc": {
    actuation: { kind: "momentary", actuatedPosition: 1, control: "Pushbutton" },
    defaultParams: { return: "spring" },
  },
  "cylinder-double": {
    cylinder: { capPort: "cap", rodPort: "rod", springReturn: false },
    defaultParams: { stroke: 200, extendSpeed: 0.55, retractSpeed: 0.55 },
  },
  "cylinder-single": {
    cylinder: { capPort: "cap", springReturn: true },
    defaultParams: { stroke: 160, extendSpeed: 0.6, retractSpeed: 0.9 },
  },
};

/** Order shown in the library palette. */
export const LIBRARY_ORDER: string[] = [
  "air-supply",
  "exhaust",
  "valve-3-2-nc",
  "valve-5-2",
  "cylinder-single",
  "cylinder-double",
];

function buildDef(kit: KitComponent, b: Behaviour): ComponentDef {
  const [, , w, h] = kit.viewBox;

  let valve: ComponentDef["valve"];
  if (kit.connections) {
    const states = [kit.defaultState, ...Object.keys(kit.connections).filter((s) => s !== kit.defaultState)];
    valve = {
      restPosition: 0,
      positions: states.map((name) => ({
        name,
        connections: kit.connections![name] ?? [],
        blocked: kit.blocked?.[name] ?? [],
      })),
    };
  }

  return {
    type: kit.id,
    name: kit.label,
    category: kit.category,
    viewBox: kit.viewBox,
    size: { x: w, y: h },
    ports: kit.ports.map((p) => ({ id: p.id, kind: p.kind, offset: { x: p.x, y: p.y } })),
    defaultView: manifest.defaultView,
    defaultState: kit.defaultState,
    defaultParams: b.defaultParams ?? {},
    ...(valve ? { valve } : {}),
    ...(b.actuation ? { actuation: b.actuation } : {}),
    ...(b.cylinder ? { cylinder: b.cylinder } : {}),
    ...(b.supply ? { supply: b.supply } : {}),
    ...(b.exhaust ? { exhaust: b.exhaust } : {}),
    ...(b.gauge ? { gauge: b.gauge } : {}),
  };
}

export const COMPONENT_DEFS: Record<string, ComponentDef> = Object.fromEntries(
  Object.entries(BEHAVIOURS).map(([id, b]) => [id, buildDef(kitComponent(id), b)]),
);

export function getDef(type: string): ComponentDef {
  const def = COMPONENT_DEFS[type];
  if (!def) throw new Error(`Unknown / unsupported component type: ${type}`);
  return def;
}

export function isSupported(type: string): boolean {
  return type in COMPONENT_DEFS;
}
