# Pneumatic Simulator — UI Design Bible

Version 1.1 · 7 September 2026 · ENGR–120

## 1. Intent and handoff boundary

Make it easy for students to build a circuit, operate it, and connect a pneumatic symbol with the component it represents. The visual direction is a blue-and-silver, 16-bit workshop: chunky mechanical illustrations, small bevels, restrained cyan highlights, and a clean drawing surface. Revision 1.1 strengthens the SNES styling and replaces actuator poses with a fixed body plus a shared moving piston/rod.

This package is a graphics and interaction specification for an existing MVP. Its source code, technology stack, and project prompt were not supplied in this turn. Preserve the existing solver, project format, and working features. Adapt the rendering contract to the repository after reading its instructions. The supplied HTML is an interactive design reference with scripted example playback, not a replacement simulator.

The reference image and recovered earlier context establish these requirements: component library on the left, circuit in the center, properties on the right, transport controls below; a symbol/hardware toggle; the component inventory in `manifest.json`; and a retro component view depicting hardware rather than restyled symbols. Additional details below are proposed UI decisions, not claims about the current MVP.

## 2. Nonnegotiable design rules

1. **The view toggle changes presentation only.** Preserve component IDs, port IDs, placement, rotation, connection endpoints, selection, camera, simulation time, pressures, cylinder position, control inputs, and undo history.
2. **The engine owns physical state.** Artwork cannot generate pressure, decide flow, interpolate a valve connection, or reset a cylinder.
3. **Schematic meaning stays legible.** Keep functional symbols as vectors. Never trace technical symbols from the supplied AI reference sheet.
4. **Hardware still looks like hardware.** Use the supplied silver/blue component graphics, brass fittings, red manual controls, and inspection-window actuators.
5. **Students can read the screen.** Use normal UI type for instructions and values. Retro character comes from the art, palette, and framing.
6. **Circuit space gets priority.** Keep decoration out of the working canvas. Use the generated training bench only in a welcome card or lesson introduction.

## 3. Package map

| Path | Purpose |
| --- | --- |
| `manifest.json` | Component IDs, labels, views, states, port geometry, valve connections, and asset paths |
| `assets/symbols/` | Individual schematic SVGs; standalone control glyphs are identified separately |
| `assets/components/` | Individual hardware SVGs; continuous-motion groups included |
| `assets/parts/actuator/` | Separate fixed bodies and shared piston/rod, in hardware and schematic styles |
| `assets/brand/` | Large beveled pixel wordmark, cylinder motif, helmet character, and compact wordmark |
| `assets/fonts/` | Original Pneu Pixel display font |
| `assets/icons/` | 28 toolbar, transport, and status SVG icons |
| `assets/tubing/` | Six connection geometries in five states; routing style references |
| `assets/png-1x/`, `assets/png-2x/` | Transparent PNG exports of every SVG, with the same folder/file naming |
| `assets/illustrations/training-bench.png` | Generated transparent welcome artwork |
| `src/tokens.css`, `src/snes.css` | Base tokens plus the SNES theme; load in that order |
| `src/render-state.js` | Framework-neutral state/anchor helpers; no physics |
| `preview/interactive-reference.html` | Self-contained interactive reference; opens without a server |
| `preview/ui-components.png`, `preview/ui-symbols.png` | Static desktop design boards (SVG + PNG) |
| `preview/component-catalog.png` | Paired symbol and component overview |
| `docs/AGENT_IMPLEMENTATION_PROMPT.md` | Copy-ready implementation brief |
| `docs/ASSET_PROVENANCE.md` | How assets were produced and reference sources |
| `docs/VERIFICATION.md` | Checks actually performed and remaining integration work |

Use SVG on the live canvas. Use PNG for thumbnail surfaces or renderers that require bitmaps. Do not crop individual parts out of the reference image. No slicing is required for this package.

## 4. Visual foundations

### Color and surfaces

