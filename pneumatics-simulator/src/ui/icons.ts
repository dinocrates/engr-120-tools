import { svgText } from "@/kit/assets.ts";
import { manifest } from "@/kit/manifest.ts";

/** Inline markup for a named kit icon (UI_DESIGN_BIBLE §3). */
export function iconSvg(name: string): string {
  const path = manifest.icons[name];
  return path ? svgText(path) : "";
}
