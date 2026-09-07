import type { EventBus } from "@/events/bus.ts";
import type { Store } from "@/model/store.ts";
import type { Engine } from "@/sim/engine.ts";
import { demoCircuit } from "./demo.ts";

const SPEEDS = [0.25, 0.5, 1, 2, 4];
const STEP_DT = 1 / 30;

/** Simulation toolbar (SDD §22) plus file actions (SDD §28). */
export function mountControls(host: HTMLElement, store: Store, engine: Engine, bus: EventBus): void {
  host.innerHTML = `
    <div class="ctl-group">
      <button data-act="run" class="ctl-primary">Run</button>
      <button data-act="pause" disabled>Pause</button>
      <button data-act="step">Step</button>
      <button data-act="reset">Reset</button>
    </div>
    <label class="ctl-speed">Speed
      <select data-act="speed">
        ${SPEEDS.map((s) => `<option value="${s}" ${s === 1 ? "selected" : ""}>${s}&times;</option>`).join("")}
      </select>
    </label>
    <div class="ctl-group ctl-file">
      <button data-act="save">Save</button>
      <button data-act="load">Load</button>
      <button data-act="demo">Demo</button>
      <button data-act="clear">Clear</button>
    </div>
    <input type="file" accept="application/json" hidden data-act="file">`;

  const btn = (a: string) => host.querySelector<HTMLButtonElement>(`[data-act="${a}"]`)!;
  const fileInput = host.querySelector<HTMLInputElement>('[data-act="file"]')!;

  const setRunning = (running: boolean): void => {
    store.setMode(running ? "run" : "edit");
    btn("run").disabled = running;
    btn("pause").disabled = !running;
    btn("step").disabled = running;
    for (const a of ["save", "load", "demo", "clear"]) btn(a).disabled = running;
  };

  btn("run").addEventListener("click", () => {
    if (store.mode === "edit") {
      engine.reset();
      setRunning(true);
    }
    engine.start();
  });
  btn("pause").addEventListener("click", () => {
    engine.pause();
    btn("run").disabled = false;
    btn("step").disabled = false;
  });
  btn("step").addEventListener("click", () => {
    if (store.mode === "edit") {
      engine.reset();
      setRunning(true);
    }
    engine.pause();
    btn("run").disabled = false;
    engine.tick(STEP_DT);
  });
  btn("reset").addEventListener("click", () => {
    engine.reset();
    setRunning(false);
  });

  host.querySelector<HTMLSelectElement>('[data-act="speed"]')!.addEventListener("change", (e) => {
    engine.speed = Number((e.target as HTMLSelectElement).value);
  });

  btn("save").addEventListener("click", () => {
    const blob = new Blob([store.serialize()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "circuit.json";
    a.click();
    URL.revokeObjectURL(url);
  });
  btn("load").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      store.load(await file.text());
      engine.reset();
      bus.emit("status:changed");
    } catch (err) {
      bus.emit("status:changed", { error: String(err) });
    }
    fileInput.value = "";
  });
  btn("demo").addEventListener("click", () => {
    store.load(JSON.stringify(demoCircuit()));
    engine.reset();
    bus.emit("status:changed");
  });
  btn("clear").addEventListener("click", () => {
    store.clear();
    engine.reset();
    bus.emit("status:changed");
  });
}
