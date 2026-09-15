import { describe, expect, it } from "vitest";
import {
  financeAssetFromDoc,
  propertyNetIncome,
  propertyYieldPct,
  totalPropertyValue,
} from "@/lib/financeAssets";

describe("finance property assets", () => {
  it("skips yield when there is no rent", () => {
    const home = { rentMonthly: 0, expensesMonthly: 120, value: 400_000 };
    expect(propertyNetIncome(home)).toBeNull();
    expect(propertyYieldPct(home)).toBeNull();
  });

  it("nets rent against expenses and yields against the latest value", () => {
    const letProperty = { rentMonthly: 1_800, expensesMonthly: 300, value: 360_000 };
    expect(propertyNetIncome(letProperty)).toEqual({ monthly: 1_500, annual: 18_000 });
    expect(propertyYieldPct(letProperty)).toBeCloseTo(5, 5);
  });

  it("sums property values for net worth", () => {
    const assets = [
      financeAssetFromDoc("a", { name: "Home", value: 450_000, primaryResidence: true }),
      financeAssetFromDoc("b", { name: "Flat", value: 180_000, rentMonthly: 950 }),
    ];
    expect(totalPropertyValue(assets)).toBe(630_000);
  });
});
