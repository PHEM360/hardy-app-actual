import { describe, expect, it } from "vitest";
import {
  holidaySearchIntervalMs,
  nextHolidaySearchAt,
} from "@/types/holidays";

describe("holiday search intervals", () => {
  it("converts units to milliseconds", () => {
    expect(holidaySearchIntervalMs(1, "hours")).toBe(60 * 60 * 1000);
    expect(holidaySearchIntervalMs(2, "days")).toBe(2 * 24 * 60 * 60 * 1000);
    expect(holidaySearchIntervalMs(1, "weeks")).toBe(7 * 24 * 60 * 60 * 1000);
    expect(holidaySearchIntervalMs(1, "months")).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("floors amount to at least 1", () => {
    expect(holidaySearchIntervalMs(0, "hours")).toBe(60 * 60 * 1000);
  });

  it("computes next search ISO timestamp", () => {
    const from = new Date("2026-09-02T12:00:00.000Z");
    const next = nextHolidaySearchAt(from, 1, "hours");
    expect(next).toBe("2026-09-02T13:00:00.000Z");
  });
});
