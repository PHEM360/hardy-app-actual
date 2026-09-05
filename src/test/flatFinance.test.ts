import { describe, expect, it } from "vitest";
import { computeFlatReturns, fmtPct } from "@/lib/flatFinance";
import type { FlatRecord } from "@/types/flats";

function sampleFlat(overrides: Partial<FlatRecord> = {}): FlatRecord {
  return {
    id: "tattersalls",
    name: "Tattersalls",
    slug: "tattersalls",
    address: "",
    propertyValueGbp: 300_000,
    mortgageBalanceGbp: 0,
    mortgageRatePct: 0,
    ownership: "personal",
    tenant: {
      name: "Tenant",
      rentMonthlyGbp: 2_000,
      depositGbp: null,
    },
    tax: {
      ownership: "personal",
      usePropertyAllowance: false,
      financeCostRestrictionPct: 100,
    },
    bankLinks: [],
    expenseCategories: [],
    incomeCategories: [],
    documentCategories: [],
    balanceHistory: [],
    ledger: [],
    ...overrides,
  };
}

describe("flatFinance", () => {
  it("rent 2k/mo on £300k value yields ~8% gross", () => {
    const summary = computeFlatReturns(sampleFlat());
    expect(summary.annualRentGbp).toBe(24_000);
    expect(summary.grossYieldPct).not.toBeNull();
    expect(summary.grossYieldPct!).toBeCloseTo(8, 1);
    expect(fmtPct(summary.grossYieldPct)).toBe("8.00%");
  });
});
