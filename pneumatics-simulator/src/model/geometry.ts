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

/** SVG `transform` attribute placing an instance's local space into the world. */
export function instanceTransformAttr(inst: ComponentInstance): string {
  return kitTransformAttr(kitComponent(inst.type), instanceTransform(inst));
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export const nodeKey = (component: string, port: string): string => `${component}:${port}`;
