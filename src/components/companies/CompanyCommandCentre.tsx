import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, FileText, Newspaper, Receipt, Users, Wallet } from "lucide-react";
import { useMultiCompanyFinance } from "@/hooks/useCompanies";
import { useAllCompanyBank, useAllCompanyBills, useAllCompanyInvoices, useAllCompanyLeads } from "@/hooks/useCompanyHub";
import { useAllCompanyMarketing } from "@/hooks/useAllCompanyMarketing";
import { amountOwedOnBill, derivedBillStatus } from "@/lib/companyBooks";
import { amountDue, derivedInvoiceStatus, estimatedTax, gbp, taxYearBounds } from "@/lib/companyInvoice";
import type { Company } from "@/types/app";

export function CompanyCommandCentre({ companies }: { companies: Company[] }) {
  const navigate = useNavigate();
  const ids = companies.map((company) => company.id!).filter(Boolean);
  const finance = useMultiCompanyFinance(ids);
  const invoicesByCompany = useAllCompanyInvoices(ids);
  const billsByCompany = useAllCompanyBills(ids);
  const bankByCompany = useAllCompanyBank(ids);
  const leadsByCompany = useAllCompanyLeads(ids);
  const marketing = useAllCompanyMarketing();
  const year = taxYearBounds(companies.find((company) => company.companyType === "registered")?.taxYearStart);

  const rows = useMemo(() => companies.map((company) => {
    const books = finance[company.id!] || { income: [], expenses: [] };
    const income = books.income.filter((item) => item.date >= year.start && item.date <= year.end).reduce((sum, item) => sum + item.amount, 0);
    const expenses = books.expenses.filter((item) => item.date >= year.start && item.date <= year.end).reduce((sum, item) => sum + item.amount, 0);
    const invoices = invoicesByCompany[company.id!] || [];
    const bills = billsByCompany[company.id!] || [];
    const bank = bankByCompany[company.id!] || [];
    const leads = leadsByCompany[company.id!] || [];
    const due = invoices.reduce((sum, invoice) => sum + (["paid", "void", "credited"].includes(derivedInvoiceStatus(invoice)) || invoice.kind === "credit" ? 0 : amountDue(invoice)), 0);
    const billsDue = bills.reduce((sum, bill) => sum + (["paid", "void"].includes(derivedBillStatus(bill)) ? 0 : amountOwedOnBill(bill)), 0);
    return {
      company,
      income,
      expenses,
      net: income - expenses,
      due,
      billsDue,
      unmatched: bank.filter((row) => !row.matchedInvoiceId && !row.matchedBillId).length,
      newLeads: leads.filter((lead) => lead.status === "new").length,
      scheduled: marketing.rows.find((bundle) => bundle.company.id === company.id)?.content.filter((piece) => piece.status === "scheduled").length ?? 0,
    };
  }), [companies, finance, invoicesByCompany, billsByCompany, bankByCompany, leadsByCompany, marketing.rows, year.start, year.end]);

  const totals = rows.reduce((acc, row) => ({
    income: acc.income + row.income,
    expenses: acc.expenses + row.expenses,
    due: acc.due + row.due,
    billsDue: acc.billsDue + row.billsDue,
    unmatched: acc.unmatched + row.unmatched,
    leads: acc.leads + row.newLeads,
  }), { income: 0, expenses: 0, due: 0, billsDue: 0, unmatched: 0, leads: 0 });
  const net = totals.income - totals.expenses;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Income this tax year" value={gbp(totals.income)} tone="#15803d" />
        <Stat label="Expenditure" value={gbp(totals.expenses)} tone="#b91c1c" />
        <Stat label="Net / est. tax" value={`${gbp(net)} · ${gbp(estimatedTax(net))}`} tone={net >= 0 ? "#1d4ed8" : "#c2410c"} />
        <Stat label="Open invoices" value={gbp(totals.due)} tone="#6d28d9" />
        <Stat label="Bills to pay" value={gbp(totals.billsDue)} tone="#c2410c" />
        <Stat label="Unmatched bank" value={String(totals.unmatched)} tone="#0f766e" />
        <Stat label="New leads" value={String(totals.leads)} tone="#7c3aed" />
        <Stat label="Tax year" value={year.label} tone="#1e3a5f" />
      </div>
      <p className="text-xs text-muted-foreground">Hardy Hub is the ledger. Figures combine invoices, bills, income and expenses. Million clinic copies appear once they land here.</p>
      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-card">
        {rows.map((row) => (
          <button
            key={row.company.id}
            type="button"
            onClick={() => navigate(`/companies/${row.company.id}`)}
            className="flex w-full items-center gap-3 border-b border-border/40 px-4 py-3 text-left last:border-0 hover:bg-muted/40"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl text-sm" style={{ background: `color-mix(in srgb, ${row.company.color} 28%, hsl(var(--card)))` }}>
              {row.company.emoji || "🏢"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{row.company.name}</span>
              <span className="block text-[11px] text-muted-foreground">
                {row.company.companyType === "trading_name" ? "Trading name" : row.company.companyType === "sole_trader" ? "Sole trader" : row.company.companyType === "registered" ? "Ltd" : "Company"}
                {row.billsDue > 0 ? ` · bills ${gbp(row.billsDue, 0)}` : ""}
                {row.unmatched > 0 ? ` · ${row.unmatched} unmatched` : ""}
              </span>
            </span>
            <span className="hidden text-right text-xs sm:block">
              <span className="block font-semibold text-emerald-700">{gbp(row.income, 0)}</span>
              <span className="block text-red-600">{gbp(row.expenses, 0)}</span>
            </span>
            <span className="w-16 text-right text-xs font-bold">{gbp(row.net, 0)}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <QuickLink icon={Receipt} label="Invoices" onClick={() => navigate("/companies?view=invoices")} color="#0f766e" />
        <QuickLink icon={Wallet} label="Bills" onClick={() => navigate("/companies?view=bills")} color="#b91c1c" />
        <QuickLink icon={BookOpen} label="Books" onClick={() => navigate("/companies?view=reports")} color="#1d4ed8" />
        <QuickLink icon={Users} label="Leads" onClick={() => navigate("/companies?view=leads")} color="#7c3aed" />
        <QuickLink icon={Newspaper} label="Content" onClick={() => navigate("/companies?view=content")} color="#0f766e" />
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-border/50 p-4 shadow-card" style={{ background: `color-mix(in srgb, ${tone} 14%, hsl(var(--card)))`, borderLeft: `4px solid ${tone}` }}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/70">{label}</p>
      <p className="mt-1 font-display text-xl font-bold">{value}</p>
    </div>
  );
}

function QuickLink({ icon: Icon, label, onClick, color }: { icon: typeof FileText; label: string; onClick: () => void; color: string }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-2 rounded-2xl border border-border/50 bg-card px-3 py-3 text-left text-sm font-semibold shadow-card" style={{ borderLeft: `4px solid ${color}` }}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}
