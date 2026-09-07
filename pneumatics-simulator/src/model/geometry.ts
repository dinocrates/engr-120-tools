/** Geometry helpers: mapping local component coordinates to world space. */

import { getDef } from "@/components/defs.ts";
import type { ComponentInstance, Rotation, Vec2 } from "./types.ts";

/** Rotate a local point (in a `size`-sized box, origin top-left) by `rot` clockwise. */
export function rotateLocal(p: Vec2, rot: Rotation, size: Vec2): Vec2 {
  switch (rot) {
    case 0:
      return { x: p.x, y: p.y };
    case 90:
      return { x: size.y - p.y, y: p.x };
    case 180:
      return { x: size.x - p.x, y: size.y - p.y };
    case 270:
      return { x: p.y, y: size.x - p.x };
  }
}

/** Bounding box of an instance after rotation. */
export function worldSize(inst: ComponentInstance): Vec2 {
  const s = getDef(inst.type).size;
  return inst.rotation % 180 === 0 ? { x: s.x, y: s.y } : { x: s.y, y: s.x };
}

/** World position of a named port on an instance. */
export function worldPort(inst: ComponentInstance, portId: string): Vec2 {
  const def = getDef(inst.type);
  const port = def.ports.find((p) => p.id === portId);
  if (!port) throw new Error(`${inst.type} has no port ${portId}`);
  const local = rotateLocal(port.offset, inst.rotation, def.size);
  return { x: inst.position.x + local.x, y: inst.position.y + local.y };
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export const nodeKey = (component: string, port: string): string => `${component}:${port}`;
