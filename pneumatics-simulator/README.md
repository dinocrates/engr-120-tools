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
| Transport — Run / Pause / Step / Reset, speed, live position meter (SDD §22, §36) | ✅ |
| Network-state solver — pressurised / exhausting / trapped regions (SDD §9–11) | ✅ |
| White-halo tubing in five states (UI_DESIGN_BIBLE §10) | ✅ |
| Components: air supply, exhaust, 3/2 NC valve, 5/2 valve, single- & double-acting cylinder | ✅ |
| Flow control, check valve, regulator, gauge, limit valve, standalone signal glyphs | ⬜ need solver features (UI_DESIGN_BIBLE §15) |
| Camera pan / zoom, undo / redo, tube branch junctions | ⬜ not yet |
| Full canvas accessibility (component/connection lists, live-region announcements) | ⬜ partial |

## Develop

```bash
npm install
npm run dev        # http://localhost:5173/engr-120-tools/pneumatics-simulator/
npm run build      # tsc --noEmit && vite build  ->  dist/
npm run smoke      # Playwright MVP + view-toggle check; needs `npm run dev`.
                   # CHROME_PATH reuses a system Chrome.
```

## Architecture

The SDD's separation of concerns (§46) is physical — one directory per layer,
and the simulation engine never imports rendering or the DOM:

```
src/
  kit/         the UI kit — manifest.ts, bundled SVG assets, render-state.ts, css/
  model/       diagram data model, geometry (centre-pivot), the Store
  components/  ComponentDef built from the kit manifest + engine behaviour
  solver/      network-state pressure solver + validator
  sim/         simulation engine — the §11 phase cycle, valve logic, cylinder motion
  render/      SVG renderer — inlines kit artwork, view toggle, pointer interaction
  ui/          brand header, library, inspector, transport, status, demo circuit
  events/      typed event bus (§32)
```

Data flow: `Store` (model) → `Engine` reads the circuit each tick and writes a
`RuntimeState` → `Renderer` swaps/pushes that into the inlined kit SVGs.

**Adding a kit component** that needs no new physics (another valve, say): add an
entry to `BEHAVIOURS` in `components/defs.ts` and to `LIBRARY_ORDER`. Geometry,
ports, and valve truth tables come from `src/kit/manifest.json` automatically.
