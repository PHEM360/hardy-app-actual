import { parseISO, subDays, subMonths, subYears, isBefore, isAfter, startOfDay } from "date-fns";
import { JEWEL_CYCLE } from "@/lib/brandPalette";

/** Accounts that may see the private Substances tab on Health. */
export const SUBSTANCE_TRACKING_EMAILS = new Set([
  "chris.hardy.07@googlemail.com",
]);

export const DEFAULT_SUBSTANCES = [
  "Oramorph",
  "Iline",
  "Morphine",
  "Oral Diazepam",
  "IV Midazolam",
  "Lorazepam",
  "Venlafaxine",
  "Dihydrocodeine",
  "Codeine",
  "Oxycodone",
  "Tramadol",
  "Gabapentin",
  "Pregabalin",
  "Zopiclone",
  "Alcohol",
  "Cannabis",
  "Nicotine",
  "Caffeine",
] as const;

export type SwigSize = "small" | "big";

export const NUMERIC_DOSE_UNITS = ["mg", "μg", "g", "ml", "tablet", "capsule", "dose"] as const;
export type NumericDoseUnit = (typeof NUMERIC_DOSE_UNITS)[number];
export type DoseUnit = NumericDoseUnit | "swig";

export const DOSE_UNITS: { value: DoseUnit; label: string }[] = [
  { value: "mg", label: "mg" },
  { value: "μg", label: "μg" },
  { value: "g", label: "g" },
  { value: "ml", label: "ml" },
  { value: "tablet", label: "tablet" },
  { value: "capsule", label: "capsule" },
  { value: "dose", label: "dose" },
  { value: "swig", label: "swig" },
];

export type SubstancePeriod = "7d" | "1m" | "3m" | "6m" | "1y" | "all";

export const SUBSTANCE_PERIODS: { label: string; value: SubstancePeriod }[] = [
  { label: "7D", value: "7d" },
  { label: "1M", value: "1m" },
  { label: "3M", value: "3m" },
  { label: "6M", value: "6m" },
  { label: "1Y", value: "1y" },
  { label: "All", value: "all" },
];

export interface SubstanceLogLike {
  id?: string;
  name: string;
  dose: string;
  unit: string;
  date: string;
  time: string;
  notes?: string;
}

export function canAccessSubstanceTracking(opts: {
  email?: string | null;
  firstName?: string | null;
  isOwnScope: boolean;
  viewingAsOther?: boolean;
}): boolean {
  if (!opts.isOwnScope || opts.viewingAsOther) return false;
  const email = (opts.email ?? "").trim().toLowerCase();
  if (email && SUBSTANCE_TRACKING_EMAILS.has(email)) return true;
  return (opts.firstName ?? "").trim().toLowerCase() === "chris";
}

export function substanceColor(name: string, allNames: string[]): string {
  const idx = allNames.indexOf(name);
  if (idx < 0) return JEWEL_CYCLE[0];
  return JEWEL_CYCLE[idx % JEWEL_CYCLE.length];
}

export function isSwigUnit(unit: string): boolean {
  return unit.trim().toLowerCase() === "swig";
}

export function formatDoseLabel(dose: string, unit: string): string {
  if (isSwigUnit(unit)) {
    const size = dose.trim().toLowerCase() === "big" ? "big" : "small";
    return `${size} swig`;
  }
  return `${dose} ${unit}`.trim();
}

/** Numeric amount for charts. Swigs count as 1 (small) or 2 (big). */
export function doseAmountForChart(dose: string, unit: string): number {
  if (isSwigUnit(unit)) {
    return dose.trim().toLowerCase() === "big" ? 2 : 1;
  }
  const n = parseFloat(dose);
  return Number.isFinite(n) ? n : 0;
}

export function periodCutoff(period: SubstancePeriod, now = new Date()): Date | null {
  if (period === "7d") return subDays(now, 7);
  if (period === "1m") return subMonths(now, 1);
  if (period === "3m") return subMonths(now, 3);
  if (period === "6m") return subMonths(now, 6);
  if (period === "1y") return subYears(now, 1);
  return null;
}

export function filterLogsByPeriod<T extends SubstanceLogLike>(
  logs: T[],
  period: SubstancePeriod,
  now = new Date(),
): T[] {
  const cutoff = periodCutoff(period, now);
  if (!cutoff) return [...logs];
  const start = startOfDay(cutoff);
  return logs.filter((log) => {
    try {
      const d = parseISO(log.date);
      return !isBefore(d, start) && !isAfter(d, now);
    } catch {
      return false;
    }
  });
}

export function filterLogsBySubstances<T extends SubstanceLogLike>(
  logs: T[],
  selected: string[],
): T[] {
  if (selected.length === 0) return [];
  const set = new Set(selected);
  return logs.filter((log) => set.has(log.name));
}

export interface SubstanceTotal {
  name: string;
  unit: string;
  doseCount: number;
  totalAmount: number;
  /** Human label when unit is swig or mixed non-numeric. */
  label: string;
}

export function computeSubstanceTotals(logs: SubstanceLogLike[]): SubstanceTotal[] {
  const map = new Map<string, SubstanceTotal>();
  for (const log of logs) {
    const key = `${log.name}::${log.unit}`;
    const existing = map.get(key);
    const amount = doseAmountForChart(log.dose, log.unit);
    if (existing) {
      existing.doseCount += 1;
      existing.totalAmount += amount;
    } else {
      map.set(key, {
        name: log.name,
        unit: log.unit,
        doseCount: 1,
        totalAmount: amount,
        label: isSwigUnit(log.unit)
          ? `${log.name} (swig units)`
          : `${log.name} (${log.unit})`,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name) || a.unit.localeCompare(b.unit));
}

export function formatTotalAmount(total: SubstanceTotal): string {
  if (isSwigUnit(total.unit)) {
    return `${total.totalAmount} swig unit${total.totalAmount === 1 ? "" : "s"}`;
  }
  const rounded = Number.isInteger(total.totalAmount)
    ? String(total.totalAmount)
    : total.totalAmount.toFixed(2).replace(/\.?0+$/, "");
  return `${rounded} ${total.unit}`;
}

/** One row per date with a numeric total per selected substance (for charts). */
export function buildDailyChartRows(
  logs: SubstanceLogLike[],
  substanceNames: string[],
): Record<string, string | number>[] {
  const byDate = new Map<string, Record<string, number>>();
  for (const log of logs) {
    if (!substanceNames.includes(log.name)) continue;
    const row = byDate.get(log.date) ?? {};
    row[log.name] = (row[log.name] ?? 0) + doseAmountForChart(log.dose, log.unit);
    byDate.set(log.date, row);
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amounts]) => {
      const row: Record<string, string | number> = { date };
      for (const name of substanceNames) {
        row[name] = amounts[name] ?? 0;
      }
      return row;
    });
}

export function mergeSubstanceOptions(
  tracked: string[],
  logged: string[],
  defaults: readonly string[] = DEFAULT_SUBSTANCES,
): string[] {
  return Array.from(new Set([...defaults, ...tracked, ...logged]))
    .map((n) => n.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

export function sortLogsNewestFirst<T extends SubstanceLogLike>(logs: T[]): T[] {
  return [...logs].sort((a, b) => {
    const dateCmp = b.date.localeCompare(a.date);
    if (dateCmp !== 0) return dateCmp;
    return (b.time || "").localeCompare(a.time || "");
  });
}
