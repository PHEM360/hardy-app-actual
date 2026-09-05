import { describe, expect, it } from "vitest";
import { DEFAULT_TAX_INPUTS, computePersonalTax } from "@/lib/personalTax";

describe("personalTax", () => {
  it("smoke: employment + property produces tax and SA boxes", () => {
    const result = computePersonalTax({
      ...DEFAULT_TAX_INPUTS,
      employmentIncomeGbp: 40_000,
      propertyIncomeGbp: 24_000,
      propertyExpensesGbp: 3_000,
      propertyFinanceCostsGbp: 6_000,
    });
    expect(result.totalIncomeGbp).toBeGreaterThan(0);
    expect(result.totalTaxGbp).toBeGreaterThan(0);
    expect(result.saBoxes.length).toBeGreaterThan(0);
    expect(result.financeCostCreditGbp).toBe(1_200);
    expect(result.claimHints.some((h) => h.id === "finance-cost-restriction")).toBe(true);
  });

  it("ltd company models corporation tax on profit", () => {
    const result = computePersonalTax({
      ...DEFAULT_TAX_INPUTS,
      entityType: "ltd_company",
      propertyIncomeGbp: 24_000,
      propertyExpensesGbp: 4_000,
      propertyFinanceCostsGbp: 4_000,
    });
    expect(result.corporationTaxGbp).toBeGreaterThan(0);
    expect(result.bandsUsed[0]).toMatch(/Corporation tax/);
  });
});
