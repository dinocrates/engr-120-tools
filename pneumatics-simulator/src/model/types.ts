/**
 * Diagram data model. Pure data — no rendering, no simulation state.
 * This is what gets serialized to JSON (see SDD §28).
 */

export interface Vec2 {
  x: number;
  y: number;
}

export type Rotation = 0 | 90 | 180 | 270;

/** SDD §8 — port kinds. Only a subset is used by the MVP. */
export type PortKind =
  | "pressure"
  | "working"
  | "exhaust"
  | "pilot"
  | "mechanical"
  | "electrical";

/** A placed component. `type` refers to a ComponentDef in the library. */
export interface ComponentInstance {
  id: string;
  type: string;
  position: Vec2;
  rotation: Rotation;
  label?: string;
  /** Component-specific configuration, e.g. { stroke: 1.2, actuator: "pushbutton" }. */
  params: Record<string, string | number | boolean>;
}

export interface ConnectionEnd {
  component: string;
  port: string;
}

export interface Connection {
  id: string;
  from: ConnectionEnd;
  to: ConnectionEnd;
}

export interface Circuit {
  version: 1;
  components: ComponentInstance[];
  connections: Connection[];
}

export function emptyCircuit(): Circuit {
  return { version: 1, components: [], connections: [] };
}
