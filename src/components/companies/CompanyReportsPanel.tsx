import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CompanyBankRec } from "@/components/companies/CompanyBankRec";
import { useCompanyBank, useCompanyBilling, useCompanyBills, useCompanyInvoices } from "@/hooks/useCompanyHub";
import { useCompanyExpenses, useCompanyIncome } from "@/hooks/useCompanies";
import {
  agedPayables,
  agedReceivables,
  cashPosition,
  profitAndLoss,
  vatPeriodBounds,
  vatReturn,
} from "@/lib/companyBooks";
import { gbp, taxYearBounds, todayIso } from "@/lib/companyInvoice";
import type { Company } from "@/types/app";
import type { AgedBucket } from "@/lib/companyBooks";
import { DEFAULT_CHART_ACCOUNTS, isVatRegistered } from "@/types/companyHub";

const BUCKETS: { id: AgedBucket; label: string }[] = [
  { id: "current", label: "Current" },
  { id: "d1_30", label: "1 to 30" },
  { id: "d31_60", label: "31 to 60" },
  { id: "d61_90", label: "61 to 90" },
  { id: "d90", label: "90+" },
];

export function CompanyReportsPanel({ company, canEdit }: { company: Company; canEdit: boolean }) {
  const companyId = company.id!;
  const { invoices, updateInvoice } = useCompanyInvoices(companyId);
  const { bills, updateBill } = useCompanyBills(companyId);
  const { incomes, addIncome } = useCompanyIncome(companyId);
  const { expenses, addExpense } = useCompanyExpenses(companyId);
  const { profile, saveProfile } = useCompanyBilling(companyId);
  const { accounts, transactions, addAccount, addTransactions, matchTransaction } = useCompanyBank(companyId);
  const taxYear = taxYearBounds(company.taxYearStart);
  const vatPeriod = vatPeriodBounds(undefined, profile.vatPeriod, profile.vatStagger || 1);
  const [range, setRange] = useState<"tax" | "vat" | "custom">("tax");
  const [customStart, setCustomStart] = useState(taxYear.start);
  const [customEnd, setCustomEnd] = useState(taxYear.end);

  const period = range === "tax" ? taxYear : range === "vat" ? vatPeriod : { start: customStart, end: customEnd, label: "Custom" };

  const pl = useMemo(() => profitAndLoss({
    invoices,
    bills,
    income: incomes,
    expenses,
    start: period.start,
    end: period.end,
  }), [invoices, bills, incomes, expenses, period.start, period.end]);

  const vat = useMemo(() => vatReturn({ invoices, bills, start: vatPeriod.start, end: vatPeriod.end }), [invoices, bills, vatPeriod.start, vatPeriod.end]);
  const ar = useMemo(() => agedReceivables(invoices), [invoices]);
  const ap = useMemo(() => agedPayables(bills), [bills]);
  const cash = useMemo(() => cashPosition({ invoices, bills, transactions, billing: profile }), [invoices, bills, transactions, profile]);

  const markInvoicePaid = async (invoice: { id?: string; number: string; customerName: string; total: number }) => {
    if (!invoice.id) return;
    try {
      await updateInvoice(invoice.id, {
        status: "paid",
        amountPaid: invoice.total,
        paidAt: new Date().toISOString(),
        paymentMethod: "bank_transfer",
      });
      await addIncome({
        date: todayIso(),
        description: `${invoice.number} · ${invoice.customerName}`,
        amount: invoice.total,
        category: "Services",
        invoiceRef: invoice.number,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not mark the invoice paid");
    }
  };

  const markBillPaid = async (bill: { id?: string; number: string; supplierName: string; total: number; category?: string; lines: { description: string }[]; expenseId?: string }) => {
    if (!bill.id) return;
    try {
      let expenseId = bill.expenseId;
      if (!expenseId) {
        expenseId = await addExpense({
          date: todayIso(),
          description: `${bill.number} · ${bill.supplierName}`,
          amount: bill.total,
          category: bill.category || bill.lines[0]?.description || "Other expenses",
        });
      }
      await updateBill(bill.id, {
        status: "paid",
        amountPaid: bill.total,
        paidAt: new Date().toISOString(),
        expenseId,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not mark the bill paid");
    }
  };

  return (
    <div className="space-y-5">
      <div
        className="rounded-2xl border border-border/50 p-4 shadow-card"
        style={{
          background: `color-mix(in srgb, ${company.color} 12%, hsl(var(--card)))`,
          borderLeft: `4px solid ${company.color}`,
        }}
      >
        <p className="font-display text-lg font-bold">Company books</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Hardy Hub is the accounts system for this company. There is no Xero connection. Enter opening balances once from your last accounts software, then keep invoices, bills and bank here.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          { id: "tax" as const, label: `Tax year ${taxYear.label}` },
          { id: "vat" as const, label: "This VAT period" },
          { id: "custom" as const, label: "Custom" },
        ]).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setRange(item.id)}
            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${range === item.id ? "border-primary/45 bg-primary/10" : "border-border/50 bg-card text-muted-foreground"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {range === "custom" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="From"><Input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /></Field>
          <Field label="To"><Input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></Field>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Income" value={gbp(pl.income)} tone="#15803d" />
        <Stat label="Expenditure" value={gbp(pl.expenditure)} tone="#b91c1c" />
        <Stat label="Net" value={gbp(pl.net)} tone={pl.net >= 0 ? "#1d4ed8" : "#c2410c"} />
        <Stat label="VAT to pay" value={isVatRegistered(profile) ? gbp(Math.max(0, vat.box5)) : "Not registered"} tone="#6d28d9" />
      </div>

      <section className="rounded-2xl border border-border/50 bg-card p-4 shadow-card">
        <p className="font-display font-bold">Profit and loss · {period.start} to {period.end}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <BooksColumn title="Income" rows={pl.incomeLines} empty="No sales in this period." />
          <BooksColumn title="Expenditure" rows={pl.expenseLines} empty="No spend in this period." />
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl px-3 py-3" style={{ background: "color-mix(in srgb, hsl(var(--primary)) 12%, hsl(var(--card)))" }}>
          <span className="text-sm font-semibold">Net profit</span>
          <span className="font-display text-xl font-bold">{gbp(pl.net)}</span>
        </div>
      </section>

      {isVatRegistered(profile) && (
        <section className="rounded-2xl border border-border/50 bg-card p-4 shadow-card">
          <p className="font-display font-bold">VAT return · {vatPeriod.label}</p>
          <p className="mt-1 text-sm text-muted-foreground">Figures follow invoice and bill dates. Submit these boxes on MTD when you file.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <VatBox n={1} label="VAT on sales" value={vat.box1} />
            <VatBox n={4} label="VAT on purchases" value={vat.box4} />
            <VatBox n={5} label="Net VAT" value={vat.box5} accent />
            <VatBox n={6} label="Net sales" value={vat.box6} />
            <VatBox n={7} label="Net purchases" value={vat.box7} />
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <AgedCard title="Aged receivables" summary={ar} empty="No unpaid invoices." />
        <AgedCard title="Aged payables" summary={ap} empty="No unpaid bills." />
      </div>

      <section className="rounded-2xl border border-border/50 bg-card p-4 shadow-card">
        <p className="font-display font-bold">Cash position</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Bank" value={gbp(cash.bank)} tone="#0f766e" />
          <Stat label="Debtors" value={gbp(cash.debtors)} tone="#1d4ed8" />
          <Stat label="Creditors" value={gbp(cash.creditors)} tone="#c2410c" />
          <Stat label="Unmatched bank lines" value={String(cash.unreconciled)} tone="#6d28d9" />
        </div>
      </section>

      <CompanyBankRec
        canEdit={canEdit}
        invoices={invoices}
        bills={bills}
        accounts={accounts}
        transactions={transactions}
        addAccount={addAccount}
        addTransactions={addTransactions}
        matchTransaction={matchTransaction}
        onMatchInvoice={markInvoicePaid}
        onMatchBill={markBillPaid}
        defaultAccountName={profile.bankName || "Business account"}
      />

      <section className="rounded-2xl border border-border/50 bg-card p-4 shadow-card">
        <p className="font-display font-bold">Opening balances</p>
        <p className="mt-1 text-sm text-muted-foreground">Copy the figures from your last report on the day you leave the old software. Do not re-enter the same invoices here.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="As of"><Input type="date" disabled={!canEdit} value={profile.openingDate || ""} onChange={(event) => void saveProfile({ openingDate: event.target.value })} /></Field>
          <Field label="Bank"><Input type="number" disabled={!canEdit} value={profile.openingBank ?? ""} onChange={(event) => void saveProfile({ openingBank: Number(event.target.value) || 0 })} /></Field>
          <Field label="Debtors"><Input type="number" disabled={!canEdit} value={profile.openingDebtors ?? ""} onChange={(event) => void saveProfile({ openingDebtors: Number(event.target.value) || 0 })} /></Field>
          <Field label="Creditors"><Input type="number" disabled={!canEdit} value={profile.openingCreditors ?? ""} onChange={(event) => void saveProfile({ openingCreditors: Number(event.target.value) || 0 })} /></Field>
          <Field label="VAT owed"><Input type="number" disabled={!canEdit} value={profile.openingVat ?? ""} onChange={(event) => void saveProfile({ openingVat: Number(event.target.value) || 0 })} /></Field>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="VAT scheme">
            <select
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
              value={profile.vatScheme}
              disabled={!canEdit}
              onChange={(event) => {
                const vatScheme = event.target.value as typeof profile.vatScheme;
                void saveProfile({ vatScheme, vatRegistered: vatScheme !== "not_registered" });
              }}
            >
              <option value="not_registered">Not registered</option>
              <option value="standard">Standard VAT</option>
              <option value="flat_rate">Flat rate</option>
            </select>
          </Field>
          <Field label="VAT period">
            <select
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
              value={`${profile.vatPeriod}:${profile.vatStagger || 1}`}
              disabled={!canEdit}
              onChange={(event) => {
                const [vatPeriod, stagger] = event.target.value.split(":");
                void saveProfile({ vatPeriod: vatPeriod as "monthly" | "quarterly", vatStagger: Number(stagger) as 1 | 2 | 3 });
              }}
            >
              <option value="quarterly:1">Quarterly Jan Apr Jul Oct</option>
              <option value="quarterly:2">Quarterly Feb May Aug Nov</option>
              <option value="quarterly:3">Quarterly Mar Jun Sep Dec</option>
              <option value="monthly:1">Monthly</option>
            </select>
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-border/50 bg-card p-4 shadow-card">
        <p className="font-display font-bold">Chart of accounts</p>
        <p className="mt-1 text-sm text-muted-foreground">Use these codes on invoice and bill lines. They group the profit and loss.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {DEFAULT_CHART_ACCOUNTS.map((account) => (
            <div key={account.code} className="flex items-center justify-between rounded-xl px-3 py-2 text-sm" style={{ background: "color-mix(in srgb, hsl(var(--muted)) 45%, hsl(var(--card)))" }}>
              <span className="font-semibold">{account.code} · {account.name}</span>
              <span className="text-[10px] font-bold uppercase text-muted-foreground">{account.type}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
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

function VatBox({ n, label, value, accent }: { n: number; label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border/50 p-3" style={{ background: accent ? "color-mix(in srgb, hsl(var(--primary)) 14%, hsl(var(--card)))" : "color-mix(in srgb, hsl(var(--muted)) 40%, hsl(var(--card)))" }}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/70">Box {n}</p>
      <p className="mt-1 text-xs">{label}</p>
      <p className="mt-1 font-display text-lg font-bold">{gbp(value)}</p>
    </div>
  );
}

function BooksColumn({ title, rows, empty }: { title: string; rows: { code: string; name: string; amount: number }[]; empty: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/70">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {rows.map((row) => (
            <li key={row.code} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm">
              <span>{row.code} {row.name}</span>
              <span className="font-semibold">{gbp(row.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AgedCard({ title, summary, empty }: { title: string; summary: ReturnType<typeof agedReceivables>; empty: string }) {
  return (
    <section className="rounded-2xl border border-border/50 bg-card p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <p className="font-display font-bold">{title}</p>
        <p className="font-display text-lg font-bold">{gbp(summary.total)}</p>
      </div>
      <div className="mt-3 grid grid-cols-5 gap-1">
        {BUCKETS.map((bucket) => (
          <div key={bucket.id} className="rounded-lg px-1 py-2 text-center" style={{ background: "color-mix(in srgb, hsl(var(--muted)) 50%, hsl(var(--card)))" }}>
            <p className="text-[9px] font-bold uppercase">{bucket.label}</p>
            <p className="mt-1 text-xs font-semibold">{gbp(summary.totals[bucket.id], 0)}</p>
          </div>
        ))}
      </div>
      {summary.rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-1">
          {summary.rows.slice(0, 8).map((row) => (
            <li key={row.id || row.number} className="flex items-center justify-between text-sm">
              <span className="truncate">{row.number} · {row.name}</span>
              <span className="font-semibold">{gbp(row.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
