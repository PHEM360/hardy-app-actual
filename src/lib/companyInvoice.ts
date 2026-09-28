import type { Company } from "@/types/app";
import type {
  CompanyBillingProfile,
  CompanyInvoice,
  CompanyInvoiceLine,
  CompanyInvoiceStatus,
} from "@/types/companyHub";
import { DEFAULT_BILLING_PROFILE, isVatRegistered } from "@/types/companyHub";

export function gbp(n: number, digits = 2): string {
  return `£${Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function newLineId(): string {
  return crypto.randomUUID();
}

export function emptyInvoiceLine(vatRate = 20): CompanyInvoiceLine {
  return { id: newLineId(), description: "", quantity: 1, unitPrice: 0, vatRate };
}

export function invoiceTotals(lines: CompanyInvoiceLine[]): { subtotal: number; vatTotal: number; total: number } {
  const subtotal = lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0);
  const vatTotal = lines.reduce((sum, line) => {
    const net = Number(line.quantity || 0) * Number(line.unitPrice || 0);
    return sum + net * (Number(line.vatRate || 0) / 100);
  }, 0);
  return {
    subtotal: roundMoney(subtotal),
    vatTotal: roundMoney(vatTotal),
    total: roundMoney(subtotal + vatTotal),
  };
}

export function roundMoney(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addMonthsIso(iso: string, months: number): string {
  const date = new Date(`${iso}T12:00:00`);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

export function formatInvoiceNumber(prefix: string, n: number): string {
  const clean = (prefix || "INV").replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "INV";
  return `${clean}-${String(Math.max(1, n)).padStart(4, "0")}`;
}

export function derivedInvoiceStatus(invoice: Pick<CompanyInvoice, "status" | "dueDate" | "amountPaid" | "total">, today = todayIso()): CompanyInvoiceStatus {
  if (invoice.status === "void" || invoice.status === "credited" || invoice.status === "paid" || invoice.status === "draft") {
    return invoice.status;
  }
  if (invoice.amountPaid >= invoice.total && invoice.total > 0) return "paid";
  if (invoice.amountPaid > 0 && invoice.amountPaid < invoice.total) {
    return invoice.dueDate < today ? "overdue" : "partial";
  }
  if (invoice.dueDate < today) return "overdue";
  return invoice.status;
}

export function amountDue(invoice: Pick<CompanyInvoice, "total" | "amountPaid">): number {
  return roundMoney(Math.max(0, Number(invoice.total || 0) - Number(invoice.amountPaid || 0)));
}

export function taxYearBounds(taxYearStart?: string) {
  const base = taxYearStart ? new Date(`${taxYearStart}T12:00:00`) : new Date(`${new Date().getFullYear()}-04-06T12:00:00`);
  const now = new Date();
  let start = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  while (new Date(start.getFullYear() + 1, start.getMonth(), start.getDate()) <= now) {
    start = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
  }
  const end = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
  end.setDate(end.getDate() - 1);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    label: `${start.getFullYear()}/${String(start.getFullYear() + 1).slice(2)}`,
  };
}

export function estimatedTax(net: number, rate = 19): number {
  return roundMoney(Math.max(0, net) * (rate / 100));
}

export function billingFrom(profile?: Partial<CompanyBillingProfile> | null): CompanyBillingProfile {
  return { ...DEFAULT_BILLING_PROFILE, ...profile };
}

export function companyLetterLines(company: Company, billing: CompanyBillingProfile): string[] {
  return [
    company.name,
    company.contact.address,
    company.contact.email,
    company.contact.phone,
    company.contact.companyNumber ? `Company no. ${company.contact.companyNumber}` : "",
    isVatRegistered(billing) && company.contact.vatNumber ? `VAT ${company.contact.vatNumber}` : "",
  ].filter(Boolean) as string[];
}

export function parseBankCsv(text: string): { date: string; description: string; amount: number }[] {
  const rows = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (rows.length < 2) return [];
  const header = splitCsvRow(rows[0]).map((cell) => cell.trim().toLowerCase());
  const dateIdx = header.findIndex((cell) => /date|posted/.test(cell) && !/updated|created|settled/.test(cell));
  const descIdx = [
    header.findIndex((cell) => /^(description|details|narrative|merchant|counter party|counterparty)$/.test(cell)),
    header.findIndex((cell) => /desc|narrative|details|merchant|reference|counter/.test(cell)),
  ].find((index) => index >= 0) ?? -1;
  const amountIdx = header.findIndex((cell) => /^amount(\b|\s|\()/.test(cell) && !/local|balance/.test(cell));
  const creditIdx = header.findIndex((cell) => /(paid\s*in|money\s*in|credit)/.test(cell) && !/description|balance/.test(cell));
  const debitIdx = header.findIndex((cell) => /(paid\s*out|money\s*out|debit)/.test(cell) && !/description|balance/.test(cell));
  if (dateIdx < 0) return [];
  return rows.slice(1).flatMap((line) => {
    const cells = splitCsvRow(line);
    const date = normaliseCsvDate(cells[dateIdx] || "");
    if (!date) return [];
    let amount = 0;
    const hasSplit = creditIdx >= 0 || debitIdx >= 0;
    if (hasSplit) {
      const credit = Number(String(cells[creditIdx] || "0").replace(/[^0-9.-]/g, "")) || 0;
      const debit = Number(String(cells[debitIdx] || "0").replace(/[^0-9.-]/g, "")) || 0;
      amount = credit - debit;
    } else if (amountIdx >= 0) {
      amount = Number(String(cells[amountIdx]).replace(/[^0-9.-]/g, ""));
    }
    if (!Number.isFinite(amount) || amount === 0) return [];
    return [{ date, description: (cells[descIdx] || "Bank line").trim() || "Bank line", amount: roundMoney(amount) }];
  });
}

function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      out.push(current);
      current = "";
    } else current += ch;
  }
  out.push(current);
  return out;
}

function normaliseCsvDate(value: string): string {
  const trimmed = value.trim();
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const uk = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (uk) {
    const year = uk[3].length === 2 ? `20${uk[3]}` : uk[3];
    return `${year}-${uk[2].padStart(2, "0")}-${uk[1].padStart(2, "0")}`;
  }
  const named = trimmed.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})$/);
  if (!named) return "";
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const month = months.findIndex((item) => named[2].toLowerCase().startsWith(item)) + 1;
  if (month < 1) return "";
  const year = named[3].length === 2 ? `20${named[3]}` : named[3];
  return `${year}-${String(month).padStart(2, "0")}-${named[1].padStart(2, "0")}`;
}

export function publicInvoicePath(companyId: string, invoiceId: string, token?: string): string {
  const base = `/i/${companyId}/${invoiceId}`;
  return token ? `${base}?t=${encodeURIComponent(token)}` : base;
}
