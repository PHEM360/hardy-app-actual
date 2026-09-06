import { describe, expect, it } from "vitest";
import {
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
    expect(result.recommendation === "sell_offer" || result.recommendation === "sell_market").toBe(
      true,
    );
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
    expect(result.recommendation).toBe("rent");
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
});
