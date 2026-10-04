/** Business setup / new-venture modeller: start-up costs, ongoing costs, income streams with
 * growth assumptions, and a year-by-year profit/cashflow projection. Illustrative, not advice. */

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export type BusinessSetupPeriod = "monthly" | "yearly";
export type BusinessSetupIncomeGrowthMode = "rate" | "toMax" | "manual";
export type BusinessSetupExpenseGrowthMode = "flat" | "rate" | "manual";

export interface BusinessSetupCostItem {
  id: string;
  name: string;
  amount: number;
  /**
   * Ongoing costs only: this cost's own yearly growth %. null means "follow
   * the plan wide setting" (flat, or the plan's growth rate).
   */
  growthPercent?: number | null;
}

export interface BusinessSetupStaffRole {
  id: string;
  title: string;
  /** Gross salary per person per year, before employer on-costs. */
  annualSalary: number;
  headcount: number;
  /** Hiring date: plan year (1 based) and calendar month within it (1 to 12). */
  startYear: number;
  startMonth: number;
}

export interface BusinessSetupVat {
  registered: boolean;
  ratePercent: number;
  /**
   * true: income figures are takings with VAT inside them (selling to the
   * public), so VAT comes out of sales. false: VAT is added on top (selling
   * to businesses), so it passes straight through and profit is unaffected.
   */
  pricesIncludeVat: boolean;
  /** Share of start-up and running costs that carry VAT the business can claim back. */
  reclaimCostsPercent: number;
}

/** UK VAT registration threshold (taxable turnover in 12 months), from April 2024. */
export const VAT_REGISTRATION_THRESHOLD = 90000;

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
  /**
   * Annual income typed in year by year, index 0 = year 1 — used when
   * growthMode === "manual". A blank year (null) carries the previous year's
   * figure forward, so "year 1 = 10k, year 3 = 30k" reads 10k, 10k, 30k, 30k…
   */
  manualByYear: (number | null)[];
  /** First year this stream earns anything (1 = from the start). Ignored in manual mode. */
  startYear: number;
}

export interface BusinessSetupFunding {
  /** Cash the owners put in at the start. Not income, not taxed, not repaid. */
  ownerInvestment: number;
  /** Borrowed at the start, repaid in equal yearly payments over loanTermYears. */
  loanAmount: number;
  loanInterestPercent: number;
  loanTermYears: number;
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
  /** Variable costs that scale with sales (stock, materials, card fees), as a % of revenue. */
  costOfSalesPercent: number;
  funding: BusinessSetupFunding;
  staff: BusinessSetupStaffRole[];
  /** Employer costs on top of salary (employer NI, pension), as a % of salary. */
  staffOnCostPercent: number;
  /** Pay rise applied each plan year after the first. */
  staffPayRisePercent: number;
  vat: BusinessSetupVat;
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
    manualByYear: [],
    startYear: 1,
  };
}

export function newStaffRole(title = ""): BusinessSetupStaffRole {
  return { id: uid(), title, annualSalary: 0, headcount: 1, startYear: 1, startMonth: 1 };
}

export function defaultVat(): BusinessSetupVat {
  return { registered: false, ratePercent: 20, pricesIncludeVat: true, reclaimCostsPercent: 50 };
}

export function defaultFunding(): BusinessSetupFunding {
  return { ownerInvestment: 0, loanAmount: 0, loanInterestPercent: 8, loanTermYears: 5 };
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
    costOfSalesPercent: 0,
    funding: defaultFunding(),
    staff: [],
    staffOnCostPercent: 18,
    staffPayRisePercent: 3,
    vat: defaultVat(),
    aiCritique: null,
  };
}

