/** Pure investment decision model for to-let flats: sell vs hold-vacant vs rent. */

import type { FlatInvestmentInputs, FlatInvestmentOneOff } from "@/types/flats";

export type { FlatInvestmentInputs, FlatInvestmentOneOff };

export type FlatInvestmentStrategy = "sell_offer" | "sell_market" | "hold_vacant" | "rent";

export interface FlatInvestmentYearRow {
  year: number;
  propertyValueGbp: number;
  grossRentGbp: number;
  operatingCostsGbp: number;
  oneOffsGbp: number;
  taxableProfitGbp: number;
  taxGbp: number;
  netRentCashGbp: number;
  /** Cash pile if sold at start (offer), grown at alternative return. */
  sellOfferWealthGbp: number;
  /** Cash pile if sold at start (market), grown at alternative return. */
  sellMarketWealthGbp: number;
  /** Net equity if hold vacant then sell at year-end (after costs + mortgage). */
  holdVacantWealthGbp: number;
  /** Net equity + invested rent cash if rent then sell at year-end. */
  rentWealthGbp: number;
  /** rentWealth − sellOfferWealth */
  rentVsOfferGbp: number;
}

export interface FlatInvestmentResult {
  inputs: FlatInvestmentInputs;
  netOfferProceedsGbp: number;
  netMarketProceedsGbp: number;
  annualGrossRentGbp: number;
  annualOperatingCostsYear0Gbp: number;
  annualNetRentBeforeTaxYear0Gbp: number;
  annualTaxYear0Gbp: number;
  annualNetRentAfterTaxYear0Gbp: number;
  years: FlatInvestmentYearRow[];
  /** Best strategy at the chosen horizon (highest wealth). */
  recommendation: FlatInvestmentStrategy;
  recommendationLabel: string;
  recommendationDetail: string;
  /** Sale price today that matches renting-to-horizon (same terminal wealth). */
  breakEvenSalePriceGbp: number | null;
  /** First year where renting beats selling at the offer (1-based), or null. */
  yearsUntilRentBeatsOffer: number | null;
  /** Monthly rent needed for renting to beat selling at offer by horizon. */
  breakEvenMonthlyRentGbp: number | null;
  wealthAtHorizon: Record<FlatInvestmentStrategy, number>;
  differencesAtHorizon: {
    rentMinusOfferGbp: number;
    rentMinusMarketGbp: number;
    rentMinusVacantGbp: number;
  };
}

export const STRATEGY_LABELS: Record<FlatInvestmentStrategy, string> = {
  sell_offer: "Sell at offer",
  sell_market: "Sell at market",
  hold_vacant: "Hold vacant",
  rent: "Rent out",
};

const BASIC_RATE = 0.2;

export function defaultInvestmentInputs(partial?: Partial<FlatInvestmentInputs>): FlatInvestmentInputs {
  const base: FlatInvestmentInputs = {
    marketValueGbp: 90_000,
    offerPriceGbp: 80_000,
    mortgageBalanceGbp: 0,
    rentMonthlyGbp: 750,
    voidMonthsPerYear: 0.5,
    serviceChargeAnnualGbp: 2_400,
    maintenanceAnnualGbp: 600,
    insuranceAnnualGbp: 250,
    groundRentAnnualGbp: 0,
    lettingFeesPctOfRent: 10,
    otherAnnualCostsGbp: 0,
    mortgageInterestAnnualGbp: 0,
    oneOffs: [],
    sellingCostsPct: 2.5,
    sellingFixedGbp: 1_500,
    capitalGrowthPctPa: 2,
    rentGrowthPctPa: 2,
    costGrowthPctPa: 2.5,
    alternativeReturnPctPa: 4,
    incomeTaxRatePct: 40,
    financeCostReliefPct: 100,
    horizonYears: 10,
  };
  if (!partial) return base;
  return {
    ...base,
    ...partial,
    oneOffs: partial.oneOffs ? [...partial.oneOffs] : base.oneOffs,
  };
}

export function netSaleProceeds(
  salePriceGbp: number,
  mortgageBalanceGbp: number,
  sellingCostsPct: number,
  sellingFixedGbp: number,
): number {
  const costs = (salePriceGbp * Math.max(0, sellingCostsPct)) / 100 + Math.max(0, sellingFixedGbp);
  return salePriceGbp - costs - Math.max(0, mortgageBalanceGbp);
}

