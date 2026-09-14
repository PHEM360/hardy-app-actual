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
  /** Cash pile if sold at the chosen completion month (offer), grown at alternative return. */
  sellOfferWealthGbp: number;
  /** Cash pile if sold at the chosen completion month (market), grown at alternative return. */
  sellMarketWealthGbp: number;
  /** Net equity if hold vacant then sell at year-end (after costs + mortgage). */
  holdVacantWealthGbp: number;
  /** Net equity + invested rent cash if rent then sell at year-end. */
  rentWealthGbp: number;
  /** rentWealth − sellOfferWealth */
  rentVsOfferGbp: number;
}

export interface FlatInvestmentTiming {
  asOfMonth: string;
  saleCompletionMonth: string;
  rentalStartMonth: string;
  rentalEndMonth: string;
  rentalDurationMonths: number;
  horizonMonths: number;
  saleMonthIndex: number;
  rentStartIndex: number;
  rentEndIndex: number;
  voidMonthsTotal: number;
}

export interface FlatInvestmentResult {
  inputs: FlatInvestmentInputs;
  timing: FlatInvestmentTiming;
  netOfferProceedsGbp: number;
  netMarketProceedsGbp: number;
  annualGrossRentGbp: number;
  annualOperatingCostsYear0Gbp: number;
  annualNetRentBeforeTaxYear0Gbp: number;
  annualTaxYear0Gbp: number;
  annualNetRentAfterTaxYear0Gbp: number;
  years: FlatInvestmentYearRow[];
  recommendation: FlatInvestmentStrategy;
  recommendationLabel: string;
  recommendationDetail: string;
  /** Sale price (at the chosen completion month) that matches renting to the horizon. */
  breakEvenSalePriceGbp: number | null;
  /** First year where renting beats selling at the offer (1-based), or null. */
  yearsUntilRentBeatsOffer: number | null;
  /** Monthly rent needed for renting to beat selling at offer by horizon. */
  breakEvenMonthlyRentGbp: number | null;
  /** Alternative return needed on sale proceeds to match the rent path. */
  breakEvenAltReturnPctPa: number | null;
  breakEvenSaleHint: string;
  breakEvenRentHint: string;
  breakEvenReturnHint: string;
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
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function currentMonthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function parseMonthKey(value: string | undefined): { y: number; m: number } | null {
  const match = String(value || "").trim().match(/^(\d{4})-(\d{1,2})$/);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(y) || m < 1 || m > 12) return null;
  return { y, m };
}

