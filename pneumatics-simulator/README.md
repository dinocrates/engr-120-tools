# Pneumatic Circuit Simulator

Browser-based pneumatic circuit simulator for ENGR 120. Build a schematic from
standard components, run it, operate the controls, and watch pressure, valve
spools, and cylinders respond.

- Engine / behaviour design: [DESIGN.md](DESIGN.md) (the 50-section SDD)
- Visual / interaction design: [UI_DESIGN_BIBLE.md](UI_DESIGN_BIBLE.md) (kit v1.1)
- Visual target: [docs/interactive-reference.html](docs/interactive-reference.html)

## Status

**MVP (SDD §48) — working, with the UI kit integrated.** The demo circuit loads
on startup: air supply → 5/2 spring-return valve → double-acting cylinder, valve
exhaust ports vented through exhausts. Press **Run**, hold the valve; the spool
shifts, pressure propagates, the cylinder extends. Release and it retracts.

| Area | State |
| --- | --- |
| SNES shell — pixel header, Pneu Pixel font, blue/silver theme, tokens + snes CSS | ✅ |
| **Symbols / Components** view toggle — presentation only, preserves all state | ✅ |
| Asset-driven rendering — kit SVGs inlined, swapped by view + state | ✅ |
| Two-piece actuators — fixed body + shared piston, procedural single-acting spring | ✅ |
| Centre-pivot rotation shared by artwork and port anchors (0/90/180/270) | ✅ |
| Searchable categorised library with hardware/symbol thumbnails | ✅ |
| Inspector — identity, editable params, read-only live values, symbol/hardware compare, "How it works" | ✅ |
| **Explain mode** — select a component/line during sim for a live plain-language causal chain (SDD §26) | ✅ |
| Transport — Run / Pause / Step / Reset, speed, live position meter (SDD §22, §36) | ✅ |
| Run-mode operator control panel — latch valve actuators, supply on/off (UI_DESIGN_BIBLE §2.3, §6) | ✅ |
| Network-state solver — pressurised / exhausting / trapped regions (SDD §9–11) | ✅ |
| White-halo tubing in five states (UI_DESIGN_BIBLE §10) | ✅ |
| Pneumatic set: supply, exhaust, 3/2 & 5/2 valves, 5/2 double-pilot, limit valve, one-way flow control, check valve, single/double cylinder | ✅ |
| Self-sequencing — limit valve tripped by cylinder position, pilot-shifted bistable valve, auto-cycle (UI_DESIGN_BIBLE §38) | ✅ |
| Flow control (speed multiplier, §16) · check valve (one-way, load-holding, §17) | ✅ |
| **Electro-pneumatics** — DC/current voltage source, pass-through contacts (pushbutton, roller switch, proximity sensor), single/double-solenoid valves, signal lamp, distinct signal wiring, power on/off (§7) | ✅ |
| Camera pan / zoom / fit, undo / redo, unknown-type placeholder, deeper validation | ✅ |
| Relay logic, ladder-diagram view, PLC | ⬜ deliberately out of scope for now — the electrical layer stays "source + contacts + solenoid" |
| Regulator, gauge (need numeric pressure) | ⬜ later |
| Tube crossing jump-over bridges, branch junctions, flow chevrons | ⬜ not yet |
| Full canvas accessibility (component/connection lists, live-region announcements) | ⬜ partial |

## Develop

```bash
npm install
npm run dev        # http://localhost:5173/engr-120-tools/pneumatics-simulator/
npm run build      # tsc --noEmit && vite build  ->  dist/
npm run smoke      # Playwright: MVP loop, view toggle, control panel, auto-cycle,
                   # undo + unknown-type fallback. Needs `npm run dev` running;
                   # CHROME_PATH reuses a system Chrome.
```

Canvas: scroll to zoom, drag empty space to pan, the fit button (top-right of the
canvas) frames the circuit. <kbd>Ctrl/Cmd+Z</kbd> / <kbd>Shift+Ctrl/Cmd+Z</kbd>
undo/redo.

## Architecture

The SDD's separation of concerns (§46) is physical — one directory per layer,
and the simulation engine never imports rendering or the DOM:

```
src/
  kit/         the UI kit — manifest.ts, bundled SVG assets, render-state.ts, css/
  model/       diagram data model, geometry (centre-pivot), the Store
  components/  ComponentDef built from the kit manifest + engine behaviour
  solver/      network-state pressure solver + boolean signal solver + validator
  sim/         simulation engine — the §11 phase cycle, valve logic, cylinder motion
  render/      SVG renderer — inlines kit artwork, view toggle, pointer interaction
  ui/          brand header, library, inspector, run control panel, transport, status, demo
  sim/explain.ts   turns solved state into a plain-language causal chain (§26)
  events/      typed event bus (§32)
```

Data flow: `Store` (model) → `Engine` reads the circuit each tick and writes a
`RuntimeState` → `Renderer` swaps/pushes that into the inlined kit SVGs.

**Adding a kit component** that needs no new physics (another valve, say): add an
entry to `BEHAVIOURS` in `components/defs.ts` and to `LIBRARY_ORDER`. Geometry,
ports, and valve truth tables come from `src/kit/manifest.json` automatically;
components the vendored manifest doesn't ship are declared in
`src/kit/manifest.ts` (`EXTRA_COMPONENTS`).
