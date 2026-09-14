import { describe, expect, it } from "vitest";
import {
  UK_PENSION_RULES,
  annualAllowanceFor,
  comparePensionScenarios,
  defaultPensionScenario,
  monthlyGrossFromPersonal,
  projectPension,
  taxFreeLumpSumGbp,
} from "@/lib/pensionModel";

function scenario(patch: Partial<ReturnType<typeof defaultPensionScenario>> = {}) {
  return {
    ...defaultPensionScenario("a", "Keep", "Now"),
    currentPotGbp: 100_000,
    paidInGbp: 70_000,
    years: 10,
    annualGrowthPct: 5,
    annualFeePct: 0,
    monthlyPersonalGbp: 0,
    monthlyEmployerGbp: 0,
    takeTaxFreeLumpSum: true,
    includeStatePension: false,
    remainingLsaGbp: UK_PENSION_RULES.lumpSumAllowanceGbp,
    ...patch,
  };
}

describe("UK pension modeller", () => {
  it("grosses up relief-at-source contributions at 20%", () => {
    expect(monthlyGrossFromPersonal(80, "relief_at_source")).toEqual({ personal: 80, relief: 20 });
    expect(monthlyGrossFromPersonal(100, "net_pay")).toEqual({ personal: 100, relief: 0 });
  });

  it("tapers the annual allowance and applies MPAA after flexible access", () => {
    expect(annualAllowanceFor({ flexiblyAccessed: false, thresholdIncomeGbp: 180_000, adjustedIncomeGbp: 400_000 })).toBe(60_000);
    expect(annualAllowanceFor({ flexiblyAccessed: false, thresholdIncomeGbp: 250_000, adjustedIncomeGbp: 360_000 })).toBe(10_000);
    expect(annualAllowanceFor({ flexiblyAccessed: false, thresholdIncomeGbp: 250_000, adjustedIncomeGbp: 280_000 })).toBe(50_000);
    expect(annualAllowanceFor({ flexiblyAccessed: true, thresholdIncomeGbp: 50_000, adjustedIncomeGbp: 50_000 })).toBe(10_000);
  });

  it("caps tax-free cash at the remaining lump sum allowance", () => {
    expect(taxFreeLumpSumGbp(80_000, UK_PENSION_RULES.lumpSumAllowanceGbp, true)).toBe(20_000);
    expect(taxFreeLumpSumGbp(2_000_000, UK_PENSION_RULES.lumpSumAllowanceGbp, true)).toBe(UK_PENSION_RULES.lumpSumAllowanceGbp);
    expect(taxFreeLumpSumGbp(80_000, UK_PENSION_RULES.lumpSumAllowanceGbp, false)).toBe(0);
  });

  it("projects growth then fees and a 4% drawdown after the tax-free lump sum", () => {
    const result = projectPension(scenario({ annualGrowthPct: 5, years: 1, drawdownRatePct: 4 }));
    const expectedPot = 100_000 * Math.pow(1.05, 1);
    expect(result.potAtHorizonGbp).toBeCloseTo(expectedPot, 4);
    expect(result.taxFreeLumpSumGbp).toBeCloseTo(expectedPot * 0.25, 4);
    expect(result.monthlyDrawdownGbp).toBeCloseTo((expectedPot * 0.75 * 0.04) / 12, 4);
    expect(result.growthToDateGbp).toBe(30_000);
  });

  it("compares a transfer with higher growth and lower fees", () => {
    const keep = scenario({ id: "a", annualGrowthPct: 4, annualFeePct: 0.75, years: 15 });
    const move = scenario({ id: "b", name: "Transfer", provider: "New", annualGrowthPct: 6, annualFeePct: 0.2, years: 15 });
    const compared = comparePensionScenarios(keep, move);
    expect(compared.potDeltaGbp).toBeGreaterThan(0);
    expect(compared.monthlyDeltaGbp).toBeGreaterThan(0);
    expect(compared.b.potAtHorizonGbp).toBeGreaterThan(compared.a.potAtHorizonGbp);
  });

  it("applies a transfer-out fee at the start of the projection", () => {
    const plain = projectPension(scenario({ years: 1, annualGrowthPct: 0, annualFeePct: 0 }));
    const charged = projectPension(scenario({ years: 1, annualGrowthPct: 0, annualFeePct: 0, transferOutFeePct: 1, transferOutFeeGbp: 50 }));
    expect(plain.potAtHorizonGbp - charged.potAtHorizonGbp).toBeCloseTo(1_050, 4);
  });
});