function grow(amount: number, ratePct: number, years: number): number {
  return amount * Math.pow(1 + ratePct / 100, years);
}

function oneOffsInYear(oneOffs: FlatInvestmentOneOff[], yearIndex: number): number {
  return oneOffs
    .filter((o) => Math.round(Number(o.year) || 0) === yearIndex)
    .reduce((s, o) => s + Math.max(0, Number(o.amountGbp) || 0), 0);
}

function yearGrossRent(inputs: FlatInvestmentInputs, yearIndex: number): number {
  const occupiedMonths = Math.max(0, 12 - Math.max(0, inputs.voidMonthsPerYear));
  const base = Math.max(0, inputs.rentMonthlyGbp) * occupiedMonths;
  return base * Math.pow(1 + inputs.rentGrowthPctPa / 100, yearIndex);
}

function yearOperatingCosts(inputs: FlatInvestmentInputs, yearIndex: number, grossRent: number): number {
  const costFactor = Math.pow(1 + inputs.costGrowthPctPa / 100, yearIndex);
  const fixed =
    (Math.max(0, inputs.serviceChargeAnnualGbp) +
      Math.max(0, inputs.maintenanceAnnualGbp) +
      Math.max(0, inputs.insuranceAnnualGbp) +
      Math.max(0, inputs.groundRentAnnualGbp) +
      Math.max(0, inputs.otherAnnualCostsGbp) +
      Math.max(0, inputs.mortgageInterestAnnualGbp)) *
    costFactor;
  const lettingFees = (grossRent * Math.max(0, inputs.lettingFeesPctOfRent)) / 100;
  return fixed + lettingFees;
}

function vacantOperatingCosts(inputs: FlatInvestmentInputs, yearIndex: number): number {
  const costFactor = Math.pow(1 + inputs.costGrowthPctPa / 100, yearIndex);
  return (
    (Math.max(0, inputs.serviceChargeAnnualGbp) +
      Math.max(0, inputs.maintenanceAnnualGbp) +
      Math.max(0, inputs.insuranceAnnualGbp) +
      Math.max(0, inputs.groundRentAnnualGbp) +
      Math.max(0, inputs.otherAnnualCostsGbp) +
      Math.max(0, inputs.mortgageInterestAnnualGbp)) *
    costFactor
  );
}

function estimateTax(
  inputs: FlatInvestmentInputs,
  grossRent: number,
  operatingCosts: number,
): { taxableProfitGbp: number; taxGbp: number } {
  const finance = Math.max(0, inputs.mortgageInterestAnnualGbp);
  const nonFinance = Math.max(0, operatingCosts - finance);
  const taxableProfitGbp = Math.max(0, grossRent - nonFinance);
  const marginal = Math.max(0, inputs.incomeTaxRatePct) / 100;
  const relief = finance * (Math.max(0, inputs.financeCostReliefPct) / 100) * BASIC_RATE;
  const taxGbp = Math.max(0, taxableProfitGbp * marginal - relief);
  return { taxableProfitGbp, taxGbp };
}

function propertyValueAt(inputs: FlatInvestmentInputs, yearIndex: number): number {
  return grow(Math.max(0, inputs.marketValueGbp), inputs.capitalGrowthPctPa, yearIndex);
}

function wealthIfSoldAtStart(netProceeds: number, altRate: number, yearsHeld: number): number {
  return grow(Math.max(0, netProceeds), altRate, yearsHeld);
}

function terminalPropertyEquity(inputs: FlatInvestmentInputs, year: number): number {
  const value = propertyValueAt(inputs, year);
  return netSaleProceeds(
    value,
    inputs.mortgageBalanceGbp,
    inputs.sellingCostsPct,
    inputs.sellingFixedGbp,
  );
}

