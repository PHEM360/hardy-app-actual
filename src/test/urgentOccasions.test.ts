import { afterEach, describe, expect, it } from "vitest";
import type { CalendarEvent } from "@/types/app";
import type { Birthday } from "@/types/birthdays";
import {
  acknowledgeOccasion,
  acknowledgedOccasionIds,
  pendingUrgentOccasions,
  todaysUrgentOccasions,
} from "@/lib/urgentOccasions";

const today = new Date(2026, 9, 9, 10, 0, 0);

function birthday(partial: Partial<Birthday> & Pick<Birthday, "id" | "name">): Birthday {
  return {
    month: 10,
    day: 9,
    createdBy: "u1",
    sharedWith: { mode: "none" },
    reminders: [],
    urgent: true,
    ...partial,
  };
}

function event(partial: Partial<CalendarEvent> & Pick<CalendarEvent, "id" | "title">): CalendarEvent {
  return {
    category: "family",
    startDate: "2026-10-09T09:00:00",
    endDate: "2026-10-09T10:00:00",
    priority: "urgent",
    source: "local",
    ...partial,
  };
}

describe("todaysUrgentOccasions", () => {
  it("shows an urgent birthday that falls today", () => {
    const items = todaysUrgentOccasions({
      now: today,
      birthdays: [birthday({ id: "b1", name: "Sam" })],
      events: [],
    });
    expect(items).toEqual([
      expect.objectContaining({ id: "bday:b1", kind: "birthday", title: "It is Sam's birthday today" }),
    ]);
  });

  it("ignores birthdays that are not marked urgent or are not today", () => {
    const items = todaysUrgentOccasions({
      now: today,
      birthdays: [
        birthday({ id: "quiet", name: "Alex", urgent: false }),
        birthday({ id: "later", name: "Jo", day: 20 }),
      ],
      events: [],
    });
    expect(items).toEqual([]);
  });

  it("shows a user marked urgent event and skips auto imported rows", () => {
    const items = todaysUrgentOccasions({
      now: today,
      birthdays: [],
      events: [
        event({ id: "e1", title: "Parents evening" }),
        event({ id: "__pet_flea", title: "Willow flea due" }),
        event({ id: "g1", title: "Work sync", source: "google" }),
      ],
    });
    expect(items.map((item) => item.id)).toEqual(["event:e1"]);
  });
});

describe("acknowledgeOccasion", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("hides an occasion once it has been acknowledged for that day", () => {
    const occasions = todaysUrgentOccasions({
      now: today,
      birthdays: [birthday({ id: "b1", name: "Sam" })],
      events: [],
    });
    expect(pendingUrgentOccasions(occasions, "2026-10-09")).toHaveLength(1);
    acknowledgeOccasion("bday:b1", "2026-10-09");
    expect(acknowledgedOccasionIds("2026-10-09")).toEqual(["bday:b1"]);
    expect(pendingUrgentOccasions(occasions, "2026-10-09")).toEqual([]);
  });
});
