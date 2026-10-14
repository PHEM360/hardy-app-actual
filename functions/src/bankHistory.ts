import { londonLocalToUtc } from "./notifications/calculations";

export type HistoryFrequency = "daily" | "weekly" | "monthly";

export type HistoryOptions = {
  /** How many months back to look. */
  months: number;
  frequency: HistoryFrequency;
  /** London wall clock time, "HH:mm". Each balance is the balance as at this time on its day. */
  time: string;
};

export type HistoryTx = {
  timestamp: string;
  amount?: number;
  running_balance?: { amount?: number };
};

export const DEFAULT_HISTORY: HistoryOptions = { months: 6, frequency: "weekly", time: "21:00" };

/** What "import history" meant before it had options: every month end the bank will share. */
export const LEGACY_HISTORY: HistoryOptions = { months: 24, frequency: "monthly", time: "23:59" };

export const MAX_HISTORY_MONTHS = 60;

export function parseHistoryOptions(value: unknown): HistoryOptions | null {
  if (value === true) return LEGACY_HISTORY;
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const months = Math.round(Number(raw.months));
  const frequency = raw.frequency === "daily" || raw.frequency === "monthly" ? raw.frequency : "weekly";
  const time = typeof raw.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(raw.time) ? raw.time : DEFAULT_HISTORY.time;
  return {
    months: Number.isFinite(months) ? Math.max(1, Math.min(months, MAX_HISTORY_MONTHS)) : DEFAULT_HISTORY.months,
    frequency,
    time,
  };
}

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(day: string, days: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDay(date);
}

/** The same day of the month N months earlier, clamped to that month's length. */
export function monthsBefore(day: string, months: number) {
  const [year, month, dom] = day.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1 - months, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return isoDay(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(dom, last))));
}

/**
 * The days to record a balance for, newest first. Today is left out because
 * today's figure comes from the live balance, not from working backwards.
 */
export function historyDates(fromDay: string, today: string, frequency: HistoryFrequency): string[] {
  const dates: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDay) || fromDay >= today) return dates;
  if (frequency === "monthly") {
    const [year, month] = today.split("-").map(Number);
    for (let i = 0; i < 12 * 20; i += 1) {
      // Day 0 of a month is the last day of the month before it.
      const eom = isoDay(new Date(Date.UTC(year, month - 1 - i, 0)));
      if (eom < fromDay) break;
      dates.push(eom);
    }
    return dates;
  }
  const step = frequency === "daily" ? 1 : 7;
  for (let day = addDays(today, -step); day >= fromDay; day = addDays(day, -step)) dates.push(day);
  return dates;
}

/** The real instant of `time` (London wall clock) on `day`. */
export function cutoffInstant(day: string, time: string) {
  const [year, month, dom] = day.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return londonLocalToUtc(year, month, dom, hours, minutes).getTime();
}

function txInstant(tx: HistoryTx) {
  const parsed = Date.parse(tx.timestamp);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function round2(amount: number) {
  return Math.round(amount * 100) / 100;
}

/**
 * The balance as at `cutoff`. Uses the bank's own running balance when it
 * gives one. Otherwise it takes today's balance and takes off everything that
 * happened after the cutoff.
 */
export function balanceAt(cutoff: number, current: number, txs: HistoryTx[]) {
  let latest: { at: number; amount: number } | null = null;
  let after = 0;
  for (const tx of txs) {
    const at = txInstant(tx);
    if (!Number.isFinite(at)) continue;
    if (at > cutoff) {
      after += Number(tx.amount || 0);
      continue;
    }
    const running = Number(tx.running_balance?.amount);
    if (tx.running_balance?.amount != null && Number.isFinite(running) && (!latest || at >= latest.at)) {
      latest = { at, amount: running };
    }
  }
  return round2(latest ? latest.amount : current - after);
}

/** Balance rows for one bank account, newest first. Never goes back past the first transaction the bank shared. */
export function historyBalances(args: {
  today: string;
  current: number;
  txs: HistoryTx[];
  options: HistoryOptions;
}): { date: string; amount: number }[] {
  const firstTx = args.txs
    .map((tx) => String(tx.timestamp || "").slice(0, 10))
    .filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day))
    .sort()[0];
  if (!firstTx) return [];
  const wanted = monthsBefore(args.today, args.options.months);
  const fromDay = firstTx > wanted ? firstTx : wanted;
  return historyDates(fromDay, args.today, args.options.frequency).map((date) => ({
    date,
    amount: balanceAt(cutoffInstant(date, args.options.time), args.current, args.txs),
  }));
}
