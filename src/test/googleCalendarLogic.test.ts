import { describe, expect, it } from "vitest";
import { calendarWriteData } from "@/lib/calendarWrite";
import { googleCalendarDocId, mapGoogleCalendarEvent, selectedGoogleCalendarIds, toGoogleCalendarBody } from "@/lib/googleCalendarLogic";

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

  it("imports the calendars Google already has switched on, including joined ones", () => {
    expect(selectedGoogleCalendarIds([
      { id: "me@gmail.com", primary: true, selected: true },
      { id: "family@group.calendar.google.com", selected: true },
      { id: "hidden@group.calendar.google.com", selected: false },
    ])).toEqual(["me@gmail.com", "family@group.calendar.google.com"]);
    expect(selectedGoogleCalendarIds([])).toEqual(["primary"]);
  });

  it("omits empty optional fields so Firestore will accept a new event", () => {
    expect(calendarWriteData({
      title: "Swim",
      description: undefined,
      location: undefined,
      category: "personal",
      invitees: [],
    })).toEqual({
      title: "Swim",
      category: "personal",
      invitees: [],
    });
  });
});
