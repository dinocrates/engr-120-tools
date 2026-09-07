/**
 * Symbol registry (SDD §30, §43). Each entry knows how to build the static
 * schematic geometry for a component type and how to apply runtime state to it.
 * Geometry is authored in the component's local (unrotated) coordinate space.
 */

import type { ComponentDef } from "@/components/defs.ts";
import type { ComponentInstance } from "@/model/types.ts";
import type { PressureState } from "@/solver/solver.ts";
import { group, line, svg } from "./svg.ts";

export interface SymbolRuntime {
  /** Pressure state keyed by local port id. */
  portStates: Map<string, PressureState>;
  valvePosition?: number;
  pressed?: boolean;
  cylinderPos?: number;
}

export interface SymbolSpec {
  build(def: ComponentDef, inst: ComponentInstance): SVGGElement;
  update(g: SVGGElement, def: ComponentDef, inst: ComponentInstance, rt: SymbolRuntime): void;
}

const stateClass = (s: PressureState | undefined): string => `state-${(s ?? "UNPRESSURIZED").toLowerCase()}`;

function setStateClass(elm: Element | null, s: PressureState | undefined): void {
  if (!elm) return;
  elm.classList.remove(
    "state-unpressurized",
    "state-pressurized",
    "state-exhausting",
    "state-trapped",
    "state-short",
  );
  elm.classList.add(stateClass(s));
}

/* ------------------------------------------------------------------ supply */

const supply: SymbolSpec = {
  build() {
    const g = group("sym sym-supply");
    g.append(
      svg("circle", { cx: 22, cy: 20, r: 15, class: "sym-body" }),
      svg("path", { d: "M22 35 L13 21 L31 21 Z", class: "sym-solid" }),
      line(22, 35, 22, 52, "sym-stub port-stub"),
    );
    return g;
  },
  update(g, _def, _inst, rt) {
    setStateClass(g.querySelector(".port-stub"), rt.portStates.get("P"));
    g.classList.toggle("energized", rt.portStates.get("P") === "PRESSURIZED");
  },
};

/* --------------------------------------------------------------- 5/2 valve */

const BOX_W = 88;

function valveBox(index: number, pairs: Array<[string, string]>): SVGGElement {
  const g = group(`vbox vbox-${index}`);
  const ox = index * BOX_W;
  g.append(svg("rect", { x: ox, y: 11, width: BOX_W, height: 30, rx: 2, class: "vbox-frame" }));
  // anchor x within a box, matching external stub positions
  const bottom: Record<string, number> = { S: 14, P: 44, R: 74 };
  const top: Record<string, number> = { A: 26, B: 62 };
  for (const [a, b] of pairs) {
    const pa = anchor(a, ox, bottom, top);
    const pb = anchor(b, ox, bottom, top);
    g.append(
      svg("line", {
        x1: pa.x,
        y1: pa.y,
        x2: pb.x,
        y2: pb.y,
        class: "vpath",
        "data-ports": `${a}-${b}`,
        "marker-end": "url(#arrow)",
      }),
    );
  }
  return g;
}

function anchor(
  port: string,
  ox: number,
  bottom: Record<string, number>,
  top: Record<string, number>,
): { x: number; y: number } {
  if (port in bottom) return { x: ox + bottom[port]!, y: 40 };
  return { x: ox + top[port]!, y: 12 };
}

