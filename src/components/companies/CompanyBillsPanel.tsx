import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCompanyBilling, useCompanyBills, useCompanyCustomers } from "@/hooks/useCompanyHub";
import { useCompanyExpenses } from "@/hooks/useCompanies";
import {
  addDaysIso,
  emptyInvoiceLine,
  formatInvoiceNumber,
  gbp,
  todayIso,
} from "@/lib/companyInvoice";
import { amountOwedOnBill, derivedBillStatus } from "@/lib/companyBooks";
import type { Company } from "@/types/app";
import type { CompanyBill, CompanyInvoiceLine } from "@/types/companyHub";
import { BILL_STATUS_LABEL, DEFAULT_CHART_ACCOUNTS } from "@/types/companyHub";

const STATUS_TONE: Record<string, string> = {
  draft: "bg-slate-200 text-slate-800",
  awaiting: "bg-amber-100 text-amber-900",
  paid: "bg-emerald-100 text-emerald-800",
  overdue: "bg-red-100 text-red-800",
  void: "bg-slate-100 text-slate-500",
};

export function CompanyBillsPanel({ company, canEdit }: { company: Company; canEdit: boolean }) {
  const companyId = company.id!;
  const { bills, addBill, updateBill } = useCompanyBills(companyId);
  const { customers, addCustomer } = useCompanyCustomers(companyId);
  const { profile, saveProfile } = useCompanyBilling(companyId);
  const { addExpense } = useCompanyExpenses(companyId);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Omit<CompanyBill, "id" | "createdAt" | "companyId">>(emptyBill(profile.defaultVatRate, profile.billPrefix, profile.nextBillNumber));

  const suppliers = customers.filter((customer) => customer.kind !== "customer");
  const toPay = useMemo(
    () => bills.filter((bill) => !["paid", "void"].includes(derivedBillStatus(bill))).reduce((sum, bill) => sum + amountOwedOnBill(bill), 0),
    [bills],
  );

  const openNew = () => {
    setEditId(null);
    setForm(emptyBill(profile.defaultVatRate, profile.billPrefix, profile.nextBillNumber));
    setOpen(true);
  };

  const openExisting = (bill: CompanyBill) => {
    setEditId(bill.id || null);
    setForm({
      number: bill.number,
      status: bill.status,
      supplierId: bill.supplierId,
      supplierName: bill.supplierName,
      supplierEmail: bill.supplierEmail,
      issueDate: bill.issueDate,
      dueDate: bill.dueDate,
      lines: bill.lines?.length ? bill.lines : [emptyInvoiceLine(profile.defaultVatRate)],
      subtotal: bill.subtotal,
      vatTotal: bill.vatTotal,
      total: bill.total,
      amountPaid: bill.amountPaid,
      category: bill.category,
      notes: bill.notes,
      expenseId: bill.expenseId,
    });
    setOpen(true);
  };

  const save = async (status: CompanyBill["status"] = "awaiting") => {
    if (!form.supplierName.trim()) {
      toast.error("Add the supplier name first");
      return null;
    }
    setBusy(true);
    try {
      const payload = { ...form, status };
      if (editId) {
        await updateBill(editId, payload);
        return editId;
      }
      const id = await addBill(payload);
      await saveProfile({ nextBillNumber: profile.nextBillNumber + 1 });
      if (!customers.some((customer) => customer.name === form.supplierName)) {
        await addCustomer({ name: form.supplierName, email: form.supplierEmail, kind: "supplier", source: "hardy" });
      }
      setEditId(id);
      setOpen(false);
      toast.success("Bill saved");
      return id;
    } finally {
      setBusy(false);
    }
  };

  const markPaid = async (bill: CompanyBill) => {
    setBusy(true);
    try {
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
      toast.success("Bill marked paid");
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile label="To pay" value={gbp(toPay)} tone="#b91c1c" />
        <SummaryTile label="Paid this year" value={gbp(bills.filter((bill) => derivedBillStatus(bill) === "paid").reduce((sum, bill) => sum + bill.total, 0))} tone="#15803d" />
        <SummaryTile label="Bills" value={String(bills.length)} tone={company.color} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Supplier bills live here. Receipt snaps stay on Expenses. Both feed the company books.</p>
        {canEdit && (
          <Button type="button" className="rounded-xl bg-gradient-primary" onClick={openNew}>
            <Plus className="mr-1 h-4 w-4" /> New bill
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-card">
        {bills.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">No bills yet. Enter a supplier invoice when it arrives.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {bills.map((bill) => {
              const status = derivedBillStatus(bill);
              return (
                <button key={bill.id} type="button" onClick={() => openExisting(bill)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{bill.number} · {bill.supplierName}</p>
                    <p className="truncate text-xs text-muted-foreground">{bill.issueDate} · due {bill.dueDate}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_TONE[status]}`}>{BILL_STATUS_LABEL[status]}</span>
                  <span className="w-24 text-right text-sm font-bold">{gbp(amountOwedOnBill(bill) || bill.total)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>{editId ? "Edit bill" : "New bill"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Number"><Input value={form.number} onChange={(event) => setForm((current) => ({ ...current, number: event.target.value }))} /></Field>
            <Field label="Supplier">
              <Input list={`suppliers-${companyId}`} value={form.supplierName} onChange={(event) => {
                const name = event.target.value;
                const known = suppliers.find((supplier) => supplier.name === name) || customers.find((customer) => customer.name === name);
                setForm((current) => ({
                  ...current,
                  supplierName: name,
                  supplierId: known?.id,
                  supplierEmail: known?.email || current.supplierEmail,
                }));
              }} />
              <datalist id={`suppliers-${companyId}`}>{customers.map((customer) => <option key={customer.id} value={customer.name} />)}</datalist>
            </Field>
            <Field label="Email"><Input type="email" value={form.supplierEmail || ""} onChange={(event) => setForm((current) => ({ ...current, supplierEmail: event.target.value }))} /></Field>
            <Field label="Category"><Input value={form.category || ""} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} placeholder="Software" /></Field>
            <Field label="Issue date"><Input type="date" value={form.issueDate} onChange={(event) => setForm((current) => ({ ...current, issueDate: event.target.value, dueDate: addDaysIso(event.target.value, 14) }))} /></Field>
            <Field label="Due date"><Input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} /></Field>
          </div>
          <div className="space-y-2">
            {form.lines.map((line, index) => (
              <div key={line.id} className="grid grid-cols-12 items-center gap-2">
                <Input className="col-span-4" placeholder="Description" value={line.description} onChange={(event) => setForm((current) => ({ ...current, lines: patchLine(current.lines, index, { description: event.target.value }) }))} />
                <select className="col-span-3 h-10 rounded-xl border border-border bg-background px-2 text-xs" value={line.accountCode || "490"} onChange={(event) => setForm((current) => ({ ...current, lines: patchLine(current.lines, index, { accountCode: event.target.value }) }))}>
                  {DEFAULT_CHART_ACCOUNTS.filter((account) => account.type === "expense").map((account) => (
                    <option key={account.code} value={account.code}>{account.code} {account.name}</option>
                  ))}
                </select>
                <Input className="col-span-1" type="number" value={line.quantity} onChange={(event) => setForm((current) => ({ ...current, lines: patchLine(current.lines, index, { quantity: Number(event.target.value) }) }))} />
                <Input className="col-span-2" type="number" value={line.unitPrice} onChange={(event) => setForm((current) => ({ ...current, lines: patchLine(current.lines, index, { unitPrice: Number(event.target.value) }) }))} />
                <Input className="col-span-1" type="number" value={line.vatRate} onChange={(event) => setForm((current) => ({ ...current, lines: patchLine(current.lines, index, { vatRate: Number(event.target.value) }) }))} />
                <button type="button" className="col-span-1 text-muted-foreground" onClick={() => setForm((current) => ({ ...current, lines: current.lines.filter((_, lineIndex) => lineIndex !== index) }))}><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => setForm((current) => ({ ...current, lines: [...current.lines, { ...emptyInvoiceLine(profile.defaultVatRate), accountCode: "490" }] }))}>Add line</Button>
          </div>
          <Field label="Notes"><Textarea value={form.notes || ""} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></Field>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={busy} onClick={() => void save("draft")}>Save draft</Button>
              <Button type="button" className="bg-gradient-primary" disabled={busy} onClick={() => void save("awaiting")}>Save bill</Button>
              {editId && (
                <Button type="button" variant="outline" disabled={busy} onClick={() => {
                  const bill = bills.find((item) => item.id === editId);
                  if (bill) void markPaid(bill);
                }}>Mark paid</Button>
              )}
            </div>
          )}
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

function emptyBill(vatRate: number, prefix: string, next: number): Omit<CompanyBill, "id" | "createdAt" | "companyId"> {
  const issueDate = todayIso();
  return {
    number: formatInvoiceNumber(prefix || "BILL", next || 1),
    status: "draft",
    supplierName: "",
    issueDate,
    dueDate: addDaysIso(issueDate, 14),
    lines: [{ ...emptyInvoiceLine(vatRate), accountCode: "490" }],
    subtotal: 0,
    vatTotal: 0,
    total: 0,
    amountPaid: 0,
  };
}
