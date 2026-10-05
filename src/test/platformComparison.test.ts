import { describe, expect, it } from "vitest";
import {
  annualCosts,
  annualPlatformFee,
  applyPreset,
  blankFields,
  comparePlatforms,
  defaultPlatformComparison,
  mergePlatformComparison,
  missingRequiredFields,
  newPlatformEntry,
  platformPreset,
  projectPlatformEntry,
  suggestedPlanId,
} from "@/lib/platformComparison";

describe("platform fee rules", () => {
  it("charges Vanguard's flat £4 a month under £32,000 and 0.15% capped at £375 above it", () => {
    const entry = newPlatformEntry("stocks_isa", "vanguard", "Vanguard", "self");
    expect(annualPlatformFee(entry, 10000)).toBe(48);
    expect(annualPlatformFee(entry, 31999)).toBe(48);
    expect(annualPlatformFee(entry, 32000)).toBeCloseTo(48, 5); // 0.15% of 32,000
    expect(annualPlatformFee(entry, 100000)).toBeCloseTo(150, 5);
    expect(annualPlatformFee(entry, 250000)).toBeCloseTo(375, 5);
    expect(annualPlatformFee(entry, 1000000)).toBe(375);
  });

  it("charges Vanguard managed 0.15% at any balance plus the 0.20% management fee", () => {
    const entry = newPlatformEntry("stocks_isa", "vanguard", "Vanguard", "managed");
    expect(annualPlatformFee(entry, 10000)).toBeCloseTo(15, 5);
    const costs = annualCosts(entry, 10000);
    expect(costs.advice).toBeCloseTo(20, 5);
    expect(costs.funds).toBeCloseTo(17, 5);
  });

  it("charges interactive investor a flat monthly fee whatever the balance", () => {
    const core = newPlatformEntry("stocks_isa", "interactive_investor", "interactive investor", "core");
    expect(annualPlatformFee(core, 5000)).toBeCloseTo(71.88, 2);
    expect(annualPlatformFee(core, 90000)).toBeCloseTo(71.88, 2);
    const plus = newPlatformEntry("pension", "interactive_investor", "interactive investor", "plus");
    expect(annualPlatformFee(plus, 500000)).toBeCloseTo(179.88, 2);
    const premium = newPlatformEntry("gia", "interactive_investor", "interactive investor", "premium");
    expect(premium.values.tradeFee).toBe(2.99);
    expect(annualPlatformFee(premium, 500000)).toBeCloseTo(479.88, 2);
  });

  it("moves interactive investor pots over £100,000 off Core", () => {
    expect(suggestedPlanId("interactive_investor", 100000)).toBe("core");
    expect(suggestedPlanId("interactive_investor", 100001)).toBe("plus");
    expect(platformPreset("interactive_investor", "stocks_isa", "core")?.rules.join(" ")).toContain("£100,000");
  });

  it("charges True Potential 0.40% with no cap, plus typical portfolio costs", () => {
    const entry = newPlatformEntry("stocks_isa", "true_potential", "True Potential");
    expect(annualPlatformFee(entry, 50000)).toBeCloseTo(200, 5);
    expect(annualPlatformFee(entry, 1000000)).toBeCloseTo(4000, 5);
    expect(annualCosts(entry, 50000).funds).toBeCloseTo(380, 5);
  });

  it("adds trading costs from trades per year", () => {
    const entry = newPlatformEntry("stocks_isa", "interactive_investor", "interactive investor", "core");
    entry.values.tradesPerYear = 10;
    expect(annualCosts(entry, 20000).trading).toBeCloseTo(39.9, 5);
  });

  it("has no hard coded rules for cash accounts or unknown providers", () => {
    expect(platformPreset("vanguard", "cash_isa", "")).toBeNull();
    expect(platformPreset("other", "stocks_isa", "")).toBeNull();
    const cash = newPlatformEntry("cash_isa", "other", "Some Bank");
    expect(cash.values).toEqual({});
    expect(missingRequiredFields(cash).map((f) => f.key)).toEqual(["interestRatePercent"]);
  });
});

