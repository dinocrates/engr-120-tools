import { COMPONENT_DEFS, LIBRARY_ORDER } from "@/components/defs.ts";
import type { EventBus } from "@/events/bus.ts";
import { kitComponent } from "@/kit/manifest.ts";
import { componentSvg } from "@/kit/render-state.ts";
import type { Store } from "@/model/store.ts";
import type { Renderer } from "@/render/renderer.ts";

interface Args {
  list: HTMLElement;
  renderer: Renderer;
  bus: EventBus;
  store: Store;
}

/** Searchable component palette (UI_DESIGN_BIBLE §5.1, §6, §27). */
export function mountLibrary({ list, renderer, bus, store }: Args): void {
  list.innerHTML = `
    <p class="eyebrow">Component library</p>
    <div class="search-wrap">
      <input id="lib-search" class="search" type="search" placeholder="Search components…"
        aria-label="Search components" />
    </div>
    <div class="parts" id="lib-parts"></div>
    <p class="instruction">Click a component, then click the workspace to place it.
    Drag one port onto another to connect. <kbd>R</kbd> rotates, <kbd>Del</kbd> removes.</p>`;

  const parts = list.querySelector<HTMLDivElement>("#lib-parts")!;
  const search = list.querySelector<HTMLInputElement>("#lib-search")!;

  const render = (): void => {
    const q = search.value.trim().toLowerCase();
    const matches = LIBRARY_ORDER.map((id) => COMPONENT_DEFS[id]!).filter(
      (d) => d.name.toLowerCase().includes(q) || d.category.toLowerCase().includes(q) || d.type.includes(q),
    );

    if (matches.length === 0) {
      parts.innerHTML = `<p class="empty-result">No components match “${escapeHtml(search.value)}”.</p>`;
      return;
    }

    let category = "";
    parts.innerHTML = matches
      .map((d) => {
        const head = d.category !== category ? `<p class="category">${d.category}</p>` : "";
        category = d.category;
        const thumb = componentSvg(kitComponent(d.type), "symbol", d.defaultState);
        return `${head}<button class="part" type="button" data-type="${d.type}">${thumb}<span>${d.name}</span></button>`;
      })
      .join("");

    parts.querySelectorAll<HTMLButtonElement>(".part").forEach((btn) => {
      btn.addEventListener("click", () => {
        const active = btn.classList.contains("active");
        renderer.setPendingType(active ? null : btn.dataset.type!);
      });
    });
  };

  search.addEventListener("input", render);
  bus.on("pending:changed", (type) => {
    parts.querySelectorAll(".part").forEach((b) => {
      b.classList.toggle("active", (b as HTMLElement).dataset.type === type);
    });
  });
  bus.on("mode:changed", () => list.classList.toggle("disabled", store.mode === "run"));

  render();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