const valve52: SymbolSpec = {
  build(def) {
    const g = group("sym sym-valve");
    // external stubs (fixed to the assembly)
    for (const p of def.ports) {
      const onTop = p.offset.y === 0;
      g.append(
        line(
          p.offset.x,
          onTop ? 0 : 52,
          p.offset.x,
          onTop ? 11 : 41,
          "port-stub",
        ),
      );
    }
    // sliding envelope, clipped so only the aligned box shows
    const clipId = `vclip-${Math.random().toString(36).slice(2)}`;
    const clip = svg("clipPath", { id: clipId });
    clip.append(svg("rect", { x: 0, y: 10, width: BOX_W, height: 32 }));
    g.append(clip);

    const env = group("venvelope");
    env.setAttribute("clip-path", `url(#${clipId})`);
    env.append(
      valveBox(0, def.valve!.positions[0]!.connections),
      valveBox(1, def.valve!.positions[1]!.connections),
    );
    g.append(env);

    // actuators: pushbutton left, spring right
    const pb = group("actuator actuator-pb");
    pb.append(
      svg("rect", { x: -12, y: 18, width: 10, height: 16, rx: 1, class: "pb-cap" }),
      line(-2, 26, 0, 26, "pb-stem"),
    );
    g.append(pb);

    const spr = group("actuator actuator-spring");
    spr.append(
      svg("path", {
        d: "M88 26 l3 -5 l4 10 l4 -10 l3 5",
        class: "spring-coil",
        fill: "none",
      }),
    );
    g.append(spr);

    return g;
  },
  update(g, def, _inst, rt) {
    const pos = rt.valvePosition ?? def.valve!.restPosition;
    const env = g.querySelector<SVGGElement>(".venvelope");
    if (env) env.setAttribute("transform", `translate(${-pos * BOX_W} 0)`);
    g.classList.toggle("pressed", Boolean(rt.pressed));

    g.querySelectorAll<SVGGElement>(".vbox").forEach((box, i) => {
      box.classList.toggle("active", i === pos);
    });
    // colour the active box's internal paths by the P-port state
    const pState = rt.portStates.get("P");
    g.querySelectorAll<SVGLineElement>(`.vbox-${pos} .vpath`).forEach((pathEl) => {
      const [a, b] = (pathEl.dataset.ports ?? "").split("-");
      const involvesP = a === "P" || b === "P";
      setStateClass(pathEl, involvesP ? pState : rt.portStates.get(a === "P" ? b! : a!));
    });
  },
};

/* ------------------------------------------------------- double-acting cyl */

const CYL = { x0: 8, x1: 92, y0: 8, y1: 32, travel: 72, pistonBase: 12 };

const cylinderDa: SymbolSpec = {
  build(def) {
    const g = group("sym sym-cylinder");
    g.append(
      svg("rect", {
        x: 6,
        y: 6,
        width: 90,
        height: 28,
        class: "cyl-barrel",
      }),
      svg("rect", { x: CYL.x0, y: CYL.y0, width: 0, height: CYL.y1 - CYL.y0, class: "cyl-chamber chamber-cap" }),
      svg("rect", { x: CYL.x0, y: CYL.y0, width: 0, height: CYL.y1 - CYL.y0, class: "cyl-chamber chamber-rod" }),
      svg("rect", { x: 12, y: CYL.y0, width: 6, height: CYL.y1 - CYL.y0, class: "cyl-piston" }),
      line(15, 20, 80, 20, "cyl-rod"),
      svg("rect", { x: 92, y: 14, width: 4, height: 12, class: "cyl-gland" }),
      svg("rect", { x: 78, y: 15, width: 6, height: 10, class: "cyl-rodend" }),
    );
    for (const p of def.ports) {
      g.append(line(p.offset.x, 40, p.offset.x, 34, "port-stub"));
    }
    return g;
  },
  update(g, _def, _inst, rt) {
    const pos = clamp01(rt.cylinderPos ?? 0);
    const pistonX = CYL.pistonBase + pos * CYL.travel;

    const piston = g.querySelector<SVGRectElement>(".cyl-piston");
    piston?.setAttribute("x", String(pistonX - 3));

    const rod = g.querySelector<SVGLineElement>(".cyl-rod");
    rod?.setAttribute("x1", String(pistonX));
    rod?.setAttribute("x2", String(pistonX + 62));

    g.querySelector(".cyl-rodend")?.setAttribute("x", String(pistonX + 60));
    g.querySelector(".cyl-gland")?.setAttribute("x", "92");

    const cap = g.querySelector<SVGRectElement>(".chamber-cap");
    cap?.setAttribute("x", String(CYL.x0));
    cap?.setAttribute("width", String(Math.max(0, pistonX - 3 - CYL.x0)));
    setStateClass(cap, rt.portStates.get("A"));

    const rodCh = g.querySelector<SVGRectElement>(".chamber-rod");
    rodCh?.setAttribute("x", String(pistonX + 3));
    rodCh?.setAttribute("width", String(Math.max(0, CYL.x1 - (pistonX + 3))));
    setStateClass(rodCh, rt.portStates.get("B"));
  },
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export const SYMBOLS: Record<string, SymbolSpec> = {
  supply,
  valve_5_2: valve52,
  cylinder_da: cylinderDa,
};

export function getSymbol(type: string): SymbolSpec {
  const s = SYMBOLS[type];
  if (!s) throw new Error(`No symbol for ${type}`);
  return s;
}
