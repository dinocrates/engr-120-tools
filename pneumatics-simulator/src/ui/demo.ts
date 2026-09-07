import type { Circuit } from "@/model/types.ts";

/**
 * The SDD §48 MVP circuit, matching the UI kit's reference example:
 * air supply -> 5/2 spring-return valve -> double-acting cylinder, with both
 * valve exhaust ports vented through exhaust components.
 *
 * Valve truth table (from manifest): rest [1-2, 4-5], actuated [1-4, 2-3].
 * Cap connects to port 4, rod to port 2 -> pressing extends, releasing retracts.
 */
export function demoCircuit(): Circuit {
  return {
    version: 1,
    components: [
      { id: "SUP1", type: "air-supply", position: { x: 32, y: 372 }, rotation: 0, label: "SUP1", params: { pressure: 600 } },
      { id: "V1", type: "valve-5-2", position: { x: 232, y: 296 }, rotation: 0, label: "V1", params: { return: "spring" } },
      { id: "C1", type: "cylinder-double", position: { x: 384, y: 48 }, rotation: 0, label: "C1", params: { stroke: 200, extendSpeed: 0.5, retractSpeed: 0.5 } },
      { id: "EX1", type: "exhaust", position: { x: 208, y: 456 }, rotation: 0, label: "EX1", params: {} },
      { id: "EX2", type: "exhaust", position: { x: 320, y: 456 }, rotation: 0, label: "EX2", params: {} },
    ],
    connections: [
      { id: "w1", from: { component: "SUP1", port: "1" }, to: { component: "V1", port: "1" } },
      { id: "w2", from: { component: "V1", port: "4" }, to: { component: "C1", port: "cap" } },
      { id: "w3", from: { component: "V1", port: "2" }, to: { component: "C1", port: "rod" } },
      { id: "w4", from: { component: "V1", port: "5" }, to: { component: "EX1", port: "1" } },
      { id: "w5", from: { component: "V1", port: "3" }, to: { component: "EX2", port: "1" } },
    ],
  };
}
