import assert from "node:assert/strict";
import { createRequire } from "node:module";

const requireFunctions = createRequire(new URL("../functions/package.json", import.meta.url));
const admin = requireFunctions("firebase-admin");
const projectId = "hardyhub-7b30d";
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const functionsHost = process.env.FIREBASE_FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001";

if (!admin.apps.length) admin.initializeApp({ projectId });

async function idTokenFor(uid, claims) {
  await admin.auth().setCustomUserClaims(uid, claims);
  const customToken = await admin.auth().createCustomToken(uid);
  const response = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
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

const uid = "display-pairing-test-user";
await admin.auth().createUser({ uid, email: "display-pairing@example.test" }).catch(() => {});
const freshToken = await idTokenFor(uid, { passkeyVerifiedAt: Math.floor(Date.now() / 1000) });

const created = await call("createDevicePairing", {});
assert.ok(created.pairingId);
assert.ok(created.claimSecret);
assert.equal(await call("getDevicePairingStatus", { pairingId: created.pairingId }).then((value) => value.status), "pending");

await call("approveDevicePairing", { pairingId: created.pairingId }, freshToken);
assert.equal(await call("getDevicePairingStatus", { pairingId: created.pairingId }).then((value) => value.status), "approved");

await assert.rejects(
  call("claimDevicePairing", { pairingId: created.pairingId, claimSecret: "wrong-secret" }),
);

const claimed = await call("claimDevicePairing", {
  pairingId: created.pairingId,
  claimSecret: created.claimSecret,
});
assert.ok(claimed.customToken);
assert.ok(claimed.deviceId);
const device = await admin.firestore().doc(`devices/${claimed.deviceId}`).get();
assert.equal(device.data()?.uid, uid);
assert.equal(device.data()?.pairedVia, "qr");

const retried = await call("claimDevicePairing", {
  pairingId: created.pairingId,
  claimSecret: created.claimSecret,
});
assert.equal(retried.deviceId, claimed.deviceId, "a lost response must be safely retryable");

const stale = await call("createDevicePairing", {});
const staleToken = await idTokenFor(uid, { passkeyVerifiedAt: 1 });
await assert.rejects(
  call("approveDevicePairing", { pairingId: stale.pairingId }, staleToken),
  (error) => error.code === "FAILED_PRECONDITION",
);

const daysAgo = (days) => Math.floor(Date.now() / 1000) - days * 86_400;
const settingsRef = admin.firestore().doc(`users/${uid}/security/settings`);
await settingsRef.delete().catch(() => {});

// One passkey covers the whole default period, so linking a second screen days
// later must not demand another one.
const withinPeriod = await call("createDevicePairing", {});
await call("approveDevicePairing", { pairingId: withinPeriod.pairingId }, await idTokenFor(uid, { passkeyVerifiedAt: daysAgo(3) }));
assert.equal(
  await call("getDevicePairingStatus", { pairingId: withinPeriod.pairingId }).then((value) => value.status),
  "approved",
);

const beyondPeriod = await call("createDevicePairing", {});
await assert.rejects(
  call("approveDevicePairing", { pairingId: beyondPeriod.pairingId }, await idTokenFor(uid, { passkeyVerifiedAt: daysAgo(8) })),
  (error) => error.code === "FAILED_PRECONDITION",
);

// A stricter period chosen in Settings must be honoured by the server too.
await settingsRef.set({ appUnlockIntervalDays: 1, version: 2 }, { merge: true });
const strict = await call("createDevicePairing", {});
await assert.rejects(
  call("approveDevicePairing", { pairingId: strict.pairingId }, await idTokenFor(uid, { passkeyVerifiedAt: daysAgo(2) })),
  (error) => error.code === "FAILED_PRECONDITION",
);
await settingsRef.delete().catch(() => {});

console.log("PASS: callable create, passkey approval reused across the chosen period, secret claim, device minting, and idempotent retry");
