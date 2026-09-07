# Pneumatic Circuit Simulator

Browser-based pneumatic circuit simulator for ENGR 120. Build a schematic from
standard components, run it, operate the controls, and watch pressure, valve
spools, and cylinders respond.

Full design: [DESIGN.md](DESIGN.md).

## Status

**MVP (SDD §48) — working.** The demo circuit loads on startup:
air supply → 5/2 spring-return pushbutton valve → double-acting cylinder.
Press **Run**, then press and hold the valve; the spool shifts, pressure
propagates, and the cylinder extends. Release and it retracts.

Implemented so far:

| Area | State |
| --- | --- |
| Diagram editor — place, move, rotate, delete, port-snap connections | ✅ |
| Save / load / clear circuit (JSON, SDD §28) | ✅ |
| Network-state solver — pressurized / exhausting / trapped regions (SDD §9–11, §33) | ✅ |
| Directional-valve model, data-driven positions (SDD §12, §44) | ✅ |
| Momentary pushbutton + spring return (SDD §13, §45) | ✅ |
| Double-acting cylinder — timed motion, normalized position (SDD §14–15, §35) | ✅ |
| Run / Pause / Step / Reset + simulation speed (SDD §22, §36) | ✅ |
| Edit-locked-during-run (SDD §23) | ✅ |
| Basic validation + live diagnostics (SDD §24–25) | ✅ |
| SVG symbols, spool-shift / button / rod / flow animation (SDD §20–21, §43) | ✅ |
| Single-acting cyl, 3/2·2/2·4/2 valves, flow control, check valve, regulator, gauge, sensors | ⬜ next |
| Explain mode, fault insertion, assessment, electro-pneumatics | ⬜ later phases |

## Develop

```bash
npm install
npm run dev        # http://localhost:5173/engr-120-tools/pneumatics-simulator/
npm run build      # tsc --noEmit && vite build  ->  dist/
npm run smoke      # Playwright MVP check; needs `npm run dev` running.
                   # Set CHROME_PATH to reuse a system Chrome.
```

## Architecture

The SDD's separation of concerns (§46) is physical — each layer is a directory
and the simulation engine never imports rendering or DOM:

```
src/
  model/       diagram data model, geometry, the Store (edit/run + selection)
  components/   data-driven component definitions (ports, valve positions, roles)
  solver/       network-state pressure solver + circuit validator
  sim/          simulation engine — the §11 phase cycle, valve logic, cylinder motion
  render/       SVG renderer, symbol registry, pointer interaction
  ui/           library palette, properties panel, sim controls, status, demo circuit
  events/       typed event bus (§32)
```

Data flow: `Store` (model) → `Engine` reads the circuit each tick and writes a
`RuntimeState` → `Renderer` pushes that runtime into existing SVG nodes.
Adding a new valve type is a new entry in `components/defs.ts` plus a symbol in
`render/symbols.ts` — no engine changes.