function projectYears(inputs: FlatInvestmentInputs): FlatInvestmentYearRow[] {
  const horizon = Math.max(1, Math.min(40, Math.round(inputs.horizonYears) || 10));
  const years: FlatInvestmentYearRow[] = [];
  let rentCashInvested = 0;
  let vacantCashInvested = 0;
  const netOffer = netSaleProceeds(
    inputs.offerPriceGbp,
    inputs.mortgageBalanceGbp,
    inputs.sellingCostsPct,
    inputs.sellingFixedGbp,
  );
  const netMarket = netSaleProceeds(
    inputs.marketValueGbp,
    inputs.mortgageBalanceGbp,
    inputs.sellingCostsPct,
    inputs.sellingFixedGbp,
  );

  for (let y = 1; y <= horizon; y++) {
    const yearIndex = y - 1;
    const grossRentGbp = yearGrossRent(inputs, yearIndex);
    const operatingCostsGbp = yearOperatingCosts(inputs, yearIndex, grossRentGbp);
    const oneOffsGbp = oneOffsInYear(inputs.oneOffs, yearIndex);
    const { taxableProfitGbp, taxGbp } = estimateTax(inputs, grossRentGbp, operatingCostsGbp);
    const netRentCashGbp = grossRentGbp - operatingCostsGbp - oneOffsGbp - taxGbp;

    rentCashInvested = grow(rentCashInvested, inputs.alternativeReturnPctPa, 1) + netRentCashGbp;
    const vacantCash = -vacantOperatingCosts(inputs, yearIndex) - oneOffsGbp;
    vacantCashInvested = grow(vacantCashInvested, inputs.alternativeReturnPctPa, 1) + vacantCash;

    const equity = terminalPropertyEquity(inputs, y);
    const sellOfferWealthGbp = wealthIfSoldAtStart(netOffer, inputs.alternativeReturnPctPa, y);
    const sellMarketWealthGbp = wealthIfSoldAtStart(netMarket, inputs.alternativeReturnPctPa, y);
    const holdVacantWealthGbp = equity + vacantCashInvested;
    const rentWealthGbp = equity + rentCashInvested;

    years.push({
      year: y,
      propertyValueGbp: propertyValueAt(inputs, y),
      grossRentGbp,
      operatingCostsGbp,
      oneOffsGbp,
      taxableProfitGbp,
      taxGbp,
      netRentCashGbp,
      sellOfferWealthGbp,
      sellMarketWealthGbp,
      holdVacantWealthGbp,
      rentWealthGbp,
      rentVsOfferGbp: rentWealthGbp - sellOfferWealthGbp,
    });
  }

  return years;
}

