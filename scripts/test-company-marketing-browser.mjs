import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const requireFunctions = createRequire(new URL("../functions/package.json", import.meta.url));
const admin = requireFunctions("firebase-admin");
const { FieldValue } = requireFunctions("firebase-admin/firestore");
const projectId = "hardyhub-7b30d";
const origin = "http://127.0.0.1:4174";
const uid = "marketing-browser-user";
const companyId = "marketing-browser-company";
const email = "marketing-browser@example.test";
const password = "Browser-test-password-7!";

if (!admin.apps.length) admin.initializeApp({ projectId });
await admin.auth().createUser({ uid, email, password }).catch(async (error) => {
  if (error.code !== "auth/uid-already-exists") throw error;
  await admin.auth().updateUser(uid, { password });
});
await admin.auth().setCustomUserClaims(uid, {
  passkeyVerifiedAt: Math.floor(Date.now() / 1000),
});
await admin.firestore().doc(`users/${uid}`).set({
  email,
  role: "superadmin",
  passkeyEnrolled: true,
  enabledFeatures: ["companies"],
  createdAt: FieldValue.serverTimestamp(),
});
await admin.firestore().doc(`companies/${companyId}`).set({
  name: "Browser Test Studio",
  description: "A company used to verify the marketing workflow.",
  color: "#6366f1",
  taxYearStart: "2026-04-06",
  contact: {},
  ownerId: uid,
  sharedWith: [],
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
});

const vite = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", "4174"], {
  cwd: new URL("..", import.meta.url),
  env: { ...process.env, VITE_USE_FIREBASE_EMULATORS: "true" },
  stdio: ["ignore", "pipe", "pipe"],
});

async function waitForServer() {
  const timeout = Date.now() + 30_000;
  while (Date.now() < timeout) {
    if (vite.exitCode !== null) throw new Error(`Vite exited with ${vite.exitCode}`);
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
      // Startup still in progress.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for the browser test server.");
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${origin}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /Let me in/ }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

  await page.goto(`${origin}/companies/${companyId}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Social & Ads/ }).click();
  await page.getByRole("button", { name: "Brand guidance", exact: true }).click();
  await page.getByRole("textbox", { name: "Brand voice" }).fill("Warm, practical and authoritative");
  await page.getByRole("textbox", { name: "Target audience" }).fill("Independent UK business owners");
  await page.getByRole("textbox", { name: "Industry" }).fill("Business consultancy");
  await page.getByRole("textbox", { name: "Objectives" }).fill("Build trust\nGenerate qualified enquiries");
  await page.getByRole("textbox", { name: "Key messages" }).fill("Practical help\nClear commercial advice");
  await page.getByRole("button", { name: "Save brand guidance" }).click();
  await page.getByText("Brand guidance saved.").waitFor();

  await page.getByRole("button", { name: "Planner" }).click();
  await page.getByRole("button", { name: "New post" }).click();
  await page.getByRole("textbox", { name: "Topic" }).fill("Monday business tip");
  await page.getByRole("textbox", { name: "Post copy" }).fill("Start the week by choosing the one commercial decision that will make everything else easier.");
  await page.getByLabel("Schedule").fill("2026-09-01T09:00");
  await page.getByRole("button", { name: "Create post" }).click();
  await page.getByText("Post added to the review queue.").waitFor();

  await page.getByRole("button", { name: "Review" }).click();
  await page.getByText("Monday business tip").waitFor();
  await page.getByRole("button", { name: "Approve" }).click();
  await page.getByText("Approved at the current version.").waitFor();

  const savedProfile = (await admin.firestore().doc(
    `companies/${companyId}/marketing/profile`,
  ).get()).data();
  assert.equal(savedProfile?.brandVoice, "Warm, practical and authoritative");
  const content = await admin.firestore().collection(`companies/${companyId}/content`).get();
  assert.equal(content.size, 1);
  assert.equal(content.docs[0].data().status, "scheduled");
  assert.equal(content.docs[0].data().approvedVersion, 1);
  assert.equal(
    (await admin.firestore().collection("marketingPublishJobs").get()).size,
    1,
    "approval should create one deterministic publishing job",
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Media" }).click();
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  assert.equal(overflows, false, "Social & Ads must not cause horizontal page scrolling on mobile");

  console.log("PASS: browser login, brand save, manual scheduling, exact-version approval, job creation, and mobile layout");
} finally {
  await browser?.close();
  vite.kill("SIGTERM");
}
