import { describe, expect, it, vi } from "vitest";
import { calculateFinancialModel, defaultFinancialModel, fixedTermMonthlyWithdrawal, type FinancialModelInput } from "@/lib/financialModel";

function scenario(): FinancialModelInput {
  return {
    ...defaultFinancialModel(),
    name: "Family gifting",
    years: 10,
    deathYear: 5,
    residenceValueGbp: 300_000,
    people: [
      { id: "mum", name: "Mum", age: 70, annualIncomeGbp: 30_000, annualSpendingGbp: 24_000 },
      { id: "chris", name: "Chris", age: 35, annualIncomeGbp: 50_000, annualSpendingGbp: 30_000 },
    ],
    accounts: [
      { id: "mum_cash", ownerId: "mum", name: "Mum cash", provider: "Bank", kind: "cash", openingBalanceGbp: 300_000, monthlyContributionGbp: 0, monthlyWithdrawalGbp: 0, returns: { cautious: 0, central: 0, optimistic: 0 }, fees: [], includeInEstate: true },
      { id: "chris_lisa", ownerId: "chris", name: "Chris LISA", provider: "Vanguard", kind: "lisa", openingBalanceGbp: 0, monthlyContributionGbp: 0, monthlyWithdrawalGbp: 0, returns: { cautious: 2, central: 5, optimistic: 7 }, fees: [{ id: "fee", effectiveFrom: "2026-01-01", annualPercent: 0.25, annualFlatGbp: 0, source: "manual" }], includeInEstate: true },
    ],
    gifts: [{ id: "gift", fromPersonId: "mum", toPersonId: "chris", fromAccountId: "mum_cash", toAccountId: "chris_lisa", amountGbp: 4_000, month: 1, exemptGbp: 3_000, fromNormalIncome: false, giftWithReservation: false }],
  };
}

describe("comprehensive financial model", () => {
  it("always calculates and exposes all three return cases", () => {
    vi.setSystemTime(new Date("2026-10-04T00:00:00Z"));
    const result = calculateFinancialModel(scenario());
    expect(Object.keys(result.runs)).toEqual(["cautious", "central", "optimistic"]);
    expect(result.runs.optimistic.endingTotalGbp).toBeGreaterThan(result.runs.central.endingTotalGbp);
    expect(result.runs.central.endingTotalGbp).toBeGreaterThan(result.runs.cautious.endingTotalGbp);
  });

  it("moves gifts between people, applies the LISA bonus and tracks fees", () => {
    const result = calculateFinancialModel(scenario()).runs.central;
    expect(result.cumulativeGiftsGbp).toBe(4_000);
    expect(result.points[1].accounts.mum_cash).toBe(302_000);
    expect(result.points[1].accounts.chris_lisa).toBeGreaterThan(5_000);
    expect(result.cumulativeFeesGbp).toBeGreaterThan(0);
  });

  it("preserves a separate do-nothing baseline", () => {
    const result = calculateFinancialModel(scenario());
    expect(result.baselineRuns.central.cumulativeGiftsGbp).toBe(0);
    expect(result.baselineRuns.central.points[1].accounts.mum_cash).toBe(306_000);
  });

  it("calculates an amortising fixed-term monthly payout", () => {
    const payment = fixedTermMonthlyWithdrawal(20_000, 0, 10);
    expect(payment).toBeCloseTo(166.67, 2);
    expect(fixedTermMonthlyWithdrawal(20_000, 5, 10)).toBeGreaterThan(payment);
  });
});
