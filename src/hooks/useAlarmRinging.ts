import { useCallback, useEffect, useState } from "react";
import { deleteDoc, doc, onSnapshot, setDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { timestampMs } from "@/lib/deviceStatus";

export interface RingingAlarm {
  alarmId: string;
  deviceId: string;
  label: string;
  time: string;
  since: number;
  snoozedUntil: number | null;
}

/**
 * Whichever alarm is currently ringing for this account, written server-side
 * (functions/src/alarms.ts) the minute it comes due and shared at
 * alarmRinging/{uid} — every display AND the phone app read the same
 * document, so they always agree on whether something is ringing, and a
 * dismiss/snooze from any one of them (even a display with no other input)
 * silences it everywhere immediately.
 */
export function useAlarmRinging(uid: string | null | undefined) {
  const [ringing, setRinging] = useState<RingingAlarm | null>(null);

  useEffect(() => {
    if (!uid) {
      setRinging(null);
      return;
    }
    return onSnapshot(doc(db, "alarmRinging", uid), (snap) => {
      if (!snap.exists()) {
        setRinging(null);
        return;
      }
      const data = snap.data();
      setRinging({
        alarmId: String(data.alarmId || ""),
        deviceId: String(data.deviceId || ""),
        label: String(data.label || ""),
        time: String(data.time || ""),
        since: timestampMs(data.since) || Date.now(),
        snoozedUntil: data.snoozedUntil ? timestampMs(data.snoozedUntil) : null,
      });
    }, () => setRinging(null));
  }, [uid]);

  const dismiss = useCallback(async () => {
    if (!uid) return;
    await deleteDoc(doc(db, "alarmRinging", uid));
  }, [uid]);

  const snooze = useCallback(async (minutes: number) => {
    if (!uid || !ringing) return;
    // A plain update would fail if the doc had just been cleared elsewhere
    // (e.g. dismissed on another device a moment ago) — merge-set instead so
    // snoozing always leaves the doc in a well-formed ringing state.
    await setDoc(doc(db, "alarmRinging", uid), {
      alarmId: ringing.alarmId,
      deviceId: ringing.deviceId,
      label: ringing.label,
      time: ringing.time,
      snoozedUntil: Timestamp.fromMillis(Date.now() + minutes * 60_000),
    }, { merge: true });
  }, [uid, ringing]);

  return { ringing, dismiss, snooze };
}
