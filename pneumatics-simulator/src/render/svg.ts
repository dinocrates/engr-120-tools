/** Tiny SVG construction helpers. */

export const SVGNS = "http://www.w3.org/2000/svg";

type Attrs = Record<string, string | number | undefined>;

export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs?: Attrs,
  children?: (SVGElement | string)[],
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVGNS, tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined) continue;
      node.setAttribute(k, String(v));
    }
  }
  if (children) {
    for (const c of children) {
      node.append(typeof c === "string" ? document.createTextNode(c) : c);
    }
  }
  return node;
}

export function line(x1: number, y1: number, x2: number, y2: number, cls?: string): SVGLineElement {
  return svg("line", { x1, y1, x2, y2, class: cls });
}

export function group(cls?: string, transform?: string): SVGGElement {
  return svg("g", { class: cls, transform });
}

/** Parse a trusted, bundled SVG string into a live element. */
export function parseSvg(markup: string): SVGSVGElement {
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
  const el = doc.documentElement;
  if (el.nodeName !== "svg") {
    throw new Error("Bundled asset failed to parse as SVG");
  }
  return document.importNode(el, true) as unknown as SVGSVGElement;
}
