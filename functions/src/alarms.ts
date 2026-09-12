import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { londonNow } from "./londonTime";

// Alarms are configured per display (devices/{id}.settings.alarms) but need
// to ring everywhere for that account — the display itself, any other
// paired display, and the phone app — and be mutable from whichever of
// those actually has an input to dismiss it. Detection is done here, once a
// minute, server-side, rather than by whichever browser tab happens to be
// open: that's what makes it reliable with the display asleep/backgrounded,
// and what gives every client the same shared "is anything ringing" answer
// via alarmRinging/{uid} (see firestore.rules for who can read/write it).
//
// This also drives tickSunriseLights' light ramp indirectly: that function
// reads the same devices/{id}.settings.alarms, now fixed (see londonTime.ts)
// to use Europe/London time instead of the Cloud Functions runtime's UTC —
// previously a one-off alarm could be auto-disabled by the display's own
// (correct, local-time) client-side firing before this tick's UTC-shifted
// idea of "now" ever reached the alarm's time, so the sunrise ramp for a
// linked light silently never ran.

interface AlarmLike {
  id: string;
  time: string;
  days: number[];
  enabled: boolean;
  label?: string;
}

const STALE_RING_MS = 30 * 60_000;

export const tickAlarms = onSchedule("* * * * *", async () => {
  const db = admin.firestore();
  const now = new Date();
  const { minutesOfDay, dayOfWeek } = londonNow(now);
  const nowKey = `${String(Math.floor(minutesOfDay / 60)).padStart(2, "0")}:${String(minutesOfDay % 60).padStart(2, "0")}`;

  const displayDocs = await db.collection("devices")
    .where("deviceType", "==", "display")
    .where("revoked", "==", false)
    .get();

  for (const deviceDoc of displayDocs.docs) {
    try {
      const data = deviceDoc.data();
      const uid = String(data.uid || "");
      if (!uid) continue;
      const alarms: AlarmLike[] = Array.isArray(data.settings?.alarms) ? data.settings.alarms : [];
      const due = alarms.find((alarm) =>
        alarm.enabled &&
        alarm.time === nowKey &&
        (!alarm.days?.length || alarm.days.includes(dayOfWeek)),
      );
      if (!due) continue;

      // Any earlier alarm still ringing for this account is superseded —
      // last one due wins rather than fighting over one shared document.
      await db.doc(`alarmRinging/${uid}`).set({
        alarmId: due.id,
        deviceId: deviceDoc.id,
        label: due.label || "",
        time: due.time,
        since: FieldValue.serverTimestamp(),
        snoozedUntil: null,
      });

      // A one-off alarm (no repeat days) turns itself off once it's fired —
      // done here, not on the client, so it happens exactly once regardless
      // of how many displays/tabs are watching it.
      if (!due.days?.length) {
        await deviceDoc.ref.update({
          "settings.alarms": alarms.map((alarm) => (alarm.id === due.id ? { ...alarm, enabled: false } : alarm)),
        });
      }
    } catch (err) {
      logger.error("tickAlarms: failed for device", { deviceId: deviceDoc.id, err: String(err) });
    }
  }

  // Safety net: if nobody was around to dismiss it, don't ring forever —
  // but someone actively snoozing it every few minutes is still "around", so
  // only clear ones that aren't currently within a snooze.
  try {
    const staleCutoff = Timestamp.fromMillis(now.getTime() - STALE_RING_MS);
    const stale = await db.collection("alarmRinging").where("since", "<=", staleCutoff).get();
    const toDelete = stale.docs.filter((candidate) => {
      const snoozedUntilMs = candidate.data().snoozedUntil?.toMillis?.() ?? 0;
      return snoozedUntilMs <= now.getTime();
    });
    await Promise.all(toDelete.map((doc) => doc.ref.delete()));
  } catch (err) {
    logger.error("tickAlarms: stale cleanup failed", { err: String(err) });
  }
});
