import type { CompanyExpense, CompanyIncome } from "@/types/app";
import type {
  CompanyBankTransaction,
  CompanyBill,
  CompanyBillingProfile,
  CompanyInvoice,
} from "@/types/companyHub";
import { DEFAULT_CHART_ACCOUNTS } from "@/types/companyHub";
import { amountDue, derivedInvoiceStatus, roundMoney, todayIso } from "@/lib/companyInvoice";

export type AgedBucket = "current" | "d1_30" | "d31_60" | "d61_90" | "d90";

export interface AgedRow {
  id?: string;
  name: string;
  number: string;
  dueDate: string;
  amount: number;
  bucket: AgedBucket;
}

export interface AgedSummary {
  rows: AgedRow[];
  totals: Record<AgedBucket, number>;
  total: number;
}

export interface ProfitAndLoss {
  start: string;
  end: string;
  sales: number;
  otherIncome: number;
  income: number;
  bills: number;
  expenses: number;
  expenditure: number;
  net: number;
  incomeLines: { code: string; name: string; amount: number }[];
  expenseLines: { code: string; name: string; amount: number }[];
}

export interface VatReturn {
  start: string;
  end: string;
  box1: number;
  box4: number;
  box5: number;
  box6: number;
  box7: number;
}

export interface CashPosition {
  bank: number;
  debtors: number;
  creditors: number;
  vat: number;
  unreconciled: number;
}

export function inPeriod(date: string, start: string, end: string): boolean {
  return Boolean(date) && date >= start && date <= end;
}

export function saleSign(invoice: Pick<CompanyInvoice, "kind">): number {
  return invoice.kind === "credit" ? -1 : 1;
}

export function isPostedInvoice(invoice: Pick<CompanyInvoice, "status" | "dueDate" | "amountPaid" | "total">): boolean {
  const status = derivedInvoiceStatus(invoice);
  return status !== "draft" && status !== "void";
}

export function derivedBillStatus(bill: Pick<CompanyBill, "status" | "dueDate" | "amountPaid" | "total">, today = todayIso()): CompanyBill["status"] {
  if (bill.status === "void" || bill.status === "paid" || bill.status === "draft") return bill.status;
  if (bill.amountPaid >= bill.total && bill.total > 0) return "paid";
  if (bill.dueDate < today) return "overdue";
  return bill.status;
}

export function isPostedBill(bill: Pick<CompanyBill, "status" | "dueDate" | "amountPaid" | "total">): boolean {
  const status = derivedBillStatus(bill);
  return status !== "draft" && status !== "void";
}

export function amountOwedOnBill(bill: Pick<CompanyBill, "total" | "amountPaid">): number {
  return roundMoney(Math.max(0, Number(bill.total || 0) - Number(bill.amountPaid || 0)));
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function vatPeriodBounds(
  today = todayIso(),
  period: "monthly" | "quarterly" = "quarterly",
  stagger: 1 | 2 | 3 = 1,
): { start: string; end: string; label: string } {
  const date = new Date(`${today}T12:00:00`);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  if (period === "monthly") {
    const lastDay = new Date(year, month, 0).getDate();
    return {
      start: ymd(year, month, 1),
      end: ymd(year, month, lastDay),
      label: date.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
    };
  }
  const offset = ((month - stagger) % 3 + 3) % 3;
  const startMonthRaw = month - offset;
  const startYear = startMonthRaw >= 1 ? year : year - 1;
  const startMonth = startMonthRaw >= 1 ? startMonthRaw : startMonthRaw + 12;
  const endMonthIndex = startMonth + 2;
  const endYear = startYear + (endMonthIndex > 12 ? 1 : 0);
  const endMonth = endMonthIndex > 12 ? endMonthIndex - 12 : endMonthIndex;
  const lastDay = new Date(endYear, endMonth, 0).getDate();
  const start = ymd(startYear, startMonth, 1);
  const end = ymd(endYear, endMonth, lastDay);
  return {
    start,
    end,
    label: `VAT ${start} to ${end}`,
  };
}

export function daysPastDue(dueDate: string, today = todayIso()): number {
  const due = new Date(`${dueDate}T12:00:00`).getTime();
  const now = new Date(`${today}T12:00:00`).getTime();
  return Math.floor((now - due) / 86_400_000);
}

export function agedBucket(dueDate: string, today = todayIso()): AgedBucket {
  const days = daysPastDue(dueDate, today);
  if (days <= 0) return "current";
  if (days <= 30) return "d1_30";
  if (days <= 60) return "d31_60";
  if (days <= 90) return "d61_90";
  return "d90";
}

const EMPTY_AGED: Record<AgedBucket, number> = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90: 0 };

