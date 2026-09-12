import { useEffect, useState } from "react";
import type { Alarm } from "@/hooks/useDeviceSettings";
import { useAutoUnlockAudio } from "@/hooks/useAutoUnlockAudio";
import { AudioUnlockOverlay } from "@/components/display/AudioUnlockOverlay";
import { getSunriseProgress } from "@/lib/sunriseAlarm";

const CHECK_INTERVAL_MS = 15_000;

/**
 * Display-only ambient effects that lead up to an alarm: a gradually
 * brightening amber glow over the sunrise ramp window, and a proactive
 * "tap to enable sound" nag shown well before anything actually rings —
 * this is the one screen that can otherwise sit untouched for days, unlike
 * a phone that gets tapped constantly. The alarm firing itself (the big
 * ringing takeover, audio, dismiss/snooze) is server-decided and shared
 * across every device — see AlarmRingingOverlay.
 */
export function AlarmManager({ alarms }: { alarms: Alarm[] }) {
  const [sunriseProgress, setSunriseProgress] = useState(0);
  const hasEnabledAlarms = alarms.some((alarm) => alarm.enabled);
  const { unlocked: audioUnlocked, tryUnlock: tryUnlockAudio } = useAutoUnlockAudio(hasEnabledAlarms);

  useEffect(() => {
    const updateSunrise = () => {
      setSunriseProgress(getSunriseProgress(alarms, new Date()));
    };
    updateSunrise();
    const interval = setInterval(updateSunrise, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [alarms]);

  return (
    <>
      <AudioUnlockOverlay hasEnabledAlarms={hasEnabledAlarms} unlocked={audioUnlocked} onTryUnlock={tryUnlockAudio} />
      {sunriseProgress > 0 && (
        <div
          className="pointer-events-none fixed inset-0 z-40 transition-opacity"
          style={{
            opacity: 0.18 + sunriseProgress * 0.72,
            transitionDuration: "15000ms",
            background: "radial-gradient(circle at 50% 105%, #fff7c2 0%, #fbbf24 30%, #f97316 58%, rgba(124,45,18,.35) 100%)",
          }}
          aria-hidden
        />
      )}
    </>
  );
}
