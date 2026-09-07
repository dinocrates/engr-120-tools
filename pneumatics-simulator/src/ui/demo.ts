import type { Circuit } from "@/model/types.ts";

/**
 * The SDD §48 MVP circuit: supply -> 5/2 spring-return pushbutton valve ->
 * double-acting cylinder. Loaded on startup so there is something to run.
 */
export function demoCircuit(): Circuit {
  return {
    version: 1,
    components: [
      {
        id: "SUP1",
        type: "supply",
        position: { x: 96, y: 344 },
        rotation: 0,
        label: "Supply",
        params: {},
      },
      {
        id: "V1",
        type: "valve_5_2",
        position: { x: 64, y: 250 },
        rotation: 0,
        label: "V1",
        params: { actuator: "pushbutton", return: "spring" },
      },
      {
        id: "C1",
        type: "cylinder_da",
        position: { x: 336, y: 96 },
        rotation: 0,
        label: "C1",
        params: { stroke: 1, extendSpeed: 0.55, retractSpeed: 0.55 },
      },
    ],
    connections: [
      { id: "w1", from: { component: "SUP1", port: "P" }, to: { component: "V1", port: "P" } },
      { id: "w2", from: { component: "V1", port: "A" }, to: { component: "C1", port: "A" } },
      { id: "w3", from: { component: "V1", port: "B" }, to: { component: "C1", port: "B" } },
    ],
  };
}
