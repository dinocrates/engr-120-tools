# Verification record — revision 1.1

Completed 7 September 2026.

## Completed for this revision

- All 116 asset SVGs parse as XML.
- All 232 PNG exports have RGBA color with actual transparent pixels and the expected dimensions at 1× or 2×.
- No actuator pose SVGs or PNGs remain. Each actuator has one default assembled thumbnail, a separate fixed body, and a shared piston/rod source for its representation.
- The single- and double-acting definitions share the same piston asset within each representation. All four two-piece assemblies (two actuator types × two representations) compose with exactly one moving piston group and one fixed body group.
- Continuous rendering was exercised at 0%, 13.7%, 25%, 50%, 75%, and 100% for all four assemblies: 24 translation checks passed. Movement selects only the piston group; port coordinates remain defined by the fixed manifest.
- The self-contained HTML's inline JavaScript parses successfully in Node.
- The original Pneu Pixel font parses successfully and contains the title, control-label, and numeral glyphs required by this theme.
- Rendered and visually inspected the revised component UI board, including the illustrated pixel header, stronger blue panels, pixel control labels, and the assembled actuator at 75% stroke.
- Symbol and hardware port geometry and valve truth tables retain the prior revision's definitions; this update does not change the solver contract.

## Limits

The HTML preview was not run in a browser here. The earlier browser installation attempt timed out; no new browser check is claimed. PNG/SVG boards are separately rendered design boards, not screenshots of the HTML. Actual browser event behavior, viewport layout, and font rendering remain to be checked in the MVP.

The existing MVP source and project prompt were not supplied. Solver integration, keyboard interactions, momentary input behavior, accessibility conformance, routing, and import/export compatibility still require the repository's acceptance checks. The included helpers do not implement a solver.

Symbols are original educational schematics; complete ISO standard compliance has not been audited. The three standalone control/sensor drawings are functional glyphs rather than complete electrical circuit symbols.