describe("presets and sources", () => {
  it("keeps the user's own figures when the plan changes", () => {
    let entry = newPlatformEntry("stocks_isa", "interactive_investor", "interactive investor", "core");
    entry = { ...entry, values: { ...entry.values, fundFeePercent: 0.3, fixedMonthly: 4.5 }, sources: { ...entry.sources, fundFeePercent: "user", fixedMonthly: "user" } };
    const next = applyPreset({ ...entry, planId: "premium" });
    expect(next.values.fundFeePercent).toBe(0.3);
    expect(next.values.fixedMonthly).toBe(4.5); // the user's own figure wins
    expect(next.values.tradeFee).toBe(2.99); // preset figure follows the plan
  });

  it("lists what is still blank, leaving out trades per year", () => {
    const entry = newPlatformEntry("stocks_isa", "interactive_investor", "interactive investor", "core");
    const keys = blankFields(entry).map((f) => f.key);
    expect(keys).toContain("fundFeePercent");
    expect(keys).toContain("annualReturnPercent");
    expect(keys).not.toContain("tradesPerYear");
    // Published rules are built in, so an empty cap is not a gap to chase.
    expect(keys).toEqual(["fundFeePercent", "annualReturnPercent"]);
    // An unknown provider's whole fee structure is fair game.
    expect(blankFields(newPlatformEntry("stocks_isa", "other", "Someone")).map((f) => f.key)).toContain("platformFeeCapAnnual");
    // A cash account only needs its rate.
    expect(blankFields(newPlatformEntry("cash_isa", "other", "Bank")).map((f) => f.key)).toEqual(["interestRatePercent"]);
    expect(missingRequiredFields(entry).map((f) => f.key)).toEqual(["fundFeePercent"]);
  });
});

describe("projection", () => {
  it("grows a cash account by its interest rate", () => {
    const doc = { ...defaultPlatformComparison(), sharedBalance: 10000, sharedMonthly: 0, years: 1 };
    const entry = newPlatformEntry("cash_isa", "other", "Some Bank");
    entry.values.interestRatePercent = 4;
    const result = projectPlatformEntry(entry, doc);
    expect(result.finalValue).toBe(10400);
    expect(result.totalFees).toBe(0);
    expect(result.ratePercent).toBe(4);
  });

  it("uses the shared growth figure when an investment has no return of its own", () => {
    const doc = { ...defaultPlatformComparison(), sharedBalance: 10000, years: 1, assumedReturnPercent: 5 };
    const entry = newPlatformEntry("stocks_isa", "true_potential", "True Potential");
    const result = projectPlatformEntry(entry, doc);
    expect(result.usedAssumedReturn).toBe(true);
    expect(result.ratePercent).toBe(5);
    // 5% growth less roughly 1.16% of charges.
    expect(result.finalValue).toBeGreaterThan(10370);
    expect(result.finalValue).toBeLessThan(10390);
    expect(result.firstYearPercent).toBe(1.16);
    expect(result.lostToFees).toBeGreaterThan(110);

    entry.values.annualReturnPercent = 8;
    expect(projectPlatformEntry(entry, doc).usedAssumedReturn).toBe(false);
    expect(projectPlatformEntry(entry, doc).ratePercent).toBe(8);
  });

  it("ranks by final value and puts accounts with gaps last", () => {
    const doc = { ...defaultPlatformComparison(), sharedBalance: 200000, years: 10 };
    const vanguard = newPlatformEntry("stocks_isa", "vanguard", "Vanguard", "self");
    vanguard.values.fundFeePercent = 0.22;
    const tp = newPlatformEntry("stocks_isa", "true_potential", "True Potential");
    const ii = newPlatformEntry("stocks_isa", "interactive_investor", "interactive investor", "plus"); // fund costs blank
    doc.entries = [ii, tp, vanguard];
    const results = comparePlatforms(doc);
    expect(results.map((r) => r.entryId)).toEqual([vanguard.id, tp.id, ii.id]);
    expect(results[2].missing.map((f) => f.key)).toEqual(["fundFeePercent"]);
  });

  it("uses each account's own pot when not comparing on a shared pot", () => {
    const doc = { ...defaultPlatformComparison(), useSharedPot: false, years: 1 };
    const entry = newPlatformEntry("cash_savings", "other", "Bank");
    entry.balance = 5000;
    entry.values.interestRatePercent = 0;
    entry.values.fixedMonthly = 2;
    const result = projectPlatformEntry(entry, doc);
    expect(result.balance).toBe(5000);
    expect(result.finalValue).toBe(5000 - 24);
  });
});

describe("loading saved data", () => {
  it("drops malformed entries and unknown fields", () => {
    const merged = mergePlatformComparison({
      years: 99,
      entries: [
        { accountType: "bogus", providerName: "x" },
        { accountType: "cash_isa", providerName: "Bank", values: { interestRatePercent: "4.1", nonsense: 3, fundFeePercent: null }, sources: { interestRatePercent: "ai" } },
      ],
    });
    expect(merged.years).toBe(40);
    expect(merged.entries).toHaveLength(1);
    expect(merged.entries[0].values).toEqual({ interestRatePercent: 4.1 });
    expect(merged.entries[0].sources).toEqual({ interestRatePercent: "ai" });
    expect(mergePlatformComparison(undefined)).toEqual(defaultPlatformComparison());
  });
});