| Role | Value | Application |
| --- | --- | --- |
| Outer frame | `#09182C` | Page background |
| Main navy | `#10233F` | Header, text, graphic outlines |
| Cobalt | `#176BE8` | Selected state and primary action |
| Cyan | `#75D9FF` | Decorative highlight on dark surfaces |
| Paper | `#F4F7FB` | Side panels |
| White | `#FFFFFF` | Active circuit canvas and input surfaces |
| Muted text | `#52647C` | Secondary information on light surfaces |
| Border | `#BBC9DA` | Panel and input separation |
| Pressure | `#D93846` | Pressurized air paths |
| Exhaust | `#1672C4` | Exhaust-connected air paths |
| Trapped | `#A96A05` | Isolated retained pressure |
| Inactive | `#738096` | Known inactive/depressurized path |
| Unknown | `#6D6682` | Unresolved state, with question marker |
| Success | `#21854A` | Run action and confirmed success |
| Warning | `#F3B747` | Warning surface with dark text |

These are semantic assignments. Supply pressure and selection both need independent visual treatment; a selected component gets a cobalt outline, not recolored pressure lines. Red manual buttons retain their material color independently of pressure.

Use navy text on light surfaces and white on navy. Reserve cyan text for dark backgrounds. Do not use pale steel or cyan as small text on white. Target at least 4.5:1 for normal text and 3:1 for large text and necessary non-text controls. Validate actual composed states, including disabled/read-only distinctions, in the app.

### Typography and spacing

Use system UI fonts for body copy, labels, and buttons. Use monospace for IDs and measurements. Use the bundled original Pneu Pixel font for short panel titles and transport buttons. The full header wordmark is vector pixel geometry with white/ice-blue faces and a cobalt extrusion; it does not depend on text font rendering. No external font download is required.

Body 14–16 px; component labels 13–14 px; secondary copy 12 px minimum in the production UI. Use 16–20 px for inspector titles and the supplied large wordmark for the header. Short pixel-font labels should be at least 14–15 px CSS, with adequate line height. Use tabular numerals. Avoid all-caps paragraphs.

Use the spacing ladder 4, 8, 12, 16, 24, 32 px. Controls are 40 px tall on desktop and at least 44 px on touch layouts. Standard icon size is 18–20 px inside controls; canvas art has its own scale. Square panel corners and stepped metallic edges establish the SNES treatment. Use cyan outer frame lines, navy title strips, a saturated blue library, steel cards, and green/blue/red transport accents. Keep bevels small enough that button labels remain clear. Use an 8 px radius only for an existing modal if needed for consistency.

### Graphic style

Mechanical art uses a side view, navy outlines, three or four steel tones, blue end caps, and brass fittings. The limited palette and stepped outlines provide the retro feel. Do not add realism filters, blur, gradients, bloom, or lighting that obscures ports.

The SVG component drawings are scalable, pixel-inspired illustrations. They are not rigid pixel-grid bitmap originals. PNG 2× exports use nearest-neighbor enlargement from the 1× raster. Prefer integer display sizes for bitmap art. Keep schematic strokes smooth and readable at arbitrary zoom.

## 5. Workspace structure

At roughly 1440×900, use a 112 px illustrated header, a 56–64 px project toolbar, a 232 px library, a flexible central canvas, a 280 px inspector, and a 64 px transport bar. Main workspace should fit in the available height; side panels scroll independently. The reference gallery below the mockup is documentation, not part of the production editor.

Header: use `assets/brand/header-lockup.svg`, including the large pixel title, cylinder motif, subtitle, and small helmet/speech-bubble accent inspired by the supplied reference. Below 700 px use `wordmark-compact.svg`; never crop the full title offscreen. Project identity and save status belong in the toolbar below. Project actions: New, Open, Save/Download, Undo, Redo. Put low-frequency settings/help/export controls in an overflow menu. Reuse existing persistence behavior; do not label a project “Saved” before a successful write.

Place a labeled **Symbols | Components** segmented control in the project toolbar. Treat it as a representation preference. If the MVP already has Design, Simulate, and Learn tabs, preserve them as task navigation; the representation preference must work across them. Do not add redundant mode controls just to resemble the sheet.

Canvas: white, faint 16-unit grid at 100%, no background illustration. Supply generally reads from lower left; control valves near center; actuators above. These are starter-layout choices, not placement restrictions. The camera may pan and zoom normally.

