import { ReminderConfig } from "./types";

const MS: Record<string, number> = {
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
  weeks: 7 * 86_400_000,
  months: 30 * 86_400_000,
  years: 365 * 86_400_000,
};

const LONDON = "Europe/London";

/** Parse "HH:MM" into { h, m } */
function parseTime(t: string): { h: number; m: number } {
  const [h, m] = (t || "09:00").split(":").map(Number);
  return { h: h ?? 9, m: m ?? 0 };
}

/**
 * Convert a civil date+time in Europe/London to a real UTC Date.
 * Firebase Functions run in UTC, so `new Date(y, m, d, h, m)` would be wrong.
 */
export function londonLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  // Iteratively correct for the London offset at that instant (handles GMT/BST).
  let utc = desiredAsUtc;
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: LONDON,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(utc));
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
    const shownAsUtc = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second"),
    );
    utc += desiredAsUtc - shownAsUtc;
  }
  return new Date(utc);
}

/** Parse an ISO datetime (or date) into a UTC Date, treating bare dates as London midnight. */
export function parseEventStart(iso: string): Date | null {
  if (!iso) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split("-").map(Number);
    return londonLocalToUtc(y, m, d, 9, 0);
  }
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed);
}

/**
 * Given a task dueDate string ("YYYY-MM-DD") and a reminder config,
 * returns the Date at which to send the notification, or null if invalid.
 * Times are interpreted in Europe/London.
 */
export function calculateReminderTime(dueDate: string, reminder: ReminderConfig): Date | null {
  const [year, month, day] = dueDate.split("-").map(Number);
  if (!year || !month || !day) return null;

  const { h, m } = parseTime(reminder.timeOfDay);

  if (reminder.mode === "onDayAt") {
    return londonLocalToUtc(year, month, day, h, m);
  }

  if (reminder.mode === "relative") {
    const amount = reminder.relativeAmount ?? 1;
    const unit = reminder.relativeUnit ?? "days";
    const dir = reminder.relativeDirection ?? "before";
    const sign = dir === "before" ? -1 : 1;

    const base = londonLocalToUtc(year, month, day, h, m);

    if (unit === "minutes" || unit === "hours") {
      return new Date(base.getTime() + sign * amount * (MS[unit] ?? MS.days));
    }

    const shiftedMs = base.getTime() + sign * amount * (MS[unit] ?? MS.days);
    const shifted = new Date(shiftedMs);
    // Re-apply time-of-day in London on the shifted calendar day
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: LONDON,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(shifted);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
    return londonLocalToUtc(get("year"), get("month"), get("day"), h, m);
  }

  return null;
}

/** Subtract relative amount from an absolute event start (for calendar reminders). */
export function calculateOffsetBefore(
  start: Date,
  amount: number,
  unit: "minutes" | "hours" | "days",
): Date {
  const ms =
    unit === "minutes" ? amount * MS.minutes : unit === "hours" ? amount * MS.hours : amount * MS.days;
  return new Date(start.getTime() - ms);
}

/** Format a Date to a friendly UK-style string in London time */
export function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    timeZone: LONDON,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Today's YYYY-MM-DD in Europe/London */
export function londonTodayString(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
