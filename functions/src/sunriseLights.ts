import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireAuth, isExpired } from "./pairingUtils";
import { hasSeenActivity, lightTopic, publishLightState, pollRetainedStatuses, MQTT_SECRETS } from "./mqttBroker";

// Ongoing control for sunrise lights: manual on/off/brightness/colour from
// the webapp (sendLightCommand), the once-a-minute sunrise ramp that reads
// each light's linked alarms and pushes an absolute target state
// (tickSunriseLights — also finishes any pending pairings, see
// lightPairing.ts), and cutting a forgotten light off (onLightRevoked).

interface AlarmLike {
  time: string;
  days: number[];
  enabled: boolean;
  sunriseMinutes?: number;
  linkedLightIds?: string[];
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "").padStart(6, "0");
  const value = parseInt(clean, 16) || 0;
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function lerpColor(fromHex: string, toHex: string, t: number): [number, number, number] {
  const [fr, fg, fb] = hexToRgb(fromHex);
  const [tr, tg, tb] = hexToRgb(toHex);
  return [
    Math.round(fr + (tr - fr) * t),
    Math.round(fg + (tg - fg) * t),
    Math.round(fb + (tb - fb) * t),
  ];
}

/**
 * Ported from src/lib/sunriseAlarm.ts's getSunriseProgress — the functions
 * package is a separate TS project from the frontend, so this ~15-line pure
 * function is duplicated rather than shared, matching the note in the plan.
 * Returns 0..1, the strongest ramp progress across every enabled alarm that
 * links this light, so one light waking with two overlapping alarms takes
 * whichever is furthest along.
 */
function sunriseProgressForLight(alarms: AlarmLike[], lightId: string, now: Date): number {
  let strongest = 0;
  for (const alarm of alarms) {
    if (!alarm.enabled || !alarm.linkedLightIds?.includes(lightId)) continue;
    const rampMinutes = alarm.sunriseMinutes || 0;
    if (!rampMinutes) continue;
    const [hours, minutes] = alarm.time.split(":").map(Number);
    for (let dayOffset = 0; dayOffset <= 1; dayOffset += 1) {
      const scheduled = new Date(now);
      scheduled.setDate(now.getDate() + dayOffset);
      scheduled.setHours(hours, minutes, 0, 0);
      if (alarm.days.length > 0 && !alarm.days.includes(scheduled.getDay())) continue;
      const start = scheduled.getTime() - rampMinutes * 60_000;
      if (now.getTime() >= start && now.getTime() < scheduled.getTime()) {
        strongest = Math.max(strongest, (now.getTime() - start) / (scheduled.getTime() - start));
      }
    }
  }
  return strongest;
}

export const sendLightCommand = onCall({ secrets: MQTT_SECRETS }, async (request) => {
  const uid = requireAuth(request);
  const deviceId = String(request.data?.deviceId || "");
  if (!deviceId) throw new HttpsError("invalid-argument", "deviceId is required.");

  const deviceRef = admin.firestore().doc(`devices/${deviceId}`);
  const snap = await deviceRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "Light not found.");
  const data = snap.data()!;
  if (data.uid !== uid || data.revoked === true || data.deviceType !== "light") {
    throw new HttpsError("permission-denied", "You don't have access to this light.");
  }

  const currentManual = data.settings?.light?.manual || { on: false, brightness: 180, colorHex: "#ffd27a" };
  const requestedOn = request.data?.on;
  const requestedBrightness = request.data?.brightness;
  const requestedColor = request.data?.colorHex;
  const nextManual = {
    on: typeof requestedOn === "boolean" ? requestedOn : currentManual.on,
    brightness: typeof requestedBrightness === "number"
      ? Math.min(255, Math.max(1, Math.round(requestedBrightness)))
      : currentManual.brightness,
    colorHex: typeof requestedColor === "string" ? requestedColor : currentManual.colorHex,
  };

  const [r, g, b] = hexToRgb(nextManual.colorHex);
  await publishLightState(deviceId, { on: nextManual.on, bri: nextManual.brightness, seg: [{ col: [[r, g, b]] }] }, 5);
  await deviceRef.update({ "settings.light.manual": nextManual });

  return { success: true };
});

