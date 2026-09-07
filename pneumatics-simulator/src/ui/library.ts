import { COMPONENT_DEFS, LIBRARY_ORDER } from "@/components/defs.ts";
import type { EventBus } from "@/events/bus.ts";
import type { Store } from "@/model/store.ts";
import type { Renderer } from "@/render/renderer.ts";

/** Component palette (SDD §5.1, §27). Click an item, then click the canvas to place. */
export function mountLibrary(host: HTMLElement, renderer: Renderer, bus: EventBus, store: Store): void {
  host.innerHTML = `<h2>Components</h2><div class="lib-list"></div>
    <p class="lib-hint">Click a component, then click the workspace to place it.
    Drag one port onto another to connect. <kbd>R</kbd> rotate &middot; <kbd>Del</kbd> remove.</p>`;
  const list = host.querySelector<HTMLDivElement>(".lib-list")!;

  for (const type of LIBRARY_ORDER) {
    const def = COMPONENT_DEFS[type]!;
    const btn = document.createElement("button");
    btn.className = "lib-item";
    btn.dataset.type = type;
    btn.textContent = def.name;
    btn.addEventListener("click", () => {
      const isActive = btn.classList.contains("active");
      renderer.setPendingType(isActive ? null : type);
    });
    list.append(btn);
  }

  bus.on("pending:changed", (type) => {
    list.querySelectorAll(".lib-item").forEach((b) => {
      b.classList.toggle("active", (b as HTMLElement).dataset.type === type);
    });
  });

  bus.on("mode:changed", () => host.classList.toggle("disabled", store.mode === "run"));
}