/** Defensive loader for Firestore data — never trust a doc shape blindly. */
export function mergeBusinessSetup(raw: Partial<BusinessSetup> | undefined): BusinessSetup {
  const base = defaultBusinessSetup(raw?.name ? String(raw.name) : "");
  const num = (v: unknown, fallback: number) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
  const costItems = (v: unknown, withGrowth = false): BusinessSetupCostItem[] =>
    Array.isArray(v)
      ? v
          .map((item) => {
            const it = item as Partial<BusinessSetupCostItem>;
            const name = String(it?.name ?? "").trim();
            // Only drop rows that are completely empty: an unnamed cost with
            // an amount still counts in the projection, so it must survive a reload.
            if (!name && !num(it?.amount, 0)) return null;
            const row: BusinessSetupCostItem = { id: String(it?.id || uid()), name, amount: num(it?.amount, 0) };
            if (withGrowth) {
              const g = it?.growthPercent;
              row.growthPercent = g === null || g === undefined || !Number.isFinite(Number(g)) ? null : Number(g);
            }
            return row;
          })
          .filter((x): x is BusinessSetupCostItem => x !== null)
      : [];

  const incomeStreams: BusinessSetupIncomeStream[] = Array.isArray(raw?.incomeStreams)
    ? raw!.incomeStreams
        .map((item) => {
          const it = item as Partial<BusinessSetupIncomeStream>;
          const name = String(it?.name ?? "").trim();
          const manualByYear = Array.isArray(it?.manualByYear)
            ? it!.manualByYear.map((n) => (n === null || n === undefined || !Number.isFinite(Number(n)) ? null : Number(n)))
            : [];
          if (!name && !num(it?.amount, 0) && !manualByYear.some((n) => n)) return null;
          return {
            id: String(it?.id || uid()),
            name,
            amount: num(it?.amount, 0),
            period: it?.period === "monthly" ? "monthly" : "yearly",
            growthMode: it?.growthMode === "toMax" || it?.growthMode === "manual" ? it.growthMode : "rate",
            growthRatePercent: num(it?.growthRatePercent, 10),
            maxAnnualAmount: num(it?.maxAnnualAmount, 0),
            yearsToMax: Math.max(1, num(it?.yearsToMax, 3)),
            manualByYear,
            startYear: Math.min(10, Math.max(1, Math.round(num(it?.startYear, 1)))),
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
    ongoingCosts: costItems(raw?.ongoingCosts, true),
    incomeStreams,
    expenseGrowth,
    costOfSalesPercent: Math.min(100, Math.max(0, num(raw?.costOfSalesPercent, 0))),
    funding: {
      ownerInvestment: Math.max(0, num(raw?.funding?.ownerInvestment, 0)),
      loanAmount: Math.max(0, num(raw?.funding?.loanAmount, 0)),
      loanInterestPercent: Math.max(0, num(raw?.funding?.loanInterestPercent, 8)),
      loanTermYears: Math.min(30, Math.max(1, Math.round(num(raw?.funding?.loanTermYears, 5)))),
    },
    staff: Array.isArray(raw?.staff)
      ? raw!.staff
          .map((item) => {
            const it = item as Partial<BusinessSetupStaffRole>;
            const title = String(it?.title ?? "").trim();
            if (!title && !num(it?.annualSalary, 0)) return null;
            return {
              id: String(it?.id || uid()),
              title,
              annualSalary: Math.max(0, num(it?.annualSalary, 0)),
              headcount: Math.max(0, num(it?.headcount, 1)),
              startYear: Math.min(10, Math.max(1, Math.round(num(it?.startYear, 1)))),
              startMonth: Math.min(12, Math.max(1, Math.round(num(it?.startMonth, 1)))),
            } satisfies BusinessSetupStaffRole;
          })
          .filter((x): x is BusinessSetupStaffRole => x !== null)
      : [],
    staffOnCostPercent: Math.max(0, num(raw?.staffOnCostPercent, 18)),
    staffPayRisePercent: num(raw?.staffPayRisePercent, 3),
    vat: {
      registered: raw?.vat?.registered === true,
      ratePercent: Math.max(0, num(raw?.vat?.ratePercent, 20)),
      pricesIncludeVat: raw?.vat?.pricesIncludeVat !== false,
      reclaimCostsPercent: Math.min(100, Math.max(0, num(raw?.vat?.reclaimCostsPercent, 50))),
    },
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
  /** Sales before any VAT is taken out. Equals revenue unless prices include VAT. */
  grossTakings: number;
  /** VAT inside the takings, owed to HMRC. Already excluded from revenue. */
  vatOnSales: number;
  /** VAT on costs claimed back. Already taken off the costs below. */
  vatReclaimed: number;
  /** Not registered, but sales this year pass the registration threshold. */
  vatThresholdExceeded: boolean;
  /** Salaries plus employer on-costs, pro rata from each hiring date. */
  staffCosts: number;
  /** Variable costs: revenue x costOfSalesPercent. */
  costOfSales: number;
  /** revenue - costOfSales. */
  grossProfit: number;
  ongoingCosts: number;
  startupCosts: number;
  loanInterest: number;
  /** Capital repaid on the loan this year. Reduces cash, not profit. */
  loanRepayment: number;
  loanBalance: number;
  profitBeforeTax: number;
  tax: number;
  netProfit: number;
  /** Cash in the bank at year end: funding in, plus profits, less loan capital repaid. */
  cumulativeCash: number;
}

export interface BusinessSetupProjection {
  years: BusinessSetupYearResult[];
  totalStartupCost: number;
  totalOngoingCostsBaseline: number;
  /** First year the plan has earned back everything it has spent (funding excluded). */
  breakEvenYear: number | null;
  /** Deepest the bank balance goes below zero: extra money still to find. */
  peakFundingNeeded: number;
  totalFunding: number;
  totalRevenue: number;
  totalNetProfit: number;
  /** Gross profit as a % of revenue across the whole plan (null with no revenue). */
  grossMarginPercent: number | null;
  /** Total net profit as a % of money put in (start-up cost or funding, whichever is larger). */
  returnOnInvestmentPercent: number | null;
}

/** Annual income for one stream. Exported so the editor can preview each year. */
export function incomeForYear(stream: BusinessSetupIncomeStream, yearIndex: number): number {
  if (stream.growthMode === "manual") {
    // Latest year at or before this one that has a figure; year 1 falls back
    // to the stream's baseline amount.
    for (let i = Math.min(yearIndex, stream.manualByYear.length - 1); i >= 0; i -= 1) {
      const value = stream.manualByYear[i];
      if (value !== null && value !== undefined && Number.isFinite(value)) return Math.max(0, value);
    }
    return Math.max(0, stream.amount);
  }
  // Streams can switch on later: growth counts from the year they start.
  const activeIndex = yearIndex - (Math.max(1, Math.round(stream.startYear || 1)) - 1);
  if (activeIndex < 0) return 0;
  const base = Math.max(0, stream.amount);
  if (activeIndex === 0) return base;
  if (stream.growthMode === "toMax") {
    const max = Math.max(stream.maxAnnualAmount, base);
    const yearsToMax = Math.max(1, stream.yearsToMax);
    if (yearsToMax <= 1) return max;
    const t = Math.min(activeIndex, yearsToMax - 1) / (yearsToMax - 1);
    return base + (max - base) * t;
  }
  const rate = stream.growthRatePercent / 100;
  let amount = base * Math.pow(1 + rate, activeIndex);
  if (stream.maxAnnualAmount > 0) amount = Math.min(amount, stream.maxAnnualAmount);
  return amount;
}

/** Equal yearly payment that clears `principal` over `years` at `ratePercent`. */
function loanAnnualPayment(principal: number, ratePercent: number, years: number): number {
  if (principal <= 0) return 0;
  const r = ratePercent / 100;
  if (r <= 0) return principal / years;
  return (principal * r) / (1 - Math.pow(1 + r, -years));
}

/** Running costs (not staff) for a plan year, after VAT is ignored. */
function ongoingCostsForYear(setup: BusinessSetup, yearIndex: number): number {
  const baseline = setup.ongoingCosts.reduce((sum, c) => sum + Math.max(0, c.amount), 0);
  if (setup.expenseGrowth.mode === "manual") {
    // A typed in yearly total overrides everything, including per cost growth.
    const override = setup.expenseGrowth.manualByYear[yearIndex];
    return Number.isFinite(override) ? Math.max(0, override) : baseline;
  }
  const planRate = setup.expenseGrowth.mode === "rate" ? setup.expenseGrowth.ratePercent : 0;
  return setup.ongoingCosts.reduce((sum, c) => {
    const own = c.growthPercent;
    const rate = own === null || own === undefined || !Number.isFinite(own) ? planRate : own;
    return sum + Math.max(0, c.amount) * Math.pow(1 + rate / 100, yearIndex);
  }, 0);
}

/**
 * Staff cost for one calendar month of the plan (monthIndex 0 = month 1 of
 * year 1). A role costs nothing before its hiring month; pay rises apply at
 * the start of each plan year after the first.
 */
export function staffCostForMonth(setup: BusinessSetup, monthIndex: number): number {
  const yearIndex = Math.floor(monthIndex / 12);
  const onCost = 1 + Math.max(0, setup.staffOnCostPercent || 0) / 100;
  const rise = Math.pow(1 + (setup.staffPayRisePercent || 0) / 100, yearIndex);
  return (setup.staff ?? []).reduce((sum, role) => {
    const hiredAt = (Math.max(1, role.startYear) - 1) * 12 + (Math.max(1, role.startMonth) - 1);
    if (monthIndex < hiredAt) return sum;
    return sum + (Math.max(0, role.annualSalary) / 12) * Math.max(0, role.headcount) * onCost * rise;
  }, 0);
}

function staffCostForYear(setup: BusinessSetup, yearIndex: number): number {
  let total = 0;
  for (let m = 0; m < 12; m += 1) total += staffCostForMonth(setup, yearIndex * 12 + m);
  return total;
}

/** Splits a year's sales and costs for VAT. All zero effect when not registered. */
function vatForYear(setup: BusinessSetup, takings: number, vatableCosts: number) {
  const vat = setup.vat ?? defaultVat();
  if (!vat.registered) return { revenue: takings, vatOnSales: 0, vatReclaimed: 0 };
  const fraction = vat.ratePercent / (100 + vat.ratePercent);
  const vatOnSales = vat.pricesIncludeVat ? takings * fraction : 0;
  const vatReclaimed = vatableCosts * (Math.min(100, Math.max(0, vat.reclaimCostsPercent)) / 100) * fraction;
  return { revenue: takings - vatOnSales, vatOnSales, vatReclaimed };
}

export function projectBusinessSetup(setup: BusinessSetup): BusinessSetupProjection {
  const years = Math.min(10, Math.max(1, Math.round(setup.years)));
  const totalStartupCost = setup.startupCosts.reduce((sum, c) => sum + Math.max(0, c.amount), 0);
  const totalOngoingCostsBaseline = setup.ongoingCosts.reduce((sum, c) => sum + Math.max(0, c.amount), 0);
  const costOfSalesRate = Math.min(100, Math.max(0, setup.costOfSalesPercent || 0)) / 100;
  const funding = setup.funding ?? defaultFunding();
  const ownerInvestment = Math.max(0, funding.ownerInvestment || 0);
  const loanAmount = Math.max(0, funding.loanAmount || 0);
  const loanTerm = Math.max(1, Math.round(funding.loanTermYears || 1));
  const loanPayment = loanAnnualPayment(loanAmount, funding.loanInterestPercent || 0, loanTerm);
  const totalFunding = ownerInvestment + loanAmount;

  let cumulativeCash = totalFunding;
  let cumulativeProfit = 0;
  let lossesBroughtForward = 0;
  let loanBalance = loanAmount;
  let breakEvenYear: number | null = null;
  let peakFundingNeeded = 0;
  let totalRevenue = 0;
  let totalGrossProfit = 0;
  const result: BusinessSetupYearResult[] = [];

  for (let yi = 0; yi < years; yi += 1) {
    // Every stream counts, named or not: a new stream has a blank name until
    // the user types one, and silently ignoring it made edits look like no-ops.
    const incomeByStream = setup.incomeStreams.map((s, index) => ({
      id: s.id,
      name: s.name.trim() || `Income stream ${index + 1}`,
      amount: Math.round(incomeForYear(s, yi) * 100) / 100,
    }));
    const grossTakings = incomeByStream.reduce((sum, s) => sum + s.amount, 0);
    const ongoingEntered = ongoingCostsForYear(setup, yi);
    const startupEntered = yi === 0 ? totalStartupCost : 0;
    // Registered: VAT inside the takings is not the business's money, and VAT
    // on costs comes back, so both are stripped out before profit is worked out.
    const vat = vatForYear(setup, grossTakings, ongoingEntered + startupEntered);
    const revenue = vat.revenue;
    const vatableTotal = ongoingEntered + startupEntered;
    const reclaimShare = vatableTotal > 0 ? vat.vatReclaimed / vatableTotal : 0;
    const ongoingCosts = ongoingEntered * (1 - reclaimShare);
    const startupCosts = startupEntered * (1 - reclaimShare);
    const staffCosts = staffCostForYear(setup, yi);
    const costOfSales = revenue * costOfSalesRate;
    const grossProfit = revenue - costOfSales;

    const loanInterest = loanBalance > 0 ? loanBalance * ((funding.loanInterestPercent || 0) / 100) : 0;
    const loanRepayment = loanBalance > 0 ? Math.min(loanBalance, Math.max(0, loanPayment - loanInterest)) : 0;
    loanBalance = Math.max(0, loanBalance - loanRepayment);

    const profitBeforeTax = grossProfit - ongoingCosts - staffCosts - startupCosts - loanInterest;
    // Losses carry forward and are used up before any tax is due, as UK
    // corporation tax allows. Without this a plan pays tax on its first
    // profitable year even while still recovering earlier losses.
    let tax = 0;
    if (profitBeforeTax < 0) {
      lossesBroughtForward += -profitBeforeTax;
    } else {
      const taxable = Math.max(0, profitBeforeTax - lossesBroughtForward);
      lossesBroughtForward = Math.max(0, lossesBroughtForward - profitBeforeTax);
      tax = taxable * (setup.taxRatePercent / 100);
    }
    const netProfit = profitBeforeTax - tax;
    cumulativeProfit += netProfit;
    cumulativeCash += netProfit - loanRepayment;
    totalRevenue += revenue;
    totalGrossProfit += grossProfit;

    // An empty plan sits at exactly zero, which is not "breaking even".
    if (breakEvenYear === null && cumulativeProfit >= 0 && totalRevenue > 0) breakEvenYear = yi + 1;
    if (-cumulativeCash > peakFundingNeeded) peakFundingNeeded = -cumulativeCash;

    result.push({
      year: yi + 1,
      incomeByStream,
      revenue: Math.round(revenue),
      grossTakings: Math.round(grossTakings),
      vatOnSales: Math.round(vat.vatOnSales),
      vatReclaimed: Math.round(vat.vatReclaimed),
      vatThresholdExceeded: !(setup.vat?.registered) && grossTakings > VAT_REGISTRATION_THRESHOLD,
      staffCosts: Math.round(staffCosts),
      costOfSales: Math.round(costOfSales),
      grossProfit: Math.round(grossProfit),
      ongoingCosts: Math.round(ongoingCosts),
      startupCosts: Math.round(startupCosts),
      loanInterest: Math.round(loanInterest),
      loanRepayment: Math.round(loanRepayment),
      loanBalance: Math.round(loanBalance),
      profitBeforeTax: Math.round(profitBeforeTax),
      tax: Math.round(tax),
      netProfit: Math.round(netProfit),
      cumulativeCash: Math.round(cumulativeCash),
    });
  }

  const moneyIn = Math.max(totalStartupCost, totalFunding);
  return {
    years: result,
    totalStartupCost: Math.round(totalStartupCost),
    totalOngoingCostsBaseline: Math.round(totalOngoingCostsBaseline),
    breakEvenYear,
    peakFundingNeeded: Math.round(peakFundingNeeded),
    totalFunding: Math.round(totalFunding),
    totalRevenue: Math.round(totalRevenue),
    totalNetProfit: Math.round(cumulativeProfit),
    grossMarginPercent: totalRevenue > 0 ? Math.round((totalGrossProfit / totalRevenue) * 1000) / 10 : null,
    returnOnInvestmentPercent: moneyIn > 0 ? Math.round((cumulativeProfit / moneyIn) * 1000) / 10 : null,
  };
}

export interface BusinessSetupMonthResult {
  /** 1 to 12. */
  month: number;
  moneyIn: number;
  moneyOut: number;
  /** Bank balance at the end of the month. */
  balance: number;
}

export interface BusinessSetupCashFlow {
  months: BusinessSetupMonthResult[];
  openingBalance: number;
  lowestBalance: number;
  lowestMonth: number;
}

/**
 * Month by month bank balance for year one. Sales, cost of sales and running
 * costs are spread evenly across the year; start-up costs and funding land in
 * month 1; staff are paid from their hiring month; the loan is paid monthly.
 * Corporation tax is left out because it falls due after the year has ended.
 */
export function monthlyCashFlowYearOne(setup: BusinessSetup): BusinessSetupCashFlow {
  const year = projectBusinessSetup({ ...setup, years: 1 }).years[0];
  const funding = setup.funding ?? defaultFunding();
  const openingBalance = Math.max(0, funding.ownerInvestment || 0) + Math.max(0, funding.loanAmount || 0);
  const loanMonthly = (year.loanInterest + year.loanRepayment) / 12;
  let balance = openingBalance;
  let lowestBalance = openingBalance;
  let lowestMonth = 1;
  const months: BusinessSetupMonthResult[] = [];
  for (let m = 0; m < 12; m += 1) {
    const moneyIn = year.revenue / 12;
    const moneyOut =
      year.costOfSales / 12 + year.ongoingCosts / 12 + staffCostForMonth(setup, m) + loanMonthly + (m === 0 ? year.startupCosts : 0);
    balance += moneyIn - moneyOut;
    if (balance < lowestBalance) {
      lowestBalance = balance;
      lowestMonth = m + 1;
    }
    months.push({ month: m + 1, moneyIn: Math.round(moneyIn), moneyOut: Math.round(moneyOut), balance: Math.round(balance) });
  }
  return { months, openingBalance: Math.round(openingBalance), lowestBalance: Math.round(lowestBalance), lowestMonth };
}
