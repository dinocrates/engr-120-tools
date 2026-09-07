# Asset provenance

## User reference

Visual direction derives from the supplied `ChatGPT Image Sep 6, 2026, 05_09_12 PM.png` reference: blue/navy framing, steel hardware, cyan highlights, brass details, red manual controls, and chunky retro styling. The reference's schematic drawings were not traced or treated as technical authorities.

## Original vector graphics

Component SVGs, symbol SVGs, UI icons, and tubing examples were authored as editable geometry for this package. PNG files were rasterized from those SVGs; the 2× files are nearest-neighbor enlargements of the logical 1× raster. SVGs have no external font or image dependencies. They include accessible names; port labels and instance IDs are supplied by the consuming UI so they remain readable during rotation/zoom.

These are instructional diagrams and functional control glyphs. They have not been certified against the complete ISO 1219 standard. Valve positions, ports, and paths were cross-checked against the cited manufacturer descriptions and the package truth tables. The signal/control glyphs are not complete electrical circuit symbols.

## Generated raster illustration

`assets/illustrations/training-bench.png` was generated with the built-in image generation tool using the supplied image as a style reference. It has an actual alpha channel. No background-removal editing or image slicing was used. It is decorative and must not be used as a technical connection diagram.

Prompt:

> Use case: stylized-concept. Create ONE isolated transparent-background pixel-art illustration for the welcome/empty-state panel of an educational pneumatic circuit simulator. Reference image is STYLE REFERENCE ONLY, do not reproduce its sheet or symbols. Subject: a small cheerful blue-and-silver pneumatic training bench, with an orange compressed-air tank underneath, a blue hose, silver horizontal double-acting cylinder with its rod pointing right, two little brass fittings, a red manual pushbutton, and a round pressure gauge. Three-quarter shallow isometric view, cohesive chunky SNES-inspired 16-bit pixel art, navy 2-3 pixel outlines, restrained steel highlights, cobalt blue chassis, cyan accents, subtle warm brass details. Approximate logical sprite resolution 192 by 144, enlarged with sharp nearest-neighbor-looking square pixels. No text, no letters, no schematic arrows, no surrounding frame, no background, no ground plane, no drop shadow extending beyond object. Centered object occupies about 80% of image, transparent alpha outside silhouette. This is decorative onboarding artwork, not a technical circuit diagram. Deliver a single illustration, not a sprite sheet.

## Technical references

- [Festo — Pneumatic valves](https://www.festo.com/gb/en/e/blog/in-practice/pneumatic-valves-id_1517691): port/position notation and pneumatic/manual/mechanical actuation.
- [Festo — CPV-SC valve-terminal documentation](https://ftp.festo.com/public/pneumatic/SOFTWARE_SERVICE/Documentation/2017/EN/TYP80_EN.PDF): working ports 2/4 and other port numbering.
- [AutomationDirect — Pneumatic Circuit Symbols Explained](https://library.automationdirect.com/pneumatic-circuit-symbols-explained/): position boxes, paths, and active-operator interpretation.
- [AutomationDirect — Understanding Circuit Symbols](https://www.automationdirect.com/pneumatics/misc/circuit_symbols): reference gallery of valve and operator conventions.

Sources checked 7 September 2026. No manufacturer artwork is redistributed in this kit.

## SNES revision 1.1

The new header, compact wordmark, helmet character, and original Pneu Pixel display font were authored as native vector/font geometry, extending the existing editable graphics system. The header uses the same two actuator pieces as the simulator. The fixed actuator bodies and shared moving piston/rod are separate SVG and transparent PNG assets; full-actuator pose sequences were removed. The welcome illustration is unchanged.
