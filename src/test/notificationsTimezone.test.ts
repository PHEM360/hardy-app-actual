import { describe, expect, it } from "vitest";

// Mirror of functions/src/notifications/calculations.ts londonLocalToUtc for client-side unit tests
function londonLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let utc = desiredAsUtc;
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(utc));
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
    const shownAsUtc = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second"),
    );
    utc += desiredAsUtc - shownAsUtc;
  }
  return new Date(utc);
}

describe("londonLocalToUtc", () => {
  it("maps winter London time to UTC correctly (GMT)", () => {
    // 15 Jan 2025 09:00 London = 09:00 UTC
    const d = londonLocalToUtc(2025, 1, 15, 9, 0);
    expect(d.toISOString()).toBe("2025-01-15T09:00:00.000Z");
  });

  it("maps summer London time to UTC correctly (BST)", () => {
    // 15 Jul 2025 09:00 London = 08:00 UTC
    const d = londonLocalToUtc(2025, 7, 15, 9, 0);
    expect(d.toISOString()).toBe("2025-07-15T08:00:00.000Z");
  });
});

describe("holiday watch kinds", () => {
  it("exposes search, flight and hotel labels", async () => {
    const { WATCH_KIND_LABELS } = await import("@/types/holidays");
    expect(WATCH_KIND_LABELS.search).toMatch(/search/i);
    expect(WATCH_KIND_LABELS.flight).toMatch(/flight/i);
    expect(WATCH_KIND_LABELS.hotel).toMatch(/hotel/i);
  });
});
