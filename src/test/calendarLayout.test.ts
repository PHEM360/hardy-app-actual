import { describe, expect, it } from "vitest";
import {
  eventOverlapsDay,
  formatHourLabel,
  hourRange,
  isAllDayEvent,
  timedPlacement,
  weekdayLabels,
  weekStartsOnValue,
  workHours,
} from "@/lib/calendarLayout";

describe("calendar layout", () => {
  it("defaults the week to Monday and can start on Sunday", () => {
    expect(weekStartsOnValue(undefined)).toBe(1);
    expect(weekStartsOnValue(0)).toBe(0);
    expect(weekdayLabels(1)[0]).toBe("Mon");
    expect(weekdayLabels(0)[0]).toBe("Sun");
  });

  it("clamps a backwards work-day range", () => {
    expect(workHours(19, 7)).toEqual({ start: 7, end: 19 });
    expect(workHours(8, 16)).toEqual({ start: 8, end: 16 });
    expect(hourRange(8, 10)).toEqual([8, 9]);
    expect(formatHourLabel(9)).toBe("09:00");
  });

  it("treats midnight-to-midnight events as all day", () => {
    expect(isAllDayEvent({
      allDay: false,
      startDate: "2026-09-14T00:00:00",
      endDate: "2026-09-15T00:00:00",
    })).toBe(true);
  });

  it("places a timed event inside the work-day grid", () => {
    const day = new Date(2026, 8, 14);
    const place = timedPlacement(
      { startDate: "2026-09-14T10:00:00", endDate: "2026-09-14T11:00:00", allDay: false },
      day,
      8,
      18,
    );
    expect(place).not.toBeNull();
    expect(place!.topPct).toBeCloseTo(20, 5);
    expect(place!.heightPct).toBeCloseTo(10, 5);
  });

  it("overlaps multi-day events onto each day they cover", () => {
    const event = { startDate: "2026-09-14T18:00:00", endDate: "2026-09-16T10:00:00" };
    expect(eventOverlapsDay(event, new Date(2026, 8, 14))).toBe(true);
    expect(eventOverlapsDay(event, new Date(2026, 8, 15))).toBe(true);
    expect(eventOverlapsDay(event, new Date(2026, 8, 16))).toBe(true);
    expect(eventOverlapsDay(event, new Date(2026, 8, 17))).toBe(false);
  });
});
