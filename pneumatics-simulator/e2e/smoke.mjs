/**
 * Smoke test for the SDD §48 MVP loop with the UI-kit shell.
 *
 * Verifies: demo loads, both views render, Run + hold actuator extends the
 * cylinder, release retracts it, and toggling the view preserves sim state.
 *
 *   npm run dev            # one terminal
 *   npm run smoke          # another   (CHROME_PATH to reuse system Chrome)
 */
import { chromium } from "playwright";

const PORT = process.env.PORT ?? "5173";
const URL = process.env.SMOKE_URL ?? `http://localhost:${PORT}/engr-120-tools/pneumatics-simulator/`;
const launch = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {};
const shots = process.argv.includes("--shots");

const browser = await chromium.launch(launch);
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push("console: " + m.text()));

const fail = async (msg) => {
  console.error("SMOKE FAIL:", msg);
  if (shots) await page.screenshot({ path: "e2e/fail.png" });
  await browser.close();
  process.exit(1);
};

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector("#run");
await page.waitForSelector(".layer-components .component");

// view toggle renders
await page.click("#viewComponent");
await page.waitForTimeout(200);
await page.click("#viewSymbol");
await page.waitForTimeout(200);

await page.click("#run");
await page.waitForTimeout(200);

const readPos = () =>
  page.textContent("#posText").then((t) => Number((t.match(/(\d+)%/) ?? [0, 0])[1]));

// -- canvas press & hold --------------------------------------------------
const valve = await page.$("[data-actuate]");
const box = await valve.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.waitForTimeout(2000);
const extended = await readPos();
if (shots) await page.screenshot({ path: "e2e/extended.png" });

// toggling the view must not disturb simulation state
await page.click("#viewComponent");
await page.waitForTimeout(150);
const afterToggle = await readPos();

await page.mouse.up();
await page.waitForTimeout(2200);
const retracted = await readPos();

// -- control panel: latch actuator, cut air, restore ---------------------
await page.click('.cp-toggle[data-kind="actuator"]');
await page.waitForTimeout(2200);
const latched = await readPos();
await page.click('.cp-toggle[data-kind="supply"]');
await page.waitForTimeout(700);
const airOff = await readPos();
await page.click('.cp-toggle[data-kind="supply"]');
await page.click('.cp-toggle[data-kind="actuator"]');
await page.waitForTimeout(2400);
const released = await readPos();

if (errors.length) await fail("page errors: " + errors.join("; "));
if (extended < 60) await fail(`cylinder did not extend on press (pos ${extended}%)`);
if (Math.abs(afterToggle - extended) > 12) await fail(`view toggle disturbed state (${extended}% -> ${afterToggle}%)`);
if (retracted > 15) await fail(`cylinder did not retract on release (pos ${retracted}%)`);
if (latched < 60) await fail(`panel latch did not actuate the valve (pos ${latched}%)`);
if (airOff < latched - 15) await fail(`air-off did not trap the cylinder (${latched}% -> ${airOff}%)`);
if (released > 15) await fail(`panel unlatch did not retract the cylinder (pos ${released}%)`);

console.log(`hold ${extended}% -> view ${afterToggle}% -> release ${retracted}%  ✓`);
console.log(`latch ${latched}% -> air-off ${airOff}% -> unlatch ${released}%  ✓`);

// -- self-sequencing: auto-cycle demo -----------------------------------
await page.click("#reset"); // back to edit mode so the demo picker is enabled
await page.waitForTimeout(150);
await page.selectOption('[data-act="demo"]', "autocycle");
await page.waitForTimeout(300);
await page.click("#run");
await page.waitForTimeout(200);
let pbBox = null;
for (const el of await page.$$("[data-actuate]")) {
  if ((await el.getAttribute("data-actuate")) === "PB1") pbBox = await el.boundingBox();
}
if (!pbBox) await fail("auto-cycle demo has no PB1 actuator");
await page.mouse.move(pbBox.x + pbBox.width / 2, pbBox.y + pbBox.height / 2);
await page.mouse.down();
await page.waitForTimeout(200);
await page.mouse.up(); // momentary tap — bistable valve should latch
await page.waitForTimeout(1500);
const cyclePeak = await readPos();
await page.waitForTimeout(3000);
const cycleEnd = await readPos();

