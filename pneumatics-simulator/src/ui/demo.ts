import type { Circuit, ComponentInstance, Connection } from "@/model/types.ts";

const comp = (
  id: string,
  type: string,
  x: number,
  y: number,
  params: ComponentInstance["params"] = {},
): ComponentInstance => ({ id, type, position: { x, y }, rotation: 0, label: id, params });

const wire = (id: string, fc: string, fp: string, tc: string, tp: string): Connection => ({
  id,
  from: { component: fc, port: fp },
  to: { component: tc, port: tp },
});

/**
 * Basic MVP circuit (matches the UI kit reference): air supply → manual 5/2
 * spring-return valve → double-acting cylinder, valve exhausts vented.
 */
function basicCircuit(): Circuit {
  return {
    version: 1,
    components: [
      comp("SUP1", "air-supply", 92, 392, { pressure: 600 }),
      comp("V1", "valve-5-2", 292, 316, { return: "spring" }),
      comp("C1", "cylinder-double", 444, 68, { stroke: 200, extendSpeed: 0.5, retractSpeed: 0.5 }),
      comp("EX1", "exhaust", 268, 476),
      comp("EX2", "exhaust", 380, 476),
    ],
    connections: [
      wire("w1", "SUP1", "1", "V1", "1"),
      wire("w2", "V1", "4", "C1", "cap"),
      wire("w3", "V1", "2", "C1", "rod"),
      wire("w4", "V1", "5", "EX1", "1"),
      wire("w5", "V1", "3", "EX2", "1"),
    ],
  };
}

/**
 * Self-sequencing circuit (UI_DESIGN_BIBLE §38 example). Press PB1 to pilot the
 * double-pilot 5/2 to extend; the limit valve LS1 trips near full extension and
 * pilots it back to retract. Bistable, so it completes the cycle on one press.
 */
function autoCycleCircuit(): Circuit {
  return {
    version: 1,
    components: [
      comp("C1", "cylinder-double", 300, 24, { stroke: 200, extendSpeed: 0.45, retractSpeed: 0.45 }),
      comp("V1", "valve-5-2-pp", 336, 316),
      comp("PB1", "valve-3-2-nc", 40, 316, { return: "spring" }),
      comp("LS1", "limit-valve", 632, 316, { triggerCylinder: "C1", triggerAt: 92, triggerEdge: "extend" }),
      comp("SUP1", "air-supply", 40, 492, { pressure: 600 }),
      comp("EXV", "exhaust", 372, 512),
      comp("EXS", "exhaust", 168, 512),
    ],
    connections: [
      wire("m1", "SUP1", "1", "V1", "1"),
      wire("m2", "SUP1", "1", "PB1", "1"),
      wire("m3", "SUP1", "1", "LS1", "1"),
      wire("m4", "V1", "4", "C1", "cap"),
      wire("m5", "V1", "2", "C1", "rod"),
      wire("m6", "PB1", "2", "V1", "14"),
      wire("m7", "LS1", "2", "V1", "12"),
      wire("m8", "V1", "5", "EXV", "1"),
      wire("m9", "V1", "3", "EXV", "1"),
      wire("m10", "PB1", "3", "EXS", "1"),
      wire("m11", "LS1", "3", "EXS", "1"),
    ],
  };
}

export interface Demo {
  id: string;
  name: string;
  circuit: () => Circuit;
}

/** Meter-out speed control: a one-way flow control on the cap line slows extend. */
function speedControlCircuit(): Circuit {
  return {
    version: 1,
    components: [
      comp("SUP1", "air-supply", 92, 452, { pressure: 600 }),
      comp("V1", "valve-5-2", 292, 376, { return: "spring" }),
      comp("FC1", "flow-control-one-way", 300, 216, { restriction: 75 }),
      comp("C1", "cylinder-double", 452, 40, { stroke: 200, extendSpeed: 0.7, retractSpeed: 0.7 }),
      comp("EX1", "exhaust", 236, 536),
      comp("EX2", "exhaust", 360, 536),
    ],
    connections: [
      wire("s1", "SUP1", "1", "V1", "1"),
      wire("s2", "V1", "4", "FC1", "1"),
      wire("s3", "FC1", "2", "C1", "cap"),
      wire("s4", "V1", "2", "C1", "rod"),
      wire("s5", "V1", "5", "EX1", "1"),
      wire("s6", "V1", "3", "EX2", "1"),
    ],
  };
}

/**
 * Electro-pneumatic auto-cycle: an electrical pushbutton energises one solenoid
 * of a double-solenoid 5/2 to extend; a roller switch on the cylinder energises
 * the other solenoid to retract, and also lights a signal lamp.
 */
function electroCircuit(): Circuit {
  return {
    version: 1,
    components: [
      comp("C1", "cylinder-double", 260, 24, { stroke: 200, extendSpeed: 0.45, retractSpeed: 0.45 }),
      comp("V1", "solenoid-5-2-dd", 320, 300),
      comp("DC1", "dc-supply", 24, 128, { volts: 24 }),
      comp("PB1", "pushbutton", 24, 296),
      comp("RS1", "roller-switch", 632, 296, { triggerCylinder: "C1", triggerAt: 92, triggerEdge: "extend" }),
      comp("LMP1", "signal-lamp", 736, 120),
      comp("SUP1", "air-supply", 56, 456, { pressure: 600 }),
      comp("EXV", "exhaust", 356, 476),
    ],
    connections: [
      wire("a1", "SUP1", "1", "V1", "1"),
      wire("a2", "V1", "4", "C1", "cap"),
      wire("a3", "V1", "2", "C1", "rod"),
      wire("a4", "V1", "5", "EXV", "1"),
      wire("a5", "V1", "3", "EXV", "1"),
      wire("s1", "DC1", "out", "PB1", "in"),
      wire("s2", "PB1", "out", "V1", "a"),
      wire("s3", "DC1", "out", "RS1", "in"),
      wire("s4", "RS1", "out", "V1", "b"),
      wire("s5", "RS1", "out", "LMP1", "in"),
    ],
  };
}

export const DEMOS: Demo[] = [
  { id: "basic", name: "Basic — manual 5/2 valve", circuit: basicCircuit },
  { id: "speed", name: "Speed control — flow control valve", circuit: speedControlCircuit },
  { id: "autocycle", name: "Auto-cycle — pushbutton + limit valve", circuit: autoCycleCircuit },
  { id: "electro", name: "Electro-pneumatic — DC supply, solenoid, roller switch", circuit: electroCircuit },
];

/** Loaded on startup. */
export function demoCircuit(): Circuit {
  return basicCircuit();
}
