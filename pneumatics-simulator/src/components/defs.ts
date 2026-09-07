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
    /**
     * momentary  — held (canvas) or latched (panel)
     * detent     — latched only
     * pilot      — pneumatic pressure at a pilot port shifts the spool
     * solenoid   — an energised control signal shifts the spool
     * mechanical — tripped by a cylinder reaching a position (limit valve)
     */
    kind: "momentary" | "detent" | "pilot" | "solenoid" | "mechanical";
    actuatedPosition: number;
    restPosition?: number;
    control: string;
    /** pilot: air port whose pressure drives the spool to `actuatedPosition` */
    pilotActuate?: string;
    /** pilot: air port whose pressure drives it back to `restPosition` */
    pilotRest?: string;
    /** solenoid: signal port whose energised state drives to `actuatedPosition` */
    signalActuate?: string;
    /** solenoid: signal port whose energised state drives back to `restPosition` */
    signalRest?: string;
    /** hold the last position when neither drive is active (bistable) */
    bistable?: boolean;
  };
  /** mechanically-triggered by a cylinder reaching a position (limit valve,
   *  roller switch, proximity sensor). Instance params say which cylinder. */
  trigger?: true;
  /** control-signal role (electro-pneumatic layer). */
  signal?: {
    role: "source" | "sink";
    port: string;
    /** source: what makes it active */
    trigger?: "manual" | "cylinder";
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
  /** one-way flow control — meters the exhausting direction (UI_DESIGN_BIBLE §16) */
  flowControl?: { oneWay: boolean };
  /** check valve — free flow inPort -> outPort, reverse blocked (SDD §17) */
  checkValve?: { inPort: string; outPort: string };
}

interface Behaviour {
  actuation?: ComponentDef["actuation"];
  trigger?: true;
  signal?: ComponentDef["signal"];
  cylinder?: ComponentDef["cylinder"];
  supply?: ComponentDef["supply"];
  exhaust?: ComponentDef["exhaust"];
  gauge?: ComponentDef["gauge"];
  flowControl?: ComponentDef["flowControl"];
  checkValve?: ComponentDef["checkValve"];
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
  "valve-5-2-pp": {
    actuation: {
      kind: "pilot",
      actuatedPosition: 1,
      restPosition: 0,
      control: "Double pilot",
      pilotActuate: "14",
      pilotRest: "12",
      bistable: true,
    },
  },
  "limit-valve": {
    actuation: { kind: "mechanical", actuatedPosition: 1, restPosition: 0, control: "Roller" },
    trigger: true,
    defaultParams: { triggerAt: 95, triggerEdge: "extend" },
  },
  "cylinder-double": {
    cylinder: { capPort: "cap", rodPort: "rod", springReturn: false },
    defaultParams: { stroke: 200, extendSpeed: 0.55, retractSpeed: 0.55 },
  },
  "cylinder-single": {
    cylinder: { capPort: "cap", springReturn: true },
    defaultParams: { stroke: 160, extendSpeed: 0.6, retractSpeed: 0.9 },
  },
  "flow-control-one-way": {
    flowControl: { oneWay: true },
    defaultParams: { restriction: 60 },
  },
  "check-valve": {
    checkValve: { inPort: "1", outPort: "2" },
  },

  /* electro-pneumatic layer (UI_DESIGN_BIBLE §7) */
  pushbutton: {
    signal: { role: "source", port: "out", trigger: "manual" },
  },
  "roller-switch": {
    signal: { role: "source", port: "out", trigger: "cylinder" },
    trigger: true,
    defaultParams: { triggerAt: 95, triggerEdge: "extend" },
  },
  "proximity-sensor": {
    signal: { role: "source", port: "out", trigger: "cylinder" },
    trigger: true,
    defaultParams: { triggerAt: 95, triggerEdge: "extend" },
  },
  "signal-lamp": {
    signal: { role: "sink", port: "in" },
  },
  "solenoid-3-2": {
    actuation: {
      kind: "solenoid",
      actuatedPosition: 1,
      restPosition: 0,
      control: "Solenoid",
      signalActuate: "a",
    },
    defaultParams: { return: "spring" },
  },
  "solenoid-5-2": {
    actuation: {
      kind: "solenoid",
      actuatedPosition: 1,
      restPosition: 0,
      control: "Solenoid",
      signalActuate: "a",
    },
    defaultParams: { return: "spring" },
  },
  "solenoid-5-2-dd": {
    actuation: {
      kind: "solenoid",
      actuatedPosition: 1,
      restPosition: 0,
      control: "Double solenoid",
      signalActuate: "a",
      signalRest: "b",
      bistable: true,
    },
  },
};

/** Order shown in the library palette. */
export const LIBRARY_ORDER: string[] = [
  "air-supply",
  "exhaust",
  "valve-3-2-nc",
  "valve-5-2",
  "valve-5-2-pp",
  "limit-valve",
  "flow-control-one-way",
  "check-valve",
  "cylinder-single",
  "cylinder-double",
  "solenoid-3-2",
  "solenoid-5-2",
  "solenoid-5-2-dd",
  "pushbutton",
  "roller-switch",
  "proximity-sensor",
  "signal-lamp",
];

/** Manual-operator components a student can toggle in the control panel. */
export function isManuallyOperable(def: ComponentDef): boolean {
  return (
    def.actuation?.kind === "momentary" ||
    def.actuation?.kind === "detent" ||
    def.signal?.trigger === "manual"
  );
}

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
    ...(b.trigger ? { trigger: true as const } : {}),
    ...(b.signal ? { signal: b.signal } : {}),
    ...(b.cylinder ? { cylinder: b.cylinder } : {}),
    ...(b.supply ? { supply: b.supply } : {}),
    ...(b.exhaust ? { exhaust: b.exhaust } : {}),
    ...(b.gauge ? { gauge: b.gauge } : {}),
    ...(b.flowControl ? { flowControl: b.flowControl } : {}),
    ...(b.checkValve ? { checkValve: b.checkValve } : {}),
  };
}

export const COMPONENT_DEFS: Record<string, ComponentDef> = Object.fromEntries(
  Object.entries(BEHAVIOURS).map(([id, b]) => [id, buildDef(kitComponent(id), b)]),
);

const unknownDefs = new Map<string, ComponentDef>();

/** Never throws — an unknown type gets a neutral placeholder def so a circuit
 *  referencing it still loads (UI_DESIGN_BIBLE §11). */
export function getDef(type: string): ComponentDef {
  const def = COMPONENT_DEFS[type];
  if (def) return def;
  let u = unknownDefs.get(type);
  if (!u) {
    const kit = kitComponent(type);
    const [, , w, h] = kit.viewBox;
    u = {
      type,
      name: type,
      category: "Unknown",
      viewBox: kit.viewBox,
      size: { x: w, y: h },
      ports: [],
      defaultView: "symbol",
      defaultState: "default",
      defaultParams: {},
    };
    unknownDefs.set(type, u);
  }
  return u;
}

export function isSupported(type: string): boolean {
  return type in COMPONENT_DEFS;
}