export function addMonthsToKey(key: string, delta: number): string {
  const parsed = parseMonthKey(key) || parseMonthKey(currentMonthKey())!;
  const idx = parsed.y * 12 + (parsed.m - 1) + Math.round(delta);
  const y = Math.floor(idx / 12);
  const m = ((idx % 12) + 12) % 12;
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

export function monthsBetweenKeys(from: string, to: string): number {
  const a = parseMonthKey(from) || parseMonthKey(currentMonthKey())!;
  const b = parseMonthKey(to) || a;
  return (b.y - a.y) * 12 + (b.m - a.m);
}

export function formatMonthKey(key: string): string {
  const parsed = parseMonthKey(key);
  if (!parsed) return key;
  return `${MONTH_NAMES[parsed.m - 1]} ${parsed.y}`;
}

export function defaultInvestmentInputs(partial?: Partial<FlatInvestmentInputs>): FlatInvestmentInputs {
  const asOf = currentMonthKey();
  const horizonYears = Math.max(1, Math.min(40, Math.round(partial?.horizonYears ?? 10) || 10));
  const base: FlatInvestmentInputs = {
    marketValueGbp: 90_000,
    offerPriceGbp: 80_000,
    mortgageBalanceGbp: 0,
    rentMonthlyGbp: 750,
    voidMonthsPerYear: 0.5,
    asOfMonth: asOf,
    saleCompletionMonth: asOf,
    rentalStartMonth: asOf,
    rentalDurationMonths: horizonYears * 12,
    serviceChargeAnnualGbp: 2_400,
    maintenanceAnnualGbp: 600,
    insuranceAnnualGbp: 250,
    groundRentAnnualGbp: 0,
    lettingFeesPctOfRent: 10,
    otherAnnualCostsGbp: 0,
    mortgageInterestAnnualGbp: 0,
    councilTaxAnnualGbp: 0,
    councilTaxSecondHomeFromMonth: "",
    councilTaxSecondHomeAnnualGbp: 0,
    oneOffs: [],
    sellingCostsPct: 2.5,
    sellingFixedGbp: 1_500,
    capitalGrowthPctPa: 2,
    rentGrowthPctPa: 2,
    costGrowthPctPa: 2.5,
    alternativeReturnPctPa: 4,
    incomeTaxRatePct: 40,
    financeCostReliefPct: 100,
    horizonYears,
  };
  if (!partial) return base;
  return {
    ...base,
    ...partial,
    asOfMonth: parseMonthKey(partial.asOfMonth) ? partial.asOfMonth : base.asOfMonth,
    saleCompletionMonth: parseMonthKey(partial.saleCompletionMonth) ? partial.saleCompletionMonth : base.saleCompletionMonth,
    rentalStartMonth: parseMonthKey(partial.rentalStartMonth) ? partial.rentalStartMonth : base.rentalStartMonth,
    councilTaxSecondHomeFromMonth: parseMonthKey(partial.councilTaxSecondHomeFromMonth)
      ? partial.councilTaxSecondHomeFromMonth
      : "",
    rentalDurationMonths:
      partial.rentalDurationMonths != null
        ? Math.max(1, Math.min(480, Math.round(partial.rentalDurationMonths) || horizonYears * 12))
        : base.rentalDurationMonths,
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

function monthlyFactor(ratePct: number): number {
  return Math.pow(1 + ratePct / 100, 1 / 12);
}

export function resolveTiming(inputs: FlatInvestmentInputs): FlatInvestmentTiming {
  const asOfMonth = parseMonthKey(inputs.asOfMonth) ? inputs.asOfMonth! : currentMonthKey();
  const horizonMonths = Math.max(12, Math.min(480, Math.round(inputs.horizonYears || 10) * 12));
  const saleRaw = parseMonthKey(inputs.saleCompletionMonth) ? inputs.saleCompletionMonth! : asOfMonth;
  const rentRaw = parseMonthKey(inputs.rentalStartMonth) ? inputs.rentalStartMonth! : asOfMonth;
  const rentalDurationMonths = Math.max(
    1,
    Math.min(480, Math.round(inputs.rentalDurationMonths || horizonMonths) || horizonMonths),
  );
  const requestedSale = monthsBetweenKeys(asOfMonth, saleRaw);
  const requestedRent = monthsBetweenKeys(asOfMonth, rentRaw);
  const saleMonthIndex = Math.max(0, Math.min(horizonMonths - 1, Math.round(requestedSale)));
  const rentStartIndex = Math.max(0, Math.min(horizonMonths, Math.round(requestedRent)));
  const rentEndIndex = Math.min(horizonMonths, rentStartIndex + rentalDurationMonths);
  const durationYears = Math.max(1 / 12, rentalDurationMonths / 12);
  const voidMonthsTotal =
    inputs.voidMonthsTotal != null && Number.isFinite(inputs.voidMonthsTotal)
      ? Math.max(0, Math.min(rentalDurationMonths, inputs.voidMonthsTotal))
      : Math.max(0, Math.min(rentalDurationMonths, (inputs.voidMonthsPerYear || 0) * durationYears));
  return {
    asOfMonth,
    saleCompletionMonth: addMonthsToKey(asOfMonth, saleMonthIndex),
    rentalStartMonth: addMonthsToKey(asOfMonth, rentStartIndex),
    rentalEndMonth: addMonthsToKey(asOfMonth, Math.max(0, rentEndIndex - 1)),
    rentalDurationMonths,
    horizonMonths,
    saleMonthIndex,
    rentStartIndex,
    rentEndIndex,
    voidMonthsTotal,
  };
}

function voidOffsets(duration: number, voids: number): Set<number> {
  const n = Math.min(Math.max(0, Math.round(voids)), Math.max(0, duration));
  const set = new Set<number>();
  if (n === 0 || duration <= 0) return set;
  for (let i = 0; i < n; i++) {
    let idx = Math.min(duration - 1, Math.floor((i * duration) / n));
    while (set.has(idx) && idx < duration - 1) idx += 1;
    set.add(idx);
  }
  return set;
}

function costFactorAtMonth(inputs: FlatInvestmentInputs, monthIndex: number): number {
  return Math.pow(1 + inputs.costGrowthPctPa / 100, Math.floor(monthIndex / 12));
}

function rentAtMonth(inputs: FlatInvestmentInputs, monthIndex: number): number {
  return Math.max(0, inputs.rentMonthlyGbp) * Math.pow(1 + inputs.rentGrowthPctPa / 100, Math.floor(monthIndex / 12));
}

function vacantFixedAnnualExcludingCouncil(inputs: FlatInvestmentInputs): number {
  return (
    Math.max(0, inputs.serviceChargeAnnualGbp) +
    Math.max(0, inputs.maintenanceAnnualGbp) +
    Math.max(0, inputs.insuranceAnnualGbp) +
    Math.max(0, inputs.groundRentAnnualGbp) +
    Math.max(0, inputs.otherAnnualCostsGbp) +
    Math.max(0, inputs.mortgageInterestAnnualGbp)
  );
}

export function secondHomeCouncilTaxAnnualGbp(inputs: Pick<FlatInvestmentInputs, "councilTaxAnnualGbp" | "councilTaxSecondHomeAnnualGbp">): number {
  if (inputs.councilTaxSecondHomeAnnualGbp != null && inputs.councilTaxSecondHomeAnnualGbp > 0) {
    return inputs.councilTaxSecondHomeAnnualGbp;
  }
  return Math.max(0, inputs.councilTaxAnnualGbp) * 2;
}

/** Council tax for one empty month. Occupied months should not call this. */
export function councilTaxForEmptyMonth(
  inputs: FlatInvestmentInputs,
  asOfMonth: string,
  monthIndex: number,
): number {
  const standard = Math.max(0, inputs.councilTaxAnnualGbp);
  if (standard <= 0 && !(inputs.councilTaxSecondHomeAnnualGbp && inputs.councilTaxSecondHomeAnnualGbp > 0)) {
    return 0;
  }
  const from = parseMonthKey(inputs.councilTaxSecondHomeFromMonth);
  const usePremium = Boolean(from) && monthIndex >= monthsBetweenKeys(asOfMonth, inputs.councilTaxSecondHomeFromMonth!);
  const annual = usePremium ? secondHomeCouncilTaxAnnualGbp(inputs) : standard;
  return (annual * costFactorAtMonth(inputs, monthIndex)) / 12;
}

function vacantMonthlyCosts(inputs: FlatInvestmentInputs, asOfMonth: string, monthIndex: number): number {
  const factor = costFactorAtMonth(inputs, monthIndex);
  return vacantFixedAnnualExcludingCouncil(inputs) * factor / 12 + councilTaxForEmptyMonth(inputs, asOfMonth, monthIndex);
}

function letOccupiedMonthlyCosts(inputs: FlatInvestmentInputs, monthIndex: number, rent: number): number {
  const factor = costFactorAtMonth(inputs, monthIndex);
  const fixed = vacantFixedAnnualExcludingCouncil(inputs) * factor / 12;
  return fixed + (rent * Math.max(0, inputs.lettingFeesPctOfRent)) / 100;
}

function letVoidMonthlyCosts(inputs: FlatInvestmentInputs, asOfMonth: string, monthIndex: number): number {
  return vacantMonthlyCosts(inputs, asOfMonth, monthIndex);
}

function oneOffsInMonth(
  oneOffs: FlatInvestmentOneOff[],
  asOfMonth: string,
  monthIndex: number,
): number {
  return oneOffs.reduce((sum, item) => {
    const amount = Math.max(0, Number(item.amountGbp) || 0);
    if (!amount) return sum;
    if (parseMonthKey(item.monthKey)) {
      return monthsBetweenKeys(asOfMonth, item.monthKey!) === monthIndex ? sum + amount : sum;
    }
    const yearIndex = Math.max(0, Math.round(Number(item.year) || 0));
    return monthIndex === yearIndex * 12 ? sum + amount : sum;
  }, 0);
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

function propertyValueAt(inputs: FlatInvestmentInputs, years: number): number {
  return grow(Math.max(0, inputs.marketValueGbp), inputs.capitalGrowthPctPa, years);
}

function terminalPropertyEquity(inputs: FlatInvestmentInputs, years: number): number {
  return netSaleProceeds(
    propertyValueAt(inputs, years),
    inputs.mortgageBalanceGbp,
    inputs.sellingCostsPct,
    inputs.sellingFixedGbp,
  );
}

type MonthSnapshot = {
  sellOffer: number;
  sellMarket: number;
  vacant: number;
  rent: number;
  grossRent: number;
  operating: number;
  oneOffs: number;
  tax: number;
  taxable: number;
  netRent: number;
  property: number;
};

function projectMonths(
  inputs: FlatInvestmentInputs,
  options?: { sellReturnPctPa?: number },
): { timing: FlatInvestmentTiming; months: MonthSnapshot[] } {
  const timing = resolveTiming(inputs);
  const voids = voidOffsets(timing.rentalDurationMonths, timing.voidMonthsTotal);
  const cashFactor = monthlyFactor(inputs.alternativeReturnPctPa);
  const sellFactor = monthlyFactor(options?.sellReturnPctPa ?? inputs.alternativeReturnPctPa);
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

  let sellOffer = 0;
  let sellMarket = 0;
  let vacantCash = 0;
  let rentCash = 0;
  let yearGross = 0;
  let yearOp = 0;
  const months: MonthSnapshot[] = [];

  for (let m = 0; m < timing.horizonMonths; m++) {
    const oneOff = oneOffsInMonth(inputs.oneOffs, timing.asOfMonth, m);
    const inTenancy = m >= timing.rentStartIndex && m < timing.rentEndIndex;
    const occupied = inTenancy && !voids.has(m - timing.rentStartIndex);
    const rent = occupied ? rentAtMonth(inputs, m) : 0;
    const operating = occupied
      ? letOccupiedMonthlyCosts(inputs, m, rent)
      : inTenancy
        ? letVoidMonthlyCosts(inputs, timing.asOfMonth, m)
        : vacantMonthlyCosts(inputs, timing.asOfMonth, m);

    yearGross += rent;
    yearOp += operating;

    if (m < timing.saleMonthIndex) {
      sellOffer -= vacantMonthlyCosts(inputs, timing.asOfMonth, m) + oneOff;
      sellMarket -= vacantMonthlyCosts(inputs, timing.asOfMonth, m) + oneOff;
    }
    if (m === timing.saleMonthIndex) {
      sellOffer += netOffer;
      sellMarket += netMarket;
    }

    vacantCash -= vacantMonthlyCosts(inputs, timing.asOfMonth, m) + oneOff;
    rentCash += rent - operating - oneOff;

    const yearEnd = (m + 1) % 12 === 0 || m === timing.horizonMonths - 1;
    let taxThis = 0;
    let taxableThis = 0;
    if (yearEnd) {
      const tax = estimateTax(inputs, yearGross, yearOp);
      taxThis = tax.taxGbp;
      taxableThis = tax.taxableProfitGbp;
      rentCash -= taxThis;
      yearGross = 0;
      yearOp = 0;
    }

    sellOffer *= sellFactor;
    sellMarket *= sellFactor;
    vacantCash *= cashFactor;
    rentCash *= cashFactor;

    const yearsHeld = (m + 1) / 12;
    const equity = terminalPropertyEquity(inputs, yearsHeld);
    months.push({
      sellOffer,
      sellMarket,
      vacant: equity + vacantCash,
      rent: equity + rentCash,
      grossRent: rent,
      operating,
      oneOffs: oneOff,
      tax: taxThis,
      taxable: taxableThis,
      netRent: rent - operating - oneOff - taxThis,
      property: propertyValueAt(inputs, yearsHeld),
    });
  }

  return { timing, months };
}

function yearRowsFromMonths(months: MonthSnapshot[], horizonYears: number): FlatInvestmentYearRow[] {
  const years: FlatInvestmentYearRow[] = [];
  const count = Math.max(1, Math.min(40, Math.round(horizonYears) || 10));
  for (let y = 1; y <= count; y++) {
    const slice = months.slice((y - 1) * 12, y * 12);
    if (!slice.length) break;
    const last = slice[slice.length - 1];
    const grossRentGbp = slice.reduce((s, row) => s + row.grossRent, 0);
    const operatingCostsGbp = slice.reduce((s, row) => s + row.operating, 0);
    const oneOffsGbp = slice.reduce((s, row) => s + row.oneOffs, 0);
    const taxGbp = slice.reduce((s, row) => s + row.tax, 0);
    const taxableProfitGbp = slice.reduce((s, row) => s + row.taxable, 0);
    const netRentCashGbp = slice.reduce((s, row) => s + row.netRent, 0);
    years.push({
      year: y,
      propertyValueGbp: last.property,
      grossRentGbp,
      operatingCostsGbp,
      oneOffsGbp,
      taxableProfitGbp,
      taxGbp,
      netRentCashGbp,
      sellOfferWealthGbp: last.sellOffer,
      sellMarketWealthGbp: last.sellMarket,
      holdVacantWealthGbp: last.vacant,
      rentWealthGbp: last.rent,
      rentVsOfferGbp: last.rent - last.sellOffer,
    });
  }
  return years;
}

function fmtDelta(n: number): string {
  const abs = Math.abs(n);
  const formatted = `£${abs.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
  return n >= 0 ? formatted : `${formatted} less`;
}

function fmtGbpWhole(n: number): string {
  return `£${Math.round(n).toLocaleString("en-GB")}`;
}

export interface FlatInvestmentVerdict {
  recommendation: FlatInvestmentStrategy;
  recommendationLabel: string;
  recommendationDetail: string;
  wealthAtHorizon: Record<FlatInvestmentStrategy, number>;
  differencesAtHorizon: {
    rentMinusOfferGbp: number;
    rentMinusMarketGbp: number;
    rentMinusVacantGbp: number;
  };
}

export function buildVerdict(
  row: FlatInvestmentYearRow,
  yearsLabel: number,
  inputs: FlatInvestmentInputs,
): FlatInvestmentVerdict {
  const wealthAtHorizon: Record<FlatInvestmentStrategy, number> = {
    sell_offer: row.sellOfferWealthGbp,
    sell_market: row.sellMarketWealthGbp,
    hold_vacant: row.holdVacantWealthGbp,
    rent: row.rentWealthGbp,
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

  const gaps = {
    rentMinusOfferGbp: row.rentWealthGbp - row.sellOfferWealthGbp,
    rentMinusMarketGbp: row.rentWealthGbp - row.sellMarketWealthGbp,
    rentMinusVacantGbp: row.rentWealthGbp - row.holdVacantWealthGbp,
  };

  const timing = resolveTiming(inputs);
  const netOffer = netSaleProceeds(inputs.offerPriceGbp, inputs.mortgageBalanceGbp, inputs.sellingCostsPct, inputs.sellingFixedGbp);
  const yearsWord = `${yearsLabel} year${yearsLabel === 1 ? "" : "s"}`;
  const marketBeatsRent = row.sellMarketWealthGbp > row.rentWealthGbp;
  const saleWhen = formatMonthKey(timing.saleCompletionMonth);
  const rentWhen = formatMonthKey(timing.rentalStartMonth);
  let recommendationDetail = "";
  if (recommendation === "rent") {
    recommendationDetail = `After ${yearsWord}, renting from ${rentWhen} leaves you ${fmtDelta(gaps.rentMinusOfferGbp)} ahead of taking the ${fmtGbpWhole(inputs.offerPriceGbp)} offer in ${saleWhen} and investing its ${fmtGbpWhole(netOffer)} net proceeds at ${inputs.alternativeReturnPctPa}%/yr.`;
    if (marketBeatsRent) {
      recommendationDetail += ` Achieving full market value on a sale would still edge renting by ${fmtDelta(row.sellMarketWealthGbp - row.rentWealthGbp)} — only count that if the price is realistic.`;
    }
  } else if (recommendation === "sell_offer") {
    recommendationDetail = `Taking the ${fmtGbpWhole(inputs.offerPriceGbp)} offer in ${saleWhen} nets ${fmtGbpWhole(netOffer)} after selling costs; invested at ${inputs.alternativeReturnPctPa}%/yr for ${yearsWord} that grows to ${fmtGbpWhole(wealthAtHorizon.sell_offer)} — ${fmtDelta(-gaps.rentMinusOfferGbp)} more than renting from ${rentWhen}.`;
  } else {
    recommendationDetail =
      "Holding vacant is rarely optimal; costs without rent drag on wealth versus selling or letting.";
  }

  return {
    recommendation,
    recommendationLabel: STRATEGY_LABELS[recommendation],
    recommendationDetail,
    wealthAtHorizon,
    differencesAtHorizon: gaps,
  };
}

function bisection(
  lo: number,
  hi: number,
  steps: number,
  test: (mid: number) => number,
): number {
  let a = lo;
  let b = hi;
  for (let i = 0; i < steps; i++) {
    const mid = (a + b) / 2;
    if (test(mid) < 0) a = mid;
    else b = mid;
  }
  return (a + b) / 2;
}

export function runFlatInvestmentModel(inputs: FlatInvestmentInputs): FlatInvestmentResult {
  const horizon = Math.max(1, Math.min(40, Math.round(inputs.horizonYears) || 10));
  const normalised: FlatInvestmentInputs = {
    ...defaultInvestmentInputs(inputs),
    ...inputs,
    horizonYears: horizon,
    oneOffs: inputs.oneOffs || [],
  };
  if (normalised.rentalDurationMonths == null) {
    normalised.rentalDurationMonths = horizon * 12;
  }

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

  const projected = projectMonths(normalised);
  const years = yearRowsFromMonths(projected.months, horizon);
  const last = years[years.length - 1];
  const verdict = buildVerdict(last, horizon, normalised);
  const firstYear = years[0];

  const yearsUntilRentBeatsOffer = years.find((row) => row.rentVsOfferGbp > 0)?.year ?? null;

  const offerTarget = last.sellOfferWealthGbp;
  const rentTarget = last.rentWealthGbp;

  const breakEvenSalePriceGbp = bisection(0, Math.max(normalised.marketValueGbp * 4, normalised.offerPriceGbp * 4, 250_000), 32, (price) => {
    const trial = projectMonths({ ...normalised, offerPriceGbp: price });
    return trial.months[trial.months.length - 1].sellOffer - rentTarget;
  });

  const breakEvenMonthlyRentGbp = bisection(0, Math.max(normalised.rentMonthlyGbp * 6, 8_000), 28, (rent) => {
    const trial = projectMonths({ ...normalised, rentMonthlyGbp: rent });
    return trial.months[trial.months.length - 1].rent - offerTarget;
  });

  const lowReturn = projectMonths(normalised, { sellReturnPctPa: 0 }).months.at(-1)!;
  const highReturn = projectMonths(normalised, { sellReturnPctPa: 40 }).months.at(-1)!;
  let breakEvenAltReturnPctPa: number | null = null;
  if (lowReturn.sellOffer >= rentTarget) {
    breakEvenAltReturnPctPa = 0;
  } else if (highReturn.sellOffer < rentTarget) {
    breakEvenAltReturnPctPa = null;
  } else {
    breakEvenAltReturnPctPa = bisection(-2, 40, 36, (rate) => {
      const trial = projectMonths(normalised, { sellReturnPctPa: rate });
      return trial.months[trial.months.length - 1].sellOffer - rentTarget;
    });
  }

  const timing = projected.timing;
  const saleWhen = formatMonthKey(timing.saleCompletionMonth);
  const rentWhen = formatMonthKey(timing.rentalStartMonth);
  const rentUntil = formatMonthKey(addMonthsToKey(timing.rentalStartMonth, timing.rentalDurationMonths));
  const breakEvenSaleHint = `To match renting from ${rentWhen} for ${timing.rentalDurationMonths} months (after one-off costs, voids and tax), a sale completing ${saleWhen} would need to be about ${fmtGbpWhole(breakEvenSalePriceGbp)}.`;
  const breakEvenRentHint = `To beat selling at ${fmtGbpWhole(normalised.offerPriceGbp)} in ${saleWhen}, you would need to rent at about ${fmtGbpWhole(breakEvenMonthlyRentGbp)}/month from ${rentWhen} until ${rentUntil}.`;
  const breakEvenReturnHint =
    breakEvenAltReturnPctPa == null
      ? `Even at 40%/yr, investing the ${fmtGbpWhole(normalised.offerPriceGbp)} offer completing ${saleWhen} does not catch renting from ${rentWhen}.`
      : `To match that rental plan, the ${fmtGbpWhole(normalised.offerPriceGbp)} sale completing ${saleWhen} would need to earn about ${breakEvenAltReturnPctPa.toFixed(1)}%/yr after costs.`;

  return {
    inputs: normalised,
    timing,
    netOfferProceedsGbp,
    netMarketProceedsGbp,
    annualGrossRentGbp: firstYear?.grossRentGbp ?? 0,
    annualOperatingCostsYear0Gbp: firstYear?.operatingCostsGbp ?? 0,
    annualNetRentBeforeTaxYear0Gbp: (firstYear?.netRentCashGbp ?? 0) + (firstYear?.taxGbp ?? 0),
    annualTaxYear0Gbp: firstYear?.taxGbp ?? 0,
    annualNetRentAfterTaxYear0Gbp: firstYear?.netRentCashGbp ?? 0,
    years,
    recommendation: verdict.recommendation,
    recommendationLabel: verdict.recommendationLabel,
    recommendationDetail: verdict.recommendationDetail,
    breakEvenSalePriceGbp,
    yearsUntilRentBeatsOffer,
    breakEvenMonthlyRentGbp,
    breakEvenAltReturnPctPa,
    breakEvenSaleHint,
    breakEvenRentHint,
    breakEvenReturnHint,
    wealthAtHorizon: verdict.wealthAtHorizon,
    differencesAtHorizon: verdict.differencesAtHorizon,
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
