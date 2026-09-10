# Slice Lab

Single-page 3D FDM printing explainer for ENGR-120. Native ES modules, Three.js 0.180.0, no backend or student-data storage. Serve the package folder through any static HTTP server. All runtime JavaScript is local.

## Learning sequence

1. **The model:** orbit a complete solid and compare the sample shapes.
2. **Slice it:** scrub horizontal cross-sections and compare 0.10, 0.20, and 0.30 mm layer heights.
3. **Build the paths:** isolate a layer, inspect wall loops, change infill density or pattern, and animate deposition.
4. **Support it:** compare a T-shaped cantilever with and without removable support paths. Infill remains inside the model; supports occupy regions beneath overhangs.
5. **Follow the nozzle:** observe X/Y travel, discrete Z changes, extrusion versus travel, and illustrative absolute-position movement commands.

## Model and rendering choices

`engine.mjs` generates rectangular cross-sections from three analytic sample solids. It creates ordered wall, skin, sparse infill, support, and travel segments. Paths and 3D beads are derived from the same coordinates. There is no decorative prerecorded print animation. Printer coordinates are X/Y on the bed and Z upward, in millimeters. The nozzle shows motion relative to the bed, not a particular printer's physical kinematics.

Line width is 0.45 mm. Sparse lines alternate direction by layer; grid uses both directions each layer. Three top/bottom layers close surface regions, including step terraces and the underside of the cantilever. The support column has a one-layer contact gap and a denser final interface. Percentage density sets an ideal hatch pitch; edge clipping and path intersections affect the exact deposited volume. Path lengths are educational geometry totals, not time, strength, or material-weight estimates. Solid infill paths are not removed when sparse infill is set to 0%.

This is a conceptual slicer for included sample models, not a general STL slicer. It does not model cooling, sag, adhesion, retractions, acceleration, path optimization, or collision avoidance. Commands shown explain motion; do not send them to a printer. Beads have simplified rectangular cross-sections and travel paths may cross previously printed regions.

## Files

- `index.html`: accessible UI and learning copy.
- `styles.css`: blue retro instrument-panel theme, responsive layouts.
- `app.mjs`: 3D viewport, rendering, controls, and playback.
- `engine.mjs`: deterministic procedural slicing and path location.
- `infill.mjs`: clipped hexagonal honeycomb paths and Z-dependent gyroid contours.
- `vendor/`: locally vendored Three.js and OrbitControls, with MIT license.
- `assets/printer.png`: generated supporting pixel-art printer illustration.

## References

- [Prusa: Infill](https://help.prusa3d.com/article/infill_42)
- [Prusa: Support material](https://help.prusa3d.com/article/support-material_1698)
- [Prusa: Infill patterns](https://help.prusa3d.com/article/infill-patterns_177130)

## Honeycomb and gyroid

Honeycomb uses a fixed hexagonal lattice with shared edges deduplicated before path traversal. This illustrates stacked hexagonal cells; it is not a reproduction of a particular slicer's honeycomb toolpath ordering.

Gyroid uses horizontal contours of the trigonometric nodal approximation `sin(X) cos(Y) + sin(Y) cos(Z) + sin(Z) cos(X) = 0`, with phase determined by physical layer height. The contour solver switches its independent axis to avoid vertical tangents. Curves are clipped to available interior rectangles and simplified within 0.045 mm of the sampled curve before becoming nozzle moves. Density controls the lattice spacing approximately; discrete beads, corners, clipping, and curve approximation affect actual fill fraction. At 100% density all sparse patterns use solid alternating lines; the UI explains this substitution. At 0%, walls and solid surfaces remain.

Repeated beads use instanced geometry to reduce memory for dense curved paths. Layer isolation copies only the selected layer's transforms. Range inputs debounce slicing while the handle moves. Run `node tests/infill.test.mjs` for pattern geometry, containment, extrusion continuity, Z variation, and density-extreme checks. Browser QA has not been performed.

## Supporting artwork

Generated once using the built-in image-generation tool. Final asset: `assets/printer.png`.

Prompt: “Use case: stylized-concept. Asset type: one supporting raster illustration for an educational website card, displayed at about 200px. Create one clean 16-bit SNES-inspired pixel-art desktop FDM 3D printer, square 1024 by 1024 canvas. Scene/backdrop: genuinely transparent background with alpha, no background pattern. Subject: compact desktop FDM printer with a dark navy metal open frame, cyan plastic filament spool, small orange print head visibly extruding a small cyan stepped object onto a blue gridded print bed. Three-quarter isometric view, complete printer centered with comfortable transparent margin, readable clear silhouette. Style/medium: chunky crisp pixel art, hard pixel edges, restrained shading, coherent pixel scale, deep navy and cobalt with cyan and small orange accents. Constraints: one standalone printer only; no words, letters, numbers, labels, logos, watermarks, diagram arrows, or UI. This is a decorative educational accent, not a diagram. Generate exactly one image, no variants.”
