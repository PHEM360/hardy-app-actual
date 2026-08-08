import { useEffect, useRef, useState } from "react";
import { AlarmClock, BellOff, Clock3 } from "lucide-react";
import type { Alarm } from "@/hooks/useDeviceSettings";
import { useTabLeader } from "@/hooks/useTabLeader";
import { playAlarmTone, stopAlarmTone } from "@/lib/alarmTone";

const CHECK_INTERVAL_MS = 15_000;
const SNOOZE_MINUTES = 9;

export function AlarmManager({
  alarms,
  onUpdateAlarm,
}: {
  alarms: Alarm[];
  onUpdateAlarm: (id: string, patch: Partial<Alarm>) => void;
}) {
  const [firing, setFiring] = useState<Alarm | null>(null);
  const [flash, setFlash] = useState(false);
  const isLeader = useTabLeader("hardyhub-display-alarm-owner");
  const lastCheckRef = useRef(new Date());
  const snoozedUntilRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const since = lastCheckRef.current;
      lastCheckRef.current = now;

      for (const alarm of alarms) {
        if (!alarm.enabled) continue;
        const snoozedUntil = snoozedUntilRef.current.get(alarm.id);
        if (snoozedUntil) {
          if (now.getTime() >= snoozedUntil) {
            snoozedUntilRef.current.delete(alarm.id);
            setFiring(alarm);
          }
          continue;
        }
        // Did this alarm's scheduled time fall inside (since, now]? A plain
        // equality check would miss ticks lost to background throttling.
        const [h, m] = alarm.time.split(":").map(Number);
        const scheduledToday = new Date(now);
        scheduledToday.setHours(h, m, 0, 0);
        const dayMatches = alarm.days.length === 0 || alarm.days.includes(scheduledToday.getDay());
        if (dayMatches && scheduledToday > since && scheduledToday <= now) {
          setFiring(alarm);
          if (alarm.days.length === 0) onUpdateAlarm(alarm.id, { enabled: false });
        }
      }
    };

    const interval = setInterval(tick, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [alarms, onUpdateAlarm]);

  useEffect(() => {
    if (!firing) {
      stopAlarmTone();
      return;
    }
    if (isLeader) playAlarmTone();
    const flashInterval = setInterval(() => setFlash((f) => !f), 600);
    return () => {
      clearInterval(flashInterval);
      stopAlarmTone();
    };
  }, [firing, isLeader]);

  if (!firing) return null;

  const dismiss = () => setFiring(null);
  const snooze = () => {
    snoozedUntilRef.current.set(firing.id, Date.now() + SNOOZE_MINUTES * 60_000);
    setFiring(null);
  };

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
        <p className="text-white text-3xl font-bold font-display">{firing.label || "Alarm"}</p>
        <p className="text-white/80 text-lg mt-1">{firing.time}</p>
      </div>
      <div className="flex gap-4">
        <button
          onClick={snooze}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/15 hover:bg-white/25 text-white font-semibold transition-colors"
        >
          <Clock3 className="w-5 h-5" /> Snooze {SNOOZE_MINUTES}m
        </button>
        <button
          onClick={dismiss}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white text-amber-700 font-semibold hover:bg-white/90 transition-colors"
        >
          <BellOff className="w-5 h-5" /> Dismiss
        </button>
      </div>
    </div>
  );
}
