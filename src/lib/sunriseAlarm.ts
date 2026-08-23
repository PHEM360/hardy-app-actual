import type { Alarm } from "@/hooks/useDeviceSettings";

export function getSunriseProgress(alarms: Alarm[], now: Date): number {
  let strongest = 0;
  for (const alarm of alarms) {
    const rampMinutes = alarm.enabled ? alarm.sunriseMinutes || 0 : 0;
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
