import { describe, expect, it } from "vitest";
import { applyCalendarMergeRules } from "@/lib/calendarMerge";
import { eventsToIcs, parseIcsEvents } from "@/lib/calendarIcs";
import type { CalendarEvent } from "@/types/app";

const event = (partial: Partial<CalendarEvent>): CalendarEvent => ({
  title: "Thing",
  category: "other",
  startDate: "2026-09-14T09:00:00.000Z",
  endDate: "2026-09-14T10:00:00.000Z",
  ...partial,
});

describe("calendar merge", () => {
  it("hides keyword matches and duplicate titles on the same day", () => {
    const merged = applyCalendarMergeRules(
      [
        event({ title: "UK Holidays", source: "google", allDay: true }),
        event({ title: "UK Holidays", source: "import", allDay: true, feedId: "icloud" }),
        event({ title: "Dentist", source: "local" }),
        event({ title: "School run", source: "google" }),
      ],
      { hideTitleContains: ["school"], hideDuplicates: true, hideAllDayHolidays: true },
    );
    expect(merged.map((item) => item.title)).toEqual(["Dentist"]);
  });

  it("keeps the local copy when the same event arrives twice", () => {
    const merged = applyCalendarMergeRules(
      [
        event({ title: "Parents evening", source: "google" }),
        event({ title: "Parents evening", source: "local" }),
      ],
      { hideDuplicates: true },
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe("local");
  });

  it("round-trips a simple ICS event", () => {
    const ics = eventsToIcs([event({ title: "Swim", location: "Baths", allDay: false })]);
    const parsed = parseIcsEvents(ics, "feed1");
    expect(parsed[0].title).toBe("Swim");
    expect(parsed[0].location).toBe("Baths");
    expect(parsed[0].source).toBe("import");
    expect(parsed[0].feedId).toBe("feed1");
  });
});
