/**
 * Typed view of the UI kit's manifest.json (kit v1.1.0).
 *
 * The manifest is the canonical source for component IDs, port IDs + geometry,
 * viewBoxes, rotation, valve truth tables, and asset paths (UI_DESIGN_BIBLE §3,
 * §8, §44). Engine and renderer both read from here.
 */

import raw from "./manifest.json";

export type KitView = "symbol" | "component";
export type KitPortKind = "air" | "signal";

export interface KitPort {
  id: string;
  x: number;
  y: number;
  kind: KitPortKind;
}

export interface KitAssembly {
  body: string;
  piston: string;
  viewBox: [number, number, number, number];
  drawOrder: string[];
  pistonTranslation: [number, number];
  spring: "procedural" | null;
}

export interface KitComponent {
  id: string;
  label: string;
  category: string;
  viewBox: [number, number, number, number];
  defaultState: string;
  ports: KitPort[];
  assets: Record<string, Record<KitView, string>>;
  symbolStatus: string;
  connections?: Record<string, Array<[string, string]>>;
  blocked?: Record<string, string[]>;
  animation?: {
    field: string;
    min?: number;
    max?: number;
    travelViewBoxUnits?: number;
    movingParts?: string[];
    needlePivot?: [number, number];
    rotationDegrees?: [number, number];
    note?: string;
  };
  assembly?: Record<KitView, KitAssembly>;
  direction?: { freeFlow: [string, string]; reverse: string };
}

export interface KitManifest {
  version: string;
  coordinateSystem: string;
  defaultView: KitView;
  components: KitComponent[];
  icons: Record<string, string>;
  tubing: {
    states: Record<string, { color: string; dash: string }>;
    shapes: string[];
    note: string;
  };
  brand: { header: string; compact: string; displayFont: string };
}

export const manifest = raw as unknown as KitManifest;

const byId = new Map(manifest.components.map((c) => [c.id, c]));

export function kitComponent(id: string): KitComponent {
  const c = byId.get(id);
  if (!c) throw new Error(`No manifest entry for component "${id}"`);
  return c;
}

export function hasKitComponent(id: string): boolean {
  return byId.has(id);
}
