export const RETURN_CASES = ["cautious", "central", "optimistic"] as const;
export type ReturnCase = typeof RETURN_CASES[number];
export type ModelAccountKind = "cash" | "cash_isa" | "stocks_isa" | "lisa" | "gia" | "pension" | "property" | "other";

export interface ModelPerson {
  id: string;
  name: string;
  age: number;
  annualIncomeGbp: number;
  annualSpendingGbp: number;
}

export interface ModelFeePeriod {
  id: string;
  effectiveFrom: string;
  annualPercent: number;
  annualFlatGbp: number;
  source: "manual" | "provider" | "hardy";
  sourceUrl?: string;
  checkedAt?: string;
}

export interface ModelAccount {
  id: string;
  ownerId: string;
  name: string;
  provider: string;
  kind: ModelAccountKind;
  openingBalanceGbp: number;
  monthlyContributionGbp: number;
  monthlyWithdrawalGbp: number;
  returns: Record<ReturnCase, number>;
  fees: ModelFeePeriod[];
  importedAccountId?: string;
  includeInEstate: boolean;
}

export interface ModelGift {
  id: string;
  fromPersonId: string;
  toPersonId: string;
  fromAccountId?: string;
  toAccountId?: string;
  amountGbp: number;
  month: number;
  exemptGbp: number;
  fromNormalIncome: boolean;
  giftWithReservation: boolean;
}

export interface FinancialModelInput {
  id?: string;
  name: string;
  description: string;
  sourcePrompt?: string;
  years: number;
  inflationPct: number;
  deathYear: number;
  people: ModelPerson[];
  accounts: ModelAccount[];
  gifts: ModelGift[];
  residenceValueGbp: number;
  residenceToDirectDescendants: boolean;
  transferableNilRateBandPct: number;
  assumptions: string[];
}

export interface ModelYearPoint {
  year: number;
  totalGbp: number;
  estateGbp: number;
  outsideEstateGbp: number;
  cumulativeFeesGbp: number;
  cumulativeGiftsGbp: number;
  inheritanceTaxGbp: number;
  people: Record<string, number>;
  accounts: Record<string, number>;
}

export interface ModelRun {
  returnCase: ReturnCase;
  points: ModelYearPoint[];
  endingTotalGbp: number;
  endingEstateGbp: number;
  endingOutsideEstateGbp: number;
  inheritanceTaxGbp: number;
  cumulativeFeesGbp: number;
  cumulativeGiftsGbp: number;
}

export interface FinancialModelResult {
  runs: Record<ReturnCase, ModelRun>;
  baselineRuns: Record<ReturnCase, ModelRun>;
  warnings: string[];
  calculatedAt: string;
  rulesVersion: string;
}

