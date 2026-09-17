/** Business setup / new-venture modeller: start-up costs, ongoing costs, income streams with
 * growth assumptions, and a year-by-year profit/cashflow projection. Illustrative, not advice. */

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export type BusinessSetupPeriod = "monthly" | "yearly";
export type BusinessSetupIncomeGrowthMode = "rate" | "toMax";
export type BusinessSetupExpenseGrowthMode = "flat" | "rate" | "manual";

export interface BusinessSetupCostItem {
  id: string;
  name: string;
  amount: number;
}

export interface BusinessSetupIncomeStream {
  id: string;
  name: string;
  /** Year 1 baseline, always stored annualised regardless of `period`. */
  amount: number;
  /** Input convenience only — which unit the user last typed the amount in. */
  period: BusinessSetupPeriod;
  growthMode: BusinessSetupIncomeGrowthMode;
  /** % per year, compounding — used when growthMode === "rate". */
  growthRatePercent: number;
  /** Ceiling this stream grows toward/caps at. */
  maxAnnualAmount: number;
  /** Years to reach maxAnnualAmount — used when growthMode === "toMax". */
  yearsToMax: number;
}

export interface BusinessSetupExpenseGrowth {
  mode: BusinessSetupExpenseGrowthMode;
  ratePercent: number;
  /** Total ongoing-cost override per year, index 0 = year 1 — used when mode === "manual". */
  manualByYear: number[];
}

export interface BusinessSetupAiCritique {
  generatedAt: number;
  summary: string;
  strengths: string[];
  risks: string[];
  suggestions: string[];
  verdict: string;
  model: string;
}

