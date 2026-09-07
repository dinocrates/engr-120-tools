import { EventBus } from "@/events/bus.ts";
import { Store } from "@/model/store.ts";
import { Engine } from "@/sim/engine.ts";
import { Renderer } from "@/render/renderer.ts";
import { mountBrand } from "@/ui/brand.ts";
import { mountLibrary } from "@/ui/library.ts";
import { mountProperties } from "@/ui/properties.ts";
import { mountControls } from "@/ui/controls.ts";
import { mountControlPanel } from "@/ui/control-panel.ts";
import { mountStatus } from "@/ui/status.ts";
import { demoCircuit } from "@/ui/demo.ts";
import "@/ui/style.css";

const $ = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el;
};

const bus = new EventBus();
const store = new Store(bus);
const engine = new Engine(() => store.circuit, bus);
const renderer = new Renderer($("workspace"), store, engine, bus);

mountBrand($("brand"));
mountLibrary({ list: $("library"), renderer, bus, store });
mountControlPanel({ host: $("run-controls"), store, engine, bus });
mountProperties({ host: $("properties"), store, engine, bus, renderer });
mountControls({ host: $("sim-controls"), actions: $("toolbar-actions"), store, engine, bus });
mountStatus({ host: $("status"), store, engine, bus });

// Segmented Symbols | Components control (UI_DESIGN_BIBLE §5).
const viewButtons: Record<string, HTMLButtonElement> = {
  symbol: $("viewSymbol") as HTMLButtonElement,
  component: $("viewComponent") as HTMLButtonElement,
};
for (const [view, btn] of Object.entries(viewButtons)) {
  btn.addEventListener("click", () => renderer.setView(view as "symbol" | "component"));
}
const syncBadge = (): void => {
  for (const [view, btn] of Object.entries(viewButtons)) {
    btn.setAttribute("aria-pressed", String(renderer.currentView === view));
  }
  $("stateBadge").textContent =
    `${store.mode === "run" ? (engine.running ? "RUNNING" : "PAUSED") : "EDIT"} · ${renderer.currentView.toUpperCase()}S`;
};
bus.on("view:changed", syncBadge);
bus.on("mode:changed", syncBadge);
bus.on("sim:started", syncBadge);
bus.on("sim:paused", syncBadge);
bus.on("sim:reset", syncBadge);

store.load(JSON.stringify(demoCircuit()));
engine.reset();
syncBadge();

// ---- main loop -------------------------------------------------------------
let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (engine.running) engine.tick(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---- keyboard (UI_DESIGN_BIBLE §6) ---------------------------------------
window.addEventListener("keydown", (e) => {
  const t = e.target as HTMLElement;
  if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
    return;
  }
  const sel = store.selection;
  if (store.mode === "edit" && sel) {
    if (e.key === "Delete" || e.key === "Backspace") {
      if (store.getComponent(sel)) store.removeComponent(sel);
      else store.removeConnection(sel);
      bus.emit("status:changed");
      return;
    }
    if (e.key === "r" || e.key === "R") {
      store.rotateComponent(sel, e.shiftKey ? -90 : 90);
      return;
    }
  }
  if (e.key === "Escape") {
    store.select(null);
    renderer.setPendingType(null);
  }
});
