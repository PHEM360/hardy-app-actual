/**
 * Rough, general-knowledge seasonality guide for UK-outbound family holidays,
 * by region and month. This is a broad approximation to help with planning —
 * always check the specific destination and year before booking.
 */

export type HolidaySeasonTag = "peak" | "shoulder" | "low" | "rainy";

export const HOLIDAY_SEASON_LABELS: Record<HolidaySeasonTag, string> = {
  peak: "Peak season",
  shoulder: "Shoulder season",
  low: "Low season",
  rainy: "Rainy / hurricane season",
};

/** Tailwind classes for a small month tile tinted by season. */
export const HOLIDAY_SEASON_STYLES: Record<HolidaySeasonTag, string> = {
  peak: "bg-amber-500/15 border-amber-400/50 text-amber-700 dark:text-amber-300",
  shoulder: "bg-emerald-500/15 border-emerald-400/50 text-emerald-700 dark:text-emerald-300",
  low: "bg-slate-500/15 border-slate-400/50 text-slate-600 dark:text-slate-300",
  rainy: "bg-sky-500/15 border-sky-400/50 text-sky-700 dark:text-sky-300",
};

export const HOLIDAY_SEASON_DOT_COLOR: Record<HolidaySeasonTag, string> = {
  peak: "#f59e0b",
  shoulder: "#10b981",
  low: "#64748b",
  rainy: "#0ea5e9",
};

/** Month is 1-12. Regions not listed, or months not covered, have no seasonal data. */
export const REGION_MONTH_SEASONS: Record<string, Partial<Record<number, HolidaySeasonTag>>> = {
  Caribbean: { 1: "peak", 2: "peak", 3: "peak", 4: "peak", 5: "shoulder", 6: "rainy", 7: "rainy", 8: "rainy", 9: "rainy", 10: "rainy", 11: "shoulder", 12: "peak" },
  Mediterranean: { 1: "rainy", 2: "rainy", 3: "low", 4: "shoulder", 5: "shoulder", 6: "peak", 7: "peak", 8: "peak", 9: "shoulder", 10: "shoulder", 11: "low", 12: "rainy" },
  Canaries: { 1: "peak", 2: "shoulder", 3: "shoulder", 4: "shoulder", 5: "shoulder", 6: "shoulder", 7: "peak", 8: "peak", 9: "shoulder", 10: "shoulder", 11: "shoulder", 12: "peak" },
  Europe: { 1: "rainy", 2: "rainy", 3: "low", 4: "low", 5: "shoulder", 6: "shoulder", 7: "peak", 8: "peak", 9: "shoulder", 10: "low", 11: "rainy", 12: "rainy" },
  "Middle East": { 1: "peak", 2: "peak", 3: "peak", 4: "shoulder", 5: "low", 6: "low", 7: "low", 8: "low", 9: "low", 10: "shoulder", 11: "peak", 12: "peak" },
  Africa: { 1: "shoulder", 2: "shoulder", 3: "peak", 4: "peak", 5: "peak", 6: "low", 7: "low", 8: "low", 9: "peak", 10: "peak", 11: "peak", 12: "shoulder" },
  Asia: { 1: "peak", 2: "peak", 3: "shoulder", 4: "rainy", 5: "rainy", 6: "rainy", 7: "rainy", 8: "rainy", 9: "rainy", 10: "shoulder", 11: "peak", 12: "peak" },
  "Indian Ocean": { 1: "peak", 2: "peak", 3: "peak", 4: "shoulder", 5: "rainy", 6: "rainy", 7: "rainy", 8: "rainy", 9: "rainy", 10: "shoulder", 11: "shoulder", 12: "peak" },
  "North America": { 1: "low", 2: "low", 3: "low", 4: "shoulder", 5: "shoulder", 6: "peak", 7: "peak", 8: "peak", 9: "shoulder", 10: "shoulder", 11: "low", 12: "peak" },
  "Central America": { 1: "peak", 2: "peak", 3: "peak", 4: "peak", 5: "shoulder", 6: "rainy", 7: "rainy", 8: "rainy", 9: "rainy", 10: "rainy", 11: "shoulder", 12: "peak" },
  "South America": { 1: "peak", 2: "peak", 3: "shoulder", 4: "shoulder", 5: "shoulder", 6: "shoulder", 7: "peak", 8: "peak", 9: "shoulder", 10: "shoulder", 11: "shoulder", 12: "peak" },
  Australasia: { 1: "peak", 2: "peak", 3: "shoulder", 4: "shoulder", 5: "shoulder", 6: "low", 7: "low", 8: "low", 9: "shoulder", 10: "shoulder", 11: "shoulder", 12: "peak" },
  "UK & Ireland": { 1: "rainy", 2: "rainy", 3: "low", 4: "low", 5: "shoulder", 6: "shoulder", 7: "peak", 8: "peak", 9: "shoulder", 10: "low", 11: "rainy", 12: "rainy" },
};

export function seasonForRegionMonth(region: string | undefined, month: number): HolidaySeasonTag | null {
  if (!region) return null;
  return REGION_MONTH_SEASONS[region]?.[month] ?? null;
}
