import { EventBus } from "@/events/bus.ts";
import { Store } from "@/model/store.ts";
import { Engine } from "@/sim/engine.ts";
import { Renderer } from "@/render/renderer.ts";
import { mountLibrary } from "@/ui/library.ts";
import { mountProperties } from "@/ui/properties.ts";
import { mountControls } from "@/ui/controls.ts";
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

mountLibrary($("library"), renderer, bus, store);
mountProperties($("properties"), store, engine, bus);
mountControls($("sim-controls"), store, engine, bus);
mountStatus($("status"), store, engine, bus);

// Start from the SDD §48 MVP circuit so there is something to run immediately.
store.load(JSON.stringify(demoCircuit()));
engine.reset();

// ---- main loop -------------------------------------------------------------
let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (engine.running) engine.tick(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// keyboard: delete selection, rotate, escape
window.addEventListener("keydown", (e) => {
  if (store.mode !== "edit") return;
  const sel = store.selection;
  if (!sel) return;
  if (e.key === "Delete" || e.key === "Backspace") {
    if (store.getComponent(sel)) store.removeComponent(sel);
    else store.removeConnection(sel);
    bus.emit("status:changed");
  } else if (e.key === "r" || e.key === "R") {
    store.rotateComponent(sel, e.shiftKey ? -90 : 90);
  } else if (e.key === "Escape") {
    store.select(null);
    renderer.setPendingType(null);
  }
});
