import { useMemo, useState } from "react";
import { Download, Plus, Printer, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CompanyInvoiceDocument } from "@/components/companies/CompanyInvoiceDocument";
import { CompanyBankRec } from "@/components/companies/CompanyBankRec";
import {
  useCompanyBank,
  useCompanyBilling,
  useCompanyBills,
  useCompanyCustomers,
  useCompanyInvoices,
} from "@/hooks/useCompanyHub";
import { useCompanyExpenses, useCompanyIncome } from "@/hooks/useCompanies";
import {
  addDaysIso,
  amountDue,
  derivedInvoiceStatus,
  emptyInvoiceLine,
  formatInvoiceNumber,
  gbp,
  todayIso,
} from "@/lib/companyInvoice";
import { nextRepeatDate } from "@/lib/companyBooks";
import {
  createCompanyIngestKey,
  recordCompanyInvoicePaid,
  sendCompanyInvoiceEmail,
  sendCompanyReceiptEmail,
} from "@/lib/companyHubApi";
import type { Company } from "@/types/app";
import type { CompanyBill, CompanyInvoice, CompanyInvoiceLine } from "@/types/companyHub";
import { DEFAULT_CHART_ACCOUNTS, INVOICE_STATUS_LABEL } from "@/types/companyHub";

const STATUS_TONE: Record<string, string> = {
  draft: "bg-slate-200 text-slate-800",
  sent: "bg-sky-100 text-sky-800",
  viewed: "bg-indigo-100 text-indigo-800",
  partial: "bg-amber-100 text-amber-900",
  paid: "bg-emerald-100 text-emerald-800",
  overdue: "bg-red-100 text-red-800",
  void: "bg-slate-100 text-slate-500",
  credited: "bg-violet-100 text-violet-800",
};

