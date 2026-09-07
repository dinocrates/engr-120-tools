import type { EventBus } from "@/events/bus.ts";
import type { Store } from "@/model/store.ts";
import type { Engine } from "@/sim/engine.ts";
import { validate } from "@/solver/validate.ts";

interface Args {
  host: HTMLElement;
  store: Store;
  engine: Engine;
  bus: EventBus;
}

/** Status / warnings strip (UI_DESIGN_BIBLE §11, §24). */
export function mountStatus({ host, store, engine, bus }: Args): void {
  const render = (payload?: unknown): void => {
    const issues = validate(store.circuit);
    const warnings = engine.runtime.warnings;
    const err = (payload as { error?: string } | undefined)?.error;

    const items: string[] = [];
    if (err) items.push(`<li class="s-error">${escape(err)}</li>`);
    for (const i of issues) items.push(`<li class="s-${i.severity}">${escape(i.message)}</li>`);
    for (const w of warnings) items.push(`<li class="s-warning">${escape(w)}</li>`);

    const head =
      items.length === 0
        ? `<span class="s-ok">${store.mode === "run" ? "Simulation running — no issues." : "No issues."}</span>`
        : `<span>${items.length} item${items.length === 1 ? "" : "s"} to review</span>`;

    host.innerHTML = `${head}<ul class="status-list">${items.join("")}</ul>`;
  };

  bus.on("status:changed", render);
  bus.on("circuit:changed", render);
  bus.on("mode:changed", render);
  bus.on("sim:reset", render);
  bus.on("valve:changed", render);
  bus.on("sim:tick", () => {
    if (engine.runtime.warnings.length) render();
  });
  render();
}

function escape(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
}