if (errors.length) await fail("page errors: " + errors.join("; "));
if (cyclePeak < 70) await fail(`auto-cycle did not extend after PB1 tap (peak ${cyclePeak}%)`);
if (cycleEnd > 12) await fail(`auto-cycle did not auto-retract at the limit valve (end ${cycleEnd}%)`);

console.log(`auto-cycle: tap PB1 -> ${cyclePeak}% -> limit -> ${cycleEnd}%  ✓`);

// -- explain mode -------------------------------------------------------
await page.evaluate(() => {
  const g = document.querySelector(".component.type-valve-5-2-pp");
  const r = g.getBoundingClientRect();
  g.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }));
});
await page.waitForTimeout(200);
const explainText = (await page.textContent(".explain")) ?? "";
if (!/V1 is in the (rest|actuated) position/.test(explainText)) {
  await fail(`explain mode gave no valve explanation: "${explainText.slice(0, 80)}"`);
}
console.log(`explain: "${explainText.replace(/\s+/g, " ").trim().slice(0, 70)}…"  ✓`);

// -- electro-pneumatic auto-cycle -------------------------------------
await page.click("#reset");
await page.selectOption('[data-act="demo"]', "electro");
await page.waitForTimeout(300);
await page.click("#run");
await page.waitForTimeout(200);
let ePb = null;
for (const el of await page.$$("[data-actuate]")) {
  if ((await el.getAttribute("data-actuate")) === "PB1") ePb = await el.boundingBox();
}
if (!ePb) await fail("electro demo has no PB1");
await page.mouse.move(ePb.x + ePb.width / 2, ePb.y + ePb.height / 2);
await page.mouse.down();
await page.waitForTimeout(200);
await page.mouse.up();
await page.waitForTimeout(1600);
const ePeak = await readPos();
await page.waitForTimeout(3000);
const eEnd = await readPos();
if (errors.length) await fail("page errors: " + errors.join("; "));
if (ePeak < 65) await fail(`electro: solenoid did not extend after PB1 tap (peak ${ePeak}%)`);
if (eEnd > 15) await fail(`electro: roller switch did not auto-retract (end ${eEnd}%)`);
console.log(`electro: tap PB1 -> ${ePeak}% -> roller switch -> ${eEnd}%  ✓`);

// -- robustness: undo + unknown-type fallback --------------------------
await page.click("#reset");
await page.selectOption('[data-act="demo"]', "basic");
await page.waitForTimeout(250);
const nComps = await page.$$eval(".layer-components .component", (els) => els.length);
await page.evaluate(() => {
  const g = document.querySelector(".component.type-cylinder-double");
  const r = g.getBoundingClientRect();
  const opts = { bubbles: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 };
  g.dispatchEvent(new PointerEvent("pointerdown", opts));
  document.querySelector(".ws-svg").dispatchEvent(
    new PointerEvent("pointermove", { ...opts, clientX: opts.clientX + 90, clientY: opts.clientY + 30 }),
  );
  document.querySelector(".ws-svg").dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
});
await page.waitForTimeout(100);
await page.keyboard.press("Control+z");
await page.waitForTimeout(150);

const unknown = {
  version: 1,
  components: [
    { id: "S", type: "air-supply", position: { x: 40, y: 200 }, rotation: 0, params: {} },
    { id: "X", type: "totally-made-up", position: { x: 300, y: 200 }, rotation: 0, params: {} },
  ],
  connections: [{ id: "w", from: { component: "S", port: "1" }, to: { component: "X", port: "1" } }],
};
await page.evaluate((c) => {
  const dt = new DataTransfer();
  dt.items.add(new File([JSON.stringify(c)], "u.json", { type: "application/json" }));
  const inp = document.getElementById("fileInput");
  inp.files = dt.files;
  inp.dispatchEvent(new Event("change", { bubbles: true }));
}, unknown);
await page.waitForTimeout(300);
const placeholder = await page.$(".unknown-art");

if (errors.length) await fail("page errors: " + errors.join("; "));
if (!placeholder) await fail("unknown component type did not render a placeholder");

console.log(`robustness: ${nComps} comps, undo + unknown-type fallback  ✓`);
console.log("SMOKE OK");
await browser.close();
