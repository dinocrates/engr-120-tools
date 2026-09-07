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

const base = raw as unknown as KitManifest;

/**
 * Local component additions — kept here rather than edited into the vendored
 * `manifest.json` so kit updates stay a clean drop-in. Entries here with the
 * same id as a base component override it (byId keeps the last). Art lives under
 * `assets/` like everything else (mostly generated from the base valve art).
 */
const AIR = "air" as const;
const SIG = "signal" as const;

const statusTeach = "teaching schematic; review before standards-controlled publication";
const glyphAssets = (id: string, states: string[]): KitComponent["assets"] =>
  Object.fromEntries(
    states.map((s) => [s, { symbol: `assets/symbols/${id}--${s}.svg`, component: `assets/components/${id}--${s}.svg` }]),
  );

/** electro-pneumatic: a signal source (single-rail DC supply). */
const source = (id: string, label: string): KitComponent => ({
  id,
  label,
  category: "Electrical",
  viewBox: [0, 0, 192, 128],
  defaultState: "default",
  ports: [{ id: "out", x: 96, y: 112, kind: SIG }],
  assets: glyphAssets(id, ["default"]),
  symbolStatus: statusTeach,
});

/** electro-pneumatic: a pass-through contact (in -> out when closed). */
const contact = (id: string, label: string, category: string): KitComponent => ({
  id,
  label,
  category,
  viewBox: [0, 0, 192, 128],
  defaultState: "rest",
  ports: [
    { id: "in", x: 96, y: 12, kind: SIG },
    { id: "out", x: 96, y: 112, kind: SIG },
  ],
  assets: glyphAssets(id, ["rest", "actuated"]),
  symbolStatus: "functional control glyph; not an electrical wiring symbol",
});

const EXTRA_COMPONENTS: KitComponent[] = [
  source("dc-supply", "DC voltage source"),
  source("current-source", "DC current source"),
  contact("pushbutton", "Pushbutton contact", "Electrical"),
  contact("roller-switch", "Roller switch contact", "Sensors"),
  contact("proximity-sensor", "Proximity sensor contact", "Sensors"),
  {
    id: "valve-5-2-pp",
    label: "5/2 valve · double pilot",
    category: "Directional valves",
    viewBox: [0, 0, 192, 128],
    defaultState: "rest",
    ports: [
      { id: "4", x: 108, y: 16, kind: "air" },
      { id: "2", x: 132, y: 16, kind: "air" },
      { id: "5", x: 100, y: 112, kind: "air" },
      { id: "1", x: 120, y: 112, kind: "air" },
      { id: "3", x: 140, y: 112, kind: "air" },
      { id: "14", x: 8, y: 64, kind: "air" },
      { id: "12", x: 184, y: 64, kind: "air" },
    ],
    assets: {
      rest: {
        symbol: "assets/symbols/valve-5-2-pp--rest.svg",
        component: "assets/components/valve-5-2-pp--rest.svg",
      },
      actuated: {
        symbol: "assets/symbols/valve-5-2-pp--actuated.svg",
        component: "assets/components/valve-5-2-pp--actuated.svg",
      },
    },
    symbolStatus: "teaching schematic; review before standards-controlled publication",
    connections: {
      rest: [["1", "2"], ["4", "5"]],
      actuated: [["1", "4"], ["2", "3"]],
    },
    blocked: { rest: ["3"], actuated: ["5"] },
  },
  solenoidValve("solenoid-3-2", "3/2 solenoid valve · NC", "3-2", false),
  solenoidValve("solenoid-5-2", "5/2 solenoid valve", "5-2", false),
  solenoidValve("solenoid-5-2-dd", "5/2 valve · double solenoid", "5-2", true),
  {
    id: "signal-lamp",
    label: "Signal lamp",
    category: "Signals",
    viewBox: [0, 0, 192, 128],
    defaultState: "off",
    ports: [{ id: "in", x: 96, y: 112, kind: SIG }],
    assets: {
      off: { symbol: "assets/symbols/signal-lamp--off.svg", component: "assets/components/signal-lamp--off.svg" },
      on: { symbol: "assets/symbols/signal-lamp--on.svg", component: "assets/components/signal-lamp--on.svg" },
    },
    symbolStatus: "teaching schematic; review before standards-controlled publication",
  },
];

function solenoidValve(id: string, label: string, kind: "3-2" | "5-2", doubleSol: boolean): KitComponent {
  const ports: KitComponent["ports"] =
    kind === "3-2"
      ? [
          { id: "2", x: 108, y: 16, kind: AIR },
          { id: "1", x: 108, y: 112, kind: AIR },
          { id: "3", x: 132, y: 112, kind: AIR },
        ]
      : [
          { id: "4", x: 108, y: 16, kind: AIR },
          { id: "2", x: 132, y: 16, kind: AIR },
          { id: "5", x: 100, y: 112, kind: AIR },
          { id: "1", x: 120, y: 112, kind: AIR },
          { id: "3", x: 140, y: 112, kind: AIR },
        ];
  ports.push({ id: "a", x: 8, y: 64, kind: SIG });
  if (doubleSol) ports.push({ id: "b", x: 184, y: 64, kind: SIG });

  const connections: Record<string, Array<[string, string]>> =
    kind === "3-2"
      ? { rest: [["2", "3"]], actuated: [["1", "2"]] }
      : { rest: [["1", "2"], ["4", "5"]], actuated: [["1", "4"], ["2", "3"]] };
  const blocked = kind === "3-2" ? { rest: ["1"], actuated: ["3"] } : { rest: ["3"], actuated: ["5"] };

  return {
    id,
    label,
    category: "Directional valves",
    viewBox: [0, 0, 192, 128],
    defaultState: "rest",
    ports,
    assets: {
      rest: { symbol: `assets/symbols/${id}--rest.svg`, component: `assets/components/${id}--rest.svg` },
      actuated: { symbol: `assets/symbols/${id}--actuated.svg`, component: `assets/components/${id}--actuated.svg` },
    },
    symbolStatus: "teaching schematic; review before standards-controlled publication",
    connections,
    blocked,
  };
}

export const manifest: KitManifest = {
  ...base,
  components: [...base.components, ...EXTRA_COMPONENTS],
};

const byId = new Map(manifest.components.map((c) => [c.id, c]));

/** A neutral stand-in for a component type this build doesn't know
 *  (UI_DESIGN_BIBLE §11 — keep the record, don't crash). */
function fallbackKit(id: string): KitComponent {
  return {
    id,
    label: id,
    category: "Unknown",
    viewBox: [0, 0, 160, 100],
    defaultState: "default",
    ports: [],
    assets: {},
    symbolStatus: "unsupported component type",
  };
}

export function kitComponent(id: string): KitComponent {
  return byId.get(id) ?? fallbackKit(id);
}

export function hasKitComponent(id: string): boolean {
  return byId.has(id);
}
