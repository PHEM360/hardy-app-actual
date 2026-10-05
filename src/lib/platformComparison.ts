/**
 * Platform comparison: what an account costs on each provider, and what the
 * same pot would be worth after N years. Illustrative, not advice.
 *
 * Provider charges below were read from each provider's own published charges
 * and are dated (see `checked`). Charges change, so every figure is editable
 * and the UI shows where each one came from.
 */

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export type PlatformAccountType = "cash_isa" | "cash_savings" | "stocks_isa" | "gia" | "pension" | "junior_isa";
export type PlatformAccountKind = "cash" | "invest";

export interface PlatformAccountTypeInfo {
  id: PlatformAccountType;
  label: string;
  kind: PlatformAccountKind;
  /** The document to upload so charges can be read from it. */
  document: string;
}

export const PLATFORM_ACCOUNT_TYPES: PlatformAccountTypeInfo[] = [
  {
    id: "stocks_isa",
    label: "Stocks and shares ISA",
    kind: "invest",
    document: "your annual costs and charges statement for the ISA (providers send one each year), or the provider's charges and rates page saved as a PDF",
  },
  {
    id: "pension",
    label: "Pension (SIPP)",
    kind: "invest",
    document: "your annual pension statement or costs and charges statement, or the pension key features document",
  },
  {
    id: "gia",
    label: "General investment account",
    kind: "invest",
    document: "your annual costs and charges statement for the account, or the provider's charges and rates page saved as a PDF",
  },
  {
    id: "junior_isa",
    label: "Junior ISA",
    kind: "invest",
    document: "the Junior ISA costs and charges statement, or the provider's charges and rates page saved as a PDF",
  },
  {
    id: "cash_isa",
    label: "Cash ISA",
    kind: "cash",
    document: "the account's summary box (the one page table every UK savings account must publish), or a recent statement showing the interest rate",
  },
  {
    id: "cash_savings",
    label: "Cash savings account",
    kind: "cash",
    document: "the account's summary box (the one page table every UK savings account must publish), or a recent statement showing the interest rate",
  },
];

export function accountTypeInfo(type: PlatformAccountType): PlatformAccountTypeInfo {
  return PLATFORM_ACCOUNT_TYPES.find((t) => t.id === type) ?? PLATFORM_ACCOUNT_TYPES[0];
}

export type PlatformFieldKey =
  | "platformFeePercent"
  | "platformFeeCapAnnual"
  | "smallPotThreshold"
  | "smallPotMonthly"
  | "fixedMonthly"
  | "fundFeePercent"
  | "adviceFeePercent"
  | "tradeFee"
  | "tradesPerYear"
  | "annualReturnPercent"
  | "interestRatePercent";

export interface PlatformFieldInfo {
  key: PlatformFieldKey;
  label: string;
  unit: "%" | "£" | "n";
  hint: string;
  kinds: PlatformAccountKind[];
  /** Blank means zero for the maths (a cap or a trade count nobody entered). */
  optional?: boolean;
}

export const PLATFORM_FIELDS: PlatformFieldInfo[] = [
  { key: "platformFeePercent", label: "Platform fee", unit: "%", hint: "Yearly charge as a % of what you hold.", kinds: ["invest"] },
  { key: "platformFeeCapAnnual", label: "Platform fee cap", unit: "£", hint: "Most the % fee can cost in a year. Blank if there is no cap.", kinds: ["invest"], optional: true },
  { key: "fixedMonthly", label: "Fixed monthly fee", unit: "£", hint: "A flat subscription or account fee, charged whatever you hold.", kinds: ["invest", "cash"], optional: true },
  { key: "smallPotThreshold", label: "Small pot limit", unit: "£", hint: "Below this balance a flat fee replaces the % fee. Blank if none.", kinds: ["invest"], optional: true },
  { key: "smallPotMonthly", label: "Small pot monthly fee", unit: "£", hint: "The flat fee charged below the small pot limit.", kinds: ["invest"], optional: true },
  { key: "fundFeePercent", label: "Fund costs", unit: "%", hint: "Ongoing charge (OCF) of the funds you hold, plus their transaction costs.", kinds: ["invest"] },
  { key: "adviceFeePercent", label: "Management or advice fee", unit: "%", hint: "Extra yearly % for a managed service or an adviser. Blank if none.", kinds: ["invest"], optional: true },
  { key: "tradeFee", label: "Fee per trade", unit: "£", hint: "Cost each time you buy or sell.", kinds: ["invest"], optional: true },
  { key: "tradesPerYear", label: "Trades per year", unit: "n", hint: "How many paid trades you expect to make. Regular monthly investing is often free.", kinds: ["invest"], optional: true },
  { key: "annualReturnPercent", label: "Yearly return before fees", unit: "%", hint: "Long run yearly growth of what you would hold here. Blank uses the shared growth figure.", kinds: ["invest"], optional: true },
  { key: "interestRatePercent", label: "Interest rate (AER)", unit: "%", hint: "The yearly interest rate, as AER.", kinds: ["cash"] },
];

