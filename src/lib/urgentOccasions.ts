import { format } from "date-fns";
import { nextOccurrenceLabel } from "@/lib/birthdayDates";
import { eventsOnDay } from "@/lib/todayInsights";
import type { CalendarEvent } from "@/types/app";
import type { Birthday } from "@/types/birthdays";

export interface UrgentOccasion {
  id: string;
  kind: "birthday" | "event";
  title: string;
  subtitle?: string;
}

const storageKey = (day: string) => `hh-urgent-ack:${day}`;

function looksLikeBirthday(event: CalendarEvent) {
  return event.category === "birthday" || event.source === "birthday" || /birthday|bday/i.test(event.title);
}

function birthdayHeadline(name: string) {
  const trimmed = name.trim();
  if (/birthday/i.test(trimmed)) return `It is ${trimmed} today`;
  return `It is ${trimmed}'s birthday today`;
}

export function todaysUrgentOccasions(args: {
  birthdays: Birthday[];
  events: CalendarEvent[];
  now?: Date;
}): UrgentOccasion[] {
  const now = args.now ?? new Date();
  const items: UrgentOccasion[] = [];
  const seenBirthdayIds = new Set<string>();

  for (const birthday of args.birthdays) {
    if (!birthday.urgent) continue;
    if (nextOccurrenceLabel(birthday.month, birthday.day, now).days !== 0) continue;
    const id = `bday:${birthday.id}`;
    seenBirthdayIds.add(birthday.id);
    items.push({
      id,
      kind: "birthday",
      title: birthdayHeadline(birthday.name),
      subtitle: birthday.birthYear ? `Turning ${now.getFullYear() - birthday.birthYear}` : "Marked urgent",
    });
  }

  for (const event of args.events) {
    if (event.priority !== "urgent") continue;
    if (event.id?.startsWith("__")) continue;
    if (event.source && event.source !== "local" && event.source !== "birthday") continue;
    if (!eventsOnDay([event], now).length) continue;
    if (event.birthdayId && seenBirthdayIds.has(event.birthdayId)) continue;
    const isBirthday = looksLikeBirthday(event);
    items.push({
      id: `event:${event.id || event.title}`,
      kind: isBirthday ? "birthday" : "event",
      title: isBirthday ? birthdayHeadline(event.title) : event.title,
      subtitle: event.location || event.description || (isBirthday ? "Marked urgent" : "This is marked urgent for today"),
    });
  }

  return items;
}

export function acknowledgedOccasionIds(day = format(new Date(), "yyyy-MM-dd")): string[] {
  try {
    const raw = localStorage.getItem(storageKey(day));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function acknowledgeOccasion(id: string, day = format(new Date(), "yyyy-MM-dd")) {
  const next = Array.from(new Set([...acknowledgedOccasionIds(day), id]));
  localStorage.setItem(storageKey(day), JSON.stringify(next));
}

export function pendingUrgentOccasions(
  occasions: UrgentOccasion[],
  day = format(new Date(), "yyyy-MM-dd"),
): UrgentOccasion[] {
  const acked = new Set(acknowledgedOccasionIds(day));
  return occasions.filter((item) => !acked.has(item.id));
}
