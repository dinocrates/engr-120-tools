/**
 * Geometry helpers — mapping component-local coordinates to world space.
 *
 * Rotation is about the viewBox centre and identical for artwork and ports
 * (UI_DESIGN_BIBLE §8). The math lives in `kit/render-state.ts`; this module
 * just adapts our `ComponentInstance` to that helper.
 */

import { getDef } from "@/components/defs.ts";
import { kitComponent } from "@/kit/manifest.ts";
import {
  instanceTransformAttr as kitTransformAttr,
  worldPort as kitWorldPort,
  type InstanceTransform,
} from "@/kit/render-state.ts";
import type { ComponentInstance, Vec2 } from "./types.ts";

export function instanceTransform(inst: ComponentInstance): InstanceTransform {
  return { x: inst.position.x, y: inst.position.y, rotation: inst.rotation };
}

/** Axis-aligned bounding box of an instance after rotation. */
export function worldSize(inst: ComponentInstance): Vec2 {
  const s = getDef(inst.type).size;
  return inst.rotation % 180 === 0 ? { x: s.x, y: s.y } : { x: s.y, y: s.x };
}

/** World position of a named port on an instance. */
export function worldPort(inst: ComponentInstance, portId: string): Vec2 {
  return kitWorldPort(kitComponent(inst.type), portId, instanceTransform(inst));
}

/**
 * Outward-facing unit direction of a port (which way a tube should leave it),
 * as a cardinal vector in world space. Inferred from the nearest viewBox edge
 * in local space, then rotated with the instance.
 */
export function worldPortDir(inst: ComponentInstance, portId: string): Vec2 {
  const def = kitComponent(inst.type);
  const port = def.ports.find((p) => p.id === portId);
  if (!port) return { x: 0, y: 1 };
  const [, , w, h] = def.viewBox;
  const d = { left: port.x, right: w - port.x, top: port.y, bottom: h - port.y };
  const min = Math.min(d.left, d.right, d.top, d.bottom);
  let local: Vec2;
  if (min === d.top) local = { x: 0, y: -1 };
  else if (min === d.bottom) local = { x: 0, y: 1 };
  else if (min === d.left) local = { x: -1, y: 0 };
  else local = { x: 1, y: 0 };

  const rad = (inst.rotation * Math.PI) / 180;
  const cos = Math.round(Math.cos(rad));
  const sin = Math.round(Math.sin(rad));
  return { x: local.x * cos - local.y * sin, y: local.x * sin + local.y * cos };
}

/** SVG `transform` attribute placing an instance's local space into the world. */
export function instanceTransformAttr(inst: ComponentInstance): string {
  return kitTransformAttr(kitComponent(inst.type), instanceTransform(inst));
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export const nodeKey = (component: string, port: string): string => `${component}:${port}`;
