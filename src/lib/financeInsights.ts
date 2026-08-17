import type { Account, AssetClass, BalanceEntry, FundAllocation } from "@/hooks/useFinance";
import { computeHistoricalGrowthRate } from "@/lib/financeProjection";

export const ASSET_CLASS_LABELS: Record<AssetClass | "unallocated", string> = {
  equity: "Equities",
  bond: "Bonds",
  cash: "Cash",
  property: "Property",
  other: "Other",
  unallocated: "Not allocated",
};

export const ASSET_CLASS_COLORS: Record<AssetClass | "unallocated", string> = {
  equity: "#3d5a80",
  bond: "#c8961e",
  cash: "#3c6e47",
  property: "#5c4a7d",
  other: "#8a4a5c",
  unallocated: "#7a7a74",
};

export type AccountKind =
  | "current"
  | "savings"
  | "cash_isa"
  | "ss_isa"
  | "lisa"
  | "gia"
  | "pension"
  | "investment"
  | "other";

export interface PeriodDelta {
  from: number | null;
  to: number | null;
  change: number | null;
  changePct: number | null;
}

export interface AccountInsight {
  account: Account;
  kind: AccountKind;
  latest: number;
  latestDate: string | null;
  openedOn: string | null;
  starting: number | null;
  opened: PeriodDelta;
  month: PeriodDelta;
  taxYear: PeriodDelta;
  high: number | null;
  low: number | null;
  years: number | null;
  cagrPct: number | null;
  estimatedContributions: number | null;
  estimatedGrowth: number | null;
  estimatedFees: number | null;
  annualFee: number | null;
  feePct: number | null;
  ocfPct: number | null;
  annualFeeGbp: number | null;
  combinedFeePct: number | null;
  allocations: FundAllocation[];
  allocationSource: "manual" | "cash" | "none";
}

export interface MixSlice {
  key: string;
  label: string;
  amount: number;
  pct: number;
  accountIds: string[];
}

export interface FinanceInsights {
  accounts: AccountInsight[];
  portfolio: {
    latest: number;
    month: PeriodDelta;
    taxYear: PeriodDelta;
    opened: PeriodDelta;
  };
  isaSplit: MixSlice[];
  isaMix: MixSlice[];
  liquidity: MixSlice[];
  typeMix: MixSlice[];
  allocation: MixSlice[];
  movers: AccountInsight[];
  totalAnnualFees: number | null;
  accountsMissingFees: number;
  accountsMissingAllocations: number;
}

export function classifyAccount(acc: Account): AccountKind {
  const t = acc.type.trim().toLowerCase();
  const n = acc.name.trim().toLowerCase();
  if (t === "lisa" || n.includes("lisa")) return "lisa";
  if (t === "cash isa" || (t.includes("cash") && t.includes("isa")) || (n.includes("cash") && n.includes("isa"))) return "cash_isa";
  const isIsa = t === "isa" || /\bisa\b/.test(n);
  if (isIsa) {
    if (t === "cash" || /\bcash\b/.test(n)) return "cash_isa";
    return "ss_isa";
  }
  if (t === "gia" || n.includes("gia") || n.includes("general investment")) return "gia";
  if (t === "pension" || n.includes("pension") || n.includes("sipp")) return "pension";
  if (t === "investment" || n.includes("investment")) return "investment";
  if (t === "current" || n.includes("current")) return "current";
  if (t === "savings" || n.includes("savings") || t === "cash") return "savings";
  return "other";
}

export function isIsaKind(kind: AccountKind) {
  return kind === "cash_isa" || kind === "ss_isa" || kind === "lisa";
}

export function isLiquidKind(kind: AccountKind) {
  return kind === "current" || kind === "savings" || kind === "cash_isa";
}

export function kindLabel(kind: AccountKind) {
  switch (kind) {
    case "current":
      return "Current";
    case "savings":
      return "Savings";
    case "cash_isa":
      return "Cash ISA";
    case "ss_isa":
      return "Stocks & shares ISA";
    case "lisa":
      return "LISA";
    case "gia":
      return "GIA";
    case "pension":
      return "Pension";
    case "investment":
      return "Investment";
    default:
      return "Other";
  }
}

function isoToday() {
  return new Date().toISOString().split("T")[0];
}

function addMonthsIso(iso: string, months: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + months, d));
  return date.toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function currentTaxYearStart(iso = isoToday()) {
  const [y, m, d] = iso.split("-").map(Number);
  const startYear = m > 4 || (m === 4 && d >= 6) ? y : y - 1;
  return `${startYear}-04-06`;
}

function latestOnOrBefore(sorted: BalanceEntry[], date: string) {
  let result: BalanceEntry | undefined;
  for (const entry of sorted) {
    if (entry.date <= date) result = entry;
    else break;
  }
  return result;
}

function delta(from: number | null, to: number | null): PeriodDelta {
  if (from === null || to === null) return { from, to, change: null, changePct: null };
  const change = to - from;
  const changePct = from !== 0 ? (change / Math.abs(from)) * 100 : null;
  return { from, to, change, changePct };
}

