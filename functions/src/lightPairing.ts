import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { enforceAnonymousRateLimit, newPairingSecret, pairingIdFrom, requireAccountAuth, secretsMatch, sha256, isExpired } from "./pairingUtils";
import { lightTopic, mqttBrokerUrl, mqttUsername, mqttPassword, MQTT_SECRETS } from "./mqttBroker";

// Pairing a sunrise light (an ESP32 running stock WLED). Unlike /display
// pairing (display.ts), there's no separate "approve from your phone" step:
// the same already-signed-in browser that clicked "Add sunrise light" stays
// in the loop the whole time — it briefly joins the light's own setup WiFi
// network, hands it home-WiFi + MQTT connection details directly via WLED's
// local /json/cfg API, then reconnects to home WiFi and polls this pairing
// until the light shows up on the broker. All state lives in
// lightPairings/{id}, which has NO client-facing Firestore rules at all —
// every read/write goes through these Cloud Functions, same as
// devicePairings in display.ts.
//
// Security note: every light shares one MQTT broker login (see
// mqttBroker.ts) rather than getting its own — most free-tier hosted
// brokers don't expose a per-device credential API. That credential is
// handed to the browser (over an authenticated call) and then typed into
// the light's own flash storage, same as it would be for any DIY MQTT
// device. If the chosen broker later supports per-device credentials or
// topic ACLs, mint one here instead of returning the shared secret — no
// other file needs to change, since everything else only deals in
// deviceId + topic.

const PAIRING_TTL_MS = 15 * 60 * 1000; // walking to the light + joining its AP takes longer than scanning a QR

export const createLightPairing = onCall({ secrets: MQTT_SECRETS }, async (request) => {
  const uid = await requireAccountAuth(request);
  await enforceAnonymousRateLimit(request, "light", "create", 8);

  const deviceRef = admin.firestore().collection("devices").doc();
  const pairingRef = admin.firestore().collection("lightPairings").doc();
  const expiresAt = Timestamp.fromMillis(Date.now() + PAIRING_TTL_MS);
  const claimSecret = newPairingSecret();

  await pairingRef.set({
    uid,
    deviceId: deviceRef.id,
    status: "pending",
    claimed: false,
    claimSecretHash: sha256(claimSecret),
    createdAt: FieldValue.serverTimestamp(),
    expiresAt,
  });

  logger.info("createLightPairing: created", { pairingId: pairingRef.id, uid, deviceId: deviceRef.id });

  return {
    pairingId: pairingRef.id,
    claimSecret,
    deviceId: deviceRef.id,
    expiresAt: expiresAt.toMillis(),
    mqttTopic: lightTopic(deviceRef.id),
    mqttBrokerUrl: mqttBrokerUrl.value(),
    mqttUsername: mqttUsername.value(),
    mqttPassword: mqttPassword.value(),
  };
});

// No auth required — polled by the browser while it may have just rejoined
// home WiFi mid-flow. Deliberately returns nothing but a status string, same
// shape as getDevicePairingStatus in display.ts.
export const getLightPairingStatus = onCall(async (request) => {
  const pairingId = pairingIdFrom(request);
  const snap = await admin.firestore().doc(`lightPairings/${pairingId}`).get();
  if (!snap.exists) return { status: "not_found" };

  const data = snap.data()!;
  if (!data.claimed && isExpired(data)) return { status: "expired" };
  return { status: data.claimed ? "claimed" : "pending", deviceId: data.claimed ? data.deviceId : undefined };
});

/**
 * Lets the browser prove it still holds the claim secret it was issued, in
 * case a future flow needs the pairing doc's details again mid-way through
 * (e.g. to retry the local /json/cfg POST after a dropped connection)
 * without re-running createLightPairing and reserving a second device id.
 */
export const getLightPairingSecret = onCall(async (request) => {
  const pairingId = pairingIdFrom(request);
  const claimSecret = String(request.data?.claimSecret || "");
  if (!claimSecret) throw new HttpsError("invalid-argument", "claimSecret is required.");

  const snap = await admin.firestore().doc(`lightPairings/${pairingId}`).get();
  if (!snap.exists) throw new HttpsError("not-found", "This pairing code has expired or doesn't exist.");
  const data = snap.data()!;
  if (!data.claimSecretHash || !secretsMatch(claimSecret, String(data.claimSecretHash))) {
    throw new HttpsError("permission-denied", "This pairing request does not belong to this light.");
  }
  if (isExpired(data)) throw new HttpsError("deadline-exceeded", "This pairing code has expired.");

  return {
    deviceId: data.deviceId as string,
    mqttTopic: lightTopic(data.deviceId as string),
    mqttBrokerUrl: mqttBrokerUrl.value(),
    mqttUsername: mqttUsername.value(),
    mqttPassword: mqttPassword.value(),
  };
});
