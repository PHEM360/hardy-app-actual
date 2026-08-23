import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = process.env.TEST_ORIGIN || "http://localhost:8080";
const browser = await chromium.launch({ headless: true });

try {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();

    await page.route(/createDevicePairing/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            pairingId: "browser_test_pairing",
            claimSecret: "browser-test-secret",
            expiresAt: Date.now() + 300_000,
          },
        }),
      });
    });
    await page.route(/getDevicePairingStatus/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { status: "pending" } }),
      });
    });

    await page.goto(`${origin}/display`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Set up this display" }).waitFor();
    await page.getByText("Scan the QR code").waitFor();
    await page.locator("svg").first().waitFor();

    assert.equal(await page.getByLabel("Email").count(), 0, "display must never ask for an account email");
    assert.equal(await page.getByLabel("Password").count(), 0, "display must never ask for an account password");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    assert.equal(overflow, false, `pairing page overflowed at ${viewport.width}px`);

    await context.close();
  }
  console.log("PASS: QR-only display receiver renders securely on desktop and mobile without horizontal overflow");
} finally {
  await browser.close();
}