function summariseAged(rows: AgedRow[]): AgedSummary {
  const totals = { ...EMPTY_AGED };
  rows.forEach((row) => {
    totals[row.bucket] = roundMoney(totals[row.bucket] + row.amount);
  });
  return {
    rows,
    totals,
    total: roundMoney(Object.values(totals).reduce((sum, value) => sum + value, 0)),
  };
}

export function agedReceivables(invoices: CompanyInvoice[], today = todayIso()): AgedSummary {
  const rows = invoices.flatMap((invoice) => {
    if (invoice.kind === "credit") return [];
    const status = derivedInvoiceStatus(invoice, today);
    if (["paid", "void", "credited", "draft"].includes(status)) return [];
    const amount = amountDue(invoice);
    if (amount <= 0) return [];
    return [{
      id: invoice.id,
      name: invoice.customerName,
      number: invoice.number,
      dueDate: invoice.dueDate,
      amount,
      bucket: agedBucket(invoice.dueDate, today),
    }];
  });
  return summariseAged(rows);
}

export function agedPayables(bills: CompanyBill[], today = todayIso()): AgedSummary {
  const rows = bills.flatMap((bill) => {
    const status = derivedBillStatus(bill, today);
    if (["paid", "void", "draft"].includes(status)) return [];
    const amount = amountOwedOnBill(bill);
    if (amount <= 0) return [];
    return [{
      id: bill.id,
      name: bill.supplierName,
      number: bill.number,
      dueDate: bill.dueDate,
      amount,
      bucket: agedBucket(bill.dueDate, today),
    }];
  });
  return summariseAged(rows);
}

function accountName(code?: string): string {
  return DEFAULT_CHART_ACCOUNTS.find((account) => account.code === code)?.name
    || (code ? `Account ${code}` : "Unassigned");
}

export function profitAndLoss(input: {
  invoices: CompanyInvoice[];
  bills: CompanyBill[];
  income: CompanyIncome[];
  expenses: CompanyExpense[];
  start: string;
  end: string;
}): ProfitAndLoss {
  const { invoices, bills, income, expenses, start, end } = input;
  const incomeMap = new Map<string, number>();
  const expenseMap = new Map<string, number>();

  const add = (map: Map<string, number>, code: string, amount: number) => {
    map.set(code, roundMoney((map.get(code) || 0) + amount));
  };

  let sales = 0;
  invoices.filter((invoice) => isPostedInvoice(invoice) && inPeriod(invoice.issueDate, start, end)).forEach((invoice) => {
    const sign = saleSign(invoice);
    sales = roundMoney(sales + sign * Number(invoice.subtotal || 0));
    (invoice.lines || []).forEach((line) => {
      const net = Number(line.quantity || 0) * Number(line.unitPrice || 0) * sign;
      add(incomeMap, line.accountCode || "200", net);
    });
    if (!(invoice.lines || []).length) add(incomeMap, "200", sign * Number(invoice.subtotal || 0));
  });

  const billedExpenseIds = new Set(bills.map((bill) => bill.expenseId).filter(Boolean));
  const invoicedRefs = new Set(invoices.map((invoice) => invoice.number).filter(Boolean));

  let otherIncome = 0;
  income.filter((item) => inPeriod(item.date, start, end) && (!item.invoiceRef || !invoicedRefs.has(item.invoiceRef))).forEach((item) => {
    otherIncome = roundMoney(otherIncome + Number(item.amount || 0));
    add(incomeMap, "210", Number(item.amount || 0));
  });

  let billSpend = 0;
  bills.filter((bill) => isPostedBill(bill) && inPeriod(bill.issueDate, start, end)).forEach((bill) => {
    billSpend = roundMoney(billSpend + Number(bill.subtotal || 0));
    (bill.lines || []).forEach((line) => {
      const net = Number(line.quantity || 0) * Number(line.unitPrice || 0);
      add(expenseMap, line.accountCode || "490", net);
    });
    if (!(bill.lines || []).length) add(expenseMap, "490", Number(bill.subtotal || 0));
  });

  let receiptSpend = 0;
  expenses.filter((item) => inPeriod(item.date, start, end) && !billedExpenseIds.has(item.id)).forEach((item) => {
    receiptSpend = roundMoney(receiptSpend + Number(item.amount || 0));
    const code = DEFAULT_CHART_ACCOUNTS.find((account) => account.name.toLowerCase() === item.category.toLowerCase())?.code || "490";
    add(expenseMap, code, Number(item.amount || 0));
  });

  const toLines = (map: Map<string, number>) => [...map.entries()]
    .filter(([, amount]) => amount !== 0)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([code, amount]) => ({ code, name: accountName(code), amount }));

  const incomeTotal = roundMoney(sales + otherIncome);
  const expenditure = roundMoney(billSpend + receiptSpend);
  return {
    start,
    end,
    sales,
    otherIncome,
    income: incomeTotal,
    bills: billSpend,
    expenses: receiptSpend,
    expenditure,
    net: roundMoney(incomeTotal - expenditure),
    incomeLines: toLines(incomeMap),
    expenseLines: toLines(expenseMap),
  };
}

