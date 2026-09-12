import { useEffect, useState } from "react";
import { AlarmClock, BellOff, Clock3 } from "lucide-react";
import { useAlarmRinging } from "@/hooks/useAlarmRinging";
import { useTabLeader } from "@/hooks/useTabLeader";
import { useAutoUnlockAudio } from "@/hooks/useAutoUnlockAudio";
import { playAlarmTone, stopAlarmTone } from "@/lib/alarmTone";

const SNOOZE_MINUTES = 9;

/**
 * Renders the full-screen ringing alarm on whatever is showing it — the
 * paired display(s) and the phone app all mount this against the same
 * account, so an alarm set on one screen rings on every one of them, and
 * dismissing/snoozing from any single one (including the phone, since not
 * every display has a way to touch it) silences all the others too. Firing
 * itself is decided server-side (functions/src/alarms.ts); this only ever
 * reacts to that shared state, it never decides "is it time" on its own.
 *
 * Audio is unlocked passively on the first tap anywhere in the app this
 * session (the phone gets tapped constantly, so this is normally already
 * true by the time anything rings) — the display's own proactive "tap to
 * enable sound" nag lives on AlarmManager instead, since it's the one screen
 * that can otherwise sit untouched for days.
 */
export function AlarmRingingOverlay({ uid }: { uid: string | null | undefined }) {
  const { ringing, dismiss, snooze } = useAlarmRinging(uid);
  const isLeader = useTabLeader("hardyhub-alarm-owner");
  useAutoUnlockAudio(!!uid);
  const [flash, setFlash] = useState(false);
  // Forces a re-check once a snooze's countdown lapses, since nothing else
  // would otherwise re-render this component at that exact moment.
  const [, retick] = useState(0);

  const snoozedUntil = ringing?.snoozedUntil ?? null;
  useEffect(() => {
    if (!snoozedUntil) return;
    const delay = Math.max(1000, snoozedUntil - Date.now() + 500);
    const timer = setTimeout(() => retick((n) => n + 1), delay);
    return () => clearTimeout(timer);
  }, [snoozedUntil]);

  const active = !!ringing && (!ringing.snoozedUntil || Date.now() >= ringing.snoozedUntil);

  useEffect(() => {
    if (!active) {
      stopAlarmTone();
      return;
    }
    if (isLeader) playAlarmTone();
    const flashInterval = setInterval(() => setFlash((f) => !f), 600);
    return () => {
      clearInterval(flashInterval);
      stopAlarmTone();
    };
  }, [active, isLeader]);

  if (!active || !ringing) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 transition-colors duration-300 ${
        flash ? "bg-amber-500" : "bg-amber-600"
      }`}
    >
      <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center">
        <AlarmClock className="w-10 h-10 text-white" />
      </div>
      <div className="text-center">
        <p className="text-white text-3xl font-bold font-display">{ringing.label || "Alarm"}</p>
        <p className="text-white/80 text-lg mt-1">{ringing.time}</p>
      </div>
      <div className="flex gap-4">
        <button
          onClick={() => void snooze(SNOOZE_MINUTES)}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/15 hover:bg-white/25 text-white font-semibold transition-colors"
        >
          <Clock3 className="w-5 h-5" /> Snooze {SNOOZE_MINUTES}m
        </button>
        <button
          onClick={() => void dismiss()}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white text-amber-700 font-semibold hover:bg-white/90 transition-colors"
        >
          <BellOff className="w-5 h-5" /> Dismiss
        </button>
      </div>
    </div>
  );
}
