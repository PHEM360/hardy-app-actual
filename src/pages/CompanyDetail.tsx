import { useState, useMemo, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Plus, Trash2, Edit2, Eye, EyeOff, Upload, ExternalLink,
  Key, Briefcase, Receipt, BarChart3, Info, Settings2, X, Shield,
  TrendingUp, FileText, Pencil, Download, ChevronRight, History, ChevronDown, ChevronUp, Camera,
} from "lucide-react";
import DocumentScannerSheet, { ScanModeChooser } from "@/components/DocumentScannerSheet";
import CompanyLogoMark from "@/components/companies/CompanyLogoMark";
import { ReceiptAttachCard, ReceiptLightbox, ReceiptManageCard, ReceiptThumb } from "@/components/receipts/ReceiptPreview";
import { alignedReceiptNames, type ReceiptSource } from "@/lib/receipts";
import { toast } from "sonner";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useCompanies,
  useCompanyLogins,
  useCompanyServices,
  useCompanyExpenses,
  expenseSaveMessage,
  useCompanyInsurance,
  useCompanyIncome,
  useCompanyTaxReturns,
  useMultiCompanyFinance,
} from "@/hooks/useCompanies";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useSharedScope } from "@/hooks/useSharedScope";
import { CompanyLogin, CompanyService, CompanyExpense, CompanyInsurance, CompanyIncome, CompanyTaxReturn, Company, sortCategoriesOtherLast } from "@/types/app";

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview",    label: "Overview",    icon: Info },
  { id: "finance",     label: "Finance",     icon: TrendingUp },
  { id: "logins",      label: "Logins",      icon: Key },
  { id: "services",    label: "Services",    icon: Briefcase },
  { id: "expenses",    label: "Expenses",    icon: Receipt },
  { id: "insurance",   label: "Insurance",   icon: Shield },
  { id: "tax",         label: "Tax",         icon: FileText },
  { id: "projection",  label: "Projection",  icon: BarChart3 },
  { id: "settings",    label: "Settings",    icon: Settings2 },
];

const COMPANY_TYPE_LABELS_DETAIL: Record<string, string> = {
  registered: "Ltd company",
  sole_trader: "Sole trader",
  trading_name: "Trading name",
  other: "Company",
};