function sumDelta(rows: PeriodDelta[]): PeriodDelta {
  let from = 0;
  let to = 0;
  let n = 0;
  for (const row of rows) {
    if (row.from === null || row.to === null) continue;
    from += row.from;
    to += row.to;
    n += 1;
  }
  if (n === 0) return { from: null, to: null, change: null, changePct: null };
  return delta(from, to);
}

function mix(rows: { key: string; label: string; amount: number; accountIds?: string[] }[]): MixSlice[] {
  const total = rows.reduce((sum, row) => sum + Math.max(0, row.amount), 0);
  return rows
    .filter((row) => row.amount > 0)
    .map((row) => ({
      key: row.key,
      label: row.label,
      amount: row.amount,
      accountIds: row.accountIds ?? [],
      pct: total > 0 ? (row.amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function resolvedAllocations(account: Account, kind: AccountKind): {
  allocations: FundAllocation[];
  source: AccountInsight["allocationSource"];
} {
  const manual = (account.allocations ?? []).filter((row) => row.pct > 0);
  if (manual.length > 0) return { allocations: manual, source: "manual" };
  if (isLiquidKind(kind)) {
    return {
      allocations: [{ id: "cash", name: "Cash", pct: 100, assetClass: "cash" }],
      source: "cash",
    };
  }
  return { allocations: [], source: "none" };
}

export function accountCombinedFeePct(account: Account): number | null {
  if (account.feePct == null && account.ocfPct == null) return null;
  return (account.feePct ?? 0) + (account.ocfPct ?? 0);
}

function insightFor(account: Account, entries: BalanceEntry[], today: string): AccountInsight {
  const sorted = entries
    .filter((entry) => entry.accountId === account.id)
    .sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const latestEntry = sorted[sorted.length - 1];
  const latest = latestEntry?.balance ?? 0;
  const latestDate = latestEntry?.date ?? null;
  const monthAgo = addMonthsIso(latestDate || today, -1);
  const taxYearOpen = addDaysIso(currentTaxYearStart(today), -1);

  const opened = delta(first?.balance ?? null, latestEntry?.balance ?? null);
  const month = delta(latestOnOrBefore(sorted, monthAgo)?.balance ?? null, latestEntry?.balance ?? null);
  const taxFrom = latestOnOrBefore(sorted, taxYearOpen) ?? sorted.find((entry) => entry.date >= currentTaxYearStart(today));
  const taxYear = delta(taxFrom?.balance ?? null, latestEntry?.balance ?? null);

  const high = sorted.length ? Math.max(...sorted.map((entry) => entry.balance)) : null;
  const low = sorted.length ? Math.min(...sorted.map((entry) => entry.balance)) : null;
  const years =
    first && latestEntry
      ? (Date.parse(latestEntry.date) - Date.parse(first.date)) / (365.25 * 24 * 60 * 60 * 1000)
      : null;
  const cagrPct = computeHistoricalGrowthRate(sorted);
  const estimatedContributions =
    account.monthlyContribution != null && years != null ? account.monthlyContribution * years * 12 : null;
  const estimatedGrowth =
    opened.change == null ? null : estimatedContributions != null ? opened.change - estimatedContributions : opened.change;
  const kind = classifyAccount(account);
  const feePct = account.feePct ?? null;
  const ocfPct = account.ocfPct ?? null;
  const annualFeeGbp = account.annualFeeGbp ?? null;
  const pctFees = accountCombinedFeePct(account);
  const avg = first && latestEntry ? (first.balance + latestEntry.balance) / 2 : latest;
  const hasFeeInput = pctFees != null || annualFeeGbp != null;
  const estimatedFees =
    hasFeeInput && years != null
      ? (avg * ((pctFees ?? 0) / 100) + (annualFeeGbp ?? 0)) * Math.max(years, 0)
      : null;
  const annualFee = hasFeeInput ? latest * ((pctFees ?? 0) / 100) + (annualFeeGbp ?? 0) : null;
  const { allocations, source: allocationSource } = resolvedAllocations(account, kind);

  return {
    account,
    kind,
    latest,
    latestDate,
    openedOn: first?.date ?? null,
    starting: first?.balance ?? null,
    opened,
    month,
    taxYear,
    high,
    low,
    years,
    cagrPct,
    estimatedContributions,
    estimatedGrowth,
    estimatedFees,
    annualFee,
    feePct,
    ocfPct,
    annualFeeGbp,
    combinedFeePct: pctFees,
    allocations,
    allocationSource,
  };
}

export function buildFinanceInsights(accounts: Account[], entries: BalanceEntry[]): FinanceInsights {
  const today = isoToday();
  const visible = accounts.filter((acc) => acc.active && !acc.hidden);
  const accountInsights = visible.map((acc) => insightFor(acc, entries, today));
  const latest = accountInsights.reduce((sum, row) => sum + row.latest, 0);

  const isaRows = accountInsights.filter((row) => isIsaKind(row.kind));
  const nonIsaRows = accountInsights.filter((row) => !isIsaKind(row.kind));
  const cashIsaRows = accountInsights.filter((row) => row.kind === "cash_isa");
  const ssIsaRows = accountInsights.filter((row) => row.kind === "ss_isa");
  const lisaRows = accountInsights.filter((row) => row.kind === "lisa");
  const liquidRows = accountInsights.filter((row) => isLiquidKind(row.kind));
  const investedRows = accountInsights.filter((row) => !isLiquidKind(row.kind));

  const byType = new Map<string, { amount: number; accountIds: string[] }>();
  for (const row of accountInsights) {
    const current = byType.get(row.account.type) ?? { amount: 0, accountIds: [] };
    current.amount += row.latest;
    current.accountIds.push(row.account.id);
    byType.set(row.account.type, current);
  }

  const byAsset = new Map<string, { amount: number; accountIds: Set<string>; label: string }>();
  for (const row of accountInsights) {
    if (row.allocations.length === 0) {
      const current = byAsset.get("unallocated") ?? {
        amount: 0,
        accountIds: new Set<string>(),
        label: ASSET_CLASS_LABELS.unallocated,
      };
      current.amount += row.latest;
      current.accountIds.add(row.account.id);
      byAsset.set("unallocated", current);
      continue;
    }
    const weightSum = row.allocations.reduce((sum, alloc) => sum + alloc.pct, 0) || 100;
    for (const alloc of row.allocations) {
      const current = byAsset.get(alloc.assetClass) ?? {
        amount: 0,
        accountIds: new Set<string>(),
        label: ASSET_CLASS_LABELS[alloc.assetClass],
      };
      current.amount += row.latest * (alloc.pct / weightSum);
      current.accountIds.add(row.account.id);
      byAsset.set(alloc.assetClass, current);
    }
  }

  const annualFees = accountInsights
    .map((row) => row.annualFee)
    .filter((value): value is number => value != null);
  const totalAnnualFees = annualFees.length ? annualFees.reduce((sum, value) => sum + value, 0) : null;

  return {
    accounts: accountInsights,
    portfolio: {
      latest,
      month: sumDelta(accountInsights.map((row) => row.month)),
      taxYear: sumDelta(accountInsights.map((row) => row.taxYear)),
      opened: sumDelta(accountInsights.map((row) => row.opened)),
    },
    isaSplit: mix([
      { key: "isa", label: "In an ISA", amount: isaRows.reduce((sum, row) => sum + row.latest, 0), accountIds: isaRows.map((row) => row.account.id) },
      { key: "other", label: "Not in an ISA", amount: nonIsaRows.reduce((sum, row) => sum + row.latest, 0), accountIds: nonIsaRows.map((row) => row.account.id) },
    ]),
    isaMix: mix([
      { key: "ss", label: "Stocks & shares ISA", amount: ssIsaRows.reduce((sum, row) => sum + row.latest, 0), accountIds: ssIsaRows.map((row) => row.account.id) },
      { key: "cash", label: "Cash ISA", amount: cashIsaRows.reduce((sum, row) => sum + row.latest, 0), accountIds: cashIsaRows.map((row) => row.account.id) },
      { key: "lisa", label: "LISA", amount: lisaRows.reduce((sum, row) => sum + row.latest, 0), accountIds: lisaRows.map((row) => row.account.id) },
    ]),
    liquidity: mix([
      { key: "liquid", label: "Cash & easy access", amount: liquidRows.reduce((sum, row) => sum + row.latest, 0), accountIds: liquidRows.map((row) => row.account.id) },
      { key: "invested", label: "Invested", amount: investedRows.reduce((sum, row) => sum + row.latest, 0), accountIds: investedRows.map((row) => row.account.id) },
    ]),
    typeMix: mix(
      [...byType.entries()].map(([key, value]) => ({ key, label: key, amount: value.amount, accountIds: value.accountIds }))
    ),
    allocation: mix(
      [...byAsset.entries()].map(([key, value]) => ({
        key,
        label: value.label,
        amount: value.amount,
        accountIds: [...value.accountIds],
      }))
    ),
    movers: [...accountInsights]
      .filter((row) => row.taxYear.change !== null)
      .sort((a, b) => Math.abs(b.taxYear.change ?? 0) - Math.abs(a.taxYear.change ?? 0))
      .slice(0, 4),
    totalAnnualFees,
    accountsMissingFees: accountInsights.filter((row) => row.annualFee == null).length,
    accountsMissingAllocations: accountInsights.filter((row) => row.allocationSource === "none").length,
  };
}

export function formatSignedGBP(value: number, compact = false) {
  const abs = Math.abs(value);
  const formatted = compact && abs >= 1000
    ? `£${(abs / 1000).toFixed(1).replace(/\.0$/, "")}k`
    : `£${abs.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

export function formatPct(value: number | null, digits = 1) {
  if (value === null || !Number.isFinite(value)) return null;
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}
