import type { FlatOwnership, FlatRecord, FlatTaxSettings } from "@/types/flats";

export interface FlatReturnSummary {
  annualRentGbp: number;
  annualExpensesGbp: number;
  annualMortgageInterestGbp: number;
  grossYieldPct: number | null;
  netYieldPct: number | null;
  grossReturnGbp: number;
  netReturnGbp: number;
  propertyValueGbp: number;
  ltvPct: number | null;
}

export interface FlatTaxYearEstimate {
  ownership: FlatOwnership;
  grossRentGbp: number;
  allowableExpensesGbp: number;
  financeCostsGbp: number;
  propertyAllowanceGbp: number;
  taxableProfitGbp: number;
  financeCostTaxCreditGbp: number;
  estimatedIncomeTaxGbp: number;
  notes: string[];
}

const BASIC_RATE = 0.2;
const PROPERTY_ALLOWANCE = 1000;

export function annualiseLedger(
  ledger: FlatRecord["ledger"],
  kind: "income" | "expense",
  year?: number,
): number {
  const y = year ?? new Date().getFullYear();
  return (ledger || [])
    .filter((e) => e.kind === kind && String(e.date || "").startsWith(String(y)))
    .reduce((sum, e) => sum + (Number(e.amountGbp) || 0), 0);
}

export function estimateAnnualRent(flat: FlatRecord, year?: number): number {
  const fromLedger = annualiseLedger(flat.ledger || [], "income", year);
  if (fromLedger > 0) return fromLedger;
  return (Number(flat.tenant?.rentMonthlyGbp) || 0) * 12;
}

export function estimateAnnualExpenses(flat: FlatRecord, year?: number): number {
  return annualiseLedger(flat.ledger || [], "expense", year);
}

export function estimateMortgageInterest(flat: FlatRecord): number {
  const balance = Number(flat.mortgageBalanceGbp) || 0;
  const rate = Number(flat.mortgageRatePct) || 0;
  if (balance > 0 && rate > 0) return (balance * rate) / 100;
  return (flat.ledger || [])
    .filter(
      (e) =>
        e.kind === "expense" && /mortgage|interest/i.test(`${e.category} ${e.description}`),
    )
    .reduce((s, e) => s + (Number(e.amountGbp) || 0), 0);
}

export function computeFlatReturns(flat: FlatRecord, year?: number): FlatReturnSummary {
  const propertyValueGbp = Math.max(0, Number(flat.propertyValueGbp) || 0);
  const annualRentGbp = estimateAnnualRent(flat, year);
  const annualExpensesGbp = estimateAnnualExpenses(flat, year);
  const annualMortgageInterestGbp = estimateMortgageInterest(flat);
  const grossReturnGbp = annualRentGbp;
  const netReturnGbp = annualRentGbp - annualExpensesGbp - annualMortgageInterestGbp;
  const grossYieldPct =
    propertyValueGbp > 0 ? (grossReturnGbp / propertyValueGbp) * 100 : null;
  const netYieldPct =
    propertyValueGbp > 0 ? (netReturnGbp / propertyValueGbp) * 100 : null;
  const mortgage = Number(flat.mortgageBalanceGbp) || 0;
  const ltvPct = propertyValueGbp > 0 ? (mortgage / propertyValueGbp) * 100 : null;
  return {
    annualRentGbp,
    annualExpensesGbp,
    annualMortgageInterestGbp,
    grossYieldPct,
    netYieldPct,
    grossReturnGbp,
    netReturnGbp,
    propertyValueGbp,
    ltvPct,
  };
}

export function estimateFlatTax(
  flat: FlatRecord,
  tax?: FlatTaxSettings,
  year?: number,
  marginalRate = 0.4,
): FlatTaxYearEstimate {
  const ownership = tax?.ownership || flat.ownership || "personal";
  const grossRentGbp = estimateAnnualRent(flat, year);
  const expensesRaw = estimateAnnualExpenses(flat, year);
  const financeCostsGbp = estimateMortgageInterest(flat);
  const notes: string[] = [];
  let allowableExpensesGbp = expensesRaw;
  let propertyAllowanceGbp = 0;
  let taxableProfitGbp = 0;
  let financeCostTaxCreditGbp = 0;
  let estimatedIncomeTaxGbp = 0;

  if (ownership === "ltd_company") {
    taxableProfitGbp = Math.max(0, grossRentGbp - expensesRaw - financeCostsGbp);
    estimatedIncomeTaxGbp = taxableProfitGbp * 0.25;
    notes.push("Modelled as company profit at a simplified 25% corporation-tax style rate.");
    notes.push("Dividends taken personally are taxed separately in Finances → Tax.");
  } else {
    if (tax?.usePropertyAllowance) {
      propertyAllowanceGbp = Math.min(PROPERTY_ALLOWANCE, grossRentGbp);
      allowableExpensesGbp = 0;
      notes.push("Using the £1,000 property income allowance instead of itemised expenses.");
    } else {
      notes.push("Itemising allowable property expenses against rental income.");
    }
    taxableProfitGbp = Math.max(
      0,
      grossRentGbp - allowableExpensesGbp - propertyAllowanceGbp,
    );
    const restriction = (tax?.financeCostRestrictionPct ?? 100) / 100;
    financeCostTaxCreditGbp = financeCostsGbp * restriction * BASIC_RATE;
    estimatedIncomeTaxGbp = Math.max(
      0,
      taxableProfitGbp * marginalRate - financeCostTaxCreditGbp,
    );
    notes.push(
      `Assumed marginal income-tax rate ${(marginalRate * 100).toFixed(0)}% for modelling.`,
    );
    if (financeCostsGbp > 0) {
      notes.push(
        "Mortgage interest is restricted for individuals — shown as a basic-rate tax reduction.",
      );
    }
  }

  return {
    ownership,
    grossRentGbp,
    allowableExpensesGbp,
    financeCostsGbp,
    propertyAllowanceGbp,
    taxableProfitGbp,
    financeCostTaxCreditGbp,
    estimatedIncomeTaxGbp,
    notes,
  };
}

export function fmtGbp(n: number | null | undefined, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `£${n.toLocaleString("en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function fmtPct(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}
