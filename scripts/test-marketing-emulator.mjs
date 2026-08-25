import assert from "node:assert/strict";
import { createRequire } from "node:module";

const requireFunctions = createRequire(new URL("../functions/package.json", import.meta.url));
const admin = requireFunctions("firebase-admin");
const projectId = "hardyhub-7b30d";
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const functionsHost = process.env.FIREBASE_FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001";

if (!admin.apps.length) admin.initializeApp({ projectId });

async function idTokenFor(uid) {
  const customToken = await admin.auth().createCustomToken(uid);
  const response = await fetch(
    `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const body = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(body));
  return body.idToken;
}

async function call(name, data, token) {
  const response = await fetch(`http://${functionsHost}/${projectId}/us-central1/${name}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ data }),
  });
  const body = await response.json();
  const payload = body.result?.data ?? body.result ?? body.data;
  if (!response.ok || body.error) {
    const error = new Error(body.error?.message || `Callable ${name} failed`);
    error.code = body.error?.status;
    throw error;
  }
  return payload;
}

const uid = "marketing-emulator-user";
const companyId = "marketing-emulator-company";
const contentId = "post";
const db = admin.firestore();
await admin.auth().createUser({ uid, email: "marketing@example.test" }).catch(() => {});
await db.doc(`users/${uid}`).set({ passkeyEnrolled: true });
await db.doc(`companies/${companyId}`).set({
  name: "Marketing test company",
  ownerId: uid,
  sharedWith: [],
});
await db.doc(`companies/${companyId}/content/${contentId}`).set({
  type: "social_post",
  platform: "instagram",
  topic: "Test post",
  draft: "This is the exact approved content.",
  refinedDraft: "",
  hashtags: ["test"],
  assetIds: [],
  scheduledFor: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  timezone: "Europe/London",
  status: "awaiting_approval",
  approvalVersion: 2,
  approvedVersion: 0,
});
const token = await idTokenFor(uid);

await assert.rejects(
  call("approveMarketingContent", { companyId, contentId, approvalVersion: 1 }, token),
  (error) => error.code === "FAILED_PRECONDITION",
  "a stale tab must not approve newer content",
);

const approved = await call(
  "approveMarketingContent",
  { companyId, contentId, approvalVersion: 2 },
  token,
);
assert.equal(approved.status, "scheduled");
const jobRef = db.doc(`marketingPublishJobs/${companyId}_${contentId}_v2`);
assert.equal((await jobRef.get()).data()?.status, "queued");

// The production adapter refuses missing credentials. Emulator tests use the
// explicit test provider to prove the queue and exactly-once state machine.
await db.doc(`companies/${companyId}/platformConnections/instagram`).set({
  platform: "instagram",
  status: "connected",
  accountName: "Test account",
});
await db.doc(`marketingPlatformCredentials/${companyId}_instagram`).set({
  companyId,
  platform: "instagram",
  provider: "test",
});
await call("publishMarketingContentNow", { companyId, contentId, approvalVersion: 2 }, token);

// Invoke the same worker body used by the scheduled function.
const { processDueMarketingJobs } = requireFunctions("./lib/marketing.js");
await processDueMarketingJobs();
const published = (await db.doc(`companies/${companyId}/content/${contentId}`).get()).data();
assert.equal(published?.status, "published");
assert.match(published?.externalPostId, /^test_/);
const completedJob = (await jobRef.get()).data();
assert.equal(completedJob?.status, "published");
const attempts = completedJob?.attempts;

await processDueMarketingJobs();
assert.equal((await jobRef.get()).data()?.attempts, attempts, "a completed job must never publish twice");

console.log("PASS: exact-version approval, deterministic scheduling, test publishing, and idempotent retry");