export interface SavedFinancialModel {
  id: string;
  input: FinancialModelInput;
  result: FinancialModelResult;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export const UK_MODEL_RULES = {
  version: "england-2026-27.1",
  isaAnnualAllowanceGbp: 20_000,
  lisaAnnualAllowanceGbp: 4_000,
  lisaBonusPct: 25,
  annualGiftExemptionGbp: 3_000,
  nilRateBandGbp: 325_000,
  residenceNilRateBandGbp: 175_000,
  residenceTaperStartsGbp: 2_000_000,
  inheritanceTaxPct: 40,
  giftWindowYears: 7,
  pensionTaxFreePct: 25,
  pensionTaxFreeCapGbp: 268_275,
} as const;

export function modelId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function defaultFinancialModel(): FinancialModelInput {
  const personId = modelId("person");
  return {
    name: "New financial model",
    description: "",
    years: 10,
    inflationPct: 2,
    deathYear: 10,
    people: [{ id: personId, name: "Mum", age: 70, annualIncomeGbp: 24_000, annualSpendingGbp: 24_000 }],
    accounts: [],
    gifts: [],
    residenceValueGbp: 0,
    residenceToDirectDescendants: true,
    transferableNilRateBandPct: 0,
    assumptions: [],
  };
}

function activeFee(account: ModelAccount): ModelFeePeriod | undefined {
  return [...account.fees].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
}

function giftTaxRate(yearsSinceGift: number): number {
  if (yearsSinceGift >= 7) return 0;
  if (yearsSinceGift >= 6) return 8;
  if (yearsSinceGift >= 5) return 16;
  if (yearsSinceGift >= 4) return 24;
  if (yearsSinceGift >= 3) return 32;
  return 40;
}

function runOne(input: FinancialModelInput, returnCase: ReturnCase, baseline: boolean): ModelRun {
  const balances = Object.fromEntries(input.accounts.map((account) => [account.id, Math.max(0, account.openingBalanceGbp)]));
  const points: ModelYearPoint[] = [];
  let fees = 0;
  let gifts = 0;
  const giftsApplied = new Set<string>();
  const annualContributions: Record<string, number> = {};

  const snapshot = (year: number) => {
    const people: Record<string, number> = Object.fromEntries(input.people.map((person) => [person.id, 0]));
    for (const account of input.accounts) people[account.ownerId] = (people[account.ownerId] || 0) + (balances[account.id] || 0);
    const financialEstate = input.accounts.reduce((sum, account) => sum + (account.includeInEstate ? balances[account.id] || 0 : 0), 0);
    const estate = financialEstate + input.residenceValueGbp;
    const deathYear = Math.max(0, Math.min(input.deathYear, input.years));
    const relevantGifts = baseline ? [] : input.gifts.filter((gift) => {
      const giftYear = gift.month / 12;
      return giftYear <= deathYear && (gift.giftWithReservation || deathYear - giftYear < UK_MODEL_RULES.giftWindowYears);
    });
    let giftTax = 0;
    let chargeableGifts = 0;
    for (const gift of relevantGifts) {
      if (gift.fromNormalIncome && !gift.giftWithReservation) continue;
      const chargeable = Math.max(0, gift.amountGbp - gift.exemptGbp);
      chargeableGifts += chargeable;
      giftTax += chargeable * giftTaxRate(deathYear - gift.month / 12) / 100;
    }
    const transferable = Math.max(0, Math.min(100, input.transferableNilRateBandPct)) / 100;
    const nrb = UK_MODEL_RULES.nilRateBandGbp * (1 + transferable);
    const residenceTaper = Math.max(0, (estate - UK_MODEL_RULES.residenceTaperStartsGbp) / 2);
    const rnrb = input.residenceToDirectDescendants
      ? Math.max(0, UK_MODEL_RULES.residenceNilRateBandGbp * (1 + transferable) - residenceTaper)
      : 0;
    const estateTax = Math.max(0, estate + chargeableGifts - nrb - rnrb) * UK_MODEL_RULES.inheritanceTaxPct / 100;
    const iht = year === deathYear ? Math.max(estateTax, giftTax) : 0;
    points.push({
      year,
      totalGbp: Object.values(balances).reduce((a, b) => a + b, 0) + input.residenceValueGbp,
      estateGbp: estate,
      outsideEstateGbp: Object.values(balances).reduce((a, b) => a + b, 0) - financialEstate,
      cumulativeFeesGbp: fees,
      cumulativeGiftsGbp: gifts,
      inheritanceTaxGbp: iht,
      people,
      accounts: { ...balances },
    });
  };

  snapshot(0);
  for (let month = 1; month <= input.years * 12; month += 1) {
    if ((month - 1) % 12 === 0) for (const account of input.accounts) annualContributions[account.id] = 0;
    for (const account of input.accounts) {
      const fee = activeFee(account);
      const growth = Math.pow(1 + account.returns[returnCase] / 100, 1 / 12) - 1;
      let balance = balances[account.id] || 0;
      const isaCap = account.kind === "lisa" ? UK_MODEL_RULES.lisaAnnualAllowanceGbp
        : account.kind === "cash_isa" || account.kind === "stocks_isa" ? UK_MODEL_RULES.isaAnnualAllowanceGbp : Infinity;
      const contribution = Math.max(0, Math.min(account.monthlyContributionGbp, isaCap - (annualContributions[account.id] || 0)));
      annualContributions[account.id] = (annualContributions[account.id] || 0) + contribution;
      balance += contribution;
      if (account.kind === "lisa") balance += contribution * UK_MODEL_RULES.lisaBonusPct / 100;
      balance -= account.monthlyWithdrawalGbp;
      balance = Math.max(0, balance);
      balance *= 1 + growth;
      const monthlyFee = balance * ((fee?.annualPercent || 0) / 100 / 12) + (fee?.annualFlatGbp || 0) / 12;
      fees += Math.min(balance, monthlyFee);
      balances[account.id] = Math.max(0, balance - monthlyFee);
    }

    for (const person of input.people) {
      const monthlySurplus = (person.annualIncomeGbp - person.annualSpendingGbp) / 12;
      const cash = input.accounts.find((account) => account.ownerId === person.id && (account.kind === "cash" || account.kind === "cash_isa"));
      if (cash) balances[cash.id] = Math.max(0, (balances[cash.id] || 0) + monthlySurplus);
    }

    if (!baseline) for (const gift of input.gifts.filter((item) => item.month === month && !giftsApplied.has(item.id))) {
      const source = gift.fromAccountId || input.accounts.find((account) => account.ownerId === gift.fromPersonId)?.id;
      const target = gift.toAccountId || input.accounts.find((account) => account.ownerId === gift.toPersonId)?.id;
      if (!source) continue;
      const paid = Math.min(balances[source] || 0, Math.max(0, gift.amountGbp));
      balances[source] = Math.max(0, (balances[source] || 0) - paid);
      if (target) {
        const targetAccount = input.accounts.find((account) => account.id === target);
        let credited = paid;
        if (targetAccount?.kind === "lisa") credited += Math.min(paid, UK_MODEL_RULES.lisaAnnualAllowanceGbp) * UK_MODEL_RULES.lisaBonusPct / 100;
        balances[target] = (balances[target] || 0) + credited;
      }
      gifts += paid;
      giftsApplied.add(gift.id);
    }
    if (month % 12 === 0) snapshot(month / 12);
  }
  const deathPoint = points.find((point) => point.year === Math.min(input.deathYear, input.years)) || points.at(-1)!;
  const last = points.at(-1)!;
  return {
    returnCase,
    points,
    endingTotalGbp: last.totalGbp,
    endingEstateGbp: last.estateGbp,
    endingOutsideEstateGbp: last.outsideEstateGbp,
    inheritanceTaxGbp: deathPoint.inheritanceTaxGbp,
    cumulativeFeesGbp: last.cumulativeFeesGbp,
    cumulativeGiftsGbp: last.cumulativeGiftsGbp,
  };
}

export function calculateFinancialModel(input: FinancialModelInput): FinancialModelResult {
  const warnings: string[] = [];
  if (!input.accounts.length) warnings.push("Add at least one account to produce a meaningful projection.");
  if (input.people.some((person) => !person.annualSpendingGbp)) warnings.push("One or more people have no annual spending entered; affordability may be incomplete.");
  if (input.accounts.some((account) => !account.fees.length)) warnings.push("One or more accounts have no fee schedule, so zero fees are assumed for those accounts.");
  if (input.accounts.some((account) => account.kind === "lisa" && account.monthlyContributionGbp * 12 > UK_MODEL_RULES.lisaAnnualAllowanceGbp)) warnings.push("A LISA contribution exceeds the annual limit; the projection caps it and applies the 25% bonus only within the limit.");
  if (input.accounts.some((account) => (account.kind === "cash_isa" || account.kind === "stocks_isa") && account.monthlyContributionGbp * 12 > UK_MODEL_RULES.isaAnnualAllowanceGbp)) warnings.push("An ISA contribution exceeds the annual limit; the projection caps it. Combined ISA subscriptions across accounts still require manual review.");
  const runs = Object.fromEntries(RETURN_CASES.map((item) => [item, runOne(input, item, false)])) as Record<ReturnCase, ModelRun>;
  const baselineRuns = Object.fromEntries(RETURN_CASES.map((item) => [item, runOne(input, item, true)])) as Record<ReturnCase, ModelRun>;
  return { runs, baselineRuns, warnings, calculatedAt: new Date().toISOString(), rulesVersion: UK_MODEL_RULES.version };
}

export function fixedTermMonthlyWithdrawal(openingBalance: number, annualReturnPct: number, years: number, residualBalance = 0): number {
  const months = Math.max(1, Math.round(years * 12));
  const rate = Math.pow(1 + annualReturnPct / 100, 1 / 12) - 1;
  if (Math.abs(rate) < 1e-9) return Math.max(0, openingBalance - residualBalance) / months;
  return Math.max(0, (openingBalance * Math.pow(1 + rate, months) - residualBalance) * rate / (Math.pow(1 + rate, months) - 1));
}
