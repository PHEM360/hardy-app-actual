import { describe, expect, it } from "vitest";
import { googleCalendarDocId, mapGoogleCalendarEvent, toGoogleCalendarBody } from "@/lib/googleCalendarLogic";

describe("google calendar mapping", () => {
  it("maps a timed Google event", () => {
    const mapped = mapGoogleCalendarEvent({
      id: "abc",
      summary: "Parents evening",
      location: "School",
      start: { dateTime: "2026-09-08T17:00:00+01:00" },
      end: { dateTime: "2026-09-08T18:00:00+01:00" },
    }, "primary");
    expect(mapped?.title).toBe("Parents evening");
    expect(mapped?.source).toBe("google");
    expect(mapped?.allDay).toBe(false);
    expect(mapped?.googleCalendarId).toBe("primary");
    expect(googleCalendarDocId("primary", "abc")).toBe("g_primary_abc");
  });

  it("maps an all-day event and skips cancelled ones", () => {
    const mapped = mapGoogleCalendarEvent({
      id: "day",
      summary: "Holiday",
      start: { date: "2026-09-10" },
      end: { date: "2026-09-11" },
    }, "family");
    expect(mapped?.allDay).toBe(true);
    expect(mapGoogleCalendarEvent({ id: "x", status: "cancelled", start: { date: "2026-09-10" }, end: { date: "2026-09-11" } }, "family")).toBeNull();
  });

  it("builds a Google body from a Hardy Hub event", () => {
    const body = toGoogleCalendarBody({
      title: "Dentist",
      startDate: "2026-09-08T09:00:00.000Z",
      endDate: "2026-09-08T10:00:00.000Z",
    });
    expect(body.summary).toBe("Dentist");
    expect("dateTime" in body.start).toBe(true);
  });
});
