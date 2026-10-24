import { formatGBP } from "@/lib/financeCalculations";

export interface TransferAccountRef {
  id: string;
  name: string;
}

export interface TransferPlan {
  fromId: string;
  toId: string;
  date: string;
  amount: number;
  fromBalance: 0;
  toBalance: number;
  fromNote: string;
  toNote: string;
}

export function latestBalanceFor(accountId: string, entries: { accountId: string; date: string; balance: number }[]) {
  return entries
    .filter((entry) => entry.accountId === accountId)
    .sort((a, b) => b.date.localeCompare(a.date))[0]?.balance ?? 0;
}

export function balanceOnOrBefore(
  accountId: string,
  entries: { accountId: string; date: string; balance: number }[],
  date: string,
) {
  return entries
    .filter((entry) => entry.accountId === accountId && entry.date <= date)
    .sort((a, b) => b.date.localeCompare(a.date))[0]?.balance ?? 0;
}

export function buildTransferPlan(args: {
  from: TransferAccountRef;
  to: TransferAccountRef;
  fromBalance: number;
  toBalance: number;
  date: string;
}): TransferPlan {
  const amount = args.fromBalance;
  return {
    fromId: args.from.id,
    toId: args.to.id,
    date: args.date,
    amount,
    fromBalance: 0,
    toBalance: args.toBalance + amount,
    fromNote: `Closed. Transferred ${formatGBP(amount)} to ${args.to.name}.`,
    toNote: `Received ${formatGBP(amount)} from ${args.from.name}.`,
  };
}
