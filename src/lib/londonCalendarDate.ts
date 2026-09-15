// All-day events (birthdays, bin day, school holidays…) are conceptually
// dates on the UK household calendar, not moments in the viewer's own
// timezone. Anchoring their "which day is this" to Europe/London means every
// family member sees the same day for them, whether they're home or abroad —
// rather than the date shifting by one depending on which side of UTC
// midnight the viewer's device happens to be on.
const LONDON_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The Europe/London calendar date (YYYY-MM-DD) that a given ISO instant falls on. */
export function londonDateFromIso(iso: string): string {
  return LONDON_DATE_FORMATTER.format(new Date(iso));
}

/** Today's date (YYYY-MM-DD) in Europe/London, regardless of the viewer's own timezone. */
export function londonToday(): string {
  return LONDON_DATE_FORMATTER.format(new Date());
}

/**
 * Whether an all-day event's UK date range covers `dateStr` (a YYYY-MM-DD
 * calendar date, e.g. a grid cell being rendered). Only meaningful for
 * allDay events — timed events should compare by instant/local time instead.
 */
export function allDayEventCoversDate(event: { startDate: string; endDate: string }, dateStr: string): boolean {
  const start = londonDateFromIso(event.startDate);
  const end = londonDateFromIso(event.endDate);
  return dateStr >= start && dateStr <= end;
}

/**
 * Convert a civil date + time in Europe/London into the UTC instant it
 * represents, correctly accounting for GMT/BST. Mirrors the same
 * iterative-correction approach as functions/src/notifications/calculations.ts's
 * londonLocalToUtc (duplicated rather than shared, since src/ and functions/
 * are separate deployable units) — do not "simplify" this to a fixed offset,
 * the loop is what makes it correct across the DST boundary.
 */
export function londonWallTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, second = 0): Date {
  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let utc = desiredAsUtc;
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(utc));
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
    const shownAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    utc += desiredAsUtc - shownAsUtc;
  }
  return new Date(utc);
}

/** UTC instant for UK-local midnight (00:00:00) on a YYYY-MM-DD date — the correct
 *  start-of-day for an all-day event, unlike a bare `${date}T00:00:00.000Z`. */
export function londonDayStartIso(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return londonWallTimeToUtc(y, m, d, 0, 0, 0).toISOString();
}

/** UTC instant for UK-local end-of-day (23:59:59) on a YYYY-MM-DD date — during
 *  BST, `${date}T23:59:59.000Z` is actually 00:59:59 UK time the *next* day,
 *  which would make a multi-day all-day event look like it runs one day long. */
export function londonDayEndIso(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return londonWallTimeToUtc(y, m, d, 23, 59, 59).toISOString();
}