Inspector: selected part name and instance ID first; editable parameters next; live measurements clearly marked read-only; a collapsed “How it works” section; a small paired symbol/hardware comparison. Nothing selected: project properties and brief build instructions. Multiple selection: count plus common editable properties. No repeated generic help paragraphs.

Below 1100 px: make the inspector a drawer or lower panel. Below 700 px: library and inspector become explicit drawers; keep circuit and transport visible. Use click/tap placement in addition to drag. Avoid shrinking a full desktop layout until its labels become unreadable. The reference HTML uses a stacked demonstration layout at narrow widths; production should adopt drawers when existing components support them.

## 6. Student interaction contract

| Action | Required behavior |
| --- | --- |
| Search library | Filter available components by name, alias, and category; show a clear empty result |
| Add part | Drag from library or select then click canvas; Escape cancels placement |
| Select | Click part; selection outline and inspector update together |
| Move | Snap origin to grid; preserve port identities; update attached routes |
| Rotate | Rotate by 90° around the declared center; update anchor transforms; keep labels upright |
| Connect | Click a port, then a compatible target; show a preview path and endpoint identifiers |
| Cancel connection | Escape or click cancel; remove the draft without changing the circuit |
| Branch | Explicitly create a junction on a tube; show a filled connection dot |
| Crossing | No connectivity unless a junction exists in the graph; draw a bridge or gap |
| Delete | Delete selected object and its incident connections as one undoable action |
| Toggle representation | Swap artwork only; no recentering, reflow, restart, or history entry |
| Inspect numeric property | Label, unit, min/max validation, commit on Enter or blur; Escape restores old value |
| Undo/redo | Handle topology and parameter edits; do not record animation frames |

Port touch targets are 24 px diameter minimum at the screen level, even when the visible port is smaller. Show number and purpose on focus/hover: “V1 · port 1 · supply.” When dense ports overlap, provide a keyboard-accessible port list in the inspector rather than overlapping invisible targets.

Keyboard: V select, C connect, R rotate selection, Delete remove, Escape cancel, Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z redo. Suppress these when typing in inputs, textareas, selects, or contenteditable elements. Space may toggle playback only when focus is on the canvas; buttons retain normal Space/Enter behavior. Make keyboard help discoverable.

Keep structural edits disabled while the engine runs if the MVP cannot safely handle them. Show “Pause to edit the circuit” near the attempted action. Manual valve operation remains available during simulation. Discrete inputs in the inspector must identify momentary versus latched operation.

For momentary controls, actuation lasts while pointer or key is held. Use pointer capture and release on pointerup, pointercancel, lostpointercapture, window blur, and keyup. Clear transient input on mode exit/reset. The reference preview uses a click-latched V1 control for examining both artwork states; that preview convenience does not redefine a physical spring-return valve.

## 7. Symbols and port meaning

