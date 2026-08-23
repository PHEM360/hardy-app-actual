import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = "https://hardyapp.co.uk";
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();
  await page.goto("https://hardyhub-7b30d.web.app/login", { waitUntil: "networkidle", timeout: 30_000 });
  assert.equal(new URL(page.url()).origin, origin);
  assert.equal(new URL(page.url()).pathname, "/login");

  await page.goto(origin, { waitUntil: "networkidle", timeout: 30_000 });
  await page.getByLabel("Email").waitFor();
  await page.getByLabel("Password").waitFor();
  await page.getByRole("button", { name: "Sign in with passkey" }).waitFor();

  const challenge = await page.evaluate(async () => {
    const response = await fetch(
      "https://us-central1-hardyhub-7b30d.cloudfunctions.net/beginPasskeyAuthentication",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data: { reauthenticate: false } }),
      },
    );
    if (!response.ok) throw new Error(`Passkey endpoint returned ${response.status}`);
    return response.json();
  });

  const result = challenge.result || challenge.data;
  assert.ok(result?.challengeId);
  assert.equal(result.options.rpId, "hardyapp.co.uk");
  assert.equal(result.options.userVerification, "required");
  console.log("PASS: production hosting, login UI, CORS and passkey challenge endpoint");
} finally {
  await browser.close();
}
