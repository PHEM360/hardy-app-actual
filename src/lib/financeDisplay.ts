export const FINANCE_STATS = [
  { id: "heroMonth", group: "Total tile", label: "Change since last month" },
  { id: "heroTaxYear", group: "Total tile", label: "Change this tax year" },
  { id: "heroOpened", group: "Total tile", label: "Change since accounts opened" },
  { id: "tileMonth", group: "Top account tiles", label: "Change since last month" },
  { id: "tileTaxYear", group: "Top account tiles", label: "Change this tax year" },
  { id: "tileOpened", group: "Top account tiles", label: "Change since opened", defaultOn: false },
  { id: "startingBalance", group: "Summary accounts", label: "Starting balance" },
  { id: "changeMonth", group: "Summary accounts", label: "Change since last month" },
  { id: "changeTaxYear", group: "Summary accounts", label: "Change this tax year" },
  { id: "changeOpened", group: "Summary accounts", label: "Change since opened" },
  { id: "fees", group: "Summary accounts", label: "Fees (estimated)" },
  { id: "interest", group: "Summary accounts", label: "Estimated interest / growth" },
  { id: "highLow", group: "Summary accounts", label: "High and low" },
  { id: "cagr", group: "Summary accounts", label: "Annualised return" },
  { id: "allocation", group: "Insights", label: "Asset allocation" },
  { id: "feesOverview", group: "Insights", label: "Fees overview" },
  { id: "isaSplit", group: "Insights", label: "ISA vs not in an ISA" },
  { id: "isaMix", group: "Insights", label: "Cash ISA vs stocks & shares ISA" },
  { id: "liquidity", group: "Insights", label: "Cash & easy-access vs invested" },
  { id: "typeMix", group: "Insights", label: "Mix by account type" },
  { id: "movers", group: "Insights", label: "Biggest movers" },
  { id: "taxYears", group: "Insights", label: "Tax year breakdown" },
] as const;

export type FinanceStatId = (typeof FINANCE_STATS)[number]["id"];

export const FINANCE_STAT_GROUPS = ["Total tile", "Top account tiles", "Summary accounts", "Insights"] as const;

export function defaultDisplayStats(): Record<FinanceStatId, boolean> {
  return Object.fromEntries(
    FINANCE_STATS.map((s) => [s.id, "defaultOn" in s ? s.defaultOn !== false : true])
  ) as Record<FinanceStatId, boolean>;
}

export function mergeDisplayStats(raw?: unknown): Record<FinanceStatId, boolean> {
  const next = defaultDisplayStats();
  if (!raw || typeof raw !== "object") return next;
  const rec = raw as Record<string, unknown>;
  for (const stat of FINANCE_STATS) {
    if (typeof rec[stat.id] === "boolean") next[stat.id] = rec[stat.id] as boolean;
  }
  return next;
}
