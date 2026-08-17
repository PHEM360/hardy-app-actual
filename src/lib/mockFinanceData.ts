import type { Account, BalanceEntry } from "@/hooks/useFinance";

/**
 * Dev-only synthetic data for previewing the Finance page UI without Firestore
 * or auth. Only ever imported by FinancePreview.tsx, which is only routed to
 * behind `import.meta.env.DEV`.
 */
export function buildMockFinanceData(): { accounts: Account[]; entries: BalanceEntry[] } {
  const accounts: Account[] = [
    { id: "acc-current", name: "Joint Current Account", type: "Current", active: true, hidden: false, openedOn: "2021-03-12" },
    { id: "acc-isa", name: "Stocks & Shares ISA", type: "ISA", active: true, hidden: false, openedOn: "2020-05-18", growthAssumptionPct: 6, feePct: 0.25, ocfPct: 0.2, adviceFeeKind: "percent", adviceFeeAmount: 0.5, allocations: [
      { id: "isa-eq", name: "Global equity", pct: 80, assetClass: "equity" },
      { id: "isa-bd", name: "Global bonds", pct: 20, assetClass: "bond" },
    ] },
    { id: "acc-lisa", name: "Lifetime ISA", type: "LISA", active: true, hidden: false, openedOn: "2022-04-06", feePct: 0.3, allocations: [
      { id: "lisa-eq", name: "Target date", pct: 100, assetClass: "equity" },
    ] },
    { id: "acc-savings", name: "Easy Access Savings", type: "Savings", active: true, hidden: false, openedOn: "2019-11-01", interestRates: [
      { id: "sav-1", ratePct: 3.2, from: "2023-06-01" },
      { id: "sav-2", ratePct: 4.5, from: "2024-08-01" },
    ] },
    { id: "acc-pension", name: "Workplace Pension", type: "Pension", active: true, hidden: false, openedOn: "2018-09-01", growthAssumptionPct: 5, feePct: 0.2, ocfPct: 0.18, extraFees: [
      { id: "pen-plat", name: "Scheme levy", kind: "gbp", amount: 24 },
    ], allocations: [
      { id: "pen-eq", name: "Global equity", pct: 70, assetClass: "equity" },
      { id: "pen-bd", name: "Bonds", pct: 20, assetClass: "bond" },
      { id: "pen-cash", name: "Cash", pct: 10, assetClass: "cash" },
    ] },
    { id: "acc-old-isa", name: "Cash ISA (closed)", type: "ISA", active: false, hidden: false, openedOn: "2016-04-06" },
  ];

  // Monthly entries from 2023-06 to 2026-06 — spans tax years 23/24, 24/25, 25/26.
  const entries: BalanceEntry[] = [];
  let id = 0;

  const series: Record<string, { start: number; monthly: number; vol: number }> = {
    "acc-current": { start: 2400, monthly: 40, vol: 350 },
    "acc-isa": { start: 8500, monthly: 350, vol: 500 },
    "acc-lisa": { start: 3000, monthly: 333, vol: 150 },
    "acc-savings": { start: 12000, monthly: 150, vol: 200 },
    "acc-pension": { start: 34000, monthly: 420, vol: 900 },
    "acc-old-isa": { start: 5200, monthly: 0, vol: 0 },
  };

  const start = new Date("2023-06-01");
  const monthCount = 37;

  for (const [accountId, cfg] of Object.entries(series)) {
    let balance = cfg.start;
    for (let m = 0; m < monthCount; m++) {
      // Closed account only has entries for its first 6 months.
      if (accountId === "acc-old-isa" && m > 5) break;

      const date = new Date(start);
      date.setMonth(date.getMonth() + m);
      const wobble = Math.sin(m * 1.3 + accountId.length) * cfg.vol;
      balance = Math.max(0, balance + cfg.monthly + wobble);
      entries.push({
        id: `mock-${id++}`,
        accountId,
        date: date.toISOString().split("T")[0],
        balance: Math.round(balance * 100) / 100,
      });
    }
  }

  return { accounts, entries };
}
