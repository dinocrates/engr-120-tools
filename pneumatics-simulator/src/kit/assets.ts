/**
 * Trusted, bundled SVG assets from the UI kit, inlined at build time.
 *
 * Every asset is a hand-authored package file (UI_DESIGN_BIBLE §8: "Inline only
 * trusted package assets; do not inject uploaded SVG markup as trusted UI").
 * Keyed by the same path strings manifest.json uses.
 */

const modules = import.meta.glob("./assets/**/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const svgByPath = new Map<string, string>();
for (const [path, text] of Object.entries(modules)) {
  svgByPath.set(path.replace(/^\.\//, ""), text);
}

export function svgText(assetPath: string): string {
  const text = svgByPath.get(assetPath);
  if (text === undefined) throw new Error(`Missing bundled asset: ${assetPath}`);
  return text;
}

export function hasSvg(assetPath: string): boolean {
  return svgByPath.has(assetPath);
}

/** Inner markup of an SVG file (everything between the root tags). */
export function svgInner(assetPath: string): string {
  const s = svgText(assetPath);
  return s.slice(s.indexOf(">") + 1, s.lastIndexOf("</svg>"));
}
