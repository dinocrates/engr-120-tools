/**
 * Framework-neutral render helpers, ported from the kit's `src/render-state.js`
 * (UI_DESIGN_BIBLE §8). No physics here — these only project engine state onto
 * trusted bundled artwork.
 *
 * Rotation is about the viewBox centre, and the SAME transform is applied to
 * artwork and to port anchors (§8: "Apply the same transform to artwork and
 * ports").
 */

import type { Vec2 } from "@/model/types.ts";
import { svgInner, svgText } from "./assets.ts";
import type { KitComponent, KitView } from "./manifest.ts";

export const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

export interface InstanceTransform {
  x: number;
  y: number;
  rotation: number;
  scale?: number;
}

/** World position of a component port under an instance transform. */
export function worldPort(def: KitComponent, portId: string, t: InstanceTransform): Vec2 {
  const port = def.ports.find((p) => p.id === portId);
  if (!port) throw new Error(`${def.id} has no port ${portId}`);
  const [, , w, h] = def.viewBox;
  const rad = ((t.rotation ?? 0) * Math.PI) / 180;
  const scale = t.scale ?? 1;
  const dx = port.x - w / 2;
  const dy = port.y - h / 2;
  return {
    x: t.x + (w / 2 + dx * Math.cos(rad) - dy * Math.sin(rad)) * scale,
    y: t.y + (h / 2 + dx * Math.sin(rad) + dy * Math.cos(rad)) * scale,
  };
}

/** SVG transform string placing an instance's local space into world space. */
export function instanceTransformAttr(def: KitComponent, t: InstanceTransform): string {
  const [, , w, h] = def.viewBox;
  const s = t.scale ?? 1;
  // translate to centre, rotate, translate back — matches worldPort()
  return `translate(${t.x} ${t.y}) scale(${s}) rotate(${t.rotation} ${w / 2} ${h / 2})`;
}

/**
 * Compose the two reusable actuator pieces into one inline SVG string.
 * Piston first, procedural spring second, body last (§9).
 */
export function assembleActuator(def: KitComponent, view: KitView): string {
  const a = def.assembly?.[view];
  if (!a) throw new Error(`No actuator assembly for ${def.id}/${view}`);
  const spring = a.spring
    ? '<path data-part="spring" fill="none" stroke="#61758F" stroke-width="2"/>'
    : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${a.viewBox.join(" ")}" ` +
    `width="${a.viewBox[2]}" height="${a.viewBox[3]}" data-view="${view}" role="img" aria-label="${def.label}">` +
    `<g data-part="piston" transform="translate(0 0)">${svgInner(a.piston)}</g>` +
    spring +
    `<g data-part="body">${svgInner(a.body)}</g>` +
    `</svg>`
  );
}

export interface ContinuousState {
  view: KitView;
  position01?: number;
  pressure?: number;
  rangeMax?: number;
}

/** Push continuous engine state into an already-mounted inline SVG. */
export function applyContinuousState(svg: SVGElement, typeId: string, state: ContinuousState): void {
  if (typeId.startsWith("cylinder-")) {
    const p = clamp01(state.position01 ?? 0);
    svg.querySelectorAll('[data-part="piston"]').forEach((n) => {
      n.setAttribute("transform", `translate(${88 * p} 0)`);
    });
    const spring = svg.querySelector('[data-part="spring"]');
    if (spring) {
      const hardware = svg.getAttribute("data-view") === "component";
      const start = (hardware ? 58 : 60) + 88 * p;
      const end = hardware ? 151 : 160;
      const mid = hardware ? 66 : 74;
      const pts: Array<[number, number]> = [
        [start, mid],
        ...Array.from({ length: 7 }, (_, k): [number, number] => {
          const i = k + 1;
          return [start + ((end - start) * i) / 8, mid + (i % 2 ? -5 : 5)];
        }),
        [end, mid],
      ];
      spring.setAttribute("d", "M" + pts.map((xy) => xy.join(" ")).join(" L"));
    }
  }

  if (typeId === "pressure-gauge" && svg.getAttribute("data-view") === "component") {
    const range = state.rangeMax;
    const valid =
      typeof range === "number" && range > 0 && typeof state.pressure === "number" && Number.isFinite(state.pressure);
    const needle = svg.querySelector('[data-part="needle"]');
    if (needle) {
      (needle as SVGElement).style.visibility = valid ? "visible" : "hidden";
      const frac = clamp01(valid ? state.pressure! / range! : 0);
      needle.setAttribute("transform", `rotate(${270 * frac} 96 60)`);
    }
  }
}

/** Full inline SVG string for a component in a given view + discrete state. */
export function componentSvg(def: KitComponent, view: KitView, state: string): string {
  if (def.assembly) return assembleActuator(def, view);
  const asset = def.assets[state]?.[view] ?? def.assets[def.defaultState]?.[view];
  if (!asset) throw new Error(`No ${view} asset for ${def.id}/${state}`);
  return svgText(asset);
}
