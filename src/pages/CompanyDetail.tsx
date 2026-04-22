import { useState, useMemo, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Plus, Trash2, Edit2, Eye, EyeOff, Upload, ExternalLink,
  Key, Briefcase, Receipt, BarChart3, Info, Settings2, X,
} from "lucide-react";
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
} from "@/hooks/useCompanies";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { CompanyLogin, CompanyService, CompanyExpense } from "@/types/app";

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview",    label: "Overview",    icon: Info },
  { id: "logins",      label: "Logins",      icon: Key },
  { id: "services",    label: "Services",    icon: Briefcase },
  { id: "expenses",    label: "Expenses",    icon: Receipt },
  { id: "projection",  label: "Projection",  icon: BarChart3 },
  { id: "settings",    label: "Settings",    icon: Settings2 },
];

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
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4" aria-describedby={undefined}>
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
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4" aria-describedby={undefined}>
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
  const { expenses, uploadingReceipt, addExpense, deleteExpense, uploadReceipt } = useCompanyExpenses(companyId);
  const { settings } = useCompanySettings(companyId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Omit<CompanyExpense, "id" | "createdAt">>({
    date: new Date().toISOString().split("T")[0],
    description: "",
    amount: 0,
    category: "Other",
    receipts: [],
  });
  const [saving, setSaving] = useState(false);
  const newFileRef = useRef<HTMLInputElement>(null);
  const [newFiles, setNewFiles] = useState<File[]>([]);

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
    if (f) setNewFiles((prev) => [...prev, f]);
    e.target.value = "";
  };

  const save = async () => {
    setSaving(true);
    try {
      await addExpense({ ...form, receipts: [] });
      setOpen(false);
      setForm({ date: new Date().toISOString().split("T")[0], description: "", amount: 0, category: "Other", receipts: [] });
      setNewFiles([]);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5">
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">
          <p className="text-[10px] text-destructive/70 uppercase tracking-wider">This Year</p>
          <p className="text-lg font-bold font-display text-destructive">£{totalThisYear.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="p-3 rounded-xl bg-muted border border-border/50">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Entries</p>
          <p className="text-lg font-bold font-display text-card-foreground">{expenses.length}</p>
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
        <button onClick={() => setOpen(true)} className="flex items-center gap-1 text-xs text-primary font-medium"><Plus className="w-3.5 h-3.5" /> Add Expense</button>
      </div>

      <div className="space-y-2">
        {expenses.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No expenses recorded yet.</p>}
        {expenses.map((exp) => (
          <div key={exp.id} className="p-3.5 rounded-xl border border-border/50 bg-card shadow-soft">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-card-foreground">{exp.description}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{exp.date} · {exp.category}</p>
                {(exp.receipts?.length ?? 0) > 0 && (
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {exp.receipts!.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        {url.match(/\.(jpg|jpeg|png|gif|webp)/i) ? (
                          <img src={url} alt="receipt" className="w-10 h-10 rounded-lg object-cover border border-border/40" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-muted border border-border/40 flex items-center justify-center text-[10px] text-muted-foreground">PDF</div>
                        )}
                      </a>
                    ))}
                    <label className="w-10 h-10 rounded-lg bg-muted border border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors">
                      <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                      <input type="file" accept="image/*,application/pdf" className="hidden" disabled={uploadingReceipt}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f && exp.id) uploadReceipt(exp.id, f, exp.receipts || []); e.target.value = ""; }} />
                    </label>
                  </div>
                )}
                {(exp.receipts?.length ?? 0) === 0 && (
                  <label className="mt-2 inline-flex items-center gap-1 text-[10px] text-primary cursor-pointer">
                    <Upload className="w-3 h-3" /> Add receipt
                    <input type="file" accept="image/*,application/pdf" className="hidden" disabled={uploadingReceipt}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f && exp.id) uploadReceipt(exp.id, f, []); e.target.value = ""; }} />
                  </label>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <p className="text-sm font-bold font-display text-destructive">£{exp.amount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</p>
                <button onClick={() => exp.id && deleteExpense(exp.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4" aria-describedby={undefined}>
          <DialogHeader><DialogTitle className="font-display">Add Expense</DialogTitle></DialogHeader>
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
            <div className="space-y-1">
              <Label>Attach receipt (optional)</Label>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-primary cursor-pointer border border-dashed border-border rounded-xl px-3 py-2 hover:bg-muted/40 transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  {newFiles.length > 0 ? `${newFiles.length} file(s) selected` : "Choose file"}
                  <input ref={newFileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleNewFile} />
                </label>
                {newFiles.length > 0 && <button onClick={() => setNewFiles([])} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => { setOpen(false); setNewFiles([]); }} className="flex-1 h-9 rounded-xl">Cancel</Button>
              <Button onClick={save} disabled={!form.description || saving} className="flex-1 h-9 rounded-xl bg-gradient-primary">{saving ? "Saving…" : "Save"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
    setLocal((l) => ({ ...l, [field]: [...l[field].filter((x) => x !== trimmed), trimmed] }));
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
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl border border-border/50 bg-card shadow-soft space-y-3">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Contact Details</p>
        {Object.entries(company.contact || {}).filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="flex justify-between text-xs">
            <span className="text-muted-foreground capitalize">{k.replace(/([A-Z])/g, " $1")}</span>
            <span className="text-card-foreground font-medium">{v as string}</span>
          </div>
        ))}
        {Object.values(company.contact || {}).filter(Boolean).length === 0 && (
          <p className="text-xs text-muted-foreground">No contact details saved.</p>
        )}
      </div>
      <div className="p-4 rounded-xl border border-border/50 bg-card shadow-soft">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tax Year</p>
        <p className="text-sm text-card-foreground">
          {company.taxYearStart
            ? `${new Date(company.taxYearStart).toLocaleDateString("en-GB", { day: "numeric", month: "long" })} — ${new Date(new Date(company.taxYearStart).setFullYear(new Date(company.taxYearStart).getFullYear() + 1) - 86400000).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}`
            : "Not set"}
        </p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const CompanyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { companies, loading } = useCompanies();
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
    <div className="px-4 py-5">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
        <button onClick={() => navigate("/companies")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> Companies
        </button>
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 shadow-soft"
            style={{ backgroundColor: `${company.color}20`, border: `2px solid ${company.color}40` }}
          >
            {company.emoji || "🏢"}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold font-display text-foreground">{company.name}</h1>
            {company.description && <p className="text-sm text-muted-foreground mt-0.5">{company.description}</p>}
          </div>
        </div>
        <div className="mt-4 h-1 rounded-full" style={{ background: `linear-gradient(to right, ${company.color}, ${company.color}40)` }} />
      </motion.div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-1 mb-5 no-scrollbar">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-colors ${
                activeTab === tab.id ? "text-white shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
              style={activeTab === tab.id ? { backgroundColor: company.color } : undefined}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {activeTab === "overview"   && <OverviewTab company={company} />}
          {activeTab === "logins"     && <LoginsTab companyId={id!} />}
          {activeTab === "services"   && <ServicesTab companyId={id!} />}
          {activeTab === "expenses"   && <ExpensesTab companyId={id!} />}
          {activeTab === "projection" && <ProjectionTab companyId={id!} taxYearStart={company.taxYearStart} />}
          {activeTab === "settings"   && <SettingsTab companyId={id!} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default CompanyDetail;