export const tickSunriseLights = onSchedule({ schedule: "* * * * *", secrets: MQTT_SECRETS }, async () => {
  const db = admin.firestore();

  // Finish any pairing whose light has connected to the broker since the last tick.
  const pendingPairings = await db.collection("lightPairings").where("claimed", "==", false).get();
  for (const pairingDoc of pendingPairings.docs) {
    const data = pairingDoc.data();
    if (isExpired(data)) continue;
    const deviceId = data.deviceId as string;
    try {
      const online = await hasSeenActivity(deviceId, 3000);
      if (!online) continue;
      await db.runTransaction(async (tx) => {
        const fresh = await tx.get(pairingDoc.ref);
        if (!fresh.exists || fresh.data()?.claimed) return;
        tx.set(db.doc(`devices/${deviceId}`), {
          uid: data.uid,
          householdId: data.uid,
          label: "Sunrise light",
          deviceType: "light",
          pairedVia: "qr",
          revoked: false,
          createdAt: FieldValue.serverTimestamp(),
          lastSeenAt: FieldValue.serverTimestamp(),
          settings: { light: { mqttTopic: lightTopic(deviceId) } },
        }, { merge: true });
        tx.update(pairingDoc.ref, { claimed: true, claimedAt: FieldValue.serverTimestamp() });
      });
      logger.info("tickSunriseLights: pairing claimed", { pairingId: pairingDoc.id, deviceId });
    } catch (err) {
      logger.error("tickSunriseLights: pairing check failed", { pairingId: pairingDoc.id, err: String(err) });
    }
  }

  // Drive the sunrise ramp for every light with an active linked alarm.
  const lightDocs = await db.collection("devices")
    .where("deviceType", "==", "light")
    .where("revoked", "==", false)
    .get();
  const now = new Date();

  // Real online/offline status, read from each light's retained MQTT status
  // message — see pollRetainedStatuses' own comment. This is the only place
  // settings.light.online/lastReportedAt ever get written; nothing else
  // touches them, so the UI's "connected" state reflects actual reachability
  // rather than just "this device is paired".
  try {
    const statuses = await pollRetainedStatuses(lightDocs.docs.map((d) => d.id));
    const statusBatch = db.batch();
    for (const lightDoc of lightDocs.docs) {
      const seen = statuses.get(lightDoc.id);
      const patch: Record<string, unknown> = { "settings.light.online": seen === "online" };
      if (seen) patch["settings.light.lastReportedAt"] = FieldValue.serverTimestamp();
      statusBatch.update(lightDoc.ref, patch);
    }
    await statusBatch.commit();
  } catch (err) {
    logger.error("tickSunriseLights: status poll failed", { err: String(err) });
  }

  for (const lightDoc of lightDocs.docs) {
    const light = lightDoc.data();
    try {
      const displayDocs = await db.collection("devices")
        .where("uid", "==", light.uid)
        .where("deviceType", "==", "display")
        .get();
      const alarms: AlarmLike[] = displayDocs.docs.flatMap((d) => (d.data().settings?.alarms || []) as AlarmLike[]);
      const progress = sunriseProgressForLight(alarms, lightDoc.id, now);
      if (progress <= 0) continue; // no ramp due right now — leave the light at whatever it was last manually set to

      const sunrise = light.settings?.light?.sunrise || {};
      const peakBrightness = sunrise.peakBrightness || 220;
      const [r, g, b] = lerpColor(sunrise.colorFrom || "#7c2d12", sunrise.colorTo || "#fff7c2", progress);
      // An absolute target for "where the ramp should be right now", not a
      // delta from the last tick — a missed minute self-corrects on the next.
      await publishLightState(lightDoc.id, {
        on: true,
        bri: Math.max(1, Math.round(progress * peakBrightness)),
        seg: [{ col: [[r, g, b]] }],
      }, 600);
    } catch (err) {
      logger.error("tickSunriseLights: ramp failed", { deviceId: lightDoc.id, err: String(err) });
    }
  }
});

// "Forget" is a plain client-side revoked:true write (useMyDevices.ts,
// unchanged for lights) — this is the server-side half that actually stops
// addressing the physical device, since MQTT publishing can't happen from
// the browser. It can't revoke the light's ability to *authenticate* (every
// light shares one broker login, see mqttBroker.ts), only its ability to
// receive commands from us from this point on.
export const onLightRevoked = onDocumentUpdated({ document: "devices/{deviceId}", secrets: MQTT_SECRETS }, async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;
  if (before.revoked === true || after.revoked !== true || after.deviceType !== "light") return;

  try {
    await publishLightState(event.params.deviceId, { on: false }, 0);
  } catch (err) {
    logger.error("onLightRevoked: failed to send final off command", { deviceId: event.params.deviceId, err: String(err) });
  }
});
