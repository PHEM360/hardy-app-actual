export type NightScreen = "clock" | "blank";
export type NightOverride = "on" | "off" | "";

export interface NightModeSettings {
  scheduleEnabled: boolean;
  start: string;
  end: string;
  screen: NightScreen;
  override: NightOverride;
  overrideUntil: string;
  withAlarms: boolean;
}

export interface NightAlarm {
  time: string;
  days: number[];
  enabled: boolean;
}

export const DEFAULT_NIGHT_MODE: NightModeSettings = {
  scheduleEnabled: true,
  start: "21:00",
  end: "07:00",
  screen: "clock",
  override: "",
  overrideUntil: "",
  withAlarms: true,
};

export function minutesFromClock(value: string | undefined): number | null {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

export function isInClockWindow(start: string, end: string, now: Date): boolean {
  const from = minutesFromClock(start);
  const to = minutesFromClock(end);
  if (from === null || to === null || from === to) return false;
  const minuteOfDay = now.getHours() * 60 + now.getMinutes();
  return from < to
    ? minuteOfDay >= from && minuteOfDay < to
    : minuteOfDay >= from || minuteOfDay < to;
}

function nextClockTime(clock: string, now: Date): Date | null {
  const minutes = minutesFromClock(clock);
  if (minutes === null) return null;
  const next = new Date(now);
  next.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

export function overrideUntilForAlarm(time: string, now: Date): string {
  return nextClockTime(time, now)?.toISOString() || "";
}

export function nextNightEndIso(night: NightModeSettings, now: Date): string {
  return nextClockTime(night.end || DEFAULT_NIGHT_MODE.end, now)?.toISOString() || "";
}

function isMorningWake(time: string): boolean {
  const minutes = minutesFromClock(time);
  if (minutes === null) return false;
  return minutes >= 4 * 60 && minutes < 12 * 60;
}

function alarmMatchesDay(days: number[], date: Date): boolean {
  return days.length === 0 || days.includes(date.getDay());
}

export function nextMorningAlarmAt(alarms: NightAlarm[], now: Date): Date | null {
  let soonest: Date | null = null;
  for (const alarm of alarms) {
    if (!alarm.enabled || !isMorningWake(alarm.time)) continue;
    const minutes = minutesFromClock(alarm.time);
    if (minutes === null) continue;
    for (let offset = 0; offset <= 1; offset += 1) {
      const candidate = new Date(now);
      candidate.setDate(now.getDate() + offset);
      candidate.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
      if (candidate.getTime() <= now.getTime()) continue;
      if (!alarmMatchesDay(alarm.days, candidate)) continue;
      if (!soonest || candidate.getTime() < soonest.getTime()) soonest = candidate;
    }
  }
  return soonest;
}

export type NightModeReason = "override" | "schedule" | "alarm" | "off";

export function resolveNightMode(
  night: NightModeSettings,
  alarms: NightAlarm[],
  now: Date,
): { active: boolean; reason: NightModeReason } {
  const until = night.overrideUntil ? new Date(night.overrideUntil).getTime() : NaN;
  const overrideLive = !Number.isFinite(until) || until > now.getTime();
  if (night.override === "on" && overrideLive) return { active: true, reason: "override" };
  if (night.override === "off" && overrideLive) return { active: false, reason: "off" };

  if (night.scheduleEnabled && isInClockWindow(night.start, night.end, now)) {
    return { active: true, reason: "schedule" };
  }

  if (night.withAlarms) {
    const alarmAt = nextMorningAlarmAt(alarms, now);
    if (alarmAt && alarmAt.getTime() - now.getTime() <= 14 * 60 * 60 * 1000) {
      const start = minutesFromClock(night.start) ?? 21 * 60;
      const eveningFrom = Math.min(start, 18 * 60);
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const inEvening = nowMinutes >= eveningFrom || nowMinutes < (minutesFromClock(night.end) ?? 7 * 60);
      if (inEvening) return { active: true, reason: "alarm" };
    }
  }

  return { active: false, reason: "off" };
}
