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
console.log("SMOKE OK");
await browser.close();