function fmtDelta(n: number): string {
  const abs = Math.abs(n);
  const formatted = `£${abs.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
  return n >= 0 ? formatted : `${formatted} less`;
}

export function runFlatInvestmentModel(inputs: FlatInvestmentInputs): FlatInvestmentResult {
  const horizon = Math.max(1, Math.min(40, Math.round(inputs.horizonYears) || 10));
  const normalised: FlatInvestmentInputs = {
    ...defaultInvestmentInputs(inputs),
    ...inputs,
    horizonYears: horizon,
    oneOffs: inputs.oneOffs || [],
  };

  const netOfferProceedsGbp = netSaleProceeds(
    normalised.offerPriceGbp,
    normalised.mortgageBalanceGbp,
    normalised.sellingCostsPct,
    normalised.sellingFixedGbp,
  );
  const netMarketProceedsGbp = netSaleProceeds(
    normalised.marketValueGbp,
    normalised.mortgageBalanceGbp,
    normalised.sellingCostsPct,
    normalised.sellingFixedGbp,
  );

  const annualGrossRentGbp = yearGrossRent(normalised, 0);
  const annualOperatingCostsYear0Gbp = yearOperatingCosts(normalised, 0, annualGrossRentGbp);
  const tax0 = estimateTax(normalised, annualGrossRentGbp, annualOperatingCostsYear0Gbp);
  const annualNetRentBeforeTaxYear0Gbp =
    annualGrossRentGbp - annualOperatingCostsYear0Gbp - oneOffsInYear(normalised.oneOffs, 0);
  const annualNetRentAfterTaxYear0Gbp = annualNetRentBeforeTaxYear0Gbp - tax0.taxGbp;

  const years = projectYears(normalised);
  const last = years[years.length - 1];

  const wealthAtHorizon: Record<FlatInvestmentStrategy, number> = {
    sell_offer: last.sellOfferWealthGbp,
    sell_market: last.sellMarketWealthGbp,
    hold_vacant: last.holdVacantWealthGbp,
    rent: last.rentWealthGbp,
  };

  const actionable: FlatInvestmentStrategy[] = ["sell_offer", "hold_vacant", "rent"];
  let recommendation: FlatInvestmentStrategy = "sell_offer";
  let best = -Infinity;
  for (const k of actionable) {
    if (wealthAtHorizon[k] > best) {
      best = wealthAtHorizon[k];
      recommendation = k;
    }
  }

  const yearsUntilRentBeatsOffer = years.find((row) => row.rentVsOfferGbp > 0)?.year ?? null;

  const targetRentWealth = last.rentWealthGbp;
  const requiredNet =
    targetRentWealth / Math.pow(1 + normalised.alternativeReturnPctPa / 100, horizon);
  const costFactor = 1 - Math.max(0, normalised.sellingCostsPct) / 100;
  let breakEvenSalePriceGbp: number | null = null;
  if (costFactor > 0) {
    breakEvenSalePriceGbp =
      (requiredNet +
        Math.max(0, normalised.sellingFixedGbp) +
        Math.max(0, normalised.mortgageBalanceGbp)) /
      costFactor;
  }

  const offerTarget = last.sellOfferWealthGbp;
  let lo = 0;
  let hi = Math.max(normalised.rentMonthlyGbp * 4, 5_000);
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    const trialYears = projectYears({ ...normalised, rentMonthlyGbp: mid });
    const w = trialYears[trialYears.length - 1].rentWealthGbp;
    if (w < offerTarget) lo = mid;
    else hi = mid;
  }
  const breakEvenMonthlyRentGbp = (lo + hi) / 2;

  const gaps = {
    rentMinusOfferGbp: last.rentWealthGbp - last.sellOfferWealthGbp,
    rentMinusMarketGbp: last.rentWealthGbp - last.sellMarketWealthGbp,
    rentMinusVacantGbp: last.rentWealthGbp - last.holdVacantWealthGbp,
  };

  const marketBeatsRent = last.sellMarketWealthGbp > last.rentWealthGbp;
  let recommendationDetail = "";
  if (recommendation === "rent") {
    recommendationDetail = `At ${horizon} years, renting leaves you ${fmtDelta(gaps.rentMinusOfferGbp)} ahead of taking the current offer (after selling costs, tax, growth and alternative returns on cash).`;
    if (marketBeatsRent) {
      recommendationDetail += ` Achieving full market value on a sale would still edge renting by ${fmtDelta(last.sellMarketWealthGbp - last.rentWealthGbp)} — only count that if the price is realistic.`;
    }
  } else if (recommendation === "sell_offer") {
    recommendationDetail = `At ${horizon} years, taking the offer and investing the proceeds beats renting by ${fmtDelta(-gaps.rentMinusOfferGbp)}.`;
  } else {
    recommendationDetail =
      "Holding vacant is rarely optimal; costs without rent drag on wealth versus selling or letting.";
  }

  return {
    inputs: normalised,
    netOfferProceedsGbp,
    netMarketProceedsGbp,
    annualGrossRentGbp,
    annualOperatingCostsYear0Gbp,
    annualNetRentBeforeTaxYear0Gbp,
    annualTaxYear0Gbp: tax0.taxGbp,
    annualNetRentAfterTaxYear0Gbp,
    years,
    recommendation,
    recommendationLabel: STRATEGY_LABELS[recommendation],
    recommendationDetail,
    breakEvenSalePriceGbp,
    yearsUntilRentBeatsOffer,
    breakEvenMonthlyRentGbp,
    wealthAtHorizon,
    differencesAtHorizon: gaps,
  };
}

export function inputsFromFlatDefaults(flat: {
  propertyValueGbp?: number | null;
  mortgageBalanceGbp?: number | null;
  mortgageRatePct?: number | null;
  tenant?: { rentMonthlyGbp?: number | null };
  investmentModel?: Partial<FlatInvestmentInputs> | null;
}): Partial<FlatInvestmentInputs> {
  if (flat.investmentModel && Object.keys(flat.investmentModel).length > 0) {
    return flat.investmentModel;
  }
  const value = Number(flat.propertyValueGbp) || 0;
  const mortgage = Number(flat.mortgageBalanceGbp) || 0;
  const rate = Number(flat.mortgageRatePct) || 0;
  const rent = Number(flat.tenant?.rentMonthlyGbp) || 0;
  const out: Partial<FlatInvestmentInputs> = {};
  if (value > 0) {
    out.marketValueGbp = value;
    out.offerPriceGbp = Math.round(value * 0.9);
  }
  if (mortgage > 0) out.mortgageBalanceGbp = mortgage;
  if (mortgage > 0 && rate > 0) out.mortgageInterestAnnualGbp = (mortgage * rate) / 100;
  if (rent > 0) out.rentMonthlyGbp = rent;
  return out;
}
