export const FINANCE_STATS = [
  { id: "heroMonth", group: "Total tile", label: "Change since last month" },
  { id: "heroTaxYear", group: "Total tile", label: "Change this tax year" },
  { id: "heroOpened", group: "Total tile", label: "Change since accounts opened" },
  { id: "startingBalance", group: "Account tiles", label: "Starting balance" },
  { id: "changeMonth", group: "Account tiles", label: "Change since last month" },
  { id: "changeTaxYear", group: "Account tiles", label: "Change this tax year" },
  { id: "changeOpened", group: "Account tiles", label: "Change since opened" },
  { id: "fees", group: "Account tiles", label: "Fees (estimated)" },
  { id: "interest", group: "Account tiles", label: "Estimated interest / growth" },
  { id: "highLow", group: "Account tiles", label: "High and low" },
  { id: "cagr", group: "Account tiles", label: "Annualised return" },
  { id: "isaSplit", group: "Insights", label: "ISA vs not in an ISA" },
  { id: "isaMix", group: "Insights", label: "Cash ISA vs stocks & shares ISA" },
  { id: "liquidity", group: "Insights", label: "Cash & easy-access vs invested" },
  { id: "typeMix", group: "Insights", label: "Mix by account type" },
  { id: "movers", group: "Insights", label: "Biggest movers" },
  { id: "taxYears", group: "Insights", label: "Tax year breakdown" },
] as const;

export type FinanceStatId = (typeof FINANCE_STATS)[number]["id"];

export const FINANCE_STAT_GROUPS = ["Total tile", "Account tiles", "Insights"] as const;

export function defaultDisplayStats(): Record<FinanceStatId, boolean> {
  return Object.fromEntries(FINANCE_STATS.map((s) => [s.id, true])) as Record<FinanceStatId, boolean>;
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