export function fieldsForKind(kind: PlatformAccountKind): PlatformFieldInfo[] {
  return PLATFORM_FIELDS.filter((f) => f.kinds.includes(kind));
}

export type PlatformValueSource = "preset" | "user" | "ai" | "document";

export interface PlatformEntry {
  id: string;
  accountType: PlatformAccountType;
  providerId: string;
  providerName: string;
  planId: string;
  /** Own pot, used when the comparison is not on a shared pot. */
  balance: number;
  monthlyContribution: number;
  values: Partial<Record<PlatformFieldKey, number | null>>;
  sources: Partial<Record<PlatformFieldKey, PlatformValueSource>>;
  /** Where an AI or document figure came from, shown next to the field. */
  notes: Partial<Record<PlatformFieldKey, string>>;
}

export interface PlatformComparisonDoc {
  entries: PlatformEntry[];
  /** Compare every account on the same pot, so only the charges differ. */
  useSharedPot: boolean;
  sharedBalance: number;
  sharedMonthly: number;
  years: number;
  /** Yearly growth before fees, used for any investment account without its own figure. */
  assumedReturnPercent: number;
}

export interface PlatformPlan {
  id: string;
  label: string;
}

export interface PlatformProvider {
  id: string;
  name: string;
  /** Account types this provider's rules below cover. */
  accountTypes: PlatformAccountType[];
  plans: PlatformPlan[];
  sourceUrl: string;
  /** Month the charges were last read from the provider's site. */
  checked: string;
}

export const OTHER_PROVIDER_ID = "other";

export const PLATFORM_PROVIDERS: PlatformProvider[] = [
  {
    id: "interactive_investor",
    name: "interactive investor",
    accountTypes: ["stocks_isa", "pension", "gia", "junior_isa"],
    plans: [
      { id: "core", label: "Core, £5.99 a month" },
      { id: "plus", label: "Plus, £14.99 a month" },
      { id: "premium", label: "Premium, £39.99 a month" },
    ],
    sourceUrl: "https://www.ii.co.uk/our-charges",
    checked: "October 2026",
  },
  {
    id: "vanguard",
    name: "Vanguard",
    accountTypes: ["stocks_isa", "pension", "gia", "junior_isa"],
    plans: [
      { id: "self", label: "Self managed" },
      { id: "managed", label: "Managed" },
    ],
    sourceUrl: "https://www.vanguardinvestor.co.uk/what-we-offer/fees-explained",
    checked: "October 2026",
  },
  {
    id: "true_potential",
    name: "True Potential",
    accountTypes: ["stocks_isa", "pension", "gia", "junior_isa"],
    plans: [],
    sourceUrl: "https://www.tpinvestor.com",
    checked: "October 2026",
  },
];

export function providerInfo(id: string): PlatformProvider | undefined {
  return PLATFORM_PROVIDERS.find((p) => p.id === id);
}

/** interactive investor's Core plan only covers up to this much across your accounts. */
export const II_CORE_LIMIT = 100000;
/** Vanguard charges a flat monthly fee, not a %, below this total holding. */
export const VANGUARD_SMALL_POT_LIMIT = 32000;

export interface PlatformPreset {
  values: Partial<Record<PlatformFieldKey, number>>;
  /** Plain statements of the provider's rules, shown on the card. */
  rules: string[];
}

/**
 * The provider's published charges for one account type and plan. Returns
 * null when there are no known rules (another provider, or a cash account,
 * whose interest rate changes too often to hard code).
 */
