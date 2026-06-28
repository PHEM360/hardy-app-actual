import { ReminderConfig } from "./types";

const MS: Record<string, number> = {
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
  weeks: 7 * 86_400_000,
  months: 30 * 86_400_000,
  years: 365 * 86_400_000,
};

/** Parse "HH:MM" into { h, m } */
function parseTime(t: string): { h: number; m: number } {
  const [h, m] = (t || "09:00").split(":").map(Number);
  return { h: h ?? 9, m: m ?? 0 };
}

/**
 * Given a task dueDate string ("YYYY-MM-DD") and a reminder config,
 * returns the Date at which to send the notification, or null if invalid.
 */
export function calculateReminderTime(dueDate: string, reminder: ReminderConfig): Date | null {
  const [year, month, day] = dueDate.split("-").map(Number);
  if (!year || !month || !day) return null;

  const { h, m } = parseTime(reminder.timeOfDay);

  if (reminder.mode === "onDayAt") {
    return new Date(year, month - 1, day, h, m, 0, 0);
  }

  if (reminder.mode === "relative") {
    const amount = reminder.relativeAmount ?? 1;
    const unit = reminder.relativeUnit ?? "days";
    const dir = reminder.relativeDirection ?? "before";
    const sign = dir === "before" ? -1 : 1;

    // Base point: due date at timeOfDay
    const base = new Date(year, month - 1, day, h, m, 0, 0);

    if (unit === "minutes" || unit === "hours") {
      // Offset from the base time directly
      return new Date(base.getTime() + sign * amount * (MS[unit] ?? MS.days));
    }

    // For days/weeks/months/years: shift the whole date, then set timeOfDay
    const shifted = new Date(base.getTime() + sign * amount * (MS[unit] ?? MS.days));
    shifted.setHours(h, m, 0, 0);
    return shifted;
  }

  return null;
}

/** Format a Date to a friendly UK-style string */
export function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
