import type { Account, BalanceEntry } from "@/hooks/useFinance";

/**
 * Dev-only synthetic data for previewing the Finance page UI without Firestore
 * or auth. Only ever imported by FinancePreview.tsx, which is only routed to
 * behind `import.meta.env.DEV`.
 */
export function buildMockFinanceData(): { accounts: Account[]; entries: BalanceEntry[] } {
  const accounts: Account[] = [
    { id: "acc-current", name: "Joint Current Account", type: "Current", active: true, hidden: false },
    { id: "acc-isa", name: "Stocks & Shares ISA", type: "ISA", active: true, hidden: false, growthAssumptionPct: 6 },
    { id: "acc-lisa", name: "Lifetime ISA", type: "LISA", active: true, hidden: false },
    { id: "acc-savings", name: "Easy Access Savings", type: "Savings", active: true, hidden: false },
    { id: "acc-pension", name: "Workplace Pension", type: "Pension", active: true, hidden: false, growthAssumptionPct: 5 },
    { id: "acc-old-isa", name: "Cash ISA (closed)", type: "ISA", active: false, hidden: false },
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
