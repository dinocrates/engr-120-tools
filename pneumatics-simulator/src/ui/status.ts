import type { EventBus } from "@/events/bus.ts";
import type { Store } from "@/model/store.ts";
import type { Engine } from "@/sim/engine.ts";
import { validate } from "@/solver/validate.ts";

/** Status / warnings panel (SDD §24). */
export function mountStatus(host: HTMLElement, store: Store, engine: Engine, bus: EventBus): void {
  const render = (payload?: unknown): void => {
    const issues = validate(store.circuit);
    const warnings = engine.runtime.warnings;
    const err = (payload as { error?: string } | undefined)?.error;

    const items: string[] = [];
    if (err) items.push(`<li class="s-error">${escape(err)}</li>`);
    for (const i of issues) {
      items.push(`<li class="s-${i.severity}">${escape(i.message)}</li>`);
    }
    for (const w of warnings) items.push(`<li class="s-warning">${escape(w)}</li>`);

    const summary =
      items.length === 0
        ? `<span class="s-ok">No issues${store.mode === "run" ? " — running" : ""}.</span>`
        : `<span class="s-count">${items.length} item${items.length === 1 ? "" : "s"}</span>`;

    host.innerHTML = `<div class="status-head">${summary}</div><ul class="status-list">${items.join("")}</ul>`;
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
