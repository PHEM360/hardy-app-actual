import {
  addHours,
  differenceInMinutes,
  endOfDay,
  isAfter,
  isBefore,
  max as maxDate,
  min as minDate,
  parseISO,
  startOfDay,
} from "date-fns";
import type { CalendarEvent } from "@/types/app";

export const WEEKDAY_LABELS_MON = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const WEEKDAY_LABELS_SUN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function weekStartsOnValue(value: number | undefined): 0 | 1 {
  return value === 0 ? 0 : 1;
}

export function weekdayLabels(weekStartsOn: 0 | 1) {
  return weekStartsOn === 0 ? WEEKDAY_LABELS_SUN : WEEKDAY_LABELS_MON;
}

export function clampHour(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(23, Math.max(0, Math.round(value as number)));
}

export function workHours(start?: number, end?: number) {
  const from = clampHour(start, 7);
  const to = clampHour(end, 19);
  if (to <= from) return { start: 7, end: 19 };
  return { start: from, end: to };
}

export function hourRange(startHour: number, endHour: number) {
  const hours: number[] = [];
  for (let hour = startHour; hour < endHour; hour += 1) hours.push(hour);
  return hours;
}

export function isAllDayEvent(event: Pick<CalendarEvent, "allDay" | "startDate" | "endDate">) {
  if (event.allDay) return true;
  try {
    const start = parseISO(event.startDate);
    const end = parseISO(event.endDate || event.startDate);
    return start.getHours() === 0 && start.getMinutes() === 0 && differenceInMinutes(end, start) >= 23 * 60;
  } catch {
    return false;
  }
}

export function eventOverlapsDay(event: Pick<CalendarEvent, "startDate" | "endDate">, day: Date) {
  try {
    const start = startOfDay(parseISO(event.startDate));
    const end = endOfDay(parseISO(event.endDate || event.startDate));
    return !isAfter(start, endOfDay(day)) && !isBefore(end, startOfDay(day));
  } catch {
    return false;
  }
}

export interface TimedPlacement {
  topPct: number;
  heightPct: number;
  startsBeforeGrid: boolean;
  endsAfterGrid: boolean;
}

export function timedPlacement(
  event: Pick<CalendarEvent, "startDate" | "endDate" | "allDay">,
  day: Date,
  startHour: number,
  endHour: number,
): TimedPlacement | null {
  if (isAllDayEvent(event)) return null;
  const start = parseISO(event.startDate);
  const end = parseISO(event.endDate || event.startDate);
  const gridStart = addHours(startOfDay(day), startHour);
  const gridEnd = addHours(startOfDay(day), endHour);
  if (isBefore(end, gridStart) || start.getTime() >= gridEnd.getTime()) return null;
  const clampedStart = maxDate([start, gridStart]);
  const clampedEnd = minDate([end, gridEnd, endOfDay(day)]);
  const total = Math.max(1, differenceInMinutes(gridEnd, gridStart));
  const offset = Math.max(0, differenceInMinutes(clampedStart, gridStart));
  const span = Math.max(20, differenceInMinutes(clampedEnd, clampedStart));
  return {
    topPct: (offset / total) * 100,
    heightPct: Math.min(100 - (offset / total) * 100, (span / total) * 100),
    startsBeforeGrid: start < gridStart,
    endsAfterGrid: end > gridEnd,
  };
}

export function formatHourLabel(hour: number) {
  const padded = String(hour).padStart(2, "0");
  return `${padded}:00`;
}