export function platformPreset(providerId: string, accountType: PlatformAccountType, planId: string): PlatformPreset | null {
  if (accountTypeInfo(accountType).kind !== "invest") return null;

  if (providerId === "interactive_investor") {
    const plan = planId === "plus" || planId === "premium" ? planId : "core";
    const fixedMonthly = plan === "core" ? 5.99 : plan === "plus" ? 14.99 : 39.99;
    const tradeFee = plan === "premium" ? 2.99 : 3.99;
    const fundTrade = plan === "core" ? "£3.99" : plan === "plus" ? "£1.49" : "free";
    const rules = [
      `A flat £${fixedMonthly.toFixed(2)} a month with no % platform fee. One fee covers your ISA, Trading Account and SIPP together.`,
      `UK and US share trades cost £${tradeFee.toFixed(2)} each. Fund trades are ${fundTrade}. Regular monthly investing is free.`,
      "You choose your own funds, so fund costs depend on what you buy.",
    ];
    if (plan === "core") rules.push(`Core only covers up to £${II_CORE_LIMIT.toLocaleString("en-GB")} across your accounts. Above that you need Plus.`);
    if (accountType === "junior_isa" && plan === "core") rules.push("A Junior ISA is included with Plus and Premium, not Core.");
    return { values: { platformFeePercent: 0, fixedMonthly, tradeFee }, rules };
  }

  if (providerId === "vanguard") {
    if (planId === "managed") {
      return {
        values: { platformFeePercent: 0.15, platformFeeCapAnnual: 375, adviceFeePercent: 0.2, fundFeePercent: 0.17, tradeFee: 0 },
        rules: [
          "Account fee of 0.15% a year, capped at £375 a year, at any balance.",
          "The managed service adds a 0.20% a year management fee.",
          "Fund costs average 0.17% a year and depend on your portfolio.",
        ],
      };
    }
    return {
      values: { platformFeePercent: 0.15, platformFeeCapAnnual: 375, smallPotThreshold: VANGUARD_SMALL_POT_LIMIT, smallPotMonthly: 4, tradeFee: 0 },
      rules: [
        `Under £${VANGUARD_SMALL_POT_LIMIT.toLocaleString("en-GB")} in total with Vanguard: a flat £4 a month (£48 a year).`,
        `£${VANGUARD_SMALL_POT_LIMIT.toLocaleString("en-GB")} or more: 0.15% a year, capped at £375 a year.`,
        "Only Vanguard's own funds are available. Their costs run from 0.06% to 0.79% a year.",
        "No charge for buying or selling funds, or for transferring out.",
      ],
    };
  }

  if (providerId === "true_potential") {
    return {
      values: { platformFeePercent: 0.4, fundFeePercent: 0.76, tradeFee: 0 },
      rules: [
        "Platform fee of 0.40% a year, worked out daily and taken monthly.",
        "Portfolio costs are typically around 0.76% a year and vary by portfolio. Check the one you hold.",
        "If you invest through a True Potential adviser there is usually an advice fee on top.",
      ],
    };
  }

  return null;
}

/** Plan interactive investor would put this pot on. */
export function suggestedPlanId(providerId: string, balance: number): string {
  if (providerId === "interactive_investor") return balance > II_CORE_LIMIT ? "plus" : "core";
  if (providerId === "vanguard") return "self";
  return "";
}

export function newPlatformEntry(accountType: PlatformAccountType, providerId: string, providerName: string, planId = ""): PlatformEntry {
  const entry: PlatformEntry = {
    id: uid(),
    accountType,
    providerId,
    providerName,
    planId,
    balance: 0,
    monthlyContribution: 0,
    values: {},
    sources: {},
    notes: {},
  };
  return applyPreset(entry);
}

/**
 * Loads the provider's published charges into an entry. Figures the user,
 * a document or AI supplied are kept; only blank or earlier preset figures
 * are replaced, so changing plan never wipes someone's own numbers.
 */
export function applyPreset(entry: PlatformEntry): PlatformEntry {
  const preset = platformPreset(entry.providerId, entry.accountType, entry.planId);
  const values = { ...entry.values };
  const sources = { ...entry.sources };
  for (const key of Object.keys(sources) as PlatformFieldKey[]) {
    if (sources[key] === "preset") {
      delete values[key];
      delete sources[key];
    }
  }
  if (preset) {
    for (const [key, value] of Object.entries(preset.values) as [PlatformFieldKey, number][]) {
      if (sources[key] && sources[key] !== "preset") continue;
      values[key] = value;
      sources[key] = "preset";
    }
  }
  return { ...entry, values, sources };
}