Pneumatic valve notation and actuation conventions follow the concepts explained by [Festo](https://www.festo.com/gb/en/e/blog/in-practice/pneumatic-valves-id_1517691) and [AutomationDirect](https://library.automationdirect.com/pneumatic-circuit-symbols-explained/). The number of positions, internal paths, and operator symbols convey different information; the supplied valve assets keep both position boxes visible and identify the active position with a narrow blue bar. These are original teaching drawings, not certified ISO 1219 artwork.

Use the `manifest.json` port numbers as canonical identity. Letters vary between manufacturers; do not silently infer connectivity from A/B/R/S. The important mapping is:

| Component | Supply | Work ports | Exhaust | Other |
| --- | --- | --- | --- | --- |
| 3/2 NC valve | 1 | 2 | 3 | Pushbutton/spring return |
| 3/2 NC limit valve | 1 | 2 | 3 | Roller/spring return |
| 5/2 valve | 1 | 2, 4 | 3, 5 | Pushbutton/spring return |
| Single cylinder | — | cap | — | Mechanical spring return |
| Double cylinder | — | cap, rod | — | Pressure on either side |
| Check / one-way control | 1→2 free-flow direction | 1, 2 | — | Reverse blocked/restricted respectively |
| Pressure gauge | — | 1 | — | Measurement tap |
| Command/sensor glyphs | — | — | — | `out` is a signal, not an air port |

The 5/2 port assignment is supported by Festo's [valve-terminal port documentation](https://ftp.festo.com/public/pneumatic/SOFTWARE_SERVICE/Documentation/2017/EN/TYP80_EN.PDF). The chosen rest direction below is a package convention; map the MVP's existing spool state explicitly instead of assuming its Boolean polarity.

| Asset | State | Open connections | Blocked ports |
| --- | --- | --- | --- |
| 3/2 NC / roller limit valve | rest | 2–3 | 1 |
| 3/2 NC / roller limit valve | actuated | 1–2 | 3 |
| 5/2 valve | rest | 1–2; 4–5 | 3 |
| 5/2 valve | actuated | 1–4; 2–3 | 5 |

In the example, cylinder cap connects to valve port 4 and rod connects to port 2. Actuation extends; release retracts. Different user plumbing can reverse that result. Never encode “actuated = extend” inside a generic valve renderer.

The standalone pushbutton, roller switch, and proximity sensor assets are **functional control glyphs**, not complete electrical wiring symbols. Their dotted signal stubs must connect only to an explicitly supported control layer. If the MVP has no signal graph, omit these three entries from its build palette; the integrated pneumatic limit valve remains available. Do not label them ISO electrical symbols or expose imaginary pneumatic ports.

## 8. Geometry and renderer contract

Every symbol/hardware pair has the same viewBox, origin, rotation pivot, and external port anchors. Most parts use 192×128 local units; cylinders use 256×128 to reserve rod travel. Read exact anchors from `manifest.json`. Do not crop to visible bounds, center by the painted pixels, or scale individual variants to “fill the card” on the live canvas.

World origin is the top-left of the unrotated viewBox. Rotation pivot is half its width and height. Apply the same transform to artwork and ports. `worldPort()` provides an example. Wire endpoint storage uses `{componentId, portId}`, never pixel coordinates alone. Recompute routed geometry after movement/rotation, not after a view toggle.

Recommended layers, back to front: grid; ordinary tubes; pressure/flow overlays; component artwork; live component overlays; junctions and ports; selection/hover handles; labels; temporary connection previews. Keep hit targets separate from painted geometry.

Component SVGs contain local `data-part` attributes instead of globally unique IDs. Query within each inline SVG root. For rendering as `<img>`, discrete state files work, but their internal parts cannot be animated from the parent document; use inline SVG, an SVG-aware renderer, or supplied PNG poses as appropriate. Inline only trusted package assets; do not inject uploaded SVG markup as trusted UI.

Treat asset state as a rendering projection:

```js
const renderState = {
  view: preferences.view,          // 'symbol' | 'component'
  type: node.type,
  position01: node.position / node.stroke,
  valveState: node.spoolState,     // explicit adapter to rest/actuated
  pressure: node.pressureKPa,
  rangeMax: node.gaugeRangeKPa,
  selected: selection.has(node.id),
};
```

Names are illustrative. Adapt units and fields to the actual MVP; do not rename its persistence schema to match this example. Reject invalid physical parameters in the engine-facing form rather than relying on renderer clamping.

## 9. Animation and transport

Actuators have **two reusable graphic pieces**, not pose sequences: one fixed body and one moving piston/rod. `assets/parts/actuator/component/` contains `cylinder-single-body.svg`, `cylinder-double-body.svg`, and a single shared `piston-rod.svg`. The schematic equivalents live under `assets/parts/actuator/symbol/`. Both types use the same piston/rod within each representation. Body variants differ because their air-port requirements differ.
+
+All pieces use the same 256×128 canvas and origin. Load each piece once. Draw the piston first, translated by `88 × position01` horizontally, then the body at `(0,0)`. The body has transparent inspection and shaft openings, so it masks the piston appropriately without requiring a third graphic. Use SVG groups or two transparent PNG layers; the geometry is identical. Do not crop to alpha bounds, stretch the rod, move the fittings, or swap full-actuator images during motion.
+
+The single-acting return spring is a procedural SVG path between the piston head and rod-side end wall. Draw it between the piston and body layers and update its endpoints with position. It is not a sprite sequence. The hardware inspection window is a teaching cutaway.
+
+`assembleActuator(definition, view, assetTexts)` in `src/render-state.js` builds the layers from the separate source files. Call `applyContinuousState` immediately after mounting and on each engine snapshot. Only `data-part="piston"` translates; `data-part="body"` never moves. The manifest records this contract in `assembly` and `animation`. A single `--default.svg` assembled file per actuator/view remains as a convenience for thumbnails, but there are no actuator pose exports.
+
+For a canvas renderer, the equivalent is:
+
+```js
+ctx.drawImage(pistonImage, originX + 88 * position01 * scale, originY, 256 * scale, 128 * scale);
+// Single acting: draw the procedural spring here, in the same local coordinates.
+ctx.drawImage(bodyImage, originX, originY, 256 * scale, 128 * scale);
+```
+
+The two-piece model is authoritative. Do not reintroduce separate 25%, 50%, or 75% actuator textures.

Gauge hardware uses a 270° needle sweep about `(96,60)`; map the configured gauge range, not a hard-coded supply pressure. Show numeric pressure and units next to the graphic. If pressure/range is missing or invalid, hide the needle and show “Unavailable.” A saturated needle requires an explicit over-range indicator. The schematic gauge remains a static symbol.

Valve, pushbutton, roller-switch, and sensor variants are discrete states. Do not tween pneumatic connectivity. An optional 80–120 ms visual button depression may follow the model state, but it cannot delay the event delivered to the solver. For reduced motion, remove decorative transitions and flow particles while still showing actual physical state changes.

| Control | State effect |
| --- | --- |
| Run | Validate required circuit constraints; begin or resume engine time |
| Pause | Stop advancing engine time; preserve pressures, inputs, position, and topology |
| Step | Advance one documented fixed engine step while paused; show its duration |
| Reset | Pause; restore configured initial simulation state and clear transient commands; keep circuit topology |
| Speed | Change simulated-time/wall-time ratio; never change the physical equations |

The HTML preview uses a 0.1 s illustrative step and a 200 mm stroke at 100 mm/s. Those are demonstration values. The integration agent must use the MVP's real fixed timestep and state. Do not introduce browser-timer physics or an autonomous repeating cylinder animation. RequestAnimationFrame paints snapshots; the solver controls time.

## 10. Pressure, flow, and diagnosis

Pressure is a scalar; flow is a signed quantity or direction. A pressurized line can have zero flow. Exhaust denotes an open path to atmosphere, not a hydraulic return reservoir. Use the engine's actual state where available; do not paint every disconnected segment blue.

| State | Visual | Motion |
| --- | --- | --- |
| Pressurized | Red solid line + pressure reading | Chevrons only with nonzero reported flow |
| Exhaust-connected | Blue solid line + exhaust label | Follow reported flow toward atmosphere |
| Inactive | Gray solid line | None |
| Trapped pressure | Amber dashed line + lock badge + pressure value | None unless the model reports flow |
| Unknown/unresolved | Muted violet dotted line + `?` badge | None |
| Control signal | Distinct dashed control style with `SIG` label | Use Boolean active indicator |

The tubing SVGs are samples, not a tilemap requirement. Route continuous orthogonal paths in production; do not stretch elbow PNGs. Render a dark outline or white halo where lines overlap busy art. A junction is a graph node, not an inferred visual crossing. Keep disconnected crossing bridges distinct from tee/cross junction dots.

If the MVP has only Boolean pressure propagation, label its values accordingly and omit unsupported pressure gradients, trapped-air diagnosis, and flow-rate displays. An absent solver value should read “Unavailable,” not zero. Preserve full precision in the model; format typical inspector measurements to one decimal when helpful.

## 11. States that need intentional UI

Empty circuit: one clear “Add an air supply” action, an optional starter circuit, and the small training-bench illustration. Asset load failure: a neutral labeled placeholder with unchanged footprint and anchors; no broken-image icons replacing a port. Unknown component type on import: preserve its saved record and report the unsupported type.

Invalid connection: highlight the two relevant ports and explain the problem in plain language. Examples: “This is a signal output. Select a control input.” or “Choose a second port.” An open air port may be an intentional exhaust depending on the engine; validation must respect its semantics.

Parameter error: “Stroke must be greater than 0 mm.” Keep the entered text available to correct. Run failure: keep the circuit editable, highlight the affected component, and provide a focusable issue list. Toasts confirm transient actions; persistent faults remain visible until resolved.

Export/import: show pending state, success only after completion, and actionable failure text. Preserve the existing extension and schema; `.pneu` in the old concept is not evidence of the MVP's implemented format. Reset affects simulation, New affects the project, and these must remain distinct actions.

## 12. Accessibility and teaching use

Every icon-only button needs a name and tooltip. View choices expose pressed state. Selection, flow direction, pressure category, and errors need shape/text reinforcement as well as color. Keyboard focus must remain visible on both backgrounds. The canvas needs an accessible component list and connection list if the existing editor is pointer-oriented.

Announce selection changes, playback changes, errors, and completed connection actions with a polite live region. Do not announce each animation frame or every fluctuating measurement. Keep measurement text selectable. Support 200% browser zoom and reduced motion. Keep context menus usable by keyboard.

For lessons, allow a focused “How it works” comparison showing the selected symbol and hardware. Describe what the student can observe: “Pressing V1 connects supply port 1 to port 4.” Avoid inferring outcomes that depend on unknown tubing. Let the instructor decide when to default students to symbols; hardware is an alternate explanation of the same model.

## 13. Implementation order

1. Read repository instructions and inspect the MVP's component registry, renderer, state store, solver outputs, port coordinates, persistence, and tests. Write a short adapter map before editing.
2. Add assets and CSS tokens. Preserve working component IDs and add explicit aliases where needed.
3. Establish shared bounds and port transforms; implement the view preference. Verify one connected cylinder circuit before expanding coverage.
4. Connect continuous cylinder/gauge state and discrete valve/input state. Check the truth tables against engine spool polarity.
5. Restyle the existing shell, library, inspector, and transport. Preserve working interactions and keyboard behavior.
6. Add pressure/flow overlays only for values the engine actually supplies; implement empty/error states and accessible alternatives.
7. Complete the focused acceptance checks below and capture both views of the same circuit.

## 14. Acceptance criteria for the integration agent

- Switching views while paused and running preserves serialized circuit data, selection, camera, current time, input state, cylinder position, and pressures.
- Every port anchor matches between both views at 0°, 90°, 180°, and 270°. Attached tubes remain attached at 50%, 100%, and 200% camera zoom.
- The same two pieces at 0%, 25%, 50%, 75%, and 100% fit the reserved bounds. Continuous state moves only the intended groups. No rod clipping at full extension.
- Valve internal paths and the engine's rest/actuated state agree with the explicit mapping. Reversing cylinder plumbing reverses the expected motion without changing valve art logic.
- A held/released momentary input cannot remain stuck after pointer cancellation, lost focus, reset, or view changes.
- Pause freezes engine time; Step advances exactly the declared step; Reset preserves topology; speed controls do not alter simulated physics.
- A pressurized end-stop circuit shows no decorative flow unless the engine reports flow. Unknown data is not displayed as zero.
- Crossings and junctions have distinct graph behavior and appearance. Control signals cannot be wired to air ports.
- Keyboard placement/selection/connection and inspector editing are usable. Shortcuts do not fire while typing. Live regions do not chatter at frame rate.
- Controls and labels remain usable at narrow widths and 200% browser zoom. Reduced motion removes decorative motion.
- Import/export round-trips preserve the MVP schema. The missing-art fallback preserves port geometry and component identity.

## 15. Explicit scope limits

This is a complete visual starter package for the listed components, not an ISO symbol certification or an implementation audit of unseen code. Electrical/control glyphs are intentionally identified as such. Logic gates, double-pilot valves, 5/3 variants, solenoids, FRL assemblies, and other future components require their own explicit definitions before appearing as usable palette items. Keep the supplied graphics and truthful fallback behavior even when an engine feature is not yet implemented.
