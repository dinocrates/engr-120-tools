# Revision 1.1 — SNES theme and two-piece actuators

- Recreated the large reference-inspired header as editable pixel geometry, including the cylinder, subtitle, helmet character, and speech bubble.
- Added a compact mobile wordmark and an original bundled Pneu Pixel display font.
- Strengthened blue panel framing, metallic card bevels, short pixel labels, and colored transport controls.
- Removed every actuator pose sequence. Each actuator uses a fixed body and a moving piston/rod. Single- and double-acting bodies share the same piston/rod within each visual representation.
- Added `assembly` definitions to the manifest and `assembleActuator()` to the renderer helpers. Kept the same port coordinates and 88-unit continuous travel.
- Updated the interactive preview to move the two-piece assembly and show the separate body/piston assets in the catalog.
- Updated the design bible and implementation prompt so the agent follows this construction.

Use `src/tokens.css` followed by `src/snes.css`. Load actuator pieces from `assets/parts/actuator/`. The archive retains its original filename for continuity; the manifest version is 1.1.0.