export function defaultPlatformComparison(): PlatformComparisonDoc {
  return { entries: [], useSharedPot: true, sharedBalance: 20000, sharedMonthly: 0, years: 10, assumedReturnPercent: 5 };
}

/** Defensive loader for Firestore data. */
export function mergePlatformComparison(raw: unknown): PlatformComparisonDoc {
  const base = defaultPlatformComparison();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<PlatformComparisonDoc>;
  const num = (v: unknown, fallback: number) => (Number.isFinite(Number(v)) && v !== null && v !== "" ? Number(v) : fallback);
  const fieldKeys = new Set(PLATFORM_FIELDS.map((f) => f.key));
  const entries: PlatformEntry[] = Array.isArray(r.entries)
    ? r.entries
        .map((item) => {
          const it = item as Partial<PlatformEntry>;
          if (!PLATFORM_ACCOUNT_TYPES.some((t) => t.id === it?.accountType)) return null;
          const values: PlatformEntry["values"] = {};
          const sources: PlatformEntry["sources"] = {};
          const notes: PlatformEntry["notes"] = {};
          for (const [key, value] of Object.entries(it.values ?? {})) {
            if (!fieldKeys.has(key as PlatformFieldKey) || value === null || !Number.isFinite(Number(value))) continue;
            values[key as PlatformFieldKey] = Number(value);
            const source = (it.sources ?? {})[key as PlatformFieldKey];
            sources[key as PlatformFieldKey] = source === "preset" || source === "ai" || source === "document" ? source : "user";
            const note = (it.notes ?? {})[key as PlatformFieldKey];
            if (note) notes[key as PlatformFieldKey] = String(note).slice(0, 300);
          }
          return {
            id: String(it.id || uid()),
            accountType: it.accountType as PlatformAccountType,
            providerId: String(it.providerId || OTHER_PROVIDER_ID),
            providerName: String(it.providerName || "Provider"),
            planId: String(it.planId || ""),
            balance: Math.max(0, num(it.balance, 0)),
            monthlyContribution: Math.max(0, num(it.monthlyContribution, 0)),
            values,
            sources,
            notes,
          } satisfies PlatformEntry;
        })
        .filter((x): x is PlatformEntry => x !== null)
    : [];
  return {
    entries,
    useSharedPot: r.useSharedPot !== false,
    sharedBalance: Math.max(0, num(r.sharedBalance, base.sharedBalance)),
    sharedMonthly: Math.max(0, num(r.sharedMonthly, base.sharedMonthly)),
    years: Math.min(40, Math.max(1, Math.round(num(r.years, base.years)))),
    assumedReturnPercent: num(r.assumedReturnPercent, base.assumedReturnPercent),
  };
}

function value(entry: PlatformEntry, key: PlatformFieldKey): number {
  const v = entry.values[key];
  return v === null || v === undefined || !Number.isFinite(v) ? 0 : v;
}

/** Required figures the entry still lacks. The comparison cannot be trusted until these are filled. */
export function missingRequiredFields(entry: PlatformEntry): PlatformFieldInfo[] {
  return fieldsForKind(accountTypeInfo(entry.accountType).kind).filter((f) => {
    if (f.optional) return false;
    const v = entry.values[f.key];
    return v === null || v === undefined;
  });
}

/**
 * The blank figures worth looking up: what "fill the gaps with AI" asks for.
 * Where the provider's published rules are built in, an empty fee box means
 * "this provider has no such charge", so only the figures that depend on the
 * person's own holdings (fund costs, returns) count as gaps.
 */
export function blankFields(entry: PlatformEntry): PlatformFieldInfo[] {
  const kind = accountTypeInfo(entry.accountType).kind;
  const rulesKnown = platformPreset(entry.providerId, entry.accountType, entry.planId) !== null;
  return fieldsForKind(kind).filter((f) => {
    const v = entry.values[f.key];
    if (v !== null && v !== undefined) return false;
    // How often someone trades is their own choice, not something to look up.
    if (f.key === "tradesPerYear") return false;
    if (!f.optional || f.key === "annualReturnPercent") return true;
    return kind === "invest" && !rulesKnown;
  });
}

/**
 * The platform's own charge for a year at a given balance: any fixed monthly
 * fee, plus either the small pot flat fee or the % fee (up to its cap).
 */
