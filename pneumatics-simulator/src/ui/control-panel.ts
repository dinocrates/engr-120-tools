import { getDef } from "@/components/defs.ts";
import type { EventBus } from "@/events/bus.ts";
import type { Store } from "@/model/store.ts";
import type { Engine } from "@/sim/engine.ts";

interface Args {
  host: HTMLElement;
  store: Store;
  engine: Engine;
  bus: EventBus;
}

type ControlKind = "supply" | "actuator";

/**
 * Operator control panel (UI_DESIGN_BIBLE §2.3, §6). Shown on the right only
 * while the simulation runs. Lists every operable input in the circuit — supply
 * isolation, manual valve actuators, and (later) solenoids — as an on/off
 * toggle. Momentary press-and-hold on the canvas still works alongside it.
 *
 * The DOM is built once per circuit and only refreshed in place afterwards, so
 * a focused toggle keeps focus while the student clicks (bible §12).
 */
export function mountControlPanel({ host, store, engine, bus }: Args): void {
  let controls: Array<{ id: string; kind: ControlKind }> = [];

  const build = (): void => {
    const running = store.mode === "run";
    host.hidden = !running;
    if (!running) {
      host.replaceChildren();
      controls = [];
      return;
    }

    const supplies = store.circuit.components.filter((c) => getDef(c.type).supply);
    const actuators = store.circuit.components.filter((c) => getDef(c.type).actuation);
    controls = [
      ...supplies.map((c) => ({ id: c.id, kind: "supply" as const })),
      ...actuators.map((c) => ({ id: c.id, kind: "actuator" as const })),
    ];

    if (controls.length === 0) {
      host.innerHTML = `<p class="eyebrow">Controls</p><p class="muted">This circuit has no operable controls.</p>`;
      return;
    }

    host.innerHTML = `
      <p class="eyebrow">Controls</p>
      <p class="cp-hint">Click to hold a control on. For a momentary press, press &amp; hold the component on the canvas.</p>
      <div class="cp-list">${supplies.map(supplyRow).join("") + actuators.map(actuatorRow).join("")}</div>`;

    host.querySelectorAll<HTMLButtonElement>("[data-cp]").forEach((btn) => {
      const { cp: id, kind } = btn.dataset;
      btn.addEventListener("click", () => {
        if (kind === "supply") engine.setSupply(id!, !(engine.runtime.supplyOn.get(id!) ?? true));
        else engine.toggleLatch(id!);
        refresh();
      });
    });
    refresh();
  };

  const refresh = (): void => {
    if (host.hidden) return;
    const rt = engine.runtime;
    for (const { id, kind } of controls) {
      const btn = host.querySelector<HTMLButtonElement>(`[data-cp="${id}"]`);
      if (!btn) continue;
      const label = btn.querySelector(".cp-state")!;
      if (kind === "supply") {
        const on = rt.supplyOn.get(id) ?? true;
        setToggle(btn, on ? "on" : "off");
        label.textContent = on ? "Air ON" : "Air OFF";
      } else {
        const latched = rt.latched.get(id) ?? false;
        const held = (rt.inputs.get(id) ?? false) && !latched;
        setToggle(btn, held ? "held" : latched ? "on" : "off");
        label.textContent = held ? "Held" : latched ? "Actuated" : "Actuate";
      }
    }
  };

  bus.on("mode:changed", build);
  bus.on("sim:reset", build);
  bus.on("circuit:changed", build);
  bus.on("valve:changed", refresh);
  bus.on("sim:tick", refresh);
  build();
}

function setToggle(btn: HTMLButtonElement, state: "on" | "off" | "held"): void {
  btn.classList.toggle("on", state === "on");
  btn.classList.toggle("held", state === "held");
  btn.setAttribute("aria-pressed", String(state !== "off"));
}

function supplyRow(c: { id: string; label?: string; params: Record<string, unknown> }): string {
  return row(c.id, "supply", c.label ?? "Air supply", `${Number(c.params.pressure ?? 600)} kPa supply`, "Air ON");
}

function actuatorRow(c: { id: string; type: string; label?: string; params: Record<string, unknown> }): string {
  const def = getDef(c.type);
  return row(
    c.id,
    "actuator",
    c.label ?? def.name,
    `${def.actuation!.control} · ${c.params.return ?? "spring"} return · momentary`,
    "Actuate",
  );
}

function row(id: string, kind: ControlKind, title: string, subtitle: string, state: string): string {
  return `
    <div class="cp-row">
      <div class="cp-meta">
        <span class="cp-title">${escapeHtml(title)}</span>
        <span class="cp-sub">${escapeHtml(subtitle)}</span>
      </div>
      <button class="cp-toggle" type="button" data-cp="${id}" data-kind="${kind}" aria-pressed="false">
        <span class="cp-dot"></span><span class="cp-state">${state}</span>
      </button>
    </div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
}
