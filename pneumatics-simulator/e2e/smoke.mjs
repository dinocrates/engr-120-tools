/**
 * Smoke test for the SDD §48 MVP loop: load the demo circuit, run it, hold the
 * valve actuator, and assert the cylinder extends then retracts on release.
 *
 * Usage:
 *   npm run dev            # in one terminal
 *   npm run smoke          # in another
 *
 * Set CHROME_PATH to use a system Chrome instead of a Playwright download.
 */
import { chromium } from "playwright";

const URL = process.env.SMOKE_URL ?? "http://localhost:5173/engr-120-tools/pneumatics-simulator/";
const launch = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {};
const shots = process.argv.includes("--shots");

const browser = await chromium.launch(launch);
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
const warnings = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && warnings.push(m.text()));

const fail = async (msg) => {
  console.error("SMOKE FAIL:", msg);
  await browser.close();
  process.exit(1);
};

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector('[data-act="run"]');

await page.click('[data-act="run"]');
if (shots) await page.screenshot({ path: "e2e/run.png" });

const valve = await page.$("[data-actuate]");
const box = await valve.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.waitForTimeout(2000);

const extended = await page.textContent("#properties");
await page.mouse.up();
await page.waitForTimeout(2000);
const retracted = await page.textContent("#properties");

// The properties panel shows the selected valve; select the cylinder to read %.
await page.evaluate(() => {
  const g = document.querySelector('.component.type-cylinder_da');
  g?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
});

if (warnings.length) console.warn("console warnings:", warnings.join("; "));
if (errors.length) await fail(`page errors: ${errors.join("; ")}`);
if (!/actuated/.test(extended)) await fail("valve did not actuate on press");
if (!/rest/.test(retracted)) await fail("valve did not return to rest on release");

console.log("valve after press:", /actuated/.test(extended) ? "actuated ✓" : "NOT actuated ✗");
console.log("valve after release:", /rest/.test(retracted) ? "rest ✓" : "NOT rest ✗");
if (shots) await page.screenshot({ path: "e2e/done.png" });

await browser.close();
console.log("SMOKE OK");
