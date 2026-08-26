import { addDays, isSameDay, startOfDay } from "date-fns";

export function daysUntilDate(iso: string, from = new Date()): number {
  const today = startOfDay(from);
  const target = startOfDay(new Date(iso));
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function nextAnnualDate(iso: string, from = new Date()): Date {
  const source = new Date(iso);
  const today = startOfDay(from);
  let next = new Date(today.getFullYear(), source.getMonth(), source.getDate());
  if (next < today) next = new Date(today.getFullYear() + 1, source.getMonth(), source.getDate());
  return next;
}

export function daysUntilNextAnnual(iso: string, from = new Date()): number {
  const today = startOfDay(from);
  const next = nextAnnualDate(iso, from);
  return Math.round((next.getTime() - today.getTime()) / 86_400_000);
}

export interface BirthdayItem {
  id: string;
  name: string;
  kind: "pet" | "event";
  date: Date;
  days: number;
}

export function upcomingBirthdays(opts: {
  pets: { id: string; name: string; birthday?: string }[];
  events: { id?: string; title: string; startDate: string }[];
  from?: Date;
  withinDays?: number;
}): BirthdayItem[] {
  const from = opts.from ?? new Date();
  const within = opts.withinDays ?? 14;
  const items: BirthdayItem[] = [];

  for (const pet of opts.pets) {
    if (!pet.birthday) continue;
    const days = daysUntilNextAnnual(pet.birthday, from);
    if (days >= 0 && days <= within) {
      items.push({
        id: `pet-${pet.id}`,
        name: pet.name,
        kind: "pet",
        date: nextAnnualDate(pet.birthday, from),
        days,
      });
    }
  }

  for (const event of opts.events) {
    if (!/birthday|bday/i.test(event.title)) continue;
    const days = daysUntilDate(event.startDate, from);
    if (days >= 0 && days <= within) {
      items.push({
        id: `event-${event.id || event.title}`,
        name: event.title,
        kind: "event",
        date: startOfDay(new Date(event.startDate)),
        days,
      });
    }
  }

  return items.sort((a, b) => a.days - b.days);
}

export function eventsOnDay<T extends { startDate: string }>(events: T[], day: Date): T[] {
  return events.filter((event) => isSameDay(new Date(event.startDate), day));
}

export function eventsInRange<T extends { startDate: string }>(events: T[], from: Date, daysAhead: number): T[] {
  const start = startOfDay(from);
  const end = addDays(start, daysAhead);
  return events
    .filter((event) => {
      const d = startOfDay(new Date(event.startDate));
      return d >= start && d <= end;
    })
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
}

export function billsDueSoon<T extends { endDate?: string }>(items: T[], from = new Date(), withinDays = 31): T[] {
  return items
    .filter((item) => {
      if (!item.endDate) return false;
      const days = daysUntilDate(item.endDate, from);
      return days >= 0 && days <= withinDays;
    })
    .sort((a, b) => daysUntilDate(a.endDate!, from) - daysUntilDate(b.endDate!, from));
}

export function overdueByDueDate<T extends { dueDate?: string; status?: string }>(items: T[], from = new Date()): T[] {
  return items.filter((item) => {
    if (!item.dueDate || item.status === "done") return false;
    return daysUntilDate(item.dueDate, from) < 0;
  });
}

export function dueOnDay<T extends { dueDate?: string; status?: string }>(items: T[], day: Date): T[] {
  return items.filter((item) => {
    if (!item.dueDate || item.status === "done") return false;
    return isSameDay(new Date(item.dueDate), day);
  });
}
