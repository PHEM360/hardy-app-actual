import type { CalendarEvent, CalendarMergeRules } from "@/types/app";

const HOLIDAY_HINT = /\b(holiday|bank holiday|bank hol|public holiday|uk holidays?|us holidays?)\b/i;

export function normalizeEventTitle(title: string): string {
  return title.replace(/\s+/g, " ").trim().toLowerCase();
}

export function eventDayKey(event: CalendarEvent): string {
  const raw = event.startDate || "";
  if (raw.length >= 10) return raw.slice(0, 10);
  try {
    return new Date(raw).toISOString().slice(0, 10);
  } catch {
    return raw;
  }
}

export function applyCalendarMergeRules(
  events: CalendarEvent[],
  rules: CalendarMergeRules | undefined,
): CalendarEvent[] {
  const hideSources = new Set(rules?.hideSources ?? []);
  const hideFeeds = new Set(rules?.hideFeedIds ?? []);
  const needles = (rules?.hideTitleContains ?? []).map((item) => item.trim().toLowerCase()).filter(Boolean);
  const hideHolidays = rules?.hideAllDayHolidays === true;
  const hideDuplicates = rules?.hideDuplicates !== false;

  const kept = events.filter((event) => {
    if (event.source && hideSources.has(event.source)) return false;
    if (event.feedId && hideFeeds.has(event.feedId)) return false;
    const title = normalizeEventTitle(event.title || "");
    if (needles.some((needle) => title.includes(needle))) return false;
    if (hideHolidays && event.allDay && HOLIDAY_HINT.test(event.title || "")) return false;
    return true;
  });

  if (!hideDuplicates) return kept;

  const seen = new Set<string>();
  const sourceRank = (source?: CalendarEvent["source"]) =>
    source === "local" ? 0 : source === "google" ? 1 : source === "birthday" ? 2 : 3;

  return [...kept]
    .sort((a, b) => sourceRank(a.source) - sourceRank(b.source))
    .filter((event) => {
      const key = `${eventDayKey(event)}|${normalizeEventTitle(event.title || "")}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