export interface BusinessSetup {
  id?: string;
  name: string;
  description: string;
  years: number;
  taxRatePercent: number;
  startupCosts: BusinessSetupCostItem[];
  ongoingCosts: BusinessSetupCostItem[];
  incomeStreams: BusinessSetupIncomeStream[];
  expenseGrowth: BusinessSetupExpenseGrowth;
  aiCritique: BusinessSetupAiCritique | null;
  ownerId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export const STARTUP_COST_PRESETS: { name: string; amount: number }[] = [
  { name: "Company registration & legal setup", amount: 200 },
  { name: "Accountancy / bookkeeping setup", amount: 300 },
  { name: "Business insurance (initial)", amount: 250 },
  { name: "Website & domain", amount: 800 },
  { name: "Branding & logo design", amount: 500 },
  { name: "Marketing launch campaign", amount: 1000 },
  { name: "Equipment & tools", amount: 2000 },
  { name: "Initial stock / materials", amount: 3000 },
  { name: "Office / workspace deposit & setup", amount: 1500 },
  { name: "Furniture & fixtures", amount: 800 },
  { name: "Software & subscriptions setup", amount: 300 },
  { name: "Licences & permits", amount: 200 },
  { name: "Point of sale / payment system", amount: 150 },
  { name: "Signage", amount: 250 },
  { name: "Vehicle / delivery setup", amount: 1500 },
  { name: "Staff recruitment & training", amount: 500 },
  { name: "Contingency fund", amount: 1000 },
];

export const ONGOING_COST_PRESETS: { name: string; amount: number }[] = [
  { name: "Rent / workspace", amount: 6000 },
  { name: "Utilities", amount: 1200 },
  { name: "Insurance", amount: 500 },
  { name: "Software subscriptions", amount: 600 },
  { name: "Marketing & advertising", amount: 2400 },
  { name: "Payroll / wages", amount: 0 },
  { name: "Accountancy fees", amount: 600 },
  { name: "Bank & payment fees", amount: 300 },
  { name: "Loan repayments", amount: 0 },
  { name: "Stock / materials replenishment", amount: 4000 },
  { name: "Delivery & shipping", amount: 500 },
  { name: "Equipment maintenance", amount: 300 },
  { name: "Professional & legal fees", amount: 400 },
  { name: "Travel", amount: 500 },
  { name: "Phone & internet", amount: 400 },
  { name: "Website hosting", amount: 200 },
  { name: "Contingency / miscellaneous", amount: 800 },
];

export function newCostItem(name: string, amount = 0): BusinessSetupCostItem {
  return { id: uid(), name, amount };
}

export function newIncomeStream(name = ""): BusinessSetupIncomeStream {
  return {
    id: uid(),
    name,
    amount: 0,
    period: "yearly",
    growthMode: "rate",
    growthRatePercent: 10,
    maxAnnualAmount: 0,
    yearsToMax: 3,
  };
}

export function defaultBusinessSetup(name = ""): BusinessSetup {
  return {
    name,
    description: "",
    years: 5,
    taxRatePercent: 19,
    startupCosts: [],
    ongoingCosts: [],
    incomeStreams: [newIncomeStream("Main income stream")],
    expenseGrowth: { mode: "flat", ratePercent: 5, manualByYear: [] },
    aiCritique: null,
  };
}

/** Defensive loader for Firestore data — never trust a doc shape blindly. */
export function mergeBusinessSetup(raw: Partial<BusinessSetup> | undefined): BusinessSetup {
  const base = defaultBusinessSetup(raw?.name ? String(raw.name) : "");
  const num = (v: unknown, fallback: number) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
  const costItems = (v: unknown): BusinessSetupCostItem[] =>
    Array.isArray(v)
      ? v
          .map((item) => {
            const it = item as Partial<BusinessSetupCostItem>;
            const name = String(it?.name ?? "").trim();
            if (!name) return null;
            return { id: String(it?.id || uid()), name, amount: num(it?.amount, 0) };
          })
          .filter((x): x is BusinessSetupCostItem => x !== null)
      : [];

  const incomeStreams: BusinessSetupIncomeStream[] = Array.isArray(raw?.incomeStreams)
    ? raw!.incomeStreams
        .map((item) => {
          const it = item as Partial<BusinessSetupIncomeStream>;
          const name = String(it?.name ?? "").trim();
          if (!name) return null;
          return {
            id: String(it?.id || uid()),
            name,
            amount: num(it?.amount, 0),
            period: it?.period === "monthly" ? "monthly" : "yearly",
            growthMode: it?.growthMode === "toMax" ? "toMax" : "rate",
            growthRatePercent: num(it?.growthRatePercent, 10),
            maxAnnualAmount: num(it?.maxAnnualAmount, 0),
            yearsToMax: Math.max(1, num(it?.yearsToMax, 3)),
          } satisfies BusinessSetupIncomeStream;
        })
        .filter((x): x is BusinessSetupIncomeStream => x !== null)
    : base.incomeStreams;

  const expenseGrowthRaw = raw?.expenseGrowth as Partial<BusinessSetupExpenseGrowth> | undefined;
  const expenseGrowth: BusinessSetupExpenseGrowth = {
    mode: expenseGrowthRaw?.mode === "rate" || expenseGrowthRaw?.mode === "manual" ? expenseGrowthRaw.mode : "flat",
    ratePercent: num(expenseGrowthRaw?.ratePercent, 5),
    manualByYear: Array.isArray(expenseGrowthRaw?.manualByYear)
      ? expenseGrowthRaw!.manualByYear.map((n) => num(n, 0))
      : [],
  };

  const aiRaw = raw?.aiCritique as Partial<BusinessSetupAiCritique> | null | undefined;
  const aiCritique: BusinessSetupAiCritique | null = aiRaw && typeof aiRaw === "object"
    ? {
        generatedAt: num(aiRaw.generatedAt, Date.now()),
        summary: String(aiRaw.summary || ""),
        strengths: Array.isArray(aiRaw.strengths) ? aiRaw.strengths.map(String) : [],
        risks: Array.isArray(aiRaw.risks) ? aiRaw.risks.map(String) : [],
        suggestions: Array.isArray(aiRaw.suggestions) ? aiRaw.suggestions.map(String) : [],
        verdict: String(aiRaw.verdict || ""),
        model: String(aiRaw.model || ""),
      }
    : null;

  return {
    ...base,
    id: raw?.id,
    name: String(raw?.name ?? base.name),
    description: String(raw?.description ?? ""),
    years: Math.min(10, Math.max(1, num(raw?.years, 5))),
    taxRatePercent: num(raw?.taxRatePercent, 19),
    startupCosts: costItems(raw?.startupCosts),
    ongoingCosts: costItems(raw?.ongoingCosts),
    incomeStreams,
    expenseGrowth,
    aiCritique,
    ownerId: raw?.ownerId,
    createdAt: raw?.createdAt,
    updatedAt: raw?.updatedAt,
  };
}

export interface BusinessSetupYearResult {
  year: number;
  incomeByStream: { id: string; name: string; amount: number }[];
  revenue: number;
  ongoingCosts: number;
  startupCosts: number;
  profitBeforeTax: number;
  tax: number;
  netProfit: number;
  cumulativeCash: number;
}

export interface BusinessSetupProjection {
  years: BusinessSetupYearResult[];
  totalStartupCost: number;
  totalOngoingCostsBaseline: number;
  breakEvenYear: number | null;
  peakFundingNeeded: number;
}

function incomeForYear(stream: BusinessSetupIncomeStream, yearIndex: number): number {
  const base = Math.max(0, stream.amount);
  if (yearIndex === 0) return base;
  if (stream.growthMode === "toMax") {
    const max = Math.max(stream.maxAnnualAmount, base);
    const yearsToMax = Math.max(1, stream.yearsToMax);
    if (yearsToMax <= 1) return max;
    const t = Math.min(yearIndex, yearsToMax - 1) / (yearsToMax - 1);
    return base + (max - base) * t;
  }
  const rate = stream.growthRatePercent / 100;
  let amount = base * Math.pow(1 + rate, yearIndex);
  if (stream.maxAnnualAmount > 0) amount = Math.min(amount, stream.maxAnnualAmount);
  return amount;
}

export function projectBusinessSetup(setup: BusinessSetup): BusinessSetupProjection {
  const years = Math.min(10, Math.max(1, Math.round(setup.years)));
  const totalStartupCost = setup.startupCosts.reduce((sum, c) => sum + Math.max(0, c.amount), 0);
  const totalOngoingCostsBaseline = setup.ongoingCosts.reduce((sum, c) => sum + Math.max(0, c.amount), 0);

  let cumulativeCash = 0;
  let breakEvenYear: number | null = null;
  let peakFundingNeeded = 0;
  const result: BusinessSetupYearResult[] = [];

  for (let yi = 0; yi < years; yi += 1) {
    const incomeByStream = setup.incomeStreams
      .filter((s) => s.name.trim())
      .map((s) => ({ id: s.id, name: s.name, amount: Math.round(incomeForYear(s, yi) * 100) / 100 }));
    const revenue = incomeByStream.reduce((sum, s) => sum + s.amount, 0);

    let ongoingCosts = totalOngoingCostsBaseline;
    if (setup.expenseGrowth.mode === "rate") {
      ongoingCosts = totalOngoingCostsBaseline * Math.pow(1 + setup.expenseGrowth.ratePercent / 100, yi);
    } else if (setup.expenseGrowth.mode === "manual") {
      const override = setup.expenseGrowth.manualByYear[yi];
      ongoingCosts = Number.isFinite(override) ? Math.max(0, override) : totalOngoingCostsBaseline;
    }

    const startupCosts = yi === 0 ? totalStartupCost : 0;
    const profitBeforeTax = revenue - ongoingCosts - startupCosts;
    const tax = Math.max(0, profitBeforeTax * (setup.taxRatePercent / 100));
    const netProfit = profitBeforeTax - tax;
    cumulativeCash += netProfit;

    if (breakEvenYear === null && cumulativeCash >= 0) breakEvenYear = yi + 1;
    if (-cumulativeCash > peakFundingNeeded) peakFundingNeeded = -cumulativeCash;

    result.push({
      year: yi + 1,
      incomeByStream,
      revenue: Math.round(revenue),
      ongoingCosts: Math.round(ongoingCosts),
      startupCosts: Math.round(startupCosts),
      profitBeforeTax: Math.round(profitBeforeTax),
      tax: Math.round(tax),
      netProfit: Math.round(netProfit),
      cumulativeCash: Math.round(cumulativeCash),
    });
  }

  return {
    years: result,
    totalStartupCost: Math.round(totalStartupCost),
    totalOngoingCostsBaseline: Math.round(totalOngoingCostsBaseline),
    breakEvenYear,
    peakFundingNeeded: Math.round(peakFundingNeeded),
  };
}
