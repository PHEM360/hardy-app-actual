import type { Company } from "@/types/app";
import type {
  BusinessCompanyData,
  BusinessCompanyTotals,
  BusinessHubTotals,
  BusinessInvoice,
  BusinessInvoiceLine,
} from "@/types/businessHub";

export function money(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export function dateKey(value = new Date()) {
  return value.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return dateKey(value);
}

export function invoiceTotals(lines: BusinessInvoiceLine[]) {
  let subtotal = 0;
  let vatAmount = 0;
  for (const line of lines) {
    const net = Math.max(0, Number(line.quantity) || 0) * Math.max(0, Number(line.unitPrice) || 0);
    const vat = net * (Math.max(0, Number(line.vatRate) || 0) / 100);
    subtotal += net;
    vatAmount += vat;
  }
  return {
    subtotal: roundMoney(subtotal),
    vatAmount: roundMoney(vatAmount),
    total: roundMoney(subtotal + vatAmount),
  };
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function invoiceStatus(invoice: BusinessInvoice): BusinessInvoice["status"] {
  if (
    invoice.status === "paid" ||
    invoice.status === "void" ||
    invoice.status === "written_off" ||
    invoice.status === "draft"
  ) {
    return invoice.status;
  }
  if ((invoice.amountPaid || 0) > 0 && (invoice.amountPaid || 0) < invoice.total) return "part_paid";
  if (invoice.dueDate && invoice.dueDate < dateKey()) return "overdue";
  return invoice.status === "pending" ? "pending" : "issued";
}

export function legalEntityForCompany(company: Company, companies: Company[]) {
  if (company.companyType === "trading_name" && company.parentCompanyId) {
    return companies.find((candidate) => candidate.id === company.parentCompanyId) || company;
  }
  return company;
}

export function invoicePrefix(company: Company) {
  const words = company.name
    .replace(/[^a-zA-Z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !["ltd", "limited", "the"].includes(word.toLowerCase()));
  const initials = words.map((word) => word[0]).join("").toUpperCase().slice(0, 5);
  return initials || "INV";
}

export function companyTotals(row: BusinessCompanyData): BusinessCompanyTotals {
  const income = roundMoney(row.income.reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
  const expenses = roundMoney(row.expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
  const liveInvoices = row.invoices.filter((invoice) => invoice.status !== "void" && invoice.status !== "draft");
  const invoiced = roundMoney(liveInvoices.reduce((sum, invoice) => sum + invoice.total, 0));
  const outstanding = roundMoney(
    liveInvoices.reduce((sum, invoice) => sum + Math.max(0, invoice.total - (invoice.amountPaid || 0)), 0),
  );
  const overdue = roundMoney(
    liveInvoices
      .filter((invoice) => invoiceStatus(invoice) === "overdue")
      .reduce((sum, invoice) => sum + Math.max(0, invoice.total - (invoice.amountPaid || 0)), 0),
  );
  const openLeads = row.leads.filter((lead) => !["converted", "closed", "spam"].includes(lead.status)).length;
  return {
    companyId: row.company.id || "",
    income,
    expenses,
    profit: roundMoney(income - expenses),
    invoiced,
    outstanding,
    overdue,
    openLeads,
  };
}

export function totalBusiness(rows: BusinessCompanyData[]): BusinessHubTotals {
  return rows.reduce<BusinessHubTotals>(
    (totals, row) => {
      const next = companyTotals(row);
      totals.income += next.income;
      totals.expenses += next.expenses;
      totals.profit += next.profit;
      totals.invoiced += next.invoiced;
      totals.outstanding += next.outstanding;
      totals.overdue += next.overdue;
      totals.openLeads += next.openLeads;
      return totals;
    },
    { income: 0, expenses: 0, profit: 0, invoiced: 0, outstanding: 0, overdue: 0, openLeads: 0 },
  );
}
