import type { Account, BalanceEntry } from "@/hooks/useFinance";

export interface TaxYearDef {
  label: string;
  start: string; // ISO date
  end: string; // ISO date
}

/** Formats a number as GBP. `compact` renders large values as e.g. "£12.3k". */
export function formatGBP(value: number, opts?: { compact?: boolean; decimals?: number }): string {
  if (opts?.compact && Math.abs(value) >= 1000) {
    return `£${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return `£${value.toLocaleString("en-GB", {
    minimumFractionDigits: opts?.decimals ?? 2,
    maximumFractionDigits: opts?.decimals ?? 2,
  })}`;
}

// ─── Pivot table (dates × accounts) ────────────────────────────────────────────

export interface PivotCell {
  balance: number;
  entryId: string;
  note?: string;
}

export interface PivotTable {
  /** Ascending ISO date strings. */
  dates: string[];
  /** date -> accountId -> cell */
  cellsByDate: Record<string, Record<string, PivotCell>>;
}

export function buildPivotTable(entries: BalanceEntry[]): PivotTable {
  const cellsByDate: Record<string, Record<string, PivotCell>> = {};
  for (const e of entries) {
    if (!cellsByDate[e.date]) cellsByDate[e.date] = {};
    cellsByDate[e.date][e.accountId] = { balance: e.balance, entryId: e.id, note: e.note };
  }
  const dates = Object.keys(cellsByDate).sort();
  return { dates, cellsByDate };
}

// ─── Per-account summary over a period ─────────────────────────────────────────

export interface AccountSummary {
  accountId: string;
  opening: number | null;
  closing: number | null;
  netChange: number | null;
  netChangePct: number | null;
  hasData: boolean;
}

export function computeAccountSummary(
  accountId: string,
  entries: BalanceEntry[],
  periodStart?: string
): AccountSummary {
  const accEntries = entries
    .filter((e) => e.accountId === accountId && (!periodStart || e.date >= periodStart))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (accEntries.length === 0) {
    return { accountId, opening: null, closing: null, netChange: null, netChangePct: null, hasData: false };
  }

  const opening = accEntries[0].balance;
  const closing = accEntries[accEntries.length - 1].balance;
  const netChange = closing - opening;
  const netChangePct = opening !== 0 ? (netChange / Math.abs(opening)) * 100 : null;

  return { accountId, opening, closing, netChange, netChangePct, hasData: true };
}

// ─── Tax-year breakdown ─────────────────────────────────────────────────────────

export interface TaxYearRow extends TaxYearDef {
  /** accountId -> net change during this tax year, or null if no data */
  perAccount: Record<string, number | null>;
  total: number | null;
}

function latestOnOrBefore(sortedEntries: BalanceEntry[], date: string): BalanceEntry | undefined {
  let result: BalanceEntry | undefined;
  for (const e of sortedEntries) {
    if (e.date <= date) result = e;
    else break;
  }
  return result;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export function computeTaxYearSummary(
  accounts: Account[],
  entries: BalanceEntry[],
  taxYears: TaxYearDef[]
): TaxYearRow[] {
  const byAccount = new Map<string, BalanceEntry[]>();
  for (const acc of accounts) {
    byAccount.set(
      acc.id,
      entries.filter((e) => e.accountId === acc.id).sort((a, b) => a.date.localeCompare(b.date))
    );
  }

  return taxYears.map((ty) => {
    const perAccount: Record<string, number | null> = {};
    let total = 0;
    let anyData = false;

    for (const acc of accounts) {
      const sorted = byAccount.get(acc.id) ?? [];
      const hasEntryInYear = sorted.some((e) => e.date >= ty.start && e.date <= ty.end);
      if (!hasEntryInYear) {
        perAccount[acc.id] = null;
        continue;
      }
      const openingEntry = latestOnOrBefore(sorted, addDays(ty.start, -1));
      const closingEntry = latestOnOrBefore(sorted, ty.end)!;
      const opening = openingEntry ? openingEntry.balance : closingEntry.balance;
      const netChange = closingEntry.balance - opening;
      perAccount[acc.id] = netChange;
      total += netChange;
      anyData = true;
    }

    return { ...ty, perAccount, total: anyData ? total : null };
  });
}

// ─── Chart Y-axis domain ────────────────────────────────────────────────────────

function niceStep(range: number): number {
  if (!Number.isFinite(range) || range <= 0) return 1;
  const rough = range / 5;
  const exp = Math.floor(Math.log10(rough));
  const pow = 10 ** exp;
  const frac = rough / pow;
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return nice * pow;
}

/** Computes a padded [min, max] domain from only the series actually being plotted,
 *  so fluctuations stay visible instead of being flattened by a fixed 0 baseline. */
export function computeChartYDomain(
  chartData: Record<string, unknown>[],
  visibleKeys: string[]
): [number, number] | undefined {
  let min = Infinity;
  let max = -Infinity;
  for (const row of chartData) {
    for (const key of visibleKeys) {
      const v = row[key];
      if (typeof v === "number" && Number.isFinite(v)) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
  }
  if (!isFinite(min) || !isFinite(max)) return undefined;

  const rawMin = min;
  if (min === max) {
    const pad = Math.max(Math.abs(min) * 0.08, 50);
    min -= pad;
    max += pad;
  } else {
    const pad = (max - min) * 0.1;
    min -= pad;
    max += pad;
  }

  if (rawMin >= 0) min = Math.max(0, min);

  const step = niceStep(max - min);
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  return [rawMin >= 0 ? Math.max(0, niceMin) : niceMin, niceMax === niceMin ? niceMin + step : niceMax];
}
