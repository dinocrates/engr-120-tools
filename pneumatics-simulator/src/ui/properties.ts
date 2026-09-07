import { getDef } from "@/components/defs.ts";
import type { EventBus } from "@/events/bus.ts";
import { kitComponent } from "@/kit/manifest.ts";
import { componentSvg } from "@/kit/render-state.ts";
import { nodeKey } from "@/model/geometry.ts";
import type { Store } from "@/model/store.ts";
import type { Engine } from "@/sim/engine.ts";
import type { Renderer } from "@/render/renderer.ts";

interface Args {
  host: HTMLElement;
  store: Store;
  engine: Engine;
  bus: EventBus;
  renderer: Renderer;
}

/** Inspector: identity, editable params, read-only live values, learn panel
 *  (UI_DESIGN_BIBLE §5.1, §25). */
export function mountProperties({ host, store, engine, bus, renderer }: Args): void {
  let liveSelected = false;

  const render = (): void => {
    const id = store.selection;
    const comp = id ? store.getComponent(id) : undefined;

    if (!comp) {
      const wire = id ? store.circuit.connections.find((w) => w.id === id) : undefined;
      if (wire) {
        const state = engine.runtime.connStates.get(wire.id);
        host.innerHTML = `
          <p class="eyebrow">Connection</p>
          <dl class="props">
            <dt>From</dt><dd class="ro">${wire.from.component} · ${wire.from.port}</dd>
            <dt>To</dt><dd class="ro">${wire.to.component} · ${wire.to.port}</dd>
            <dt>State <span class="readonly-flag">live</span></dt>
            <dd class="ro">${store.mode === "run" ? state ?? "Unavailable" : "—"}</dd>
          </dl>`;
        return;
      }
      host.innerHTML = `
        <p class="eyebrow">Circuit</p>
        <p class="muted">Nothing selected.</p>
        <div class="callout">
          <strong>Build a circuit</strong><br />
          1. Add an air supply.<br />
          2. Add a valve and a cylinder.<br />
          3. Connect ports by dragging one onto another.<br />
          4. Vent the valve exhaust ports to an exhaust.<br />
          5. Press <em>Run</em>, then hold the valve to actuate it.
        </div>`;
      return;
    }

    const def = getDef(comp.type);
    const runMode = store.mode === "run";
    const rt = engine.runtime;
    const rows: string[] = [
      `<dt>Type</dt><dd class="ro">${def.name}</dd>`,
      `<dt>Label</dt><dd><input class="p-label" value="${escapeAttr(comp.label ?? "")}" ${runMode ? "disabled" : ""} /></dd>`,
      `<dt>Rotation</dt><dd class="ro">${comp.rotation}°</dd>`,
    ];

    if (def.cylinder) {
      const pos = rt.cylinderPos.get(comp.id) ?? 0;
      const dir = rt.cylinderDir.get(comp.id) ?? "holding";
      const cap = portReadout(rt, comp.id, def.cylinder.capPort, runMode);
      const rod = def.cylinder.rodPort ? portReadout(rt, comp.id, def.cylinder.rodPort, runMode) : "—";
      rows.push(
        numRow("Stroke", "stroke", comp.params.stroke ?? 200, "mm", runMode, 1),
        numRow("Extend speed", "extendSpeed", comp.params.extendSpeed ?? 0.6, "/s", runMode, 0.05),
        numRow("Retract speed", "retractSpeed", comp.params.retractSpeed ?? 0.6, "/s", runMode, 0.05),
        `<dt>Position <span class="readonly-flag">live</span></dt><dd class="ro">${runMode ? Math.round(pos * 100) + "%" : "—"}</dd>`,
        `<dt>Direction <span class="readonly-flag">live</span></dt><dd class="ro">${runMode ? dir : "—"}</dd>`,
        `<dt>Cap side <span class="readonly-flag">live</span></dt><dd class="ro">${cap}</dd>`,
        `<dt>Rod side <span class="readonly-flag">live</span></dt><dd class="ro">${rod}</dd>`,
      );
    }

    if (def.valve) {
      const idx = runMode ? rt.valvePositions.get(comp.id) ?? def.valve.restPosition : def.valve.restPosition;
      const p = def.valve.positions[idx]!;
      const conns = p.connections.map(([a, b]) => `${a}→${b}`).join(", ") || "all blocked";
      rows.push(
        `<dt>Actuation</dt><dd class="ro">${def.actuation?.control ?? "—"} / ${comp.params.return ?? "—"}</dd>`,
        `<dt>Position <span class="readonly-flag">live</span></dt><dd class="ro">${p.name} — ${conns}</dd>`,
      );
    }

    if (def.supply) {
      rows.push(numRow("Pressure", "pressure", comp.params.pressure ?? 600, "kPa", runMode, 10));
    }

    const compareHtml = (["symbol", "component"] as const)
      .map((v) => {
        const active = renderer.currentView === v ? " active" : "";
        return `<figure class="${active.trim()}">${componentSvg(kitComponent(comp.type), v, def.defaultState)}<figcaption>${v === "symbol" ? "SYMBOL" : "HARDWARE"}</figcaption></figure>`;
      })
      .join("");

    host.innerHTML = `
      <p class="eyebrow">Selected component</p>
      <div class="title-row"><h2>${escapeHtml(comp.label ?? def.name)}</h2><span class="tag">${comp.id}</span></div>
      <p class="sub">${def.category}</p>
      <div class="compare">${compareHtml}</div>
      <dl class="props">${rows.join("")}</dl>
      <details class="howto">
        <summary>How it works</summary>
        <p>${howto(def)}</p>
      </details>`;

    host.querySelector<HTMLInputElement>(".p-label")?.addEventListener("change", (e) => {
      store.setLabel(comp.id, (e.target as HTMLInputElement).value);
    });
    host.querySelectorAll<HTMLInputElement>(".p-num").forEach((inp) => {
      inp.addEventListener("change", () => {
        const v = Number(inp.value);
        if (Number.isFinite(v) && v > 0) store.setParam(comp.id, inp.dataset.key!, v);
        else render();
      });
    });
  };

  bus.on("selection:changed", () => {
    const id = store.selection;
    const comp = id ? store.getComponent(id) : undefined;
    liveSelected = Boolean(comp && (getDef(comp.type).cylinder || getDef(comp.type).valve));
    render();
  });
  bus.on("circuit:changed", render);
  bus.on("mode:changed", render);
  bus.on("view:changed", render);
  bus.on("sim:tick", () => liveSelected && render());
  bus.on("valve:changed", () => liveSelected && render());
  render();
}

