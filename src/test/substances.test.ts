import { describe, expect, it } from "vitest";
import {
  buildDailyChartRows,
  canAccessSubstanceTracking,
  chartSeriesKey,
  computeSubstanceTotals,
  doseAmountForChart,
  filterLogsByPeriod,
  filterLogsBySubstances,
  formatDoseLabel,
  formatTotalAmount,
  listChartSeries,
  mergeSubstanceOptions,
  sortLogsNewestFirst,
} from "@/lib/substances";

const sample = [
  { id: "1", name: "Oramorph", dose: "10", unit: "mg", date: "2026-03-10", time: "08:00" },
  { id: "2", name: "Oramorph", dose: "5", unit: "mg", date: "2026-03-10", time: "20:00" },
  { id: "3", name: "Codeine", dose: "30", unit: "mg", date: "2026-03-11", time: "12:00" },
  { id: "4", name: "Oramorph", dose: "big", unit: "swig", date: "2026-03-12", time: "09:30" },
  { id: "5", name: "Lorazepam", dose: "1", unit: "mg", date: "2025-01-01", time: "22:00" },
];

describe("canAccessSubstanceTracking", () => {
  it("allows Chris by email on his own page", () => {
    expect(canAccessSubstanceTracking({
      email: "chris.hardy.07@googlemail.com",
      isOwnScope: true,
    })).toBe(true);
  });

  it("allows Chris by first name on his own page", () => {
    expect(canAccessSubstanceTracking({
      firstName: "Chris",
      isOwnScope: true,
    })).toBe(true);
  });

  it("hides the tab on a shared health page", () => {
    expect(canAccessSubstanceTracking({
      email: "chris.hardy.07@googlemail.com",
      isOwnScope: false,
    })).toBe(false);
  });

  it("hides the tab while viewing as someone else", () => {
    expect(canAccessSubstanceTracking({
      email: "chris.hardy.07@googlemail.com",
      isOwnScope: true,
      viewingAsOther: true,
    })).toBe(false);
  });

  it("denies other family members", () => {
    expect(canAccessSubstanceTracking({
      email: "sarah@example.com",
      firstName: "Sarah",
      isOwnScope: true,
    })).toBe(false);
  });
});

describe("dose helpers", () => {
  it("formats swig sizes", () => {
    expect(formatDoseLabel("big", "swig")).toBe("big swig");
    expect(formatDoseLabel("small", "swig")).toBe("small swig");
    expect(formatDoseLabel("10", "mg")).toBe("10 mg");
  });

  it("maps swig sizes to chart amounts", () => {
    expect(doseAmountForChart("small", "swig")).toBe(1);
    expect(doseAmountForChart("big", "swig")).toBe(2);
    expect(doseAmountForChart("12.5", "mg")).toBe(12.5);
  });
});

describe("filtering and totals", () => {
  it("filters by selected substances", () => {
    expect(filterLogsBySubstances(sample, ["Oramorph"]).map((l) => l.id)).toEqual(["1", "2", "4"]);
  });

  it("filters by period", () => {
    const now = new Date("2026-03-12T12:00:00");
    const recent = filterLogsByPeriod(sample, "7d", now);
    expect(recent.map((l) => l.id)).toEqual(["1", "2", "3", "4"]);
  });

  it("computes overall totals per substance and unit", () => {
    const totals = computeSubstanceTotals(sample.filter((l) => l.name === "Oramorph"));
    expect(totals).toHaveLength(2);
    const mg = totals.find((t) => t.unit === "mg")!;
    expect(mg.doseCount).toBe(2);
    expect(mg.totalAmount).toBe(15);
    expect(formatTotalAmount(mg)).toBe("15 mg");
    const swig = totals.find((t) => t.unit === "swig")!;
    expect(formatTotalAmount(swig)).toBe("2 swig units");
  });

  it("keeps incompatible units as separate chart series", () => {
    const series = listChartSeries(sample, ["Oramorph", "Codeine"]);
    expect(series.map((s) => s.key)).toEqual([
      chartSeriesKey("Codeine", "mg"),
      chartSeriesKey("Oramorph", "mg"),
      chartSeriesKey("Oramorph", "swig"),
    ]);
    const rows = buildDailyChartRows(sample, series);
    expect(rows[0]).toMatchObject({
      date: "2026-03-10",
      [chartSeriesKey("Oramorph", "mg")]: 15,
      [chartSeriesKey("Oramorph", "swig")]: 0,
      [chartSeriesKey("Codeine", "mg")]: 0,
    });
    expect(rows[1]).toMatchObject({
      date: "2026-03-11",
      [chartSeriesKey("Codeine", "mg")]: 30,
    });
    expect(rows[2]).toMatchObject({
      date: "2026-03-12",
      [chartSeriesKey("Oramorph", "swig")]: 2,
      [chartSeriesKey("Oramorph", "mg")]: 0,
    });
  });

  it("sorts newest first by date then time", () => {
    const sorted = sortLogsNewestFirst(sample.slice(0, 2));
    expect(sorted.map((l) => l.time)).toEqual(["20:00", "08:00"]);
  });

  it("merges default catalog with tracked and logged names", () => {
    const names = mergeSubstanceOptions(["CustomMed"], ["Oramorph"], ["Oramorph", "Codeine"]);
    expect(names).toContain("CustomMed");
    expect(names).toContain("Oramorph");
    expect(names).toContain("Codeine");
  });
});