export function CompanyInvoicesPanel({ company, canEdit }: { company: Company; canEdit: boolean }) {
  const companyId = company.id!;
  const { invoices, addInvoice, updateInvoice } = useCompanyInvoices(companyId);
  const { bills, updateBill } = useCompanyBills(companyId);
  const { customers, addCustomer } = useCompanyCustomers(companyId);
  const { profile, saveProfile } = useCompanyBilling(companyId);
  const { accounts, transactions, addAccount, addTransactions, matchTransaction } = useCompanyBank(companyId);
  const { addIncome } = useCompanyIncome(companyId);
  const { addExpense } = useCompanyExpenses(companyId);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<CompanyInvoice | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showBilling, setShowBilling] = useState(false);
  const [form, setForm] = useState<Omit<CompanyInvoice, "id" | "createdAt" | "companyId">>(emptyForm(company, profile.defaultVatRate, profile.defaultDueDays, profile.invoicePrefix, profile.nextInvoiceNumber));

  const outstanding = useMemo(
    () => invoices.filter((invoice) => !["paid", "void", "credited"].includes(derivedInvoiceStatus(invoice))).reduce((sum, invoice) => sum + amountDue(invoice), 0),
    [invoices],
  );

  const openNew = () => {
    setEditId(null);
    setForm(emptyForm(company, profile.defaultVatRate, profile.defaultDueDays, profile.invoicePrefix, profile.nextInvoiceNumber));
    setOpen(true);
  };

  const openExisting = (invoice: CompanyInvoice) => {
    setEditId(invoice.id || null);
    setForm({
      number: invoice.number,
      status: invoice.status,
      kind: invoice.kind || "invoice",
      repeat: invoice.repeat,
      source: invoice.source,
      creditOfInvoiceId: invoice.creditOfInvoiceId,
      customerId: invoice.customerId,
      customerName: invoice.customerName,
      customerEmail: invoice.customerEmail,
      customerPhone: invoice.customerPhone,
      customerAddress: invoice.customerAddress,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      currency: invoice.currency || "GBP",
      lines: invoice.lines?.length ? invoice.lines : [emptyInvoiceLine(profile.defaultVatRate)],
      subtotal: invoice.subtotal,
      vatTotal: invoice.vatTotal,
      total: invoice.total,
      amountPaid: invoice.amountPaid,
      notes: invoice.notes,
      paymentTermsDays: invoice.paymentTermsDays,
    });
    setOpen(true);
  };

  const saveDraft = async (status: CompanyInvoice["status"] = "draft") => {
    if (!form.customerName.trim()) {
      toast.error("Add the customer name first");
      return null;
    }
    setBusy(true);
    try {
      const payload = { ...form, status, source: form.source || "hardy" as const };
      if (editId) {
        await updateInvoice(editId, payload);
        return editId;
      }
      const id = await addInvoice(payload);
      await saveProfile({ nextInvoiceNumber: profile.nextInvoiceNumber + 1 });
      if (form.customerEmail && !customers.some((customer) => customer.email === form.customerEmail)) {
        await addCustomer({ name: form.customerName, email: form.customerEmail, phone: form.customerPhone, address: form.customerAddress, source: "hardy" });
      }
      setEditId(id);
      return id;
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    const id = await saveDraft("sent");
    if (!id) return;
    try {
      const result = await sendCompanyInvoiceEmail(companyId, id);
      toast.success(result?.url ? "Invoice emailed with a private payment link" : "Invoice marked as sent");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the invoice email. It is saved as sent.");
    }
  };

  const markPaid = async (invoice: CompanyInvoice) => {
    setBusy(true);
    try {
      if (invoice.id) {
        try {
          await recordCompanyInvoicePaid({ companyId, invoiceId: invoice.id, method: "bank_transfer" });
        } catch {
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
        }
      }
      toast.success("Marked as paid. Receipt can be emailed from the invoice.");
    } finally {
      setBusy(false);
    }
  };

  const markBillPaid = async (bill: CompanyBill) => {
    if (!bill.id) return;
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
  };

  const issueCredit = async () => {
    const original = invoices.find((item) => item.id === editId);
    if (!original?.id) return;
    setBusy(true);
    try {
      await addInvoice({
        number: formatInvoiceNumber("CN", profile.nextInvoiceNumber),
        status: "sent",
        kind: "credit",
        source: "hardy",
        creditOfInvoiceId: original.id,
        customerId: original.customerId,
        customerName: original.customerName,
        customerEmail: original.customerEmail,
        customerPhone: original.customerPhone,
        customerAddress: original.customerAddress,
        issueDate: todayIso(),
        dueDate: todayIso(),
        currency: original.currency || "GBP",
        lines: original.lines,
        subtotal: original.subtotal,
        vatTotal: original.vatTotal,
        total: original.total,
        amountPaid: 0,
        notes: `Credit against ${original.number}`,
        paymentTermsDays: 0,
      });
      await updateInvoice(original.id, { status: "credited" });
      await saveProfile({ nextInvoiceNumber: profile.nextInvoiceNumber + 1 });
      toast.success("Credit note raised");
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const createNextRepeat = async () => {
    const original = invoices.find((item) => item.id === editId);
    const frequency = original?.repeat?.frequency || form.repeat?.frequency || "monthly";
    const nextDate = nextRepeatDate(form.issueDate, frequency);
    setBusy(true);
    try {
      await addInvoice({
        ...form,
        number: formatInvoiceNumber(profile.invoicePrefix || company.name.slice(0, 3), profile.nextInvoiceNumber),
        status: "draft",
        kind: "invoice",
        source: "hardy",
        issueDate: nextDate,
        dueDate: addDaysIso(nextDate, form.paymentTermsDays || 14),
        amountPaid: 0,
        repeat: { frequency, nextDate: nextRepeatDate(nextDate, frequency), active: true },
      });
      if (editId) {
        await updateInvoice(editId, { repeat: { frequency, nextDate, active: true } });
      }
      await saveProfile({ nextInvoiceNumber: profile.nextInvoiceNumber + 1 });
      toast.success("Next repeating invoice drafted");
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className="grid gap-3 sm:grid-cols-3"
      >
        <SummaryTile label="Outstanding" value={gbp(outstanding)} tone={company.color} />
        <SummaryTile label="Paid this year" value={gbp(invoices.filter((invoice) => invoice.status === "paid").reduce((sum, invoice) => sum + invoice.total, 0))} tone="#15803d" />
        <SummaryTile label="Invoices" value={String(invoices.length)} tone={company.color} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {profile.accountsHome === "million" ? "Million remains the clinic ledger. Copies land here when they sync." : profile.accountsHome === "both" ? "Managed here and on Million." : "Hardy Hub is the accounts system for this company."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => setShowBilling((openBilling) => !openBilling)}>Billing setup</Button>
          {canEdit && (
            <Button type="button" className="rounded-xl bg-gradient-primary" onClick={openNew}>
              <Plus className="mr-1 h-4 w-4" /> New invoice
            </Button>
          )}
        </div>
      </div>

      {showBilling && (
        <div className="space-y-3 rounded-2xl border border-border/50 bg-card p-4 shadow-card" style={{ borderLeft: `4px solid ${company.color}` }}>
          <p className="font-display font-bold">Letterhead and payments</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Invoice prefix"><Input value={profile.invoicePrefix} onChange={(event) => void saveProfile({ invoicePrefix: event.target.value.toUpperCase() })} /></Field>
            <Field label="Bill prefix"><Input value={profile.billPrefix} onChange={(event) => void saveProfile({ billPrefix: event.target.value.toUpperCase() })} /></Field>
            <Field label="Default due days"><Input type="number" value={profile.defaultDueDays} onChange={(event) => void saveProfile({ defaultDueDays: Number(event.target.value) || 14 })} /></Field>
            <Field label="VAT rate %"><Input type="number" value={profile.defaultVatRate} onChange={(event) => void saveProfile({ defaultVatRate: Number(event.target.value) || 0 })} /></Field>
            <Field label="Accounts home">
              <select className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm" value={profile.accountsHome} onChange={(event) => void saveProfile({ accountsHome: event.target.value as "hardy" | "million" | "both" })}>
                <option value="hardy">Hardy Hub only</option>
                <option value="million">Million is source of truth</option>
                <option value="both">Both Hardy Hub and Million</option>
              </select>
            </Field>
            <Field label="Million org id"><Input value={profile.millionOrgId || ""} onChange={(event) => void saveProfile({ millionOrgId: event.target.value })} placeholder="For Gwynology or BGM Medical" /></Field>
            <Field label="Website"><Input value={profile.websiteUrl || ""} onChange={(event) => void saveProfile({ websiteUrl: event.target.value })} placeholder="https://" /></Field>
            <Field label="Bank"><Input value={profile.bankName || ""} onChange={(event) => void saveProfile({ bankName: event.target.value })} placeholder="Tide" /></Field>
            <Field label="Account name"><Input value={profile.bankAccountName || ""} onChange={(event) => void saveProfile({ bankAccountName: event.target.value })} /></Field>
            <Field label="Sort code"><Input value={profile.bankSortCode || ""} onChange={(event) => void saveProfile({ bankSortCode: event.target.value })} /></Field>
            <Field label="Account number"><Input value={profile.bankAccountNumber || ""} onChange={(event) => void saveProfile({ bankAccountNumber: event.target.value })} /></Field>
            <div className="sm:col-span-2">
              <Field label="Payment note"><Textarea value={profile.paymentInstructions || ""} onChange={(event) => void saveProfile({ paymentInstructions: event.target.value })} /></Field>
            </div>
          </div>
          {canEdit && (
            <Button type="button" variant="outline" className="rounded-xl" onClick={async () => {
              try {
                const { key } = await createCompanyIngestKey(companyId);
                await navigator.clipboard.writeText(key);
                toast.success("Website ingest key copied. Store it on the company site only. It will not be shown again.");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not create a key");
              }
            }}>Create website ingest key</Button>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-card">
        {invoices.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">No invoices yet. Create one on this company’s letterhead.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {invoices.map((invoice) => {
              const status = derivedInvoiceStatus(invoice);
              return (
                <button key={invoice.id} type="button" onClick={() => openExisting(invoice)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{invoice.kind === "credit" ? "Credit · " : ""}{invoice.number} · {invoice.customerName}</p>
                    <p className="truncate text-xs text-muted-foreground">{invoice.issueDate}{invoice.repeat?.active ? " · repeats" : ""}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_TONE[status]}`}>{INVOICE_STATUS_LABEL[status]}</span>
                  <span className="w-24 text-right text-sm font-bold">{gbp(amountDue(invoice) || invoice.total)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <CompanyBankRec
        canEdit={canEdit}
        invoices={invoices}
        bills={bills}
        accounts={accounts}
        transactions={transactions}
        addAccount={addAccount}
        addTransactions={addTransactions}
        matchTransaction={matchTransaction}
        onMatchInvoice={markPaid}
        onMatchBill={markBillPaid}
        defaultAccountName={profile.bankName || "Tide"}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>{editId ? "Edit invoice" : "New invoice"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Number"><Input value={form.number} onChange={(event) => setForm((current) => ({ ...current, number: event.target.value }))} /></Field>
            <Field label="Customer">
              <Input list={`customers-${companyId}`} value={form.customerName} onChange={(event) => {
                const name = event.target.value;
                const known = customers.find((customer) => customer.name === name);
                setForm((current) => ({
                  ...current,
                  customerName: name,
                  customerId: known?.id,
                  customerEmail: known?.email || current.customerEmail,
                  customerPhone: known?.phone || current.customerPhone,
                  customerAddress: known?.address || current.customerAddress,
                }));
              }} />
              <datalist id={`customers-${companyId}`}>{customers.map((customer) => <option key={customer.id} value={customer.name} />)}</datalist>
            </Field>
            <Field label="Email"><Input type="email" value={form.customerEmail || ""} onChange={(event) => setForm((current) => ({ ...current, customerEmail: event.target.value }))} /></Field>
            <Field label="Phone"><Input value={form.customerPhone || ""} onChange={(event) => setForm((current) => ({ ...current, customerPhone: event.target.value }))} /></Field>
            <Field label="Issue date"><Input type="date" value={form.issueDate} onChange={(event) => setForm((current) => ({ ...current, issueDate: event.target.value, dueDate: addDaysIso(event.target.value, current.paymentTermsDays) }))} /></Field>
            <Field label="Due date"><Input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} /></Field>
            <div className="sm:col-span-2"><Field label="Address"><Textarea value={form.customerAddress || ""} onChange={(event) => setForm((current) => ({ ...current, customerAddress: event.target.value }))} /></Field></div>
          </div>
          <div className="space-y-2">
            {form.lines.map((line, index) => (
              <div key={line.id} className="grid grid-cols-12 items-center gap-2">
                <Input className="col-span-4" placeholder="Description" value={line.description} onChange={(event) => setForm((current) => ({ ...current, lines: patchLine(current.lines, index, { description: event.target.value }) }))} />
                <select className="col-span-3 h-10 rounded-xl border border-border bg-background px-2 text-xs" value={line.accountCode || "200"} onChange={(event) => setForm((current) => ({ ...current, lines: patchLine(current.lines, index, { accountCode: event.target.value }) }))}>
                  {DEFAULT_CHART_ACCOUNTS.filter((account) => account.type === "income").map((account) => (
                    <option key={account.code} value={account.code}>{account.code} {account.name}</option>
                  ))}
                </select>
                <Input className="col-span-1" type="number" value={line.quantity} onChange={(event) => setForm((current) => ({ ...current, lines: patchLine(current.lines, index, { quantity: Number(event.target.value) }) }))} />
                <Input className="col-span-2" type="number" value={line.unitPrice} onChange={(event) => setForm((current) => ({ ...current, lines: patchLine(current.lines, index, { unitPrice: Number(event.target.value) }) }))} />
                <Input className="col-span-1" type="number" value={line.vatRate} onChange={(event) => setForm((current) => ({ ...current, lines: patchLine(current.lines, index, { vatRate: Number(event.target.value) }) }))} />
                <button type="button" className="col-span-1 text-muted-foreground" onClick={() => setForm((current) => ({ ...current, lines: current.lines.filter((_, lineIndex) => lineIndex !== index) }))}><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => setForm((current) => ({ ...current, lines: [...current.lines, emptyInvoiceLine(profile.defaultVatRate)] }))}>Add line</Button>
          </div>
          <Field label="Notes"><Textarea value={form.notes || ""} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></Field>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={busy} onClick={() => void saveDraft("draft").then((id) => id && toast.success("Draft saved"))}>Save draft</Button>
              <Button type="button" className="bg-gradient-primary" disabled={busy} onClick={() => void send()}><Send className="mr-1 h-4 w-4" /> Send</Button>
              {editId && (
                <>
                  <Button type="button" variant="outline" disabled={busy} onClick={() => {
                    const invoice = invoices.find((item) => item.id === editId);
                    if (invoice) void markPaid(invoice);
                  }}>Mark paid</Button>
                  {form.kind !== "credit" && (
                    <Button type="button" variant="outline" disabled={busy} onClick={() => void issueCredit()}>Credit note</Button>
                  )}
                  <Button type="button" variant="outline" disabled={busy} onClick={() => {
                    setForm((current) => ({
                      ...current,
                      repeat: { frequency: "monthly", nextDate: nextRepeatDate(current.issueDate, "monthly"), active: true },
                    }));
                    toast.success("This invoice will repeat monthly. Save, then use Create next when due.");
                  }}>Repeat monthly</Button>
                  {form.repeat?.active && (
                    <Button type="button" variant="outline" disabled={busy} onClick={() => void createNextRepeat()}>Create next</Button>
                  )}
                  <Button type="button" variant="outline" onClick={() => {
                    const invoice = invoices.find((item) => item.id === editId);
                    if (invoice) setPreview(invoice);
                  }}><Printer className="mr-1 h-4 w-4" /> Preview</Button>
                  <Button type="button" variant="outline" onClick={() => editId && void sendCompanyReceiptEmail(companyId, editId).then(() => toast.success("Receipt emailed")).catch((error) => toast.error(error instanceof Error ? error.message : "Could not email receipt"))}>
                    <Download className="mr-1 h-4 w-4" /> Email receipt
                  </Button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(next) => !next && setPreview(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>Print preview</DialogTitle></DialogHeader>
          {preview && <CompanyInvoiceDocument company={company} billing={profile} invoice={preview} kind={preview.status === "paid" ? "receipt" : "invoice"} />}
          <Button type="button" onClick={() => window.print()} className="rounded-xl">Print</Button>
        </DialogContent>
      </Dialog>
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

function SummaryTile({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-border/50 p-4 shadow-card" style={{ background: `color-mix(in srgb, ${tone} 14%, hsl(var(--card)))`, borderLeft: `4px solid ${tone}` }}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}

function patchLine(lines: CompanyInvoiceLine[], index: number, patch: Partial<CompanyInvoiceLine>) {
  return lines.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line));
}

function emptyForm(company: Company, vatRate: number, dueDays: number, prefix: string, next: number): Omit<CompanyInvoice, "id" | "createdAt" | "companyId"> {
  const issueDate = todayIso();
  return {
    number: formatInvoiceNumber(prefix || company.name.slice(0, 3), next || 1),
    status: "draft",
    kind: "invoice",
    source: "hardy",
    customerName: "",
    issueDate,
    dueDate: addDaysIso(issueDate, dueDays || 14),
    currency: "GBP",
    lines: [{ ...emptyInvoiceLine(vatRate), accountCode: "200" }],
    subtotal: 0,
    vatTotal: 0,
    total: 0,
    amountPaid: 0,
    paymentTermsDays: dueDays || 14,
  };
}
