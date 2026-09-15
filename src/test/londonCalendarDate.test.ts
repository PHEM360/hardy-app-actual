import { describe, expect, it } from "vitest";
import {
  allDayEventCoversDate,
  londonDateFromIso,
  londonDayEndIso,
  londonDayStartIso,
} from "../lib/londonCalendarDate";

describe("londonDateFromIso", () => {
  it("reads a UTC midnight instant as that same date in winter (GMT, UTC+0)", () => {
    expect(londonDateFromIso("2026-01-15T00:00:00.000Z")).toBe("2026-01-15");
  });

  it("shifts a late-UTC instant forward a day once British Summer Time (UTC+1) applies", () => {
    // 23:30 UTC on 14 June is already 00:30 the next day in the UK during BST.
    expect(londonDateFromIso("2026-06-14T23:30:00.000Z")).toBe("2026-06-15");
  });

  it("does not shift the same late-UTC instant in winter, when the UK is on GMT", () => {
    expect(londonDateFromIso("2026-01-14T23:30:00.000Z")).toBe("2026-01-14");
  });

  it("agrees with the stored all-day convention (UTC midnight) regardless of viewer timezone", () => {
    // This is what an all-day event is actually stored as (see Calendar.tsx handleSave).
    expect(londonDateFromIso("2026-09-16T00:00:00.000Z")).toBe("2026-09-16");
    expect(londonDateFromIso("2026-09-16T23:59:59.000Z")).toBe("2026-09-17");
  });
});

describe("allDayEventCoversDate", () => {
  it("matches a single-day all-day event on its own date only", () => {
    // Built with londonDayStartIso/EndIso, which is what the app now stores
    // for all-day events (see Calendar.tsx handleSave) — a naive
    // `${date}T23:59:59.000Z` literal would be wrong here since 16 September
    // is still within BST (see the londonDayStartIso/EndIso tests below).
    const event = { startDate: londonDayStartIso("2026-09-16"), endDate: londonDayEndIso("2026-09-16") };
    expect(allDayEventCoversDate(event, "2026-09-16")).toBe(true);
    expect(allDayEventCoversDate(event, "2026-09-15")).toBe(false);
    expect(allDayEventCoversDate(event, "2026-09-17")).toBe(false);
  });

  it("matches every date within a multi-day all-day event stored with correct UK day boundaries", () => {
    // Built with londonDayStartIso/EndIso, not a naive `${date}T23:59:59.000Z`
    // literal — see the next describe block for why that distinction matters.
    const event = { startDate: londonDayStartIso("2026-08-01"), endDate: londonDayEndIso("2026-08-05") };
    expect(allDayEventCoversDate(event, "2026-08-01")).toBe(true);
    expect(allDayEventCoversDate(event, "2026-08-03")).toBe(true);
    expect(allDayEventCoversDate(event, "2026-08-05")).toBe(true);
    expect(allDayEventCoversDate(event, "2026-07-31")).toBe(false);
    expect(allDayEventCoversDate(event, "2026-08-06")).toBe(false);
  });
});

describe("londonDayStartIso / londonDayEndIso", () => {
  it("matches the naive UTC literal in winter, when the UK is on GMT (UTC+0)", () => {
    expect(londonDayStartIso("2026-01-15")).toBe("2026-01-15T00:00:00.000Z");
    expect(londonDayEndIso("2026-01-15")).toBe("2026-01-15T23:59:59.000Z");
  });

  it("shifts an hour earlier in summer, when the UK is on BST (UTC+1)", () => {
    // A naive `${date}T23:59:59.000Z` would actually be 00:59:59 the *next*
    // UK day during BST — the correct UK 23:59:59 is an hour earlier in UTC.
    expect(londonDayStartIso("2026-06-14")).toBe("2026-06-13T23:00:00.000Z");
    expect(londonDayEndIso("2026-06-14")).toBe("2026-06-14T22:59:59.000Z");
  });

  it("round-trips back to the same UK calendar date via londonDateFromIso", () => {
    for (const date of ["2026-01-15", "2026-03-29", "2026-06-14", "2026-10-25", "2026-12-31"]) {
      expect(londonDateFromIso(londonDayStartIso(date))).toBe(date);
      expect(londonDateFromIso(londonDayEndIso(date))).toBe(date);
    }
  });
});
