import { describe, expect, it } from "vitest";
import {
  balanceAt,
  cutoffInstant,
  historyBalances,
  historyDates,
  monthsBefore,
  parseHistoryOptions,
} from "../../functions/src/bankHistory";

describe("bank history options", () => {
  it("keeps the old meaning of history: true", () => {
    expect(parseHistoryOptions(true)).toEqual({ months: 24, frequency: "monthly", time: "23:59" });
    expect(parseHistoryOptions(false)).toBeNull();
    expect(parseHistoryOptions(undefined)).toBeNull();
  });

  it("clamps and repairs bad input", () => {
    expect(parseHistoryOptions({ months: 500, frequency: "hourly", time: "9pm" })).toEqual({
      months: 60,
      frequency: "weekly",
      time: "21:00",
    });
    expect(parseHistoryOptions({ months: 6, frequency: "daily", time: "07:30" })).toEqual({
      months: 6,
      frequency: "daily",
      time: "07:30",
    });
  });
});

describe("bank history dates", () => {
  it("steps back by calendar months", () => {
    expect(monthsBefore("2026-10-09", 6)).toBe("2026-04-09");
    expect(monthsBefore("2026-08-31", 6)).toBe("2026-02-28");
    expect(monthsBefore("2026-01-15", 2)).toBe("2025-11-15");
  });

  it("lists weekly days back from today and leaves today out", () => {
    expect(historyDates("2026-09-10", "2026-10-09", "weekly")).toEqual([
      "2026-10-02",
      "2026-09-25",
      "2026-09-18",
      "2026-09-11",
    ]);
  });

  it("lists every day for daily", () => {
    const days = historyDates("2026-04-09", "2026-10-09", "daily");
    expect(days[0]).toBe("2026-10-08");
    expect(days[days.length - 1]).toBe("2026-04-09");
    expect(days).toHaveLength(183);
  });

  it("lists month ends for monthly", () => {
    expect(historyDates("2026-06-15", "2026-10-09", "monthly")).toEqual(["2026-09-30", "2026-08-31", "2026-07-31", "2026-06-30"]);
  });
});

describe("balance as at a time of day", () => {
  it("uses London time in summer and winter", () => {
    expect(new Date(cutoffInstant("2026-07-01", "21:00")).toISOString()).toBe("2026-07-01T20:00:00.000Z");
    expect(new Date(cutoffInstant("2026-01-10", "21:00")).toISOString()).toBe("2026-01-10T21:00:00.000Z");
  });

  it("takes off everything after the cut off when the bank gives no running balance", () => {
    const txs = [
      { timestamp: "2026-10-05T12:00:00Z", amount: -40 },
      { timestamp: "2026-10-05T21:30:00Z", amount: -10 },
      { timestamp: "2026-10-07T09:00:00Z", amount: 100 },
    ];
    // 9pm UK on 5 October is 20:00 UTC, so the 21:30 UTC payment has not happened yet.
    expect(balanceAt(cutoffInstant("2026-10-05", "21:00"), 500, txs)).toBe(410);
    expect(balanceAt(cutoffInstant("2026-10-05", "23:30"), 500, txs)).toBe(400);
    expect(balanceAt(cutoffInstant("2026-10-04", "21:00"), 500, txs)).toBe(450);
  });

  it("prefers the bank's running balance", () => {
    const txs = [
      { timestamp: "2026-10-01T10:00:00Z", amount: -5, running_balance: { amount: 300 } },
      { timestamp: "2026-10-03T10:00:00Z", amount: -5, running_balance: { amount: 295 } },
      { timestamp: "2026-10-06T10:00:00Z", amount: 50, running_balance: { amount: 345 } },
    ];
    expect(balanceAt(cutoffInstant("2026-10-04", "21:00"), 999, txs)).toBe(295);
  });

  it("stops at the first transaction the bank shared", () => {
    const rows = historyBalances({
      today: "2026-10-09",
      current: 1000,
      txs: [
        { timestamp: "2026-09-20T08:00:00Z", amount: 200 },
        { timestamp: "2026-10-01T08:00:00Z", amount: -50 },
      ],
      options: { months: 6, frequency: "weekly", time: "21:00" },
    });
    expect(rows).toEqual([
      { date: "2026-10-02", amount: 1000 },
      { date: "2026-09-25", amount: 1050 },
    ]);
  });
});
