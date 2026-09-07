# Implement the pneumatic simulator UI package

Read the repository's instructions, then `UI_DESIGN_BIBLE.md`, `manifest.json`, and `src/render-state.js`. Open `preview/interactive-reference.html` for the visual target. This handoff was created without access to the MVP source; determine its actual architecture before editing.

Update the existing MVP's presentation and component rendering to match the kit. Preserve the solver, working interactions, component identity, and project format. Use existing application components and dependencies where practical.

First map the current component type IDs, air/control port IDs, spool-state polarity, cylinder position units, gauge pressure units, timestep, renderer transforms, and persistence format to the kit. Do not silently rename stored data. Do not treat the HTML's scripted playback as a physics implementation.

Implement a labeled Symbols / Components toggle. Both views must share node bounds, anchors, rotation center, placement, routing, selection, and simulation state. A view change is a UI preference only. For actuators, load the separate fixed body and shared piston/rod defined under `assembly` in the manifest. Use `assembleActuator` and `applyContinuousState`; do not generate or switch among full-actuator pose images. Render the piston first and body last. The single-acting spring is a procedural path. PNG exports are available for thumbnails or bitmap renderers.

Preserve the retro blue/silver mechanical look while keeping a white grid canvas and readable system UI typography. Use the large illustrated pixel header, compact mobile wordmark, bundled Pneu Pixel font, and `src/snes.css`. Restyle the header/toolbar, searchable component library, inspector, and transport controls following the design bible. Put decorative generated art only in an empty/welcome panel.

Use the manifest's truth tables, not assumptions about Boolean valve state. Manual spring-return controls must release reliably. Preserve pneumatic versus signal-port distinctions. Do not expose the three standalone control/sensor glyphs as wireable parts unless the MVP has the corresponding signal model.

Use actual engine measurements. Distinguish pressure from flow; no autonomous animation loop should manufacture motion or flow. Missing data must remain unknown. Keep Run/Pause/Step/Reset semantics consistent with the existing engine and the documented UI contract.

Complete the acceptance checks in section 14. Report the concrete files changed, any engine-to-asset mapping decisions, checks performed, and remaining limitations. Capture the same example circuit in both views to demonstrate that the topology and anchors are preserved.