const SERVICE_UNITS = ["per month", "per year", "per project", "per hour", "per day", "one-off"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Given a tax year start date (ISO), return the end of the CURRENT tax year */
function getCurrentTaxYearEnd(taxYearStart: string): Date {
  if (!taxYearStart) return new Date(new Date().getFullYear(), 11, 31);
  const base = new Date(taxYearStart);
  const now = new Date();
  let yearStart = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  while (new Date(yearStart.getFullYear() + 1, yearStart.getMonth(), yearStart.getDate()) <= now) {
    yearStart = new Date(yearStart.getFullYear() + 1, yearStart.getMonth(), yearStart.getDate());
  }
  const yearEnd = new Date(yearStart.getFullYear() + 1, yearStart.getMonth(), yearStart.getDate());
  yearEnd.setDate(yearEnd.getDate() - 1);
  return yearEnd;
}

function daysRemaining(end: Date): number {
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

function fmt(n: number) {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ─── Logins Tab ───────────────────────────────────────────────────────────────

function LoginsTab({ companyId }: { companyId: string }) {
  const { logins, addLogin, updateLogin, deleteLogin } = useCompanyLogins(companyId);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<CompanyLogin | null>(null);
  const [form, setForm] = useState<Omit<CompanyLogin, "id">>({ service: "", username: "", password: "", url: "", notes: "" });
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const openAdd = () => { setEdit(null); setForm({ service: "", username: "", password: "", url: "", notes: "" }); setOpen(true); };
  const openEdit = (l: CompanyLogin) => { setEdit(l); setForm({ service: l.service, username: l.username, password: l.password || "", url: l.url || "", notes: l.notes || "" }); setOpen(true); };

  const save = async () => {
    setSaving(true);
    try {
      if (edit?.id) await updateLogin(edit.id, form); else await addLogin(form);
      setOpen(false);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={openAdd} className="flex items-center gap-1 text-xs text-primary font-medium"><Plus className="w-3.5 h-3.5" /> Add Login</button>
      </div>
      {logins.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">No logins saved yet.</p>}
      {logins.map((l) => (
        <div key={l.id} className="p-3.5 rounded-xl border border-border/50 bg-card shadow-soft space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-card-foreground">{l.service}</p>
            <div className="flex gap-1">
              <button onClick={() => openEdit(l)} className="p-1 text-muted-foreground hover:text-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
              <button onClick={() => l.id && deleteLogin(l.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Username: <span className="text-foreground font-mono">{l.username}</span></p>
          {l.password && (
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">Password: <span className="text-foreground font-mono">{revealed[l.id!] ? l.password : "••••••••"}</span></p>
              <button onClick={() => setRevealed((r) => ({ ...r, [l.id!]: !r[l.id!] }))} className="text-muted-foreground hover:text-foreground">
                {revealed[l.id!] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
            </div>
          )}
          {l.url && <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary"><ExternalLink className="w-3 h-3" /> {l.url}</a>}
          {l.notes && <p className="text-xs text-muted-foreground italic">{l.notes}</p>}
        </div>
      ))}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
          <DialogHeader><DialogTitle className="font-display">{edit ? "Edit Login" : "Add Login"}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1"><Label>Service *</Label><Input value={form.service} onChange={(e) => setForm((f) => ({ ...f, service: e.target.value }))} placeholder="e.g. Xero, Companies House" className="h-9 rounded-xl" /></div>
            <div className="space-y-1"><Label>Username / Email *</Label><Input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} className="h-9 rounded-xl" /></div>
            <div className="space-y-1"><Label>Password</Label><Input type="text" value={form.password || ""} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="h-9 rounded-xl font-mono" /></div>
            <div className="space-y-1"><Label>URL</Label><Input value={form.url || ""} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://" className="h-9 rounded-xl" /></div>
            <div className="space-y-1"><Label>Notes</Label><Textarea value={form.notes || ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="rounded-xl resize-none" rows={2} /></div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setOpen(false)} className="flex-1 h-9 rounded-xl">Cancel</Button>
              <Button onClick={save} disabled={!form.service || !form.username || saving} className="flex-1 h-9 rounded-xl bg-gradient-primary">{saving ? "Saving…" : "Save"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Services Tab ─────────────────────────────────────────────────────────────

function ServicesTab({ companyId }: { companyId: string }) {
  const { services, addService, updateService, deleteService } = useCompanyServices(companyId);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<CompanyService | null>(null);
  const [form, setForm] = useState<Omit<CompanyService, "id">>({ name: "", description: "", price: 0, unit: "per month", category: "" });
  const [saving, setSaving] = useState(false);
  const { settings } = useCompanySettings(companyId);

  const openAdd = () => { setEdit(null); setForm({ name: "", description: "", price: 0, unit: "per month", category: "" }); setOpen(true); };
  const openEdit = (s: CompanyService) => { setEdit(s); setForm({ name: s.name, description: s.description || "", price: s.price, unit: s.unit, category: s.category || "" }); setOpen(true); };
  const save = async () => {
    setSaving(true);
    try {
      if (edit?.id) await updateService(edit.id, form); else await addService(form);
      setOpen(false);
    } finally { setSaving(false); }
  };

  const totalAnnual = services.reduce((sum, s) => {
    const mult = s.unit === "per month" ? 12 : s.unit === "per year" ? 1 : 0;
    return sum + s.price * mult;
  }, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Est. annual revenue</p>
          <p className="text-lg font-bold font-display text-card-foreground">£{totalAnnual.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1 text-xs text-primary font-medium"><Plus className="w-3.5 h-3.5" /> Add Service</button>
      </div>
      {services.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">No services defined yet.</p>}
      {services.map((s) => (
        <div key={s.id} className="p-3.5 rounded-xl border border-border/50 bg-card shadow-soft">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-card-foreground">{s.name}</p>
              {s.category && <p className="text-[10px] text-muted-foreground">{s.category}</p>}
              {s.description && <p className="text-xs text-muted-foreground mt-1">{s.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-sm font-bold font-display text-card-foreground">£{s.price.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</p>
                <p className="text-[10px] text-muted-foreground">{s.unit}</p>
              </div>
              <button onClick={() => openEdit(s)} className="p-1 text-muted-foreground hover:text-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
              <button onClick={() => s.id && deleteService(s.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        </div>
      ))}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
          <DialogHeader><DialogTitle className="font-display">{edit ? "Edit Service" : "Add Service"}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1"><Label>Service Name *</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="h-9 rounded-xl" /></div>
            <div className="space-y-1"><Label>Description</Label><Textarea value={form.description || ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="rounded-xl resize-none" rows={2} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>Price (£)</Label><Input type="number" step="0.01" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: parseFloat(e.target.value) || 0 }))} className="h-9 rounded-xl" /></div>
              <div className="space-y-1"><Label>Unit</Label>
                <Select value={form.unit} onValueChange={(v) => setForm((f) => ({ ...f, unit: v }))}>
                  <SelectTrigger className="h-9 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>{SERVICE_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={form.category || ""} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger className="h-9 rounded-xl"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{settings.incomeCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setOpen(false)} className="flex-1 h-9 rounded-xl">Cancel</Button>
              <Button onClick={save} disabled={!form.name || saving} className="flex-1 h-9 rounded-xl bg-gradient-primary">{saving ? "Saving…" : "Save"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Expenses Tab ─────────────────────────────────────────────────────────────

function ExpensesTab({ companyId }: { companyId: string }) {
  const {
    expenses, uploadingReceipt, addExpense, updateExpense, deleteExpense,
    uploadReceipt, removeReceipt, replaceReceipt, renameReceipt,
  } = useCompanyExpenses(companyId);
  const { settings } = useCompanySettings(companyId);
  const [open, setOpen] = useState(false);
  const emptyForm: Omit<CompanyExpense, "id" | "createdAt"> = {
    date: new Date().toISOString().split("T")[0],
    description: "",
    amount: 0,
    category: "Other",
    receipts: [],
    receiptNames: [],
  };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const newFileRef = useRef<HTMLInputElement>(null);
  const [newReceiptCapture, setNewReceiptCapture] = useState<File | null>(null);
  const [newReceiptFile, setNewReceiptFile] = useState<File | null>(null);
  const [chosenMode, setChosenMode] = useState<"scan" | "picture" | null>(null);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [scannerCtx, setScannerCtx] = useState<{
    expId: string;
    receipts: string[];
    file: File;
    replaceUrl?: string;
  } | null>(null);
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<ReceiptSource | null>(null);

  const liveExpense = editingId ? expenses.find((e) => e.id === editingId) : undefined;
  const liveReceipts = liveExpense?.receipts ?? form.receipts ?? [];
  const liveNames = alignedReceiptNames(liveReceipts, liveExpense?.receiptNames ?? form.receiptNames);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setNewReceiptFile(null);
    setOpen(true);
  };

  const openEdit = (exp: CompanyExpense) => {
    setEditingId(exp.id ?? null);
    setForm({
      date: exp.date,
      description: exp.description,
      amount: exp.amount,
      category: exp.category,
      receipts: exp.receipts ?? [],
      receiptNames: alignedReceiptNames(exp.receipts ?? [], exp.receiptNames),
    });
    setNewReceiptFile(null);
    setOpen(true);
  };

  const attachIncomingFile = (f: File) => {
    if (f.type.startsWith("image/")) {
      setNewReceiptCapture(f);
      return;
    }
    if (editingId) {
      void uploadReceipt(editingId, f, liveReceipts);
    } else {
      setNewReceiptFile(f);
    }
  };

  const totalThisYear = useMemo(() => {
    const now = new Date();
    return expenses
      .filter((e) => new Date(e.date).getFullYear() === now.getFullYear())
      .reduce((s, e) => s + e.amount, 0);
  }, [expenses]);

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e) => { map[e.category] = (map[e.category] || 0) + e.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const handleNewFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) attachIncomingFile(f);
  };

  const openUpload = () => {
    const input = newFileRef.current;
    if (!input) return;
    input.removeAttribute("capture");
    input.setAttribute("accept", "image/*,application/pdf");
    setChosenMode(null);
    input.click();
  };

  const openCameraChooser = () => setChooserOpen(true);

  const handlePick = (file: File, mode: "scan" | "picture") => {
    setChosenMode(mode);
    setChooserOpen(false);
    setNewReceiptCapture(file);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editingId) {
        await updateExpense(editingId, { date: form.date, description: form.description, amount: form.amount, category: form.category });
        if (newReceiptFile) {
          try {
            await uploadReceipt(editingId, newReceiptFile, form.receipts ?? []);
          } catch (receiptErr) {
            console.error("Failed to upload receipt", receiptErr);
            toast.success("Expense saved", { description: "The receipt didn’t upload — try attaching it again." });
            setOpen(false);
            setEditingId(null);
            setForm(emptyForm);
            setNewReceiptFile(null);
            return;
          }
        }
      } else {
        const id = await addExpense({
          date: form.date,
          description: form.description,
          amount: form.amount,
          category: form.category,
          receipts: [],
        });
        if (id && newReceiptFile) {
          try {
            await uploadReceipt(id, newReceiptFile, []);
          } catch (receiptErr) {
            console.error("Failed to upload receipt", receiptErr);
            toast.success("Expense saved", { description: "The receipt didn’t upload — try attaching it again." });
            setOpen(false);
            setEditingId(null);
            setForm(emptyForm);
            setNewReceiptFile(null);
            return;
          }
        }
      }
      setOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      setNewReceiptFile(null);
      toast.success("Expense saved");
    } catch (err) {
      console.error("Failed to save expense", err);
      toast.error(expenseSaveMessage(err));
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5">
        <div
          className="rounded-2xl p-3.5 shadow-card"
          style={{ background: "color-mix(in srgb, hsl(var(--destructive)) 16%, hsl(var(--card)))", borderLeft: "4px solid hsl(var(--destructive))" }}
        >
          <p className="text-[10px] uppercase tracking-wider font-semibold text-destructive/80">This year</p>
          <p className="text-lg font-bold font-display text-destructive">£{totalThisYear.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</p>
        </div>
        <div
          className="rounded-2xl p-3.5 shadow-card"
          style={{ background: "color-mix(in srgb, hsl(var(--primary)) 14%, hsl(var(--card)))", borderLeft: "4px solid hsl(var(--primary))" }}
        >
          <p className="text-[10px] uppercase tracking-wider font-semibold text-primary/80">Entries</p>
          <p className="text-lg font-bold font-display text-foreground">{expenses.length}</p>
        </div>
      </div>

      {byCategory.length > 0 && (
        <div className="p-3.5 rounded-xl border border-border/50 bg-card shadow-soft space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">By Category</p>
          {byCategory.map(([cat, amt]) => (
            <div key={cat} className="flex justify-between text-xs">
              <span className="text-card-foreground">{cat}</span>
              <span className="font-medium">£{amt.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={openAdd} className="flex h-9 items-center gap-1.5 rounded-xl bg-gradient-primary px-3 text-xs font-semibold text-primary-foreground shadow-soft">
          <Plus className="h-3.5 w-3.5" /> Add expense
        </button>
      </div>

      <div className="space-y-2">
        {expenses.length === 0 && (
          <div className="rounded-2xl border border-border/40 bg-card px-4 py-10 text-center shadow-soft">
            <p className="text-sm font-semibold text-foreground">No expenses yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Add one to keep receipts with the spend.</p>
          </div>
        )}
        {expenses.map((exp) => {
          const names = alignedReceiptNames(exp.receipts ?? [], exp.receiptNames);
          return (
            <div
              key={exp.id}
              role="button"
              tabIndex={0}
              onClick={() => openEdit(exp)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openEdit(exp); } }}
              className="cursor-pointer rounded-2xl border border-border/40 p-3.5 shadow-soft transition-shadow hover:shadow-md"
              style={{
                background: "color-mix(in srgb, hsl(var(--destructive)) 10%, hsl(var(--card)))",
                borderLeftWidth: 4,
                borderLeftColor: "hsl(var(--destructive))",
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-card-foreground">{exp.description}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{exp.date} · {exp.category}</p>
                  {(exp.receipts?.length ?? 0) > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {exp.receipts!.map((url, i) => (
                        <ReceiptThumb
                          key={url}
                          source={{ url, name: names[i] }}
                          className="h-20 w-16"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewer({ url, name: names[i] });
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <div className="ml-1 flex shrink-0 items-center gap-1">
                  <p className="text-sm font-bold font-display text-destructive">£{exp.amount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</p>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openEdit(exp); }}
                    className="p-1 text-muted-foreground hover:text-primary"
                    aria-label="Edit expense"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); exp.id && deleteExpense(exp.id); }}
                    className="p-1 text-muted-foreground hover:text-destructive"
                    aria-label="Delete expense"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {(exp.history?.length ?? 0) > 0 && (
                <div className="mt-2 -mx-3.5 -mb-3.5 border-t border-border/40">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setHistoryOpenId((cur) => (cur === exp.id ? null : exp.id ?? null));
                    }}
                    className="flex w-full items-center justify-between px-3.5 py-2 text-[10px] font-medium text-muted-foreground hover:bg-background/40"
                  >
                    <span className="flex items-center gap-1.5"><History className="h-3 w-3" /> Edited ({exp.history!.length})</span>
                    {historyOpenId === exp.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                  {historyOpenId === exp.id && (
                    <div className="divide-y divide-border/40 bg-background/30 text-[10px]">
                      {[...exp.history!].reverse().map((h, i) => (
                        <div key={i} className="space-y-0.5 px-3.5 py-2">
                          <div className="font-medium text-muted-foreground">Before edit on {new Date(h.editedAt).toLocaleString("en-GB")}</div>
                          <div>{h.description} · £{h.amount.toLocaleString("en-GB", { minimumFractionDigits: 2 })} · {h.date} · {h.category}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next && viewer) return;
          setOpen(next);
        }}
      >
        <DialogContent
          aria-describedby={undefined}
          className="mx-4 max-w-md"
          onPointerDownOutside={(e) => { if (viewer) e.preventDefault(); }}
          onInteractOutside={(e) => { if (viewer) e.preventDefault(); }}
          onEscapeKeyDown={(e) => { if (viewer) e.preventDefault(); }}
        >
          <DialogHeader>
            <DialogTitle className="font-display">{editingId ? (form.description || "Expense") : "Add expense"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1"><Label>Description *</Label><Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="h-9 rounded-xl" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>Amount (£)</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} className="h-9 rounded-xl" /></div>
              <div className="space-y-1"><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="h-9 rounded-xl" /></div>
            </div>
            <div className="space-y-1"><Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger className="h-9 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{settings.expenseCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Receipt</Label>
              {editingId && liveReceipts.length > 0 && (
                <div className="space-y-2">
                  {liveReceipts.map((url, i) => (
                    <ReceiptManageCard
                      key={url}
                      url={url}
                      name={liveNames[i]}
                      busy={uploadingReceipt}
                      onPreview={() => setViewer({ url, name: liveNames[i] })}
                      onRename={(name) => { void renameReceipt(editingId, url, name); }}
                      onReplace={(file) => {
                        if (file.type.startsWith("image/")) {
                          setScannerCtx({ expId: editingId, receipts: liveReceipts, file, replaceUrl: url });
                        } else {
                          void replaceReceipt(editingId, url, file);
                        }
                      }}
                      onRemove={() => { void removeReceipt(editingId, url); }}
                    />
                  ))}
                </div>
              )}
              <input ref={newFileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleNewFile} />
              {newReceiptFile && !editingId ? (
                <ReceiptAttachCard
                  file={newReceiptFile}
                  onRemove={() => setNewReceiptFile(null)}
                  onPreview={() => setViewer({ file: newReceiptFile, name: newReceiptFile.name })}
                />
              ) : (
                <div className="flex gap-2">
                  <button type="button" onClick={openUpload} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/30 text-xs text-muted-foreground hover:bg-muted/60">
                    <Upload className="h-3.5 w-3.5" /> {liveReceipts.length || newReceiptFile ? "Add another" : "Upload file"}
                  </button>
                  <button type="button" onClick={openCameraChooser} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/30 text-xs text-muted-foreground hover:bg-muted/60">
                    <Camera className="h-3.5 w-3.5" /> Take photo
                  </button>
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => { setOpen(false); setEditingId(null); setNewReceiptFile(null); }} className="h-9 flex-1 rounded-xl">Cancel</Button>
              <Button onClick={save} disabled={!form.description || saving} className="h-9 flex-1 rounded-xl bg-gradient-primary">{saving ? "Saving…" : "Save"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ask scan vs picture before the camera opens */}
      <ScanModeChooser
        open={chooserOpen}
        onPick={handlePick}
        onCancel={() => setChooserOpen(false)}
      />

      {/* Scan & crop (or just confirm + rename) a receipt for the expense currently being created */}
      <DocumentScannerSheet
        imageFile={newReceiptCapture}
        initialMode={chosenMode ?? undefined}
        onConfirm={(scannedFile) => {
          if (editingId) {
            void uploadReceipt(editingId, scannedFile, liveReceipts);
          } else {
            setNewReceiptFile(scannedFile);
          }
          setNewReceiptCapture(null);
          setChosenMode(null);
        }}
        onCancel={() => { setNewReceiptCapture(null); setChosenMode(null); }}
      />

      <DocumentScannerSheet
        imageFile={scannerCtx?.file ?? null}
        onConfirm={(scannedFile) => {
          if (scannerCtx) {
            if (scannerCtx.replaceUrl) {
              void replaceReceipt(scannerCtx.expId, scannerCtx.replaceUrl, scannedFile);
            } else {
              void uploadReceipt(scannerCtx.expId, scannedFile, scannerCtx.receipts);
            }
          }
          setScannerCtx(null);
        }}
        onCancel={() => setScannerCtx(null)}
      />

      <ReceiptLightbox source={viewer} open={!!viewer} onClose={() => setViewer(null)} />
    </div>
  );
}

// ─── Projection Tab ───────────────────────────────────────────────────────────

const PROJ_YEARS = 5; // number of future years after "This TY"
const YEAR_LABELS = ["This TY", "Year 1", "Year 2", "Year 3", "Year 4", "Year 5"];

interface ProjIncomeLine {
  id: string;
  name: string;
  unitPrice: number;
  qty: number;
  period: "per year" | "per month" | "per week" | "per day" | "one-off";
}

interface ProjExpenseLine {
  id: string;
  name: string;
  amount: number;
  period: "per year" | "per month" | "one-off";
}

interface ProjYear {
  income: ProjIncomeLine[];
  expenditure: ProjExpenseLine[];
}

const INCOME_PERIODS = ["per year", "per month", "per week", "per day", "one-off"] as const;
const EXPENSE_PERIODS = ["per year", "per month", "one-off"] as const;

const ANNUAL_MULT: Record<string, number> = {
  "per year": 1, "per month": 12, "per week": 52, "per day": 365, "one-off": 1,
};

function uid() { return Math.random().toString(36).slice(2, 9); }

function calcYearTotals(year: ProjYear, prorateFactor = 1, isThisTY = false) {
  const revenue = year.income.reduce((s, l) => {
    const annual = l.unitPrice * l.qty * ANNUAL_MULT[l.period];
    return s + (isThisTY ? annual * prorateFactor : annual);
  }, 0);
  const expenses = year.expenditure.reduce((s, l) => {
    const annual = l.amount * ANNUAL_MULT[l.period];
    return s + (isThisTY ? annual * prorateFactor : annual);
  }, 0);
  return { revenue: Math.round(revenue), expenses: Math.round(expenses) };
}

// ── Income line editor ──
function IncomeLineRow({
  line, onUpdate, onDelete,
}: { line: ProjIncomeLine; onUpdate: (patch: Partial<ProjIncomeLine>) => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-2 py-2 border-b border-border/20 last:border-0">
      <Input
        value={line.name}
        onChange={(e) => onUpdate({ name: e.target.value })}
        placeholder="Service name"
        className="h-8 rounded-lg text-xs flex-1 min-w-0"
      />
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[10px] text-muted-foreground">£</span>
        <Input
          type="number" min={0} step={0.01}
          value={line.unitPrice}
          onChange={(e) => onUpdate({ unitPrice: parseFloat(e.target.value) || 0 })}
          className="h-8 rounded-lg text-xs w-20 text-right"
          placeholder="Price"
        />
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[10px] text-muted-foreground">×</span>
        <Input
          type="number" min={0} step={1}
          value={line.qty}
          onChange={(e) => onUpdate({ qty: parseFloat(e.target.value) || 0 })}
          className="h-8 rounded-lg text-xs w-14 text-center"
          placeholder="Qty"
        />
      </div>
      <select
        value={line.period}
        onChange={(e) => onUpdate({ period: e.target.value as ProjIncomeLine["period"] })}
        className="h-8 rounded-lg text-[10px] bg-muted border border-border px-1.5 shrink-0 cursor-pointer"
      >
        {INCOME_PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <span className="text-[10px] text-green-700 font-medium tabular-nums shrink-0 w-16 text-right">
        {fmt(Math.round(line.unitPrice * line.qty * ANNUAL_MULT[line.period]))}<span className="text-muted-foreground">/yr</span>
      </span>
      <button onClick={onDelete} className="p-1 text-muted-foreground hover:text-destructive shrink-0">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Expense line editor ──
function ExpenseLineRow({
  line, onUpdate, onDelete,
}: { line: ProjExpenseLine; onUpdate: (patch: Partial<ProjExpenseLine>) => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-2 py-2 border-b border-border/20 last:border-0">
      <Input
        value={line.name}
        onChange={(e) => onUpdate({ name: e.target.value })}
        placeholder="Expense name"
        className="h-8 rounded-lg text-xs flex-1 min-w-0"
      />
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[10px] text-muted-foreground">£</span>
        <Input
          type="number" min={0} step={0.01}
          value={line.amount}
          onChange={(e) => onUpdate({ amount: parseFloat(e.target.value) || 0 })}
          className="h-8 rounded-lg text-xs w-24 text-right"
          placeholder="Amount"
        />
      </div>
      <select
        value={line.period}
        onChange={(e) => onUpdate({ period: e.target.value as ProjExpenseLine["period"] })}
        className="h-8 rounded-lg text-[10px] bg-muted border border-border px-1.5 shrink-0 cursor-pointer"
      >
        {EXPENSE_PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <span className="text-[10px] text-red-600 font-medium tabular-nums shrink-0 w-16 text-right">
        {fmt(Math.round(line.amount * ANNUAL_MULT[line.period]))}<span className="text-muted-foreground">/yr</span>
      </span>
      <button onClick={onDelete} className="p-1 text-muted-foreground hover:text-destructive shrink-0">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function ProjectionTab({ companyId, taxYearStart }: { companyId: string; taxYearStart?: string }) {
  const { services } = useCompanyServices(companyId);
  const { expenses } = useCompanyExpenses(companyId);
  const { settings } = useCompanySettings(companyId);

  const [taxRate, setTaxRate] = useState(settings.corporateTaxRate ?? 19);
  const [activeYear, setActiveYear] = useState(0);
  const [chartType, setChartType] = useState<"bar" | "area">("bar");

  const taxYearEnd = useMemo(() => getCurrentTaxYearEnd(taxYearStart || ""), [taxYearStart]);
  const daysLeft = useMemo(() => daysRemaining(taxYearEnd), [taxYearEnd]);
  const prorateFactor = Math.min(1, daysLeft / 365);

  // Initialise per-year data
  const [years, setYears] = useState<ProjYear[]>(() =>
    YEAR_LABELS.map(() => ({ income: [], expenditure: [] }))
  );

  // Seed income lines from services (once)
  const seeded = useRef(false);
  useEffect(() => {
    if (!seeded.current && services.length > 0) {
      seeded.current = true;
      setYears((prev) =>
        prev.map((yr) => ({
          ...yr,
          income: services.map((s) => ({
            id: uid(),
            name: s.name,
            unitPrice: s.price,
            qty: 1,
            period: (s.unit === "per month" || s.unit === "per week" || s.unit === "per day" || s.unit === "per year")
              ? s.unit as ProjIncomeLine["period"]
              : "one-off",
          })),
        }))
      );
    }
  }, [services]);

  // Seed expenditure lines from actual expenses (once, This TY only)
  const expSeeded = useRef(false);
  useEffect(() => {
    if (!expSeeded.current && expenses.length > 0) {
      expSeeded.current = true;
      const byCategory: Record<string, number> = {};
      expenses.forEach((e) => { byCategory[e.category] = (byCategory[e.category] || 0) + e.amount; });
      const lines: ProjExpenseLine[] = Object.entries(byCategory).map(([name, amount]) => ({
        id: uid(), name, amount, period: "one-off",
      }));
      setYears((prev) => prev.map((yr, i) => i === 0 ? { ...yr, expenditure: lines } : yr));
    }
  }, [expenses]);

  // Mutators
  const updateIncomeLine = (yi: number, id: string, patch: Partial<ProjIncomeLine>) =>
    setYears((prev) => prev.map((yr, i) => i === yi
      ? { ...yr, income: yr.income.map((l) => l.id === id ? { ...l, ...patch } : l) }
      : yr));

  const deleteIncomeLine = (yi: number, id: string) =>
    setYears((prev) => prev.map((yr, i) => i === yi
      ? { ...yr, income: yr.income.filter((l) => l.id !== id) }
      : yr));

  const addIncomeLine = (yi: number) =>
    setYears((prev) => prev.map((yr, i) => i === yi
      ? { ...yr, income: [...yr.income, { id: uid(), name: "", unitPrice: 0, qty: 1, period: "per year" }] }
      : yr));

  const updateExpenseLine = (yi: number, id: string, patch: Partial<ProjExpenseLine>) =>
    setYears((prev) => prev.map((yr, i) => i === yi
      ? { ...yr, expenditure: yr.expenditure.map((l) => l.id === id ? { ...l, ...patch } : l) }
      : yr));

  const deleteExpenseLine = (yi: number, id: string) =>
    setYears((prev) => prev.map((yr, i) => i === yi
      ? { ...yr, expenditure: yr.expenditure.filter((l) => l.id !== id) }
      : yr));

  const addExpenseLine = (yi: number) =>
    setYears((prev) => prev.map((yr, i) => i === yi
      ? { ...yr, expenditure: [...yr.expenditure, { id: uid(), name: "", amount: 0, period: "per year" }] }
      : yr));

  // Computed projections
  const projections = useMemo(() =>
    YEAR_LABELS.map((label, yi) => {
      const { revenue, expenses: exp } = calcYearTotals(years[yi], prorateFactor, yi === 0);
      const grossProfit = revenue - exp;
      const tax = Math.max(0, grossProfit * (taxRate / 100));
      return { label, revenue, expenses: exp, grossProfit, tax, netProfit: Math.round(grossProfit - tax) };
    }), [years, taxRate, prorateFactor]);

  const chartData = projections.map((p) => ({ name: p.label, Revenue: p.revenue, Expenses: p.expenses, "Net Profit": p.netProfit }));
  const COLORS = { Revenue: "#22c55e", Expenses: "#ef4444", "Net Profit": "#6366f1" } as const;

  const thisYear = years[activeYear];
  const proj = projections[activeYear];

  // Income breakdown for pie-style bars
  const incomeLines = thisYear.income.filter((l) => l.name);
  const totalIncome = proj.revenue;
  const expLines = thisYear.expenditure.filter((l) => l.name);
  const totalExp = proj.expenses;

  return (
    <div className="space-y-5">

      {/* Year selector tabs */}
      <div className="flex gap-1 overflow-x-auto no-scrollbar pb-0.5">
        {YEAR_LABELS.map((label, yi) => {
          const p = projections[yi];
          const isProfit = p.netProfit >= 0;
          return (
            <button
              key={yi}
              onClick={() => setActiveYear(yi)}
              className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl border text-[10px] font-medium transition-colors min-w-[72px] ${
                activeYear === yi
                  ? "bg-primary text-white border-primary shadow-sm"
                  : "bg-card border-border/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              <span className="font-semibold text-[11px]">{label}</span>
              <span className={`mt-0.5 tabular-nums ${activeYear === yi ? "text-white/80" : isProfit ? "text-green-600" : "text-red-500"}`}>
                {isProfit ? "+" : ""}{fmt(p.netProfit)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Year editor card */}
      <div className="rounded-xl border border-border/50 bg-card shadow-soft overflow-hidden">

        {/* ── Income section ── */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Income</p>
              <p className="text-xs font-bold text-green-700 mt-0.5">{fmt(totalIncome)} projected</p>
            </div>
            <button
              onClick={() => addIncomeLine(activeYear)}
              className="flex items-center gap-1 text-xs text-primary font-medium"
            >
              <Plus className="w-3.5 h-3.5" /> Add Service
            </button>
          </div>
          {/* Column headers */}
          {thisYear.income.length > 0 && (
            <div className="flex items-center gap-2 pb-1 border-b border-border/30">
              <span className="text-[10px] text-muted-foreground flex-1">Service</span>
              <span className="text-[10px] text-muted-foreground w-20 text-right shrink-0">Price (£)</span>
              <span className="text-[10px] text-muted-foreground w-14 text-center shrink-0">Qty</span>
              <span className="text-[10px] text-muted-foreground w-[90px] shrink-0">Period</span>
              <span className="text-[10px] text-muted-foreground w-16 text-right shrink-0">Annual</span>
              <span className="w-6 shrink-0" />
            </div>
          )}
          {thisYear.income.length === 0 && (
            <p className="text-xs text-muted-foreground py-3 text-center">No income lines. Add a service above.</p>
          )}
          {thisYear.income.map((line) => (
            <IncomeLineRow
              key={line.id}
              line={line}
              onUpdate={(p) => updateIncomeLine(activeYear, line.id, p)}
              onDelete={() => deleteIncomeLine(activeYear, line.id)}
            />
          ))}
        </div>

        <div className="h-px bg-border/40 mx-4" />

        {/* ── Expenditure section ── */}
        <div className="px-4 pt-3 pb-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Expenditure</p>
              <p className="text-xs font-bold text-red-600 mt-0.5">{fmt(totalExp)} projected</p>
            </div>
            <button
              onClick={() => addExpenseLine(activeYear)}
              className="flex items-center gap-1 text-xs text-primary font-medium"
            >
              <Plus className="w-3.5 h-3.5" /> Add Expense
            </button>
          </div>
          {thisYear.expenditure.length > 0 && (
            <div className="flex items-center gap-2 pb-1 border-b border-border/30">
              <span className="text-[10px] text-muted-foreground flex-1">Description</span>
              <span className="text-[10px] text-muted-foreground w-24 text-right shrink-0">Amount (£)</span>
              <span className="text-[10px] text-muted-foreground w-[90px] shrink-0">Period</span>
              <span className="text-[10px] text-muted-foreground w-16 text-right shrink-0">Annual</span>
              <span className="w-6 shrink-0" />
            </div>
          )}
          {thisYear.expenditure.length === 0 && (
            <p className="text-xs text-muted-foreground py-3 text-center">No expenditure lines. Add one above.</p>
          )}
          {thisYear.expenditure.map((line) => (
            <ExpenseLineRow
              key={line.id}
              line={line}
              onUpdate={(p) => updateExpenseLine(activeYear, line.id, p)}
              onDelete={() => deleteExpenseLine(activeYear, line.id)}
            />
          ))}
        </div>
      </div>

      {/* Summary card for active year */}
      <div className="rounded-xl border border-border/50 bg-card shadow-soft overflow-hidden">
        <div className="px-4 pt-3 pb-1 border-b border-border/30 flex items-center justify-between">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            {YEAR_LABELS[activeYear]} Summary
          </p>
          <div className="flex items-center gap-2">
            <Label className="text-[10px] text-muted-foreground">Corp Tax</Label>
            <Input
              type="number" min={0} max={100}
              value={taxRate}
              onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
              className="h-7 rounded-lg w-14 text-xs"
            />
            <span className="text-[10px] text-muted-foreground">%</span>
          </div>
        </div>
        <div className="p-4 space-y-2.5">
          {/* Summary rows */}
          {[
            { label: "Turnover (Revenue)", value: proj.revenue, color: "text-green-700", bold: false },
            { label: "Total Expenditure", value: -proj.expenses, color: "text-red-600", bold: false },
            { label: "Gross Profit / Loss", value: proj.grossProfit, color: proj.grossProfit >= 0 ? "text-blue-700" : "text-red-600", bold: false },
            { label: `Corporation Tax (${taxRate}%)`, value: -proj.tax, color: "text-orange-600", bold: false },
            { label: "Net Profit / Loss", value: proj.netProfit, color: proj.netProfit >= 0 ? "text-indigo-700" : "text-red-600", bold: true },
          ].map(({ label, value, color, bold }) => (
            <div key={label} className={`flex justify-between items-center ${bold ? "pt-2 border-t border-border/40" : ""}`}>
              <span className={`text-xs ${bold ? "font-bold text-card-foreground" : "text-muted-foreground"}`}>{label}</span>
              <span className={`text-sm tabular-nums font-${bold ? "bold" : "medium"} ${color}`}>
                {value < 0 ? `-${fmt(Math.abs(value))}` : fmt(value)}
              </span>
            </div>
          ))}

          {/* Proportion bars */}
          {(totalIncome > 0 || totalExp > 0) && (
            <div className="pt-3 space-y-3">
              {/* Income breakdown */}
              {incomeLines.length > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">Income breakdown</p>
                  <div className="flex h-4 rounded-full overflow-hidden w-full gap-px">
                    {incomeLines.map((l, i) => {
                      const annual = l.unitPrice * l.qty * ANNUAL_MULT[l.period];
                      const pct = totalIncome > 0 ? (annual / totalIncome) * 100 : 0;
                      const PALETTE = ["#22c55e","#16a34a","#4ade80","#86efac","#bbf7d0","#6ee7b7"];
                      return pct > 0 ? (
                        <div key={l.id} style={{ width: `${pct}%`, backgroundColor: PALETTE[i % PALETTE.length] }} title={`${l.name}: ${pct.toFixed(1)}%`} />
                      ) : null;
                    })}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                    {incomeLines.map((l, i) => {
                      const annual = l.unitPrice * l.qty * ANNUAL_MULT[l.period];
                      const pct = totalIncome > 0 ? (annual / totalIncome) * 100 : 0;
                      const PALETTE = ["#22c55e","#16a34a","#4ade80","#86efac","#bbf7d0","#6ee7b7"];
                      return pct > 0 ? (
                        <div key={l.id} className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                          <span className="text-[10px] text-muted-foreground">{l.name || "Unnamed"} <span className="font-medium text-card-foreground">{pct.toFixed(0)}%</span></span>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              {/* Expenditure breakdown */}
              {expLines.length > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">Expenditure breakdown</p>
                  <div className="flex h-4 rounded-full overflow-hidden w-full gap-px">
                    {expLines.map((l, i) => {
                      const annual = l.amount * ANNUAL_MULT[l.period];
                      const pct = totalExp > 0 ? (annual / totalExp) * 100 : 0;
                      const PALETTE = ["#ef4444","#dc2626","#f87171","#fca5a5","#fecaca","#fda4af"];
                      return pct > 0 ? (
                        <div key={l.id} style={{ width: `${pct}%`, backgroundColor: PALETTE[i % PALETTE.length] }} title={`${l.name}: ${pct.toFixed(1)}%`} />
                      ) : null;
                    })}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                    {expLines.map((l, i) => {
                      const annual = l.amount * ANNUAL_MULT[l.period];
                      const pct = totalExp > 0 ? (annual / totalExp) * 100 : 0;
                      const PALETTE = ["#ef4444","#dc2626","#f87171","#fca5a5","#fecaca","#fda4af"];
                      return pct > 0 ? (
                        <div key={l.id} className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                          <span className="text-[10px] text-muted-foreground">{l.name || "Unnamed"} <span className="font-medium text-card-foreground">{pct.toFixed(0)}%</span></span>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              {/* Income vs Expenditure bar */}
              {totalIncome > 0 && totalExp > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">Income vs Expenditure</p>
                  <div className="flex h-4 rounded-full overflow-hidden w-full">
                    {(() => {
                      const total = totalIncome + totalExp;
                      const iPct = (totalIncome / total) * 100;
                      const ePct = (totalExp / total) * 100;
                      return <>
                        <div style={{ width: `${iPct}%` }} className="bg-green-500" title={`Income ${iPct.toFixed(1)}%`} />
                        <div style={{ width: `${ePct}%` }} className="bg-red-400" title={`Expenditure ${ePct.toFixed(1)}%`} />
                      </>;
                    })()}
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span className="text-green-700 font-medium">Income {((totalIncome / (totalIncome + totalExp)) * 100).toFixed(0)}%</span>
                    <span className="text-red-600 font-medium">Expenditure {((totalExp / (totalIncome + totalExp)) * 100).toFixed(0)}%</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Multi-year overview table */}
      <div className="overflow-x-auto rounded-xl border border-border/50">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/60">
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground w-28">Metric</th>
              {projections.map((p) => (
                <th key={p.label} className="text-right px-3 py-2.5 font-semibold text-card-foreground min-w-[80px]">{p.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {(["revenue", "expenses", "grossProfit", "tax", "netProfit"] as const).map((key) => {
              const rowLabels: Record<string, string> = {
                revenue: "Revenue", expenses: "Expenditure", grossProfit: "Gross Profit",
                tax: `Corp Tax (${taxRate}%)`, netProfit: "Net Profit",
              };
              const colorMap: Record<string, string> = {
                revenue: "text-green-700", expenses: "text-red-600", grossProfit: "text-blue-700",
                tax: "text-orange-600", netProfit: "font-bold text-indigo-700",
              };
              return (
                <tr key={key} className={key === "netProfit" ? "bg-muted/30" : ""}>
                  <td className="px-3 py-2.5 font-medium text-card-foreground">{rowLabels[key]}</td>
                  {projections.map((p) => {
                    const val = p[key];
                    const neg = (key === "netProfit" || key === "grossProfit") && val < 0;
                    return (
                      <td key={p.label} className={`px-3 py-2.5 text-right tabular-nums ${neg ? "text-red-600" : colorMap[key]}`}>
                        {fmt(val)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Chart */}
      <div className="p-4 rounded-xl border border-border/50 bg-card shadow-soft">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">5-Year Projection Chart</p>
          <div className="flex gap-1">
            <button onClick={() => setChartType("bar")} className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${chartType === "bar" ? "bg-primary text-white border-primary" : "bg-muted border-border text-muted-foreground"}`}>Bar</button>
            <button onClick={() => setChartType("area")} className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${chartType === "area" ? "bg-primary text-white border-primary" : "bg-muted border-border text-muted-foreground"}`}>Area</button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          {chartType === "bar" ? (
            <BarChart data={chartData} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 12, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {(Object.keys(COLORS) as (keyof typeof COLORS)[]).map((k) => (
                <Bar key={k} dataKey={k} fill={COLORS[k]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          ) : (
            <AreaChart data={chartData}>
              <defs>
                {(Object.entries(COLORS) as [string, string][]).map(([k, color]) => (
                  <linearGradient key={k} id={`grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 12, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {(Object.entries(COLORS) as [string, string][]).map(([k, color]) => (
                <Area key={k} type="monotone" dataKey={k} stroke={color} fill={`url(#grad-${k})`} strokeWidth={2} dot={{ r: 3 }} />
              ))}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        Tax year ends {taxYearEnd.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} · {daysLeft} days remaining · "This TY" = {(prorateFactor * 100).toFixed(0)}% of full year
      </p>
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab({ companyId }: { companyId: string }) {
  const { settings, loading, saveSettings } = useCompanySettings(companyId);
  const [local, setLocal] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [newIncome, setNewIncome] = useState("");
  const [newExpense, setNewExpense] = useState("");

  // Sync when settings load from Firestore
  useMemo(() => { setLocal(settings); }, [settings]);

  const addItem = (field: "incomeCategories" | "expenseCategories", value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setLocal((l) => ({
      ...l,
      [field]: sortCategoriesOtherLast([...l[field].filter((x) => x !== trimmed), trimmed]),
    }));
    if (field === "incomeCategories") setNewIncome(""); else setNewExpense("");
  };

  const removeItem = (field: "incomeCategories" | "expenseCategories", value: string) =>
    setLocal((l) => ({ ...l, [field]: l[field].filter((x) => x !== value) }));

  const save = async () => {
    setSaving(true);
    try { await saveSettings(local); } finally { setSaving(false); }
  };

  if (loading) return <p className="text-xs text-muted-foreground text-center py-8">Loading settings…</p>;

  return (
    <div className="space-y-6">
      {/* Income categories */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Income / Service Categories</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {local.incomeCategories.map((cat) => (
            <span key={cat} className="flex items-center gap-1 text-xs bg-green-50 text-green-800 border border-green-200 rounded-full px-2.5 py-1">
              {cat}
              <button onClick={() => removeItem("incomeCategories", cat)} className="hover:text-red-500 transition-colors"><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={newIncome} onChange={(e) => setNewIncome(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addItem("incomeCategories", newIncome); }}
            placeholder="Add category…" className="h-8 rounded-xl text-xs" />
          <Button onClick={() => addItem("incomeCategories", newIncome)} variant="outline" className="h-8 rounded-xl text-xs px-3">Add</Button>
        </div>
      </div>

      {/* Expense categories */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Expense Categories</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {local.expenseCategories.map((cat) => (
            <span key={cat} className="flex items-center gap-1 text-xs bg-red-50 text-red-800 border border-red-200 rounded-full px-2.5 py-1">
              {cat}
              <button onClick={() => removeItem("expenseCategories", cat)} className="hover:text-red-500 transition-colors"><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={newExpense} onChange={(e) => setNewExpense(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addItem("expenseCategories", newExpense); }}
            placeholder="Add category…" className="h-8 rounded-xl text-xs" />
          <Button onClick={() => addItem("expenseCategories", newExpense)} variant="outline" className="h-8 rounded-xl text-xs px-3">Add</Button>
        </div>
      </div>

      {/* Corp tax rate */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Default Corp Tax Rate</p>
        <div className="flex items-center gap-2">
          <Input type="number" min={0} max={100} value={local.corporateTaxRate}
            onChange={(e) => setLocal((l) => ({ ...l, corporateTaxRate: parseFloat(e.target.value) || 0 }))}
            className="h-9 rounded-xl w-20" />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
      </div>

      <Button onClick={save} disabled={saving} className="w-full h-10 rounded-xl bg-gradient-primary">
        {saving ? "Saving…" : "Save Settings"}
      </Button>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ company }: { company: any }) {
  const color = company.color || "#6366f1";
  const contactEntries = Object.entries(company.contact || {}).filter(([, v]) => v);
  return (
    <div className="space-y-3">
      <div
        className="space-y-3 rounded-2xl p-4 shadow-soft"
        style={{ background: `color-mix(in srgb, ${color} 16%, hsl(var(--card)))`, borderLeft: `3px solid ${color}` }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Contact</p>
        {contactEntries.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 text-xs">
            <span className="capitalize text-muted-foreground">{k.replace(/([A-Z])/g, " $1")}</span>
            <span className="text-right font-medium text-card-foreground">{v as string}</span>
          </div>
        ))}
        {contactEntries.length === 0 && (
          <p className="text-xs text-muted-foreground">No contact details saved.</p>
        )}
      </div>
      <div
        className="rounded-2xl p-4 shadow-soft"
        style={{ background: `color-mix(in srgb, ${color} 14%, hsl(var(--card)))`, borderLeft: `3px solid ${color}` }}
      >
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tax year</p>
        <p className="text-sm font-medium text-card-foreground">
          {company.taxYearStart
            ? `${new Date(company.taxYearStart).toLocaleDateString("en-GB", { day: "numeric", month: "long" })} — ${new Date(new Date(company.taxYearStart).setFullYear(new Date(company.taxYearStart).getFullYear() + 1) - 86400000).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}`
            : "Not set"}
        </p>
      </div>
    </div>
  );
}

// ─── Insurance Tab ────────────────────────────────────────────────────────────

function formatRenewal(dateStr?: string): { label: string; urgent: boolean } {
  if (!dateStr) return { label: "No date", urgent: false };
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
  if (diff < 0) return { label: "Expired", urgent: true };
  if (diff === 0) return { label: "Today!", urgent: true };
  if (diff <= 30) return { label: `${diff}d`, urgent: true };
  if (diff < 365) {
    const m = Math.floor(diff / 30.44);
    const d = diff - Math.round(m * 30.44);
    return { label: d > 0 ? `${m}m ${d}d` : `${m}m`, urgent: false };
  }
  const y = Math.floor(diff / 365);
  const rem = diff - y * 365;
  const m = Math.floor(rem / 30.44);
  return { label: m > 0 ? `${y}y ${m}m` : `${y}y`, urgent: false };
}

const POLICY_TYPES = [
  "Public Liability","Professional Indemnity","Employers Liability",
  "Product Liability","Directors & Officers","Cyber","Commercial Vehicle",
  "Building & Contents","Business Interruption","Other",
];

const INSURANCE_EMPTY: Omit<CompanyInsurance, "id" | "createdAt"> = {
  type: "", provider: "", policyNumber: "", coverAmount: undefined,
  coverDetails: "", premium: undefined, premiumPeriod: "annually",
  startDate: "", renewalDate: "", notes: "",
};

function InsuranceTab({ companyId }: { companyId: string }) {
  const { policies, addPolicy, updatePolicy, deletePolicy } = useCompanyInsurance(companyId);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<CompanyInsurance | null>(null);
  const [form, setForm] = useState<Omit<CompanyInsurance, "id" | "createdAt">>(INSURANCE_EMPTY);
  const [saving, setSaving] = useState(false);

  const openAdd = () => { setEdit(null); setForm(INSURANCE_EMPTY); setOpen(true); };
  const openEdit = (p: CompanyInsurance) => {
    setEdit(p);
    setForm({
      type: p.type, provider: p.provider, policyNumber: p.policyNumber || "",
      coverAmount: p.coverAmount, coverDetails: p.coverDetails || "",
      premium: p.premium, premiumPeriod: p.premiumPeriod || "annually",
      startDate: p.startDate || "", renewalDate: p.renewalDate || "", notes: p.notes || "",
    });
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (edit?.id) await updatePolicy(edit.id, form);
      else await addPolicy(form);
      setOpen(false);
    } finally { setSaving(false); }
  };

  const setF = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{policies.length} {policies.length === 1 ? "policy" : "policies"}</p>
        <Button size="sm" onClick={openAdd} className="h-8 rounded-xl gap-1 text-xs"><Plus className="w-3 h-3" /> Add Policy</Button>
      </div>

      {policies.length === 0 ? (
        <div className="flex flex-col items-center py-10 gap-2 text-center">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
            <Shield className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No insurance policies</p>
          <p className="text-xs text-muted-foreground">Add policies to track coverage &amp; renewals</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {policies.map((p) => {
            const { label, urgent } = formatRenewal(p.renewalDate);
            return (
              <div key={p.id} className="rounded-2xl border border-border/50 bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-card-foreground">{p.type || "Policy"}</p>
                    <p className="text-xs text-muted-foreground">{p.provider}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {p.renewalDate && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${urgent ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
                        {label}
                      </span>
                    )}
                    <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"><Edit2 className="w-3 h-3" /></button>
                    <button onClick={() => p.id && deletePolicy(p.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {p.policyNumber && <div><span className="text-[10px] text-muted-foreground">Policy #</span><p className="text-xs font-mono">{p.policyNumber}</p></div>}
                  {p.coverAmount !== undefined && <div><span className="text-[10px] text-muted-foreground">Cover</span><p className="text-xs font-semibold">{fmt(p.coverAmount)}</p></div>}
                  {p.premium !== undefined && <div><span className="text-[10px] text-muted-foreground">Premium</span><p className="text-xs">{fmt(p.premium)}<span className="text-muted-foreground"> /{p.premiumPeriod === "monthly" ? "mo" : "yr"}</span></p></div>}
                  {p.renewalDate && <div><span className="text-[10px] text-muted-foreground">Renewal</span><p className="text-xs">{new Date(p.renewalDate).toLocaleDateString("en-GB")}</p></div>}
                </div>
                {p.coverDetails && <p className="text-[11px] text-muted-foreground border-t border-border/30 pt-2 mt-1">{p.coverDetails}</p>}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEdit(null); }}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{edit ? "Edit Policy" : "Add Policy"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label>Policy Type *</Label>
              <Select value={form.type} onValueChange={(v) => setF("type", v)}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Select type…" /></SelectTrigger>
                <SelectContent>{POLICY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Provider *</Label>
              <Input value={form.provider} onChange={(e) => setF("provider", e.target.value)} placeholder="e.g. AXA, Aviva" className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Policy Number</Label>
              <Input value={form.policyNumber || ""} onChange={(e) => setF("policyNumber", e.target.value)} placeholder="e.g. POL-12345" className="h-10 rounded-xl font-mono" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Cover Amount (£)</Label>
                <Input type="number" value={form.coverAmount ?? ""} onChange={(e) => setF("coverAmount", e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 1000000" className="h-10 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label>Premium (£)</Label>
                <Input type="number" value={form.premium ?? ""} onChange={(e) => setF("premium", e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 1200" className="h-10 rounded-xl" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Premium Period</Label>
              <Select value={form.premiumPeriod || "annually"} onValueChange={(v) => setF("premiumPeriod", v)}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="annually">Annually</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>What it Covers</Label>
              <Textarea value={form.coverDetails || ""} onChange={(e) => setF("coverDetails", e.target.value)} placeholder="Describe what this policy covers…" className="rounded-xl resize-none" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input type="date" value={form.startDate || ""} onChange={(e) => setF("startDate", e.target.value)} className="h-10 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label>Renewal Date</Label>
                <Input type="date" value={form.renewalDate || ""} onChange={(e) => setF("renewalDate", e.target.value)} className="h-10 rounded-xl" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes || ""} onChange={(e) => setF("notes", e.target.value)} placeholder="Any additional notes…" className="rounded-xl resize-none" rows={2} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setOpen(false)} className="flex-1 h-10 rounded-xl">Cancel</Button>
              <Button onClick={save} disabled={!form.type || !form.provider || saving} className="flex-1 h-10 rounded-xl">{saving ? "Saving…" : "Save Policy"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Finance Tab ─────────────────────────────────────────────────────────────

function getTaxYearBounds(taxYearStart: string) {
  const base = taxYearStart ? new Date(taxYearStart) : new Date(`${new Date().getFullYear()}-04-06`);
  const now = new Date();
  let start = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  while (new Date(start.getFullYear() + 1, start.getMonth(), start.getDate()) <= now) {
    start = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
  }
  const end = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
  end.setDate(end.getDate() - 1);
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const daysPassed = Math.max(0, Math.ceil((now.getTime() - start.getTime()) / 86_400_000));
  const daysLeft = Math.max(0, totalDays - daysPassed);
  const progress = Math.min(100, Math.round((daysPassed / totalDays) * 100));
  const startStr = start.toISOString().split("T")[0];
  const endStr = end.toISOString().split("T")[0];
  const label = `${start.getFullYear()}/${String(start.getFullYear() + 1).slice(2)}`;
  return { start: startStr, end: endStr, label, daysLeft, progress, totalDays };
}

const INCOME_EMPTY: Omit<CompanyIncome, "id" | "createdAt"> = {
  date: new Date().toISOString().split("T")[0],
  description: "",
  amount: 0,
  category: "",
  invoiceRef: "",
};

function EntityFinanceSummary({
  companyId,
  company,
  ty,
  isChild,
  onNavigate,
}: {
  companyId: string;
  company: Company;
  ty: { start: string; end: string };
  isChild: boolean;
  onNavigate?: () => void;
}) {
  const financeData = useMultiCompanyFinance([companyId]);
  const d = financeData[companyId] || { income: [], expenses: [] };
  const income = d.income.filter((i) => i.date >= ty.start && i.date <= ty.end).reduce((s, i) => s + i.amount, 0);
  const expenses = d.expenses.filter((e) => e.date >= ty.start && e.date <= ty.end).reduce((s, e) => s + e.amount, 0);
  const net = income - expenses;
  return (
    <div className={`rounded-xl border border-border/50 bg-muted/30 p-3 ${isChild ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""}`} onClick={onNavigate}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center text-sm" style={{ backgroundColor: `${company.color}20` }}>
          <CompanyLogoMark
            logoUrl={company.logoUrl}
            website={company.contact.website}
            emoji={company.emoji}
            name={company.name}
            className="h-full w-full rounded-lg object-contain p-0.5"
          />
        </div>
        <span className="text-xs font-semibold text-foreground flex-1">{company.name}</span>
        {isChild && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <div className="rounded-lg bg-green-500/10 p-2 text-center">
          <p className="text-[10px] text-green-700 dark:text-green-400 font-medium">Income</p>
          <p className="text-xs font-bold text-green-700 dark:text-green-400">{fmt(income)}</p>
        </div>
        <div className="rounded-lg bg-red-500/10 p-2 text-center">
          <p className="text-[10px] text-red-600 font-medium">Expenses</p>
          <p className="text-xs font-bold text-red-600">{fmt(expenses)}</p>
        </div>
        <div className={`rounded-lg p-2 text-center ${net >= 0 ? "bg-primary/10" : "bg-orange-500/10"}`}>
          <p className={`text-[10px] font-medium ${net >= 0 ? "text-primary" : "text-orange-600"}`}>Net</p>
          <p className={`text-xs font-bold ${net >= 0 ? "text-primary" : "text-orange-600"}`}>{fmt(Math.abs(net))}</p>
        </div>
      </div>
    </div>
  );
}

function FinanceTab({ companyId, company, allCompanies, updateCompany }: {
  companyId: string;
  company: Company;
  allCompanies: Company[];
  updateCompany: (id: string, updates: Partial<Company>) => Promise<void>;
}) {
  const children = allCompanies.filter((c) => c.parentCompanyId === companyId);
  const parent = company.parentCompanyId ? allCompanies.find((c) => c.id === company.parentCompanyId) : null;
  const { settings } = useCompanySettings(companyId);

  const allIds = useMemo(() => [companyId, ...children.map((c) => c.id!).filter(Boolean)], [companyId, children.map((c) => c.id).join(",")]);
  const financeData = useMultiCompanyFinance(allIds);
  const { incomes, addIncome, updateIncome, deleteIncome } = useCompanyIncome(companyId);

  const [selectedEntity, setSelectedEntity] = useState<string>("consolidated");
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [editIncome, setEditIncome] = useState<CompanyIncome | null>(null);
  const [incomeForm, setIncomeForm] = useState<Omit<CompanyIncome, "id" | "createdAt">>(INCOME_EMPTY);
  const [saving, setSaving] = useState(false);
  const [editTaxYear, setEditTaxYear] = useState(false);
  const [tempTaxStart, setTempTaxStart] = useState(company.taxYearStart || "");

  const ty = useMemo(() => getTaxYearBounds(company.taxYearStart || ""), [company.taxYearStart]);

  const filterToTY = (items: { date: string; amount: number }[]) =>
    items.filter((i) => i.date >= ty.start && i.date <= ty.end);

  // Consolidated totals
  const consolidated = useMemo(() => {
    let income = 0;
    let expenses = 0;
    allIds.forEach((id) => {
      const d = financeData[id] || { income: [], expenses: [] };
      income += filterToTY(d.income).reduce((s, i) => s + i.amount, 0);
      expenses += filterToTY(d.expenses).reduce((s, e) => s + e.amount, 0);
    });
    return { income, expenses, net: income - expenses };
  }, [financeData, allIds, ty]);

  // Own entity data
  const own = useMemo(() => {
    const d = financeData[companyId] || { income: [], expenses: [] };
    const inc = filterToTY(d.income);
    const exp = filterToTY(d.expenses);
    const incTotal = inc.reduce((s, i) => s + i.amount, 0);
    const expTotal = exp.reduce((s, e) => s + e.amount, 0);
    return {
      income: incTotal,
      expenses: expTotal,
      net: incTotal - expTotal,
      incomeItems: inc as CompanyIncome[],
      expenseItems: exp as CompanyExpense[],
    };
  }, [financeData, companyId, ty]);

  const isParent = children.length > 0;
  const shown = selectedEntity === "consolidated" ? consolidated : {
    income: own.income,
    expenses: own.expenses,
    net: own.income - own.expenses,
  };

  const openAddIncome = () => {
    setEditIncome(null);
    setIncomeForm(INCOME_EMPTY);
    setIncomeOpen(true);
  };
  const openEditIncome = (inc: CompanyIncome) => {
    setEditIncome(inc);
    setIncomeForm({ date: inc.date, description: inc.description, amount: inc.amount, category: inc.category, invoiceRef: inc.invoiceRef || "" });
    setIncomeOpen(true);
  };

  const saveIncome = async () => {
    setSaving(true);
    try {
      if (editIncome?.id) await updateIncome(editIncome.id, incomeForm);
      else await addIncome(incomeForm);
      setIncomeOpen(false);
    } finally { setSaving(false); }
  };

  const saveTaxYear = async () => {
    if (company.id) await updateCompany(company.id, { taxYearStart: tempTaxStart });
    setEditTaxYear(false);
  };

  const taxRate = settings.corporateTaxRate ?? 19;
  const estTax = Math.max(0, (isParent ? consolidated : own).net * (taxRate / 100));

  // Expense breakdown by category
  const expByCategory = useMemo(() => {
    const d = financeData[companyId] || { income: [], expenses: [] };
    const bycat: Record<string, number> = {};
    (d.expenses as CompanyExpense[]).filter((e) => e.date >= ty.start && e.date <= ty.end)
      .forEach((e) => { bycat[e.category] = (bycat[e.category] || 0) + e.amount; });
    return Object.entries(bycat).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [financeData, companyId, ty]);

  return (
    <div className="space-y-4">
      {/* Tax year header */}
      <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Tax Year</p>
            {editTaxYear ? (
              <div className="flex items-center gap-2 mt-1">
                <Input type="date" value={tempTaxStart} onChange={(e) => setTempTaxStart(e.target.value)} className="h-8 rounded-lg text-sm w-36" />
                <button onClick={saveTaxYear} className="text-xs text-primary font-semibold">Save</button>
                <button onClick={() => setEditTaxYear(false)} className="text-xs text-muted-foreground">Cancel</button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="text-base font-bold">{ty.label}</p>
                <button onClick={() => { setTempTaxStart(company.taxYearStart || ""); setEditTaxYear(true); }} className="text-muted-foreground hover:text-foreground">
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">{new Date(ty.start).toLocaleDateString("en-GB")} – {new Date(ty.end).toLocaleDateString("en-GB")}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{ty.daysLeft}d left</p>
            <p className="text-sm font-bold">{ty.progress}%</p>
          </div>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${ty.progress}%`, backgroundColor: company.color }} />
        </div>
      </div>

      {/* Entity selector (parent companies) */}
      {isParent && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          <button
            onClick={() => setSelectedEntity("consolidated")}
            className={`flex-shrink-0 text-[11px] font-medium px-3 py-1.5 rounded-full border transition-colors ${selectedEntity === "consolidated" ? "border-transparent text-white" : "border-border text-muted-foreground bg-muted/40"}`}
            style={selectedEntity === "consolidated" ? { backgroundColor: company.color } : {}}
          >
            All Entities
          </button>
          <button
            onClick={() => setSelectedEntity(companyId)}
            className={`flex-shrink-0 text-[11px] font-medium px-3 py-1.5 rounded-full border transition-colors ${selectedEntity === companyId ? "border-transparent text-white" : "border-border text-muted-foreground bg-muted/40"}`}
            style={selectedEntity === companyId ? { backgroundColor: company.color } : {}}
          >
            {company.emoji} {company.name}
          </button>
          {children.map((child) => (
            <button
              key={child.id}
              onClick={() => setSelectedEntity(child.id!)}
              className={`flex-shrink-0 text-[11px] font-medium px-3 py-1.5 rounded-full border transition-colors ${selectedEntity === child.id ? "border-transparent text-white" : "border-border text-muted-foreground bg-muted/40"}`}
              style={selectedEntity === child.id ? { backgroundColor: child.color } : {}}
            >
              {child.emoji} {child.name}
            </button>
          ))}
        </div>
      )}

      {/* Note for trading names */}
      {parent && (
        <div className="rounded-xl bg-muted/50 p-3 text-[11px] text-muted-foreground">
          This is a trading name of <span className="font-semibold text-foreground">{parent.name}</span>. Track income and expenses here; consolidated view is on the parent company.
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-green-500/10 p-3">
          <p className="text-[10px] text-green-700 dark:text-green-400 font-medium uppercase tracking-wider">Income</p>
          <p className="text-lg font-bold text-green-700 dark:text-green-400">{fmt(selectedEntity === "consolidated" ? consolidated.income : own.income)}</p>
        </div>
        <div className="rounded-xl bg-red-500/10 p-3">
          <p className="text-[10px] text-red-600 font-medium uppercase tracking-wider">Expenses</p>
          <p className="text-lg font-bold text-red-600">{fmt(selectedEntity === "consolidated" ? consolidated.expenses : own.expenses)}</p>
        </div>
        <div className={`rounded-xl p-3 ${(selectedEntity === "consolidated" ? consolidated : own).net >= 0 ? "bg-primary/10" : "bg-orange-500/10"}`}>
          <p className={`text-[10px] font-medium uppercase tracking-wider ${(selectedEntity === "consolidated" ? consolidated : own).net >= 0 ? "text-primary" : "text-orange-600"}`}>
            {(selectedEntity === "consolidated" ? consolidated : own).net >= 0 ? "Net Profit" : "Net Loss"}
          </p>
          <p className={`text-lg font-bold ${(selectedEntity === "consolidated" ? consolidated : own).net >= 0 ? "text-primary" : "text-orange-600"}`}>
            {fmt(Math.abs((selectedEntity === "consolidated" ? consolidated : own).net))}
          </p>
        </div>
        <div className="rounded-xl bg-amber-500/10 p-3">
          <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium uppercase tracking-wider">Est. Tax ({taxRate}%)</p>
          <p className="text-lg font-bold text-amber-700 dark:text-amber-400">{fmt(estTax)}</p>
        </div>
      </div>

      {/* Consolidated entity breakdown */}
      {isParent && selectedEntity === "consolidated" && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Entity Breakdown</p>
          <EntityFinanceSummary companyId={companyId} company={company} ty={ty} isChild={false} />
          {children.map((child) => (
            <EntityFinanceSummary key={child.id} companyId={child.id!} company={child} ty={ty} isChild={true} />
          ))}
        </div>
      )}

      {/* Income section */}
      {(selectedEntity === companyId || !isParent || selectedEntity !== "consolidated") && selectedEntity !== "consolidated" ? (
        // showing a specific child — note only
        selectedEntity !== companyId ? (
          <div className="rounded-xl bg-muted/50 p-3 text-[11px] text-muted-foreground text-center">
            Open {children.find((c) => c.id === selectedEntity)?.name}'s company page to manage their income and expenses.
          </div>
        ) : null
      ) : null}

      {/* Own income list (when on own entity or not a parent) */}
      {(selectedEntity === companyId || !isParent) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Income This Year</p>
            <Button size="sm" onClick={openAddIncome} className="h-7 rounded-xl gap-1 text-xs px-2.5">
              <Plus className="w-3 h-3" /> Add
            </Button>
          </div>
          {own.incomeItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/50 p-4 text-center">
              <p className="text-xs text-muted-foreground">No income recorded this tax year</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {own.incomeItems.map((inc) => (
                <div key={inc.id} className="flex items-center gap-2 rounded-xl bg-muted/30 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{inc.description}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(inc.date).toLocaleDateString("en-GB")} · {inc.category}</p>
                  </div>
                  <p className="text-xs font-bold text-green-700 dark:text-green-400 flex-shrink-0">{fmt(inc.amount)}</p>
                  <div className="flex gap-0.5 flex-shrink-0">
                    <button onClick={() => openEditIncome(inc)} className="p-1 rounded text-muted-foreground hover:text-foreground"><Edit2 className="w-3 h-3" /></button>
                    <button onClick={() => inc.id && deleteIncome(inc.id)} className="p-1 rounded text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Expense breakdown by category */}
      {(selectedEntity === companyId || !isParent) && expByCategory.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Expenses by Category</p>
          <div className="space-y-2">
            {expByCategory.map(([cat, total]) => {
              const pct = own.expenses > 0 ? (total / own.expenses) * 100 : 0;
              return (
                <div key={cat}>
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="text-muted-foreground">{cat}</span>
                    <span className="font-semibold">{fmt(total)}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-red-400" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Income entry dialog */}
      <Dialog open={incomeOpen} onOpenChange={(o) => { setIncomeOpen(o); if (!o) setEditIncome(null); }}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editIncome ? "Edit Income" : "Add Income"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label>Description *</Label>
              <Input value={incomeForm.description} onChange={(e) => setIncomeForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. Consulting fee – Jan" className="h-10 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Amount (£) *</Label>
                <Input type="number" value={incomeForm.amount || ""} onChange={(e) => setIncomeForm((f) => ({ ...f, amount: Number(e.target.value) }))} placeholder="0.00" className="h-10 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label>Date *</Label>
                <Input type="date" value={incomeForm.date} onChange={(e) => setIncomeForm((f) => ({ ...f, date: e.target.value }))} className="h-10 rounded-xl" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={incomeForm.category} onValueChange={(v) => setIncomeForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Select category…" /></SelectTrigger>
                <SelectContent>{settings.incomeCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Invoice Ref</Label>
              <Input value={incomeForm.invoiceRef || ""} onChange={(e) => setIncomeForm((f) => ({ ...f, invoiceRef: e.target.value }))} placeholder="e.g. INV-0042" className="h-10 rounded-xl font-mono" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setIncomeOpen(false)} className="flex-1 h-10 rounded-xl">Cancel</Button>
              <Button onClick={saveIncome} disabled={!incomeForm.description || !incomeForm.amount || saving} className="flex-1 h-10 rounded-xl">{saving ? "Saving…" : "Save"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tax Tab ──────────────────────────────────────────────────────────────────

const TAX_RETURN_EMPTY: Omit<CompanyTaxReturn, "id" | "createdAt"> = {
  taxYear: "", taxPaid: undefined, filingDate: "", pdfUrl: "", notes: "",
};

function TaxTab({ companyId, company, allCompanies }: {
  companyId: string;
  company: Company;
  allCompanies: Company[];
}) {
  const parent = company.parentCompanyId ? allCompanies.find((c) => c.id === company.parentCompanyId) : null;
  const { taxReturns, uploadingPdf, addReturn, updateReturn, deleteReturn, uploadPdf } = useCompanyTaxReturns(companyId);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<CompanyTaxReturn | null>(null);
  const [form, setForm] = useState<Omit<CompanyTaxReturn, "id" | "createdAt">>(TAX_RETURN_EMPTY);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingUploadId, setPendingUploadId] = useState<string | null>(null);

  const openAdd = () => { setEdit(null); setForm(TAX_RETURN_EMPTY); setOpen(true); };
  const openEdit = (r: CompanyTaxReturn) => {
    setEdit(r);
    setForm({ taxYear: r.taxYear, taxPaid: r.taxPaid, filingDate: r.filingDate || "", pdfUrl: r.pdfUrl || "", notes: r.notes || "" });
    setOpen(true);
  };
  const save = async () => {
    setSaving(true);
    try {
      if (edit?.id) await updateReturn(edit.id, form);
      else await addReturn(form);
      setOpen(false);
    } finally { setSaving(false); }
  };
  const setF = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!pendingUploadId || !e.target.files?.[0]) return;
    await uploadPdf(pendingUploadId, e.target.files[0]);
    setPendingUploadId(null);
  };

  if (parent && company.companyType === "trading_name") {
    return (
      <div className="rounded-2xl border border-border/50 bg-muted/30 p-6 text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto">
          <FileText className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-semibold">Tax filing via parent company</p>
        <p className="text-xs text-muted-foreground">
          As a trading name, tax returns are filed under <span className="font-medium text-foreground">{parent.name}</span>. View tax on their company page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{taxReturns.length} {taxReturns.length === 1 ? "return" : "returns"} filed</p>
        <Button size="sm" onClick={openAdd} className="h-8 rounded-xl gap-1 text-xs"><Plus className="w-3 h-3" /> Add Return</Button>
      </div>

      {taxReturns.length === 0 ? (
        <div className="flex flex-col items-center py-10 gap-2 text-center">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
            <FileText className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No tax returns yet</p>
          <p className="text-xs text-muted-foreground">Add your annual tax / self-assessment returns here</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {taxReturns.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border/50 bg-card p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary">{r.taxYear}</span>
                  {r.filingDate && (
                    <span className="text-[10px] text-muted-foreground">Filed {new Date(r.filingDate).toLocaleDateString("en-GB")}</span>
                  )}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"><Edit2 className="w-3 h-3" /></button>
                  <button onClick={() => r.id && deleteReturn(r.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>

              {r.taxPaid !== undefined && (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs text-muted-foreground">Tax paid:</span>
                  <span className="text-base font-bold">{fmt(r.taxPaid)}</span>
                </div>
              )}

              {r.notes && <p className="text-[11px] text-muted-foreground line-clamp-2">{r.notes}</p>}

              <div className="flex items-center gap-2 pt-1">
                {r.pdfUrl ? (
                  <a href={r.pdfUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] text-primary font-medium">
                    <Download className="w-3 h-3" /> Download PDF
                  </a>
                ) : (
                  <button
                    onClick={() => { setPendingUploadId(r.id!); fileRef.current?.click(); }}
                    disabled={uploadingPdf}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <Upload className="w-3 h-3" /> {uploadingPdf && pendingUploadId === r.id ? "Uploading…" : "Upload PDF"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileUpload} />

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEdit(null); }}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{edit ? "Edit Tax Return" : "Add Tax Return"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label>Tax Year *</Label>
              <Input value={form.taxYear} onChange={(e) => setF("taxYear", e.target.value)} placeholder="e.g. 2024/25" className="h-10 rounded-xl font-mono" />
              <p className="text-[11px] text-muted-foreground">Format: YYYY/YY (e.g. 2024/25)</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Tax Paid (£)</Label>
                <Input type="number" value={form.taxPaid ?? ""} onChange={(e) => setF("taxPaid", e.target.value ? Number(e.target.value) : undefined)} placeholder="0.00" className="h-10 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label>Filing Date</Label>
                <Input type="date" value={form.filingDate || ""} onChange={(e) => setF("filingDate", e.target.value)} className="h-10 rounded-xl" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes || ""} onChange={(e) => setF("notes", e.target.value)} placeholder="Accountant details, reference numbers, notes…" className="rounded-xl resize-none" rows={3} />
            </div>
            <p className="text-[11px] text-muted-foreground">📎 You can upload the PDF after saving the return.</p>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setOpen(false)} className="flex-1 h-10 rounded-xl">Cancel</Button>
              <Button onClick={save} disabled={!form.taxYear || saving} className="flex-1 h-10 rounded-xl">{saving ? "Saving…" : "Save"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const CompanyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { scopeUserId } = useSharedScope("companies");
  const { companies, loading, updateCompany } = useCompanies(scopeUserId ?? undefined);
  const [activeTab, setActiveTab] = useState("overview");

  const company = companies.find((c) => c.id === id);

  if (loading) {
    return (
      <div className="px-4 py-5 flex items-center justify-center min-h-64">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="px-4 py-5">
        <button onClick={() => navigate("/companies")} className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4"><ArrowLeft className="w-4 h-4" /> Back</button>
        <p className="text-sm text-muted-foreground">Company not found.</p>
      </div>
    );
  }

  return (
    <div
      className="mx-auto w-full min-w-0 overflow-x-hidden py-4 sm:py-5"
      style={{
        paddingLeft: "max(1rem, env(safe-area-inset-left, 0px))",
        paddingRight: "max(1rem, env(safe-area-inset-right, 0px))",
      }}
    >
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
        <button onClick={() => navigate("/companies")} className="group mb-3 flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          Companies
        </button>
        <div
          className="flex items-center gap-3 rounded-2xl border border-border/40 p-3.5 shadow-card"
          style={{
            background: `color-mix(in srgb, ${company.color} 15%, hsl(var(--card)))`,
            borderLeftWidth: 3,
            borderLeftColor: company.color,
          }}
        >
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl text-xl"
            style={{ background: `color-mix(in srgb, ${company.color} 28%, hsl(var(--card)))` }}
          >
            <CompanyLogoMark logoUrl={company.logoUrl} website={company.contact.website} emoji={company.emoji} name={company.name} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl font-bold text-foreground">{company.name}</h1>
            <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
              {[
                company.companyType ? COMPANY_TYPE_LABELS_DETAIL[company.companyType] : null,
                company.contact.companyNumber ? `No. ${company.contact.companyNumber}` : null,
                company.description,
              ].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
      </motion.div>

      <div className="flex min-w-0 gap-3">
        <aside className="w-[3.75rem] shrink-0 sm:w-[11.5rem]">
          <nav className="sticky top-2 space-y-0.5 rounded-2xl border border-border/40 bg-card p-1.5 shadow-soft">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const on = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex w-full items-center gap-2.5 rounded-xl border-[1.5px] px-1.5 py-1.5 text-left transition sm:px-2 ${
                    on ? "text-foreground" : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                  style={on ? {
                    background: `color-mix(in srgb, ${company.color} 22%, hsl(var(--card)))`,
                    borderColor: `color-mix(in srgb, ${company.color} 58%, transparent)`,
                  } : undefined}
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      background: on
                        ? `color-mix(in srgb, ${company.color} 34%, hsl(var(--card)))`
                        : "color-mix(in srgb, hsl(var(--muted)) 70%, hsl(var(--card)))",
                    }}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="hidden min-w-0 truncate text-[13px] font-semibold sm:block">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === "overview"   && <OverviewTab company={company} />}
              {activeTab === "finance"    && <FinanceTab companyId={id!} company={company} allCompanies={companies} updateCompany={updateCompany} />}
              {activeTab === "logins"     && <LoginsTab companyId={id!} />}
              {activeTab === "services"   && <ServicesTab companyId={id!} />}
              {activeTab === "expenses"   && <ExpensesTab companyId={id!} />}
              {activeTab === "insurance"  && <InsuranceTab companyId={id!} />}
              {activeTab === "tax"        && <TaxTab companyId={id!} company={company} allCompanies={companies} />}
              {activeTab === "projection" && <ProjectionTab companyId={id!} taxYearStart={company.taxYearStart} />}
              {activeTab === "settings"   && <SettingsTab companyId={id!} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default CompanyDetail;
