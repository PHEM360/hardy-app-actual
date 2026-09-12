import { londonLocalToUtc } from "./notifications/calculations";

const LONDON = "Europe/London";

export interface LondonNow {
  /** Minutes since midnight, London wall-clock time. */
  minutesOfDay: number;
  /** 0=Sun..6=Sat, for the London calendar date. */
  dayOfWeek: number;
  /** "YYYY-MM-DD" for the London calendar date. */
  dateStr: string;
}

/**
 * `now`'s civil date/time in Europe/London. Cloud Functions run in UTC, so
 * `now.getHours()`/`now.getDay()` are silently off by the UK's current DST
 * offset from what an alarm's or a light schedule's "HH:mm" (set by someone
 * looking at a UK clock) actually means — see notifications/calculations.ts,
 * which the same bug was already fixed for elsewhere in this codebase.
 */
export function londonNow(now: Date): LondonNow {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return {
    minutesOfDay: get("hour") * 60 + get("minute"),
    // A plain calendar Y-M-D has one unambiguous day of the week regardless
    // of timezone, so Date.UTC at midnight is safe here.
    dayOfWeek: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
    dateStr,
  };
}

/** `now`'s London wall-clock time as "HH:mm", matching how alarms/schedules store times. */
export function londonTimeKey(now: Date): string {
  const { minutesOfDay } = londonNow(now);
  return `${String(Math.floor(minutesOfDay / 60)).padStart(2, "0")}:${String(minutesOfDay % 60).padStart(2, "0")}`;
}

/** The real UTC instant for "HH:mm" (a "time" string) on the London calendar date `dateStr`. */
export function londonTimeOn(dateStr: string, time: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return londonLocalToUtc(year, month, day, hours, minutes).getTime();
}

/** Shift a "YYYY-MM-DD" London calendar date by N days — calendar-only, no DST involved. */
export function addLondonDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

export function dayOfWeekFor(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}