function portReadout(
  rt: Engine["runtime"],
  compId: string,
  port: string,
  runMode: boolean,
): string {
  if (!runMode) return "—";
  return rt.portStates.get(nodeKey(compId, port)) ?? "Unavailable";
}

function numRow(
  label: string,
  key: string,
  value: unknown,
  unit: string,
  disabled: boolean,
  step: number,
): string {
  return `<dt>${label}</dt><dd><input class="p-num" type="number" step="${step}" data-key="${key}" value="${Number(value)}" ${disabled ? "disabled" : ""} /> <span class="muted">${unit}</span></dd>`;
}

function howto(def: ReturnType<typeof getDef>): string {
  if (def.supply) return "Provides pressurised air to the circuit at the configured pressure.";
  if (def.exhaust) return "An open path to atmosphere. Valve exhaust ports must connect here to vent.";
  if (def.valve) {
    return "The artwork shows both spool positions; the blue bar marks the active one. Pushing the button shifts the spool while held; the spring returns it on release.";
  }
  if (def.cylinder && def.cylinder.springReturn) {
    return "Air on the cap side extends the rod; the internal spring retracts it when cap pressure is removed.";
  }
  if (def.cylinder) return "Air on the cap side extends the rod, air on the rod side retracts it, with the other side venting.";
  return "Compare the functional symbol with the physical hardware. Port identifiers are the same in both views.";
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
}
function escapeAttr(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
