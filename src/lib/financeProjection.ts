import type { Account, BalanceEntry } from "@/hooks/useFinance";

export type ScenarioId = "historical" | "cautious" | "optimistic" | "custom";

export const SCENARIO_LABELS: Record<ScenarioId, string> = {
  historical: "Historical average",
  cautious: "Cautious",
  optimistic: "Optimistic",
  custom: "Custom",
};

/** Fixed annual growth assumptions for the non-custom, non-historical presets. */
export const SCENARIO_FIXED_RATES: Partial<Record<ScenarioId, number>> = {
  cautious: 2,
  optimistic: 7,
};

const DEFAULT_FALLBACK_GROWTH_PCT = 4;
const LISA_ANNUAL_CAP = 4000;
const LISA_BONUS_RATE = 0.25;

/** Compound annual growth rate (CAGR) implied by an account's own logged history. */
export function computeHistoricalGrowthRate(entries: BalanceEntry[]): number | null {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) return null;

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const years = (new Date(last.date).getTime() - new Date(first.date).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (years < 0.25 || first.balance <= 0) return null;

  return (Math.pow(last.balance / first.balance, 1 / years) - 1) * 100;
}

/** Resolves the effective annual growth % to project an account at, for the chosen scenario. */
export function resolveGrowthPct(scenario: ScenarioId, account: Account, accountEntries: BalanceEntry[]): number {
  if (scenario === "custom") return account.growthAssumptionPct ?? DEFAULT_FALLBACK_GROWTH_PCT;
  if (scenario === "historical") return computeHistoricalGrowthRate(accountEntries) ?? DEFAULT_FALLBACK_GROWTH_PCT;
  return SCENARIO_FIXED_RATES[scenario] ?? DEFAULT_FALLBACK_GROWTH_PCT;
}

/** Default assumed monthly contribution when the account has none set explicitly. */
export function defaultMonthlyContribution(account: Account): number {
  if (account.monthlyContribution !== undefined) return account.monthlyContribution;
  // LISAs are commonly maxed out to capture the full government bonus.
  return account.type === "LISA" ? LISA_ANNUAL_CAP / 12 : 0;
}

export interface ProjectionParams {
  startingBalance: number;
  annualGrowthPct: number;
  monthlyContribution: number;
  annualFeePct: number;
  years: number;
  isLisa: boolean;
}

export interface ProjectionPoint {
  year: number; // 0 = today
  balance: number;
  cumulativeContributions: number;
  cumulativeBonus: number;
}

/**
 * Projects an account's balance forward month-by-month, applying growth then fees each
 * month and — for LISA accounts — a 25% government bonus each year on contributions up
 * to the £4,000 annual cap. Returns one point per year (index 0 = today).
 */
export function projectAccountBalance(params: ProjectionParams): ProjectionPoint[] {
  const { startingBalance, annualGrowthPct, monthlyContribution, annualFeePct, years, isLisa } = params;
  const monthlyGrowth = Math.pow(1 + annualGrowthPct / 100, 1 / 12) - 1;
  const monthlyFee = Math.pow(1 + Math.max(0, annualFeePct) / 100, 1 / 12) - 1;

  let balance = startingBalance;
  let cumulativeContributions = 0;
  let cumulativeBonus = 0;
  const points: ProjectionPoint[] = [{ year: 0, balance, cumulativeContributions: 0, cumulativeBonus: 0 }];

  for (let year = 1; year <= years; year++) {
    let yearContribution = 0;
    for (let month = 1; month <= 12; month++) {
      let contribution = Math.max(0, monthlyContribution);
      if (isLisa) {
        const remainingCap = LISA_ANNUAL_CAP - yearContribution;
        contribution = Math.max(0, Math.min(contribution, remainingCap));
      }
      balance += contribution;
      yearContribution += contribution;
      cumulativeContributions += contribution;

      balance *= 1 + monthlyGrowth;
      balance *= 1 - monthlyFee;
    }
    if (isLisa && yearContribution > 0) {
      const bonus = yearContribution * LISA_BONUS_RATE;
      balance += bonus;
      cumulativeBonus += bonus;
    }
    points.push({ year, balance, cumulativeContributions, cumulativeBonus });
  }

  return points;
}
