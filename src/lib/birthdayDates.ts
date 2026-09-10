import { startOfDay } from "date-fns";

/** Next occurrence (today counts) of a recurring month/day, plus days until it. */
export function nextOccurrenceLabel(month: number, day: number, from = new Date()): { date: Date; days: number } {
  const today = startOfDay(from);
  let next = new Date(today.getFullYear(), month - 1, day);
  if (next < today) next = new Date(today.getFullYear() + 1, month - 1, day);
  const days = Math.round((next.getTime() - today.getTime()) / 86_400_000);
  return { date: next, days };
}
