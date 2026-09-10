import { describe, expect, it } from "vitest";
import {
  buildVerdict,
  defaultInvestmentInputs,
  netSaleProceeds,
  runFlatInvestmentModel,
} from "@/lib/flatInvestmentModel";

describe("flatInvestmentModel", () => {
  it("nets sale proceeds after costs and mortgage", () => {
    // 80k sale, 2.5% + £1.5k costs, no mortgage → 80k - 2k - 1.5k = 76.5k
    expect(netSaleProceeds(80_000, 0, 2.5, 1_500)).toBeCloseTo(76_500, 0);
  });

  it("flags sell-at-offer when rent barely covers heavy costs", () => {
    const result = runFlatInvestmentModel(
      defaultInvestmentInputs({
        marketValueGbp: 90_000,
        offerPriceGbp: 88_000,
        rentMonthlyGbp: 400,
        serviceChargeAnnualGbp: 4_000,
        maintenanceAnnualGbp: 1_000,
        insuranceAnnualGbp: 300,
        lettingFeesPctOfRent: 12,
        voidMonthsPerYear: 1,
        capitalGrowthPctPa: 0,
        alternativeReturnPctPa: 5,
        horizonYears: 5,
        incomeTaxRatePct: 40,
        oneOffs: [{ id: "1", label: "Lease", amountGbp: 5_000, year: 0 }],
      }),
    );
    expect(result.annualGrossRentGbp).toBeCloseTo(400 * 11, 0);
    expect(result.recommendation).toBe("sell_offer");
    expect(result.years).toHaveLength(5);
  });

  it("finds a year when strong rent beats a low offer", () => {
    const result = runFlatInvestmentModel(
      defaultInvestmentInputs({
        marketValueGbp: 90_000,
        offerPriceGbp: 70_000,
        rentMonthlyGbp: 900,
        serviceChargeAnnualGbp: 1_200,
        maintenanceAnnualGbp: 300,
        insuranceAnnualGbp: 200,
        lettingFeesPctOfRent: 8,
        voidMonthsPerYear: 0,
        capitalGrowthPctPa: 2,
        alternativeReturnPctPa: 3,
        horizonYears: 15,
        incomeTaxRatePct: 20,
        sellingCostsPct: 2,
        sellingFixedGbp: 1_000,
      }),
    );
    expect(result.yearsUntilRentBeatsOffer).not.toBeNull();
    expect(result.yearsUntilRentBeatsOffer!).toBeGreaterThan(0);
    expect(result.breakEvenSalePriceGbp).not.toBeNull();
    expect(result.breakEvenSalePriceGbp!).toBeGreaterThan(result.inputs.offerPriceGbp);
    expect(result.differencesAtHorizon.rentMinusOfferGbp).toBeGreaterThan(0);
    // Primary verdict ignores aspirational "sell at market"
    expect(result.recommendation).toBe("rent");
    expect(["sell_offer", "hold_vacant", "rent"]).toContain(result.recommendation);
  });

  it("projects growing property value and cash piles", () => {
    const result = runFlatInvestmentModel(
      defaultInvestmentInputs({
        marketValueGbp: 100_000,
        offerPriceGbp: 100_000,
        rentMonthlyGbp: 800,
        capitalGrowthPctPa: 3,
        horizonYears: 3,
        voidMonthsPerYear: 0,
        serviceChargeAnnualGbp: 0,
        maintenanceAnnualGbp: 0,
        insuranceAnnualGbp: 0,
        lettingFeesPctOfRent: 0,
        sellingCostsPct: 0,
        sellingFixedGbp: 0,
        incomeTaxRatePct: 0,
        alternativeReturnPctPa: 0,
      }),
    );
    expect(result.years[0].propertyValueGbp).toBeCloseTo(103_000, 0);
    expect(result.years[2].propertyValueGbp).toBeCloseTo(100_000 * Math.pow(1.03, 3), 0);
    expect(result.years[0].grossRentGbp).toBeCloseTo(9_600, 0);
  });

  it("labels the sell-at-offer figure as compounded wealth, not the raw offer", () => {
    // Reproduces the reported "verdict shows £116,199 for an £80,000 offer" confusion:
    // that number is real (net offer proceeds compounded for the horizon), just unlabelled.
    const result = runFlatInvestmentModel(
      defaultInvestmentInputs({
        marketValueGbp: 90_000,
        offerPriceGbp: 80_000,
        sellingCostsPct: 0,
        sellingFixedGbp: 1_500,
        alternativeReturnPctPa: 4,
        horizonYears: 10,
      }),
    );
    expect(result.wealthAtHorizon.sell_offer).toBeCloseTo(78_500 * Math.pow(1.04, 10), 0);
    expect(result.recommendationDetail).toContain("£80,000");
    expect(result.recommendationDetail).toContain("4%/yr");
    expect(result.recommendationDetail).toContain("10 years");
  });

  it("buildVerdict at an earlier year answers 'what if I only look N years out'", () => {
    const inputs = defaultInvestmentInputs({
      marketValueGbp: 100_000,
      offerPriceGbp: 90_000,
      rentMonthlyGbp: 900,
      capitalGrowthPctPa: 2,
      alternativeReturnPctPa: 3,
      horizonYears: 10,
    });
    const result = runFlatInvestmentModel(inputs);
    const twoYearVerdict = buildVerdict(result.years[1], 2, result.inputs);
    const horizonVerdict = buildVerdict(result.years[result.years.length - 1], 10, result.inputs);
    expect(twoYearVerdict.wealthAtHorizon.rent).toBeCloseTo(result.years[1].rentWealthGbp, 0);
    expect(twoYearVerdict.wealthAtHorizon.rent).not.toBeCloseTo(horizonVerdict.wealthAtHorizon.rent, 0);
    expect(twoYearVerdict.recommendationDetail).toMatch(/2 years/);
  });

  it("charges council tax only for the void months while let, but the full year while vacant", () => {
    const letResult = runFlatInvestmentModel(
      defaultInvestmentInputs({
        rentMonthlyGbp: 800,
        voidMonthsPerYear: 3,
        councilTaxAnnualGbp: 1_200,
        costGrowthPctPa: 0,
        serviceChargeAnnualGbp: 0,
        maintenanceAnnualGbp: 0,
        insuranceAnnualGbp: 0,
        lettingFeesPctOfRent: 0,
        horizonYears: 1,
      }),
    );
    // 3 void months of a £1,200/yr bill = £300, the rest of the year is the tenant's liability.
    expect(letResult.annualOperatingCostsYear0Gbp).toBeCloseTo(300, 0);

    const noCouncilTax = runFlatInvestmentModel(
      defaultInvestmentInputs({
        rentMonthlyGbp: 800,
        voidMonthsPerYear: 3,
        councilTaxAnnualGbp: 0,
        costGrowthPctPa: 0,
        serviceChargeAnnualGbp: 0,
        maintenanceAnnualGbp: 0,
        insuranceAnnualGbp: 0,
        lettingFeesPctOfRent: 0,
        horizonYears: 1,
      }),
    );
    expect(noCouncilTax.annualOperatingCostsYear0Gbp).toBeCloseTo(0, 0);

    // Held vacant all year, the landlord is liable for the whole bill.
    const vacantResult = runFlatInvestmentModel(
      defaultInvestmentInputs({
        councilTaxAnnualGbp: 1_200,
        costGrowthPctPa: 0,
        serviceChargeAnnualGbp: 0,
        maintenanceAnnualGbp: 0,
        insuranceAnnualGbp: 0,
        horizonYears: 1,
      }),
    );
    expect(vacantResult.wealthAtHorizon.hold_vacant).toBeLessThan(vacantResult.inputs.marketValueGbp);
    const noCostVacant = runFlatInvestmentModel(
      defaultInvestmentInputs({
        councilTaxAnnualGbp: 0,
        costGrowthPctPa: 0,
        serviceChargeAnnualGbp: 0,
        maintenanceAnnualGbp: 0,
        insuranceAnnualGbp: 0,
        horizonYears: 1,
      }),
    );
    expect(vacantResult.wealthAtHorizon.hold_vacant).toBeCloseTo(noCostVacant.wealthAtHorizon.hold_vacant - 1_200, 0);
  });
});
