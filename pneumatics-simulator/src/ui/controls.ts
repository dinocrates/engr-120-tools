import { getDef } from "@/components/defs.ts";
import type { EventBus } from "@/events/bus.ts";
import type { Store } from "@/model/store.ts";
import type { Engine } from "@/sim/engine.ts";
import { DEMOS } from "./demo.ts";
import { iconSvg } from "./icons.ts";

interface Args {
  host: HTMLElement;
  actions: HTMLElement;
  store: Store;
  engine: Engine;
  bus: EventBus;
}

const SPEEDS = [0.25, 0.5, 1, 2, 4];
const STEP_DT = 1 / 30;

/** Transport bar (UI_DESIGN_BIBLE §22) + project actions (§5). */
export function mountControls({ host, actions, store, engine, bus }: Args): void {
  actions.innerHTML = `
    <button class="pneu-button" data-act="new">${iconSvg("new")}New</button>
    <button class="pneu-button" data-act="open">${iconSvg("open")}Open</button>
    <button class="pneu-button" data-act="save">${iconSvg("save")}Save</button>
    <button class="pneu-button icon-only" data-act="undo" title="Undo" aria-label="Undo">${iconSvg("undo")}</button>
    <button class="pneu-button icon-only" data-act="redo" title="Redo" aria-label="Redo">${iconSvg("redo")}</button>
    <label class="demo-pick">${iconSvg("book")}
      <select data-act="demo" aria-label="Load a demo circuit">
        <option value="">Demo…</option>
        ${DEMOS.map((d) => `<option value="${d.id}">${d.name}</option>`).join("")}
      </select>
    </label>`;

  host.innerHTML = `
    <button class="pneu-button run" id="run">${iconSvg("run")}Run</button>
    <button class="pneu-button" id="pause" disabled>${iconSvg("pause")}Pause</button>
    <button class="pneu-button" id="step">${iconSvg("step")}Step</button>
    <button class="pneu-button" id="reset">${iconSvg("reset")}Reset</button>
    <label class="speed">Speed
      <select id="speed">${SPEEDS.map((s) => `<option value="${s}"${s === 1 ? " selected" : ""}>${s}×</option>`).join("")}</select>
    </label>
    <div class="pos-readout">
      <span id="time" class="time">t = 0.00 s</span>
      <span id="posText">—</span>
      <div class="meter"><div id="posMeter" style="width:0%"></div></div>
    </div>`;

  const $ = <T extends HTMLElement>(id: string): T => host.querySelector<T>(`#${id}`)!;
  const run = $<HTMLButtonElement>("run");
  const pause = $<HTMLButtonElement>("pause");
  const step = $<HTMLButtonElement>("step");
  const fileInput = document.getElementById("fileInput") as HTMLInputElement;

  const undoBtn = actions.querySelector<HTMLButtonElement>('[data-act="undo"]')!;
  const redoBtn = actions.querySelector<HTMLButtonElement>('[data-act="redo"]')!;

  const syncHistory = (): void => {
    const editable = store.mode === "edit";
    undoBtn.disabled = !editable || !store.canUndo;
    redoBtn.disabled = !editable || !store.canRedo;
  };
  undoBtn.addEventListener("click", () => {
    store.undo();
    bus.emit("status:changed");
  });
  redoBtn.addEventListener("click", () => {
    store.redo();
    bus.emit("status:changed");
  });
  bus.on("history:changed", syncHistory);
  bus.on("mode:changed", syncHistory);

  const setRunMode = (on: boolean): void => {
    store.setMode(on ? "run" : "edit");
    for (const a of ["new", "open", "save", "demo"]) {
      actions.querySelector<HTMLButtonElement>(`[data-act="${a}"]`)!.disabled = on;
    }
    syncHistory();
  };
  const syncButtons = (): void => {
    run.disabled = engine.running;
    pause.disabled = !engine.running;
    step.disabled = engine.running;
  };

  run.addEventListener("click", () => {
    if (store.mode === "edit") {
      engine.reset();
      setRunMode(true);
    }
    engine.start();
    syncButtons();
  });
  pause.addEventListener("click", () => {
    engine.pause();
    syncButtons();
  });
  step.addEventListener("click", () => {
    if (store.mode === "edit") {
      engine.reset();
      setRunMode(true);
    }
    engine.pause();
    engine.tick(STEP_DT);
    syncButtons();
  });
  $("reset").addEventListener("click", () => {
    engine.reset();
    setRunMode(false);
    syncButtons();
  });
  $<HTMLSelectElement>("speed").addEventListener("change", (e) => {
    engine.speed = Number((e.target as HTMLSelectElement).value);
  });

  const loadCircuit = (json: string): void => {
    store.load(json);
    engine.reset();
    setRunMode(false);
    syncButtons();
    bus.emit("status:changed");
  };

  actions.querySelector('[data-act="new"]')!.addEventListener("click", () => {
    if (store.circuit.components.length && !confirm("Discard the current circuit?")) return;
    store.clear();
    engine.reset();
    bus.emit("status:changed");
  });
  const demoSel = actions.querySelector<HTMLSelectElement>('[data-act="demo"]')!;
  demoSel.addEventListener("change", () => {
    const demo = DEMOS.find((d) => d.id === demoSel.value);
    if (demo) loadCircuit(JSON.stringify(demo.circuit()));
    demoSel.value = "";
  });
  actions.querySelector('[data-act="open"]')!.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (file) {
      try {
        loadCircuit(await file.text());
      } catch (err) {
        bus.emit("status:changed", { error: `Could not open file: ${String(err)}` });
      }
    }
    fileInput.value = "";
  });
  actions.querySelector('[data-act="save"]')!.addEventListener("click", () => {
    const blob = new Blob([store.serialize()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "circuit.json";
    a.click();
    URL.revokeObjectURL(url);
    document.getElementById("saveStatus")!.textContent = "Downloaded";
  });

  const updateReadout = (): void => {
    const cyl =
      (store.selection && store.getComponent(store.selection)?.type && getDef(store.getComponent(store.selection)!.type).cylinder
        ? store.getComponent(store.selection)!
        : undefined) ?? store.circuit.components.find((c) => getDef(c.type).cylinder);
    const live = store.mode === "run";
    const pos = cyl && live ? engine.runtime.cylinderPos.get(cyl.id) ?? 0 : 0;
    $("time").textContent = `t = ${engine.runtime.time.toFixed(2)} s`;
    $("posText").textContent = cyl ? `${cyl.label ?? cyl.id} ${live ? Math.round(pos * 100) + "%" : "—"}` : "—";
    $("posMeter").style.width = `${pos * 100}%`;
  };

  bus.on("sim:tick", updateReadout);
  bus.on("sim:reset", () => {
    syncButtons();
    updateReadout();
  });
  bus.on("sim:started", syncButtons);
  bus.on("sim:paused", syncButtons);
  bus.on("selection:changed", updateReadout);
  bus.on("circuit:changed", updateReadout);
  updateReadout();
  syncHistory();
}
