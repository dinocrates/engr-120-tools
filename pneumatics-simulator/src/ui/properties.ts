import { getDef } from "@/components/defs.ts";
import type { EventBus } from "@/events/bus.ts";
import { nodeKey } from "@/model/geometry.ts";
import type { Store } from "@/model/store.ts";
import type { Engine } from "@/sim/engine.ts";

/** Properties panel + live diagnostics (SDD §5.1, §25). */
export function mountProperties(host: HTMLElement, store: Store, engine: Engine, bus: EventBus): void {
  const render = (): void => {
    const id = store.selection;
    const comp = id ? store.getComponent(id) : undefined;

    if (!comp) {
      const wire = id ? store.circuit.connections.find((w) => w.id === id) : undefined;
      host.innerHTML = wire
        ? `<h2>Connection</h2><dl class="props">
             <dt>From</dt><dd>${wire.from.component} &middot; ${wire.from.port}</dd>
             <dt>To</dt><dd>${wire.to.component} &middot; ${wire.to.port}</dd>
             <dt>State</dt><dd>${engine.runtime.connStates.get(wire.id) ?? "—"}</dd></dl>`
        : `<h2>Properties</h2><p class="muted">Select a component or connection.</p>`;
      return;
    }

    const def = getDef(comp.type);
    const rows: string[] = [
      `<dt>Type</dt><dd>${def.name}</dd>`,
      `<dt>Label</dt><dd><input class="p-label" value="${comp.label ?? ""}" ${store.mode === "run" ? "disabled" : ""}></dd>`,
      `<dt>Rotation</dt><dd>${comp.rotation}&deg;</dd>`,
    ];

    if (def.cylinder) {
      const pos = engine.runtime.cylinderPos.get(comp.id) ?? 0;
      const dir = engine.runtime.cylinderDir.get(comp.id) ?? "holding";
      const cap = engine.runtime.portStates.get(nodeKey(comp.id, def.cylinder.capPort)) ?? "—";
      const rod = engine.runtime.portStates.get(nodeKey(comp.id, def.cylinder.rodPort)) ?? "—";
      rows.push(
        `<dt>Extend speed</dt><dd><input type="number" step="0.05" min="0.05" max="3" class="p-param" data-key="extendSpeed" value="${comp.params.extendSpeed ?? 0.6}" ${store.mode === "run" ? "disabled" : ""}></dd>`,
        `<dt>Retract speed</dt><dd><input type="number" step="0.05" min="0.05" max="3" class="p-param" data-key="retractSpeed" value="${comp.params.retractSpeed ?? 0.6}" ${store.mode === "run" ? "disabled" : ""}></dd>`,
        `<dt>Position</dt><dd>${Math.round(pos * 100)}%</dd>`,
        `<dt>Direction</dt><dd>${dir}</dd>`,
        `<dt>Cap side</dt><dd>${cap}</dd>`,
        `<dt>Rod side</dt><dd>${rod}</dd>`,
      );
    }

    if (def.valve) {
      const p = engine.runtime.valvePositions.get(comp.id) ?? def.valve.restPosition;
      const conns = def.valve.positions[p]!.connections.map(([a, b]) => `${a}&rarr;${b}`).join(", ");
      rows.push(
        `<dt>Actuation</dt><dd>${def.actuation?.control ?? "—"} / ${comp.params.return ?? "—"}</dd>`,
        `<dt>Position</dt><dd>${def.valve.positions[p]!.name ?? p} (${conns})</dd>`,
      );
    }

    host.innerHTML = `<h2>${comp.label ?? def.name}</h2><dl class="props">${rows.join("")}</dl>`;

    host.querySelector<HTMLInputElement>(".p-label")?.addEventListener("change", (e) => {
      store.setLabel(comp.id, (e.target as HTMLInputElement).value);
    });
    host.querySelectorAll<HTMLInputElement>(".p-param").forEach((inp) => {
      inp.addEventListener("change", () => {
        store.setParam(comp.id, inp.dataset.key!, Number(inp.value));
      });
    });
  };

  bus.on("selection:changed", render);
  bus.on("circuit:changed", render);
  bus.on("mode:changed", render);
  // live values while running
  let selectedIsLive = false;
  bus.on("selection:changed", () => {
    const id = store.selection;
    const comp = id ? store.getComponent(id) : undefined;
    selectedIsLive = Boolean(comp && (getDef(comp.type).cylinder || getDef(comp.type).valve));
  });
  bus.on("sim:tick", () => {
    if (selectedIsLive) render();
  });
  bus.on("valve:changed", () => {
    if (selectedIsLive) render();
  });
  render();
}