export function annualPlatformFee(entry: PlatformEntry, balance: number): number {
  const fixed = value(entry, "fixedMonthly") * 12;
  const threshold = value(entry, "smallPotThreshold");
  if (threshold > 0 && balance < threshold) return fixed + value(entry, "smallPotMonthly") * 12;
  const cap = value(entry, "platformFeeCapAnnual");
  const percentFee = (balance * value(entry, "platformFeePercent")) / 100;
  return fixed + (cap > 0 ? Math.min(cap, percentFee) : percentFee);
}

export interface PlatformCostBreakdown {
  platform: number;
  funds: number;
  advice: number;
  trading: number;
  total: number;
}

export function annualCosts(entry: PlatformEntry, balance: number): PlatformCostBreakdown {
  if (accountTypeInfo(entry.accountType).kind === "cash") {
    const platform = value(entry, "fixedMonthly") * 12;
    return { platform, funds: 0, advice: 0, trading: 0, total: platform };
  }
  const platform = annualPlatformFee(entry, balance);
  const funds = (balance * value(entry, "fundFeePercent")) / 100;
  const advice = (balance * value(entry, "adviceFeePercent")) / 100;
  const trading = value(entry, "tradeFee") * value(entry, "tradesPerYear");
  return { platform, funds, advice, trading, total: platform + funds + advice + trading };
}

export interface PlatformResult {
  entryId: string;
  kind: PlatformAccountKind;
  balance: number;
  monthly: number;
  /** Growth or interest rate used, before fees. */
  ratePercent: number;
  /** true when the shared growth figure was used because the entry has none. */
  usedAssumedReturn: boolean;
  firstYear: PlatformCostBreakdown;
  /** First year cost as a % of the starting pot (null with an empty pot). */
  firstYearPercent: number | null;
  finalValue: number;
  totalPaidIn: number;
  totalFees: number;
  /** How much less the pot is worth than the same pot with no charges at all. */
  lostToFees: number;
  missing: PlatformFieldInfo[];
}

/**
 * Month by month projection. Each month: pay in, grow, then take one twelfth
 * of the year's charges worked out on the balance at that point, so tiered
 * and capped fees follow the pot as it grows.
 */
export function projectPlatformEntry(entry: PlatformEntry, doc: PlatformComparisonDoc): PlatformResult {
  const kind = accountTypeInfo(entry.accountType).kind;
  const balance = doc.useSharedPot ? doc.sharedBalance : entry.balance;
  const monthly = doc.useSharedPot ? doc.sharedMonthly : entry.monthlyContribution;
  const ownReturn = entry.values.annualReturnPercent;
  const usedAssumedReturn = kind === "invest" && (ownReturn === null || ownReturn === undefined);
  const ratePercent = kind === "cash" ? value(entry, "interestRatePercent") : usedAssumedReturn ? doc.assumedReturnPercent : (ownReturn as number);
  const monthlyGrowth = Math.pow(1 + ratePercent / 100, 1 / 12);
  const months = Math.max(1, Math.round(doc.years)) * 12;

  let pot = balance;
  let potNoFees = balance;
  let totalFees = 0;
  for (let m = 0; m < months; m += 1) {
    pot = (pot + monthly) * monthlyGrowth;
    potNoFees = (potNoFees + monthly) * monthlyGrowth;
    const fee = Math.min(Math.max(0, pot), annualCosts(entry, pot).total / 12);
    pot -= fee;
    totalFees += fee;
  }

  const firstYear = annualCosts(entry, balance);
  return {
    entryId: entry.id,
    kind,
    balance,
    monthly,
    ratePercent,
    usedAssumedReturn,
    firstYear,
    firstYearPercent: balance > 0 ? Math.round((firstYear.total / balance) * 10000) / 100 : null,
    finalValue: Math.round(pot),
    totalPaidIn: Math.round(balance + monthly * months),
    totalFees: Math.round(totalFees),
    lostToFees: Math.round(potNoFees - pot),
    missing: missingRequiredFields(entry),
  };
}

/** Results for every entry, best final value first. Entries with gaps go last. */
export function comparePlatforms(doc: PlatformComparisonDoc): PlatformResult[] {
  return doc.entries
    .map((entry) => projectPlatformEntry(entry, doc))
    .sort((a, b) => {
      if ((a.missing.length > 0) !== (b.missing.length > 0)) return a.missing.length > 0 ? 1 : -1;
      return b.finalValue - a.finalValue;
    });
}
