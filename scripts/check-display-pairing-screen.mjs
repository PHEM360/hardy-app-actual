/**
 * Checks the /display pairing screen on the sizes it really runs at, including
 * a tablet with its system font scaled up, which is what made the QR code look
 * magnified. Fails if the screen overflows or the QR shrinks out of usefulness.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = process.env.DISPLAY_ORIGIN || "https://hardyapp.co.uk";
const cases = [
  { name: "Samsung tablet portrait", width: 800, height: 1280, rootFontPx: 16 },
  { name: "Samsung tablet portrait, font scaled 2x", width: 800, height: 1280, rootFontPx: 32 },
  { name: "Tablet landscape, screen zoom on", width: 1024, height: 640, rootFontPx: 26 },
  { name: "1080p TV browser", width: 1920, height: 1080, rootFontPx: 16 },
];

const browser = await chromium.launch();
let failures = 0;

for (const { name, width, height, rootFontPx } of cases) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  await page.addInitScript((size) => {
    document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.fontSize = `${size}px`;
    });
  }, rootFontPx);
  await page.goto(`${origin}/display`, { waitUntil: "networkidle", timeout: 45_000 });
  await page.getByRole("heading", { name: "Set up this screen" }).waitFor({ timeout: 30_000 });
  await page.locator("svg[viewBox]").first().waitFor({ timeout: 30_000 });

  const metrics = await page.evaluate(() => {
    const qr = document.querySelector("div[style*='min(38vmin']");
    const box = qr?.getBoundingClientRect();
    return {
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      qrSide: box ? Math.round(box.width) : 0,
      qrVisible: !!box && box.top >= 0 && box.bottom <= window.innerHeight + 1,
    };
  });

  try {
    assert.ok(metrics.documentWidth <= metrics.viewportWidth + 1, `horizontal overflow: ${metrics.documentWidth} > ${metrics.viewportWidth}`);
    assert.ok(metrics.documentHeight <= metrics.viewportHeight + 1, `vertical overflow: ${metrics.documentHeight} > ${metrics.viewportHeight}`);
    assert.ok(metrics.qrSide >= 150, `QR too small to scan: ${metrics.qrSide}px`);
    assert.ok(metrics.qrSide <= Math.min(metrics.viewportWidth, metrics.viewportHeight) * 0.55, `QR dominates the screen: ${metrics.qrSide}px`);
    assert.ok(metrics.qrVisible, "QR is not fully on screen");
    console.log(`PASS ${name}: ${width}x${height} @ ${rootFontPx}px root font — QR ${metrics.qrSide}px, page ${metrics.documentWidth}x${metrics.documentHeight}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}: ${error.message}`);
  }

  await page.screenshot({ path: `/tmp/display-pairing-${width}x${height}-${rootFontPx}.png` });
  await context.close();
}

await browser.close();
if (failures > 0) process.exit(1);
console.log("PASS: the pairing screen fits every display size tested, with system font scaling applied");