export function vatReturn(input: {
  invoices: CompanyInvoice[];
  bills: CompanyBill[];
  start: string;
  end: string;
}): VatReturn {
  const { invoices, bills, start, end } = input;
  let box1 = 0;
  let box6 = 0;
  invoices.filter((invoice) => isPostedInvoice(invoice) && inPeriod(invoice.issueDate, start, end)).forEach((invoice) => {
    const sign = saleSign(invoice);
    box1 = roundMoney(box1 + sign * Number(invoice.vatTotal || 0));
    box6 = roundMoney(box6 + sign * Number(invoice.subtotal || 0));
  });
  let box4 = 0;
  let box7 = 0;
  bills.filter((bill) => isPostedBill(bill) && inPeriod(bill.issueDate, start, end)).forEach((bill) => {
    box4 = roundMoney(box4 + Number(bill.vatTotal || 0));
    box7 = roundMoney(box7 + Number(bill.subtotal || 0));
  });
  return {
    start,
    end,
    box1,
    box4,
    box5: roundMoney(box1 - box4),
    box6,
    box7,
  };
}

export function cashPosition(input: {
  invoices: CompanyInvoice[];
  bills: CompanyBill[];
  transactions: CompanyBankTransaction[];
  billing: Pick<CompanyBillingProfile, "openingBank" | "openingDebtors" | "openingCreditors" | "openingVat">;
  today?: string;
}): CashPosition {
  const today = input.today || todayIso();
  const ar = agedReceivables(input.invoices, today);
  const ap = agedPayables(input.bills, today);
  const bankFromImport = input.transactions.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const vatOnOpenSales = input.invoices.filter((invoice) => isPostedInvoice(invoice) && derivedInvoiceStatus(invoice, today) !== "paid").reduce((sum, invoice) => sum + saleSign(invoice) * Number(invoice.vatTotal || 0), 0);
  const vatOnOpenBills = input.bills.filter((bill) => isPostedBill(bill) && derivedBillStatus(bill, today) !== "paid").reduce((sum, bill) => sum + Number(bill.vatTotal || 0), 0);
  return {
    bank: roundMoney((input.billing.openingBank || 0) + bankFromImport),
    debtors: roundMoney((input.billing.openingDebtors || 0) + ar.total),
    creditors: roundMoney((input.billing.openingCreditors || 0) + ap.total),
    vat: roundMoney((input.billing.openingVat || 0) + vatOnOpenSales - vatOnOpenBills),
    unreconciled: input.transactions.filter((row) => !row.matchedInvoiceId && !row.matchedBillId).length,
  };
}

export function nextRepeatDate(iso: string, frequency: "monthly" | "yearly"): string {
  const [year, month, day] = iso.split("-").map(Number);
  const months = frequency === "yearly" ? 12 : 1;
  const utc = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(utc.getUTCFullYear(), utc.getUTCMonth() + 1, 0)).getUTCDate();
  const clamped = Math.min(day, lastDay);
  return `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, "0")}-${String(clamped).padStart(2, "0")}`;
}
