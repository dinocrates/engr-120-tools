/**
 * Data-driven component definitions (SDD §44).
 *
 * A ComponentDef is pure data describing a component's ports, geometry and
 * behavioral role. The simulation engine reads these; rendering is handled
 * separately by a symbol registry keyed on `type` (SDD §30).
 *
 * Adding a new directional valve (2/2, 3/2, 4/2, 5/3, ...) should be a matter
 * of adding a def here plus a symbol — no engine changes.
 */

import type { PortKind, Vec2 } from "@/model/types.ts";

export interface PortDef {
  id: string;
  kind: PortKind;
  /** Local coordinates, component unrotated, origin at top-left of `size`. */
  offset: Vec2;
  /** Optional ISO 1219 port number / label. */
  label?: string;
}

export interface ValvePositionDef {
  name?: string;
  /** Port id pairs internally connected while the spool is in this position. */
  connections: Array<[string, string]>;
}

export type ActuationKind = "momentary" | "detent" | "toggle";

export interface ComponentDef {
  type: string;
  name: string;
  category: "supply" | "valve" | "actuator" | "flow" | "sensor";
  /** Bounding box in schematic units (px at 1x zoom). */
  size: Vec2;
  ports: PortDef[];
  defaultParams?: Record<string, string | number | boolean>;

  /** Present for directional control valves. */
  valve?: {
    positions: ValvePositionDef[];
    /** Index of the spring / de-actuated rest position. */
    restPosition: number;
  };

  /** How the valve is driven from user input (MVP: manual only). */
  actuation?: {
    kind: ActuationKind;
    /** Position index the valve moves to when actuated. */
    actuatedPosition: number;
    /** Label shown on the on-canvas control. */
    control: string;
  };

  /** Present for cylinders. */
  cylinder?: {
    capPort: string;
    rodPort: string;
    /** true = single-acting spring return. */
    springReturn: boolean;
  };

  /** Present for the air supply. */
  supply?: { port: string };
}

const SUPPLY: ComponentDef = {
  type: "supply",
  name: "Air Supply",
  category: "supply",
  size: { x: 44, y: 52 },
  supply: { port: "P" },
  ports: [{ id: "P", kind: "pressure", offset: { x: 22, y: 52 }, label: "1" }],
};

const VALVE_5_2: ComponentDef = {
  type: "valve_5_2",
  name: "5/2 Valve",
  category: "valve",
  size: { x: 88, y: 52 },
  defaultParams: { actuator: "pushbutton", return: "spring" },
  ports: [
    { id: "A", kind: "working", offset: { x: 26, y: 0 }, label: "4" },
    { id: "B", kind: "working", offset: { x: 62, y: 0 }, label: "2" },
    { id: "S", kind: "exhaust", offset: { x: 14, y: 52 }, label: "5" },
    { id: "P", kind: "pressure", offset: { x: 44, y: 52 }, label: "1" },
    { id: "R", kind: "exhaust", offset: { x: 74, y: 52 }, label: "3" },
  ],
  valve: {
    restPosition: 0,
    positions: [
      { name: "rest", connections: [["P", "B"], ["A", "R"]] },
      { name: "actuated", connections: [["P", "A"], ["B", "S"]] },
    ],
  },
  actuation: { kind: "momentary", actuatedPosition: 1, control: "PB" },
};

const CYLINDER_DA: ComponentDef = {
  type: "cylinder_da",
  name: "Double-Acting Cylinder",
  category: "actuator",
  size: { x: 160, y: 40 },
  defaultParams: { stroke: 1, extendSpeed: 0.6, retractSpeed: 0.6 },
  cylinder: { capPort: "A", rodPort: "B", springReturn: false },
  ports: [
    { id: "A", kind: "working", offset: { x: 14, y: 40 } },
    { id: "B", kind: "working", offset: { x: 70, y: 40 } },
  ],
};

export const COMPONENT_DEFS: Record<string, ComponentDef> = {
  [SUPPLY.type]: SUPPLY,
  [VALVE_5_2.type]: VALVE_5_2,
  [CYLINDER_DA.type]: CYLINDER_DA,
};

/** Order shown in the library palette. */
export const LIBRARY_ORDER: string[] = [SUPPLY.type, VALVE_5_2.type, CYLINDER_DA.type];

export function getDef(type: string): ComponentDef {
  const def = COMPONENT_DEFS[type];
  if (!def) throw new Error(`Unknown component type: ${type}`);
  return def;
}
