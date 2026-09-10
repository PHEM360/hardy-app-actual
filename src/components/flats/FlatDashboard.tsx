import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Calculator,
  Check,
  FileText,
  Landmark,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Settings2,
  StickyNote,
  Trash2,
  TrendingUp,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/auth/AuthContext";
import { useBankConnections } from "@/hooks/useBankConnections";
import { useBankConnectStatus } from "@/hooks/useBankConnectStatus";
import { setFlatDocumentCategories, useFlat } from "@/hooks/useFlats";
import { computeFlatReturns, estimateFlatTax, fmtGbp, fmtPct } from "@/lib/flatFinance";
import { importFlatBankTransactions, startBankConnect } from "@/lib/truelayerApi";
import {
  FLAT_LEDGER_FREQUENCIES,
  OWNERSHIP_LABELS,
  type FlatDocumentMeta,
  type FlatOwnership,
  type FlatRecord,
  type FlatTenant,
} from "@/types/flats";

const ACCENT = "hsl(195,50%,45%)";
const SECTIONS = [
  { id: "returns", label: "Returns", icon: TrendingUp },
  { id: "property", label: "Property", icon: Building2 },
  { id: "ledger", label: "Income", icon: Wallet },
  { id: "bank", label: "Bank", icon: Landmark },
  { id: "tax", label: "Tax", icon: Calculator },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "docs", label: "Docs", icon: FileText },
  { id: "balances", label: "Balances", icon: TrendingUp },
] as const;

function tint(pct = 14) {
  return `color-mix(in srgb, ${ACCENT} ${pct}%, hsl(var(--card)))`;
}

/** ISO date (yyyy-mm-dd) to dd/mm/yy for compact display in list rows. */
function fmtDateShort(iso: string) {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y.slice(2)}`;
}

function SectionCard({
  id,
  title,
  icon,
  action,
  children,
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card"
      style={{ borderLeft: `4px solid ${ACCENT}` }}
    >
      <div
        className="flex items-center justify-between gap-2 border-b border-border/40 px-4 py-3"
        style={{ background: tint(10) }}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
            style={{ background: `linear-gradient(135deg,hsl(195,53%,48%),hsl(205,48%,42%))` }}
          >
            {icon}
          </span>
          <h2 className="truncate font-display text-sm font-bold text-foreground">{title}</h2>
        </div>
        {action}
      </div>
      <div className="min-w-0 p-4">{children}</div>
    </section>
  );
}

function StatTile({ label, value, emphasise }: { label: string; value: string; emphasise?: boolean }) {
  return (
    <div
      className="min-w-0 rounded-2xl border border-border/50 p-3 shadow-soft"
      style={{ background: tint(emphasise ? 18 : 12) }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display font-bold text-foreground ${emphasise ? "text-xl" : "text-lg"}`}>{value}</p>
    </div>
  );
}

function BalanceTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-2.5 shadow-elevated">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-sm font-bold text-card-foreground">{fmtGbp(payload[0].value)}</p>
    </div>
  );
}

export default function FlatDashboard({
  flatId,
  canEdit = true,
  flats = [],
}: {
  flatId: string;
  canEdit?: boolean;
  /** Sibling flats, used to offer "use these tag settings for X too". */
  flats?: FlatRecord[];
}) {
  const { dataUid } = useAuth();
  const {
    flat,
    documents,
    notes,
    loading,
    uploadingDoc,
    saveFlat,
    addBalance,
    addLedgerEntry,
    updateLedgerEntry,
    removeLedgerEntry,
    saveTax,
    saveBankLinks,
    uploadDocuments,
    updateDocument,
    deleteDocument,
    addNote,
    toggleNote,
    deleteNote,
  } = useFlat(flatId);
  const { connections, loading: banksLoading } = useBankConnections(dataUid);
  const { configured: bankConfigured } = useBankConnectStatus();

  const year = new Date().getFullYear();
  const [ledgerYear, setLedgerYear] = useState(year);
  const [busy, setBusy] = useState<string | null>(null);

  const [address, setAddress] = useState("");
  const [propertyValue, setPropertyValue] = useState("");
  const [mortgageBalance, setMortgageBalance] = useState("");
  const [mortgageRate, setMortgageRate] = useState("");
  const [tenant, setTenant] = useState<FlatTenant>({
    name: "",
    email: "",
    phone: "",
    contractStart: "",
    contractEnd: "",
    depositGbp: null,
    rentMonthlyGbp: null,
  });

  const [incomeOpen, setIncomeOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editingLedgerId, setEditingLedgerId] = useState<string | null>(null);
  const [ledgerDesc, setLedgerDesc] = useState("");
  const [ledgerAmount, setLedgerAmount] = useState("");
  const [ledgerCategory, setLedgerCategory] = useState("");
  const [ledgerDate, setLedgerDate] = useState(new Date().toISOString().slice(0, 10));
  const [ledgerFrequency, setLedgerFrequency] = useState("One-off");
  const [ledgerNotes, setLedgerNotes] = useState("");
  const [ledgerFile, setLedgerFile] = useState<File | null>(null);

  const [linkConnId, setLinkConnId] = useState("");
  const [linkAccountId, setLinkAccountId] = useState("");

  const [noteText, setNoteText] = useState("");
  const [docCategory, setDocCategory] = useState("Other");
  const [docYear, setDocYear] = useState<number>(year);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);

  const [tagSettingsOpen, setTagSettingsOpen] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [savingCategories, setSavingCategories] = useState(false);

  const [editDocId, setEditDocId] = useState<string | null>(null);
  const [editDocDraft, setEditDocDraft] = useState<{ name: string; category: string; year: string; notes: string }>({
    name: "",
    category: "",
    year: "",
    notes: "",
  });
  const [savingDocEdit, setSavingDocEdit] = useState(false);
  const [deleteDocTarget, setDeleteDocTarget] = useState<FlatDocumentMeta | null>(null);
  const [deletingDoc, setDeletingDoc] = useState(false);

  const otherFlats = flats.filter((f) => f.id !== flatId);

  const [balOpen, setBalOpen] = useState(false);
  const [balDate, setBalDate] = useState(new Date().toISOString().slice(0, 10));
  const [balAmount, setBalAmount] = useState("");

  useEffect(() => {
    if (!flat) return;
    setAddress(flat.address || "");
    setPropertyValue(flat.propertyValueGbp != null ? String(flat.propertyValueGbp) : "");
    setMortgageBalance(flat.mortgageBalanceGbp != null ? String(flat.mortgageBalanceGbp) : "");
    setMortgageRate(flat.mortgageRatePct != null ? String(flat.mortgageRatePct) : "");
    setTenant({
      name: flat.tenant?.name || "",
      email: flat.tenant?.email || "",
      phone: flat.tenant?.phone || "",
      contractStart: flat.tenant?.contractStart || "",
      contractEnd: flat.tenant?.contractEnd || "",
      depositGbp: flat.tenant?.depositGbp ?? null,
      rentMonthlyGbp: flat.tenant?.rentMonthlyGbp ?? null,
      notes: flat.tenant?.notes || "",
    });
  }, [flat]);

  const returns = useMemo(() => (flat ? computeFlatReturns(flat, ledgerYear) : null), [flat, ledgerYear]);
  const taxEstimate = useMemo(
    () => (flat ? estimateFlatTax(flat, flat.tax, ledgerYear) : null),
    [flat, ledgerYear],
  );

  const yearLedger = useMemo(
    () =>
      (flat?.ledger || [])
        .filter((e) => String(e.date || "").startsWith(String(ledgerYear)))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [flat?.ledger, ledgerYear],
  );

  const incomeTotal = yearLedger.filter((e) => e.kind === "income").reduce((s, e) => s + e.amountGbp, 0);
  const expenseTotal = yearLedger.filter((e) => e.kind === "expense").reduce((s, e) => s + e.amountGbp, 0);

  const chartData = useMemo(
    () =>
      [...(flat?.balanceHistory || [])]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((b) => ({ month: b.month || b.date.slice(0, 7), balance: b.balance })),
    [flat?.balanceHistory],
  );

  const selectedConn = connections.find((c) => c.id === linkConnId);
  const bankLinks = flat?.bankLinks || [];
  const documentsById = useMemo(() => new Map(documents.map((d) => [d.id, d])), [documents]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const saveProperty = async () => {
    if (!flat || !canEdit) return;
    setBusy("save");
    try {
      await saveFlat({
        address,
        propertyValueGbp: propertyValue ? Number(propertyValue) : null,
        mortgageBalanceGbp: mortgageBalance ? Number(mortgageBalance) : null,
        mortgageRatePct: mortgageRate ? Number(mortgageRate) : null,
        tenant: {
          ...tenant,
          depositGbp: tenant.depositGbp != null ? Number(tenant.depositGbp) : null,
          rentMonthlyGbp: tenant.rentMonthlyGbp != null ? Number(tenant.rentMonthlyGbp) : null,
        },
      });
      toast.success("Property details saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(null);
    }
  };

  const resetLedgerForm = () => {
    setEditingLedgerId(null);
    setLedgerDesc("");
    setLedgerAmount("");
    setLedgerCategory("");
    setLedgerDate(new Date().toISOString().slice(0, 10));
    setLedgerFrequency("One-off");
    setLedgerNotes("");
    setLedgerFile(null);
  };

  const openEditLedger = (kind: "income" | "expense", e: (typeof yearLedger)[number]) => {
    setEditingLedgerId(e.id);
    setLedgerDesc(e.description);
    setLedgerAmount(String(e.amountGbp));
    setLedgerCategory(e.category);
    setLedgerDate(e.date);
    setLedgerFrequency(e.frequency || "One-off");
    setLedgerNotes(e.notes || "");
    setLedgerFile(null);
    if (kind === "income") setIncomeOpen(true);
    else setExpenseOpen(true);
  };

  const submitLedger = async (kind: "income" | "expense") => {
    if (!flat || !canEdit) return;
    const amount = Number(ledgerAmount);
    if (!ledgerDesc.trim() || !Number.isFinite(amount) || amount <= 0) {
      toast.error("Add a description and amount");
      return;
    }
    setBusy(kind);
    try {
      const category =
        ledgerCategory ||
        (kind === "income" ? flat.incomeCategories[0] : flat.expenseCategories[0]) ||
        "Other";

      let documentId: string | null = editingLedgerId
        ? yearLedger.find((e) => e.id === editingLedgerId)?.documentId ?? null
        : null;

      if (ledgerFile) {
        const entryId = editingLedgerId || `led_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const result = await uploadDocuments([ledgerFile], {
          category,
          year: Number(ledgerDate.slice(0, 4)) || year,
          link: { noteId: entryId, type: "ledger", text: ledgerDesc.trim() },
        });
        if (result.uploaded[0]) documentId = result.uploaded[0].id;
        if (editingLedgerId) {
          await updateLedgerEntry(editingLedgerId, {
            date: ledgerDate,
            description: ledgerDesc.trim(),
            category,
            amountGbp: amount,
            frequency: ledgerFrequency,
            notes: ledgerNotes,
            documentId,
          });
        } else {
          await addLedgerEntry({
            id: entryId,
            kind,
            date: ledgerDate,
            description: ledgerDesc.trim(),
            category,
            amountGbp: amount,
            frequency: ledgerFrequency,
            notes: ledgerNotes,
            source: "manual",
            documentId,
          });
        }
      } else if (editingLedgerId) {
        await updateLedgerEntry(editingLedgerId, {
          date: ledgerDate,
          description: ledgerDesc.trim(),
          category,
          amountGbp: amount,
          frequency: ledgerFrequency,
          notes: ledgerNotes,
        });
      } else {
        await addLedgerEntry({
          kind,
          date: ledgerDate,
          description: ledgerDesc.trim(),
          category,
          amountGbp: amount,
          frequency: ledgerFrequency,
          notes: ledgerNotes,
          source: "manual",
        });
      }

      toast.success(
        editingLedgerId ? "Entry updated" : kind === "income" ? "Income added" : "Expense added",
      );
      setIncomeOpen(false);
      setExpenseOpen(false);
      resetLedgerForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save entry");
    } finally {
      setBusy(null);
    }
  };

  const connectBank = async () => {
    if (bankConfigured === false) {
      toast.error("Bank linking is not set up yet. A TrueLayer sandbox app still needs to be added.");
      return;
    }
    setBusy("connect");
    try {
      const url = await startBankConnect(window.location.pathname);
      window.location.href = url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start bank connect");
      setBusy(null);
    }
  };

  const openTagSettings = () => {
    setCategoryDraft([...(flat.documentCategories || [])]);
    setNewCategory("");
    setTagSettingsOpen(true);
  };

  const addCategoryToDraft = () => {
    const v = newCategory.trim();
    if (!v || categoryDraft.some((c) => c.toLowerCase() === v.toLowerCase())) return;
    setCategoryDraft((prev) => [...prev, v]);
    setNewCategory("");
  };

  const removeCategoryFromDraft = (c: string) => {
    setCategoryDraft((prev) => prev.filter((x) => x !== c));
  };

  const saveTagSettings = async (alsoApplyToFlatId?: string) => {
    if (categoryDraft.length === 0) {
      toast.error("Add at least one tag");
      return;
    }
    setSavingCategories(true);
    try {
      await saveFlat({ documentCategories: categoryDraft });
      if (alsoApplyToFlatId) {
        await setFlatDocumentCategories(alsoApplyToFlatId, categoryDraft);
      }
      toast.success(alsoApplyToFlatId ? "Tag settings saved for both properties" : "Tag settings saved");
      setTagSettingsOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save tag settings");
    } finally {
      setSavingCategories(false);
    }
  };

  const startEditDoc = (d: FlatDocumentMeta) => {
    setEditDocId(d.id);
    setEditDocDraft({
      name: d.name,
      category: d.category || "Other",
      year: d.year != null ? String(d.year) : "",
      notes: d.notes || "",
    });
  };

  const saveEditDoc = async () => {
    if (!editDocId) return;
    if (!editDocDraft.name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    setSavingDocEdit(true);
    try {
      await updateDocument(editDocId, {
        name: editDocDraft.name.trim(),
        category: editDocDraft.category,
        year: editDocDraft.year ? Number(editDocDraft.year) : null,
        notes: editDocDraft.notes,
      });
      toast.success("Document updated");
      setEditDocId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update document");
    } finally {
      setSavingDocEdit(false);
    }
  };

  const confirmDeleteDoc = async () => {
    if (!deleteDocTarget) return;
    setDeletingDoc(true);
    try {
      await deleteDocument(deleteDocTarget);
      toast.success("Document deleted");
      setDeleteDocTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete document");
    } finally {
      setDeletingDoc(false);
    }
  };

  const handleFileUpload = async (files: File[]) => {
    if (files.length === 0) return;
    setUploadProgress({ done: 0, total: files.length });
    try {
      const result = await uploadDocuments(
        files,
        { category: docCategory, year: docYear },
        (done, total) => setUploadProgress({ done, total }),
      );
      if (result.failed.length === 0) {
        toast.success(`${result.succeeded} document${result.succeeded === 1 ? "" : "s"} uploaded`);
      } else if (result.succeeded === 0) {
        toast.error(`Could not upload ${result.failed.length === 1 ? "that file" : "any of those files"}`);
      } else {
        toast.message(
          `${result.succeeded} uploaded, ${result.failed.length} failed (${result.failed
            .slice(0, 3)
            .map((f) => f.name)
            .join(", ")}${result.failed.length > 3 ? "…" : ""})`,
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadProgress(null);
    }
  };

  const linkAccount = async () => {
    if (!linkConnId || !linkAccountId || !canEdit) return;
    const acc = selectedConn?.accounts.find((a) => a.id === linkAccountId);
    const next = [
      ...bankLinks.filter((l) => !(l.connectionId === linkConnId && l.bankAccountId === linkAccountId)),
      {
        connectionId: linkConnId,
        bankAccountId: linkAccountId,
        label: acc?.name || acc?.masked || "Bank account",
        financeAccountId: acc?.linkedAccountId ?? null,
      },
    ];
    setBusy("link");
    try {
      await saveBankLinks(next);
      toast.success("Bank account linked to this flat");
      setLinkAccountId("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not link account");
    } finally {
      setBusy(null);
    }
  };

  const importFromLink = async (connectionId: string, bankAccountId: string) => {
    setBusy(`import-${bankAccountId}`);
    try {
      const res = await importFlatBankTransactions({
        flatId,
        connectionId,
        bankAccountId,
        days: 90,
      });
      toast.success(`Imported ${res.imported} of ${res.scanned} transactions`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(null);
    }
  };

  if (loading || !flat) {
    return (
      <div className="flex justify-center py-16 text-sm text-muted-foreground">
        {loading ? "Loading flat…" : "Flat not found"}
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-3">
      <nav
        aria-label="Flat sections"
        className="sticky top-2 z-10 flex gap-1.5 overflow-x-auto rounded-2xl border border-border/50 bg-card p-1.5 shadow-card"
      >
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => scrollTo(s.id)}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-transparent px-2.5 py-1.5 text-left text-xs font-semibold text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
            >
              <Icon className="h-3.5 w-3.5" />
              {s.label}
            </button>
          );
        })}
      </nav>

      <div className="min-w-0 space-y-4 overflow-x-hidden">
        <SectionCard id="returns" title="Returns" icon={<TrendingUp className="h-4 w-4" />}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="Gross yield" value={fmtPct(returns?.grossYieldPct)} emphasise />
            <StatTile label="Net yield" value={fmtPct(returns?.netYieldPct)} emphasise />
            <StatTile label="Net / year" value={fmtGbp(returns?.netReturnGbp)} />
            <StatTile label="Gross rent / year" value={fmtGbp(returns?.annualRentGbp)} />
          </div>
        </SectionCard>

        <SectionCard
          id="property"
          title="Property & tenant"
          icon={<Building2 className="h-4 w-4" />}
          action={
            canEdit ? (
              <Button
                size="sm"
                className="h-8 rounded-lg bg-gradient-primary text-xs"
                disabled={busy === "save"}
                onClick={() => void saveProperty()}
              >
                {busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
              </Button>
            ) : undefined
          }
        >
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Address</Label>
              <Input
                value={address}
                disabled={!canEdit}
                onChange={(e) => setAddress(e.target.value)}
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Property value (£)</Label>
              <Input
                type="number"
                value={propertyValue}
                disabled={!canEdit}
                onChange={(e) => setPropertyValue(e.target.value)}
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mortgage balance (£)</Label>
              <Input
                type="number"
                value={mortgageBalance}
                disabled={!canEdit}
                onChange={(e) => setMortgageBalance(e.target.value)}
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mortgage rate (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={mortgageRate}
                disabled={!canEdit}
                onChange={(e) => setMortgageRate(e.target.value)}
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tenant name</Label>
              <Input
                value={tenant.name}
                disabled={!canEdit}
                onChange={(e) => setTenant((t) => ({ ...t, name: e.target.value }))}
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tenant email</Label>
              <Input
                type="email"
                value={tenant.email || ""}
                disabled={!canEdit}
                onChange={(e) => setTenant((t) => ({ ...t, email: e.target.value }))}
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tenant phone</Label>
              <Input
                value={tenant.phone || ""}
                disabled={!canEdit}
                onChange={(e) => setTenant((t) => ({ ...t, phone: e.target.value }))}
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Rent / month (£)</Label>
              <Input
                type="number"
                value={tenant.rentMonthlyGbp ?? ""}
                disabled={!canEdit}
                onChange={(e) =>
                  setTenant((t) => ({
                    ...t,
                    rentMonthlyGbp: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Deposit (£)</Label>
              <Input
                type="number"
                value={tenant.depositGbp ?? ""}
                disabled={!canEdit}
                onChange={(e) =>
                  setTenant((t) => ({
                    ...t,
                    depositGbp: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Contract start</Label>
              <Input
                type="date"
                value={tenant.contractStart || ""}
                disabled={!canEdit}
                onChange={(e) => setTenant((t) => ({ ...t, contractStart: e.target.value }))}
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Contract end</Label>
              <Input
                type="date"
                value={tenant.contractEnd || ""}
                disabled={!canEdit}
                onChange={(e) => setTenant((t) => ({ ...t, contractEnd: e.target.value }))}
                className="h-10 rounded-xl"
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          id="ledger"
          title="Income & expenditure"
          icon={<Wallet className="h-4 w-4" />}
          action={
            <div className="flex flex-wrap items-center gap-1.5">
              <Select value={String(ledgerYear)} onValueChange={(v) => setLedgerYear(Number(v))}>
                <SelectTrigger className="h-8 w-[5.5rem] rounded-lg text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[year, year - 1, year - 2].map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {canEdit && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-lg text-xs"
                    onClick={() => {
                      resetLedgerForm();
                      setLedgerCategory(flat.incomeCategories[0] || "Rent");
                      setIncomeOpen(true);
                    }}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Income
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 rounded-lg bg-gradient-primary text-xs"
                    onClick={() => {
                      resetLedgerForm();
                      setLedgerCategory(flat.expenseCategories[0] || "Other");
                      setExpenseOpen(true);
                    }}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Expense
                  </Button>
                </>
              )}
            </div>
          }
        >
          <div className="mb-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-border/40 p-2.5" style={{ background: tint(12) }}>
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Income {ledgerYear}</p>
              <p className="font-display text-base font-bold text-foreground">{fmtGbp(incomeTotal)}</p>
            </div>
            <div className="rounded-xl border border-border/40 p-2.5" style={{ background: tint(12) }}>
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Expenses {ledgerYear}</p>
              <p className="font-display text-base font-bold text-foreground">{fmtGbp(expenseTotal)}</p>
            </div>
          </div>
          <div className="max-h-72 space-y-1.5 overflow-y-auto">
            {yearLedger.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No entries for {ledgerYear} yet.</p>
            ) : (
              yearLedger.map((e) => {
                const linkedDoc = e.documentId ? documentsById.get(e.documentId) : undefined;
                return (
                  <div
                    key={e.id}
                    className="flex min-w-0 items-center gap-2 rounded-xl border border-border/40 px-3 py-2"
                    style={{ background: tint(8) }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{e.description}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                        <span>{fmtDateShort(e.date)}</span>
                        <span>·</span>
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{ background: tint(20) }}
                        >
                          {e.category}
                        </span>
                        {e.frequency && e.frequency !== "One-off" && (
                          <>
                            <span>·</span>
                            <span>{e.frequency}</span>
                          </>
                        )}
                        {e.source === "truelayer" && <span>· bank</span>}
                        {linkedDoc && (
                          <a
                            href={linkedDoc.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-0.5 text-primary hover:underline"
                          >
                            <FileText className="h-3 w-3" /> doc
                          </a>
                        )}
                      </div>
                      {e.notes && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{e.notes}</p>}
                    </div>
                    <span
                      className={`shrink-0 text-sm font-semibold ${
                        e.kind === "income" ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"
                      }`}
                    >
                      {e.kind === "income" ? "+" : "−"}
                      {fmtGbp(e.amountGbp)}
                    </span>
                    {canEdit && (
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          onClick={() => openEditLedger(e.kind, e)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                          onClick={() => void removeLedgerEntry(e.id).then(() => toast.success("Removed"))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </SectionCard>

        <SectionCard
          id="bank"
          title="Bank account"
          icon={<Landmark className="h-4 w-4" />}
          action={
            canEdit ? (
              <Button
                size="sm"
                className="h-8 rounded-lg bg-gradient-primary text-xs gap-1.5"
                disabled={!!busy || bankConfigured === false}
                onClick={() => void connectBank()}
              >
                {busy === "connect" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Landmark className="h-3.5 w-3.5" />}
                Connect bank
              </Button>
            ) : undefined
          }
        >
          {bankLinks.length > 0 ? (
            <ul className="mb-4 space-y-2">
              {bankLinks.map((link) => (
                <li
                  key={`${link.connectionId}-${link.bankAccountId}`}
                  className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-border/40 px-3 py-2.5"
                  style={{ background: tint(10) }}
                >
                  <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{link.label || link.bankAccountId}</p>
                    <p className="text-[11px] text-muted-foreground">Linked account</p>
                  </div>
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-lg text-xs"
                      disabled={busy === `import-${link.bankAccountId}`}
                      onClick={() => void importFromLink(link.connectionId, link.bankAccountId)}
                    >
                      {busy === `import-${link.bankAccountId}` ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        "Import txs"
                      )}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-4 text-sm text-muted-foreground">
              {bankConfigured === false
                ? "Bank linking is waiting on a TrueLayer app, so Connect bank cannot open the bank login yet."
                : "No bank account linked to this flat yet."}
            </p>
          )}

          {canEdit && (
            <div className="grid gap-2 rounded-xl border border-border/40 p-3 sm:grid-cols-[1fr_1fr_auto]" style={{ background: tint(8) }}>
              <Select
                value={linkConnId || undefined}
                onValueChange={(v) => {
                  setLinkConnId(v);
                  setLinkAccountId("");
                }}
              >
                <SelectTrigger className="h-10 rounded-xl text-xs">
                  <SelectValue placeholder={banksLoading ? "Loading…" : "Connection"} />
                </SelectTrigger>
                <SelectContent>
                  {connections.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.provider} · {c.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={linkAccountId || undefined} onValueChange={setLinkAccountId} disabled={!selectedConn}>
                <SelectTrigger className="h-10 rounded-xl text-xs">
                  <SelectValue placeholder="Account" />
                </SelectTrigger>
                <SelectContent>
                  {(selectedConn?.accounts || []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name || a.masked || a.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="h-10 rounded-xl bg-gradient-primary text-xs"
                disabled={!linkConnId || !linkAccountId || busy === "link"}
                onClick={() => void linkAccount()}
              >
                Link
              </Button>
            </div>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">
            You can also manage bank connections under Finances → Settings.
          </p>
        </SectionCard>

        <SectionCard id="tax" title="Tax" icon={<Calculator className="h-4 w-4" />}>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Ownership</Label>
              <Select
                value={flat.tax?.ownership || flat.ownership}
                disabled={!canEdit}
                onValueChange={(v) =>
                  void saveTax({
                    ...flat.tax,
                    ownership: v as FlatOwnership,
                  }).then(() => toast.success("Ownership updated"))
                }
              >
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(OWNERSHIP_LABELS) as FlatOwnership[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {OWNERSHIP_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/40 px-3 py-2" style={{ background: tint(10) }}>
              <div>
                <p className="text-xs font-semibold text-foreground">Property allowance</p>
                <p className="text-[11px] text-muted-foreground">Use £1,000 allowance instead of expenses</p>
              </div>
              <Switch
                checked={!!flat.tax?.usePropertyAllowance}
                disabled={!canEdit}
                onCheckedChange={(checked) =>
                  void saveTax({ ...flat.tax, usePropertyAllowance: checked }).then(() =>
                    toast.success("Tax settings saved"),
                  )
                }
              />
            </div>
          </div>
          {taxEstimate && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatTile label="Gross rent" value={fmtGbp(taxEstimate.grossRentGbp)} />
                <StatTile label="Allowable expenses" value={fmtGbp(taxEstimate.allowableExpensesGbp)} />
                <StatTile label="Taxable profit" value={fmtGbp(taxEstimate.taxableProfitGbp)} />
                <StatTile label="Est. tax" value={fmtGbp(taxEstimate.estimatedIncomeTaxGbp)} emphasise />
              </div>
              {taxEstimate.financeCostTaxCreditGbp > 0 && (
                <p className="text-xs text-muted-foreground">
                  Finance-cost tax credit: {fmtGbp(taxEstimate.financeCostTaxCreditGbp)}
                </p>
              )}
              <ul className="space-y-1">
                {taxEstimate.notes.map((n) => (
                  <li key={n} className="text-xs text-muted-foreground">
                    · {n}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </SectionCard>

        <SectionCard id="notes" title="Notes" icon={<StickyNote className="h-4 w-4" />}>
          {canEdit && (
            <div className="mb-3 flex gap-2">
              <Input
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note…"
                className="h-10 rounded-xl"
              />
              <Button
                size="sm"
                className="h-10 shrink-0 rounded-xl bg-gradient-primary"
                disabled={!noteText.trim()}
                onClick={() =>
                  void addNote(noteText.trim()).then(() => {
                    setNoteText("");
                    toast.success("Note added");
                  })
                }
              >
                Add
              </Button>
            </div>
          )}
          <ul className="space-y-1.5">
            {notes.length === 0 ? (
              <li className="py-4 text-center text-sm text-muted-foreground">No notes yet.</li>
            ) : (
              notes.map((n) => (
                <li
                  key={n.id}
                  className="flex items-start gap-2 rounded-xl border border-border/40 px-3 py-2"
                  style={{ background: tint(8) }}
                >
                  <button
                    type="button"
                    disabled={!canEdit}
                    className="mt-0.5 text-xs font-semibold text-muted-foreground"
                    onClick={() => void toggleNote(n.id, !n.done)}
                  >
                    {n.done ? "✓" : "○"}
                  </button>
                  <p className={`min-w-0 flex-1 text-sm ${n.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                    {n.text}
                  </p>
                  {canEdit && (
                    <button
                      type="button"
                      className="rounded-lg p-1 text-muted-foreground hover:text-destructive"
                      onClick={() => void deleteNote(n.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))
            )}
          </ul>
        </SectionCard>

        <SectionCard
          id="docs"
          title="Documents"
          icon={<FileText className="h-4 w-4" />}
          action={
            canEdit ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={openTagSettings}
                  className="flex h-8 items-center gap-1 rounded-lg border border-border/50 px-2 text-xs font-semibold text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  title="Tag settings"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                </button>
                <Select value={docCategory} onValueChange={setDocCategory}>
                  <SelectTrigger className="h-8 w-28 rounded-lg text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(flat.documentCategories || []).map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(docYear)} onValueChange={(v) => setDocYear(Number(v))}>
                  <SelectTrigger className="h-8 w-[4.5rem] rounded-lg text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[year + 1, year, year - 1, year - 2, year - 3].map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="h-8 rounded-lg bg-gradient-primary text-xs gap-1"
                  disabled={uploadingDoc}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploadingDoc ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {uploadingDoc && uploadProgress ? `${uploadProgress.done}/${uploadProgress.total}` : "Upload"}
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length === 0) return;
                    void handleFileUpload(files);
                    e.target.value = "";
                  }}
                />
              </div>
            ) : undefined
          }
        >
          <ul className="space-y-1.5">
            {documents.length === 0 ? (
              <li className="py-4 text-center text-sm text-muted-foreground">No documents yet.</li>
            ) : (
              documents.map((d) =>
                editDocId === d.id ? (
                  <li
                    key={d.id}
                    className="space-y-2 rounded-xl border border-primary/40 px-3 py-2.5"
                    style={{ background: tint(14) }}
                  >
                    <Input
                      value={editDocDraft.name}
                      onChange={(e) => setEditDocDraft((p) => ({ ...p, name: e.target.value }))}
                      className="h-9 rounded-lg text-sm"
                      placeholder="Document name"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        value={editDocDraft.category}
                        onValueChange={(v) => setEditDocDraft((p) => ({ ...p, category: v }))}
                      >
                        <SelectTrigger className="h-9 rounded-lg text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(flat.documentCategories || []).map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={editDocDraft.year || "none"}
                        onValueChange={(v) => setEditDocDraft((p) => ({ ...p, year: v === "none" ? "" : v }))}
                      >
                        <SelectTrigger className="h-9 rounded-lg text-xs">
                          <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No year</SelectItem>
                          {[year + 1, year, year - 1, year - 2, year - 3, year - 4].map((y) => (
                            <SelectItem key={y} value={String(y)}>
                              {y}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Textarea
                      value={editDocDraft.notes}
                      onChange={(e) => setEditDocDraft((p) => ({ ...p, notes: e.target.value }))}
                      rows={2}
                      className="rounded-lg text-sm"
                      placeholder="Notes…"
                    />
                    <div className="flex justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg text-xs"
                        onClick={() => setEditDocId(null)}
                      >
                        <X className="mr-1 h-3.5 w-3.5" />
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 rounded-lg bg-gradient-primary text-xs"
                        disabled={savingDocEdit}
                        onClick={() => void saveEditDoc()}
                      >
                        {savingDocEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
                        Save
                      </Button>
                    </div>
                  </li>
                ) : (
                  <li
                    key={d.id}
                    className="flex min-w-0 items-center gap-2 rounded-xl border border-border/40 px-3 py-2"
                    style={{ background: tint(8) }}
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <a href={d.url} target="_blank" rel="noreferrer" className="truncate text-sm font-medium text-primary hover:underline">
                        {d.name}
                      </a>
                      <p className="text-[11px] text-muted-foreground">
                        {d.category || "Other"}
                        {d.year ? ` · ${d.year}` : ""} · {fmtDateShort(d.date)}
                      </p>
                      {d.notes && <p className="truncate text-[11px] text-muted-foreground">{d.notes}</p>}
                    </div>
                    {canEdit && (
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          onClick={() => startEditDoc(d)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                          onClick={() => setDeleteDocTarget(d)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </li>
                ),
              )
            )}
          </ul>
        </SectionCard>

        <SectionCard
          id="balances"
          title="Balances"
          icon={<TrendingUp className="h-4 w-4" />}
          action={
            canEdit ? (
              <Button size="sm" className="h-8 rounded-lg bg-gradient-primary text-xs" onClick={() => setBalOpen(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add
              </Button>
            ) : undefined
          }
        >
          {chartData.length > 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-52 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="flatBalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={48} tickFormatter={(v) => `£${Math.round(v / 1000)}k`} />
                  <Tooltip content={<BalanceTooltip />} />
                  <Area type="monotone" dataKey="balance" stroke={ACCENT} fill="url(#flatBalGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No balance history yet.</p>
          )}
        </SectionCard>
      </div>

      <Dialog
        open={incomeOpen}
        onOpenChange={(o) => {
          setIncomeOpen(o);
          if (!o) resetLedgerForm();
        }}
      >
        <DialogContent className="mx-4 max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{editingLedgerId ? "Edit income" : "Add income"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Input value={ledgerDesc} onChange={(e) => setLedgerDesc(e.target.value)} className="h-10 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Amount (£)</Label>
                <Input type="number" value={ledgerAmount} onChange={(e) => setLedgerAmount(e.target.value)} className="h-10 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Date</Label>
                <Input type="date" value={ledgerDate} onChange={(e) => setLedgerDate(e.target.value)} className="h-10 rounded-xl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Select value={ledgerCategory} onValueChange={setLedgerCategory}>
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {flat.incomeCategories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Frequency</Label>
                <Select value={ledgerFrequency} onValueChange={setLedgerFrequency}>
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FLAT_LEDGER_FREQUENCIES.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={ledgerNotes}
                onChange={(e) => setLedgerNotes(e.target.value)}
                rows={2}
                className="rounded-xl"
                placeholder="Optional notes…"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Attach document (optional)</Label>
              <Input
                type="file"
                onChange={(e) => setLedgerFile(e.target.files?.[0] || null)}
                className="h-10 rounded-xl text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
              />
              {ledgerFile && <p className="text-[11px] text-muted-foreground">{ledgerFile.name} will also be added to Documents.</p>}
            </div>
            <Button className="w-full rounded-xl bg-gradient-primary" disabled={busy === "income"} onClick={() => void submitLedger("income")}>
              {busy === "income" ? <Loader2 className="h-4 w-4 animate-spin" /> : editingLedgerId ? "Save changes" : "Save income"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={expenseOpen}
        onOpenChange={(o) => {
          setExpenseOpen(o);
          if (!o) resetLedgerForm();
        }}
      >
        <DialogContent className="mx-4 max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{editingLedgerId ? "Edit expense" : "Add expense"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Input value={ledgerDesc} onChange={(e) => setLedgerDesc(e.target.value)} className="h-10 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Amount (£)</Label>
                <Input type="number" value={ledgerAmount} onChange={(e) => setLedgerAmount(e.target.value)} className="h-10 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Date</Label>
                <Input type="date" value={ledgerDate} onChange={(e) => setLedgerDate(e.target.value)} className="h-10 rounded-xl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Select value={ledgerCategory} onValueChange={setLedgerCategory}>
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {flat.expenseCategories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Frequency</Label>
                <Select value={ledgerFrequency} onValueChange={setLedgerFrequency}>
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FLAT_LEDGER_FREQUENCIES.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={ledgerNotes}
                onChange={(e) => setLedgerNotes(e.target.value)}
                rows={2}
                className="rounded-xl"
                placeholder="Optional notes…"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Attach document (optional)</Label>
              <Input
                type="file"
                onChange={(e) => setLedgerFile(e.target.files?.[0] || null)}
                className="h-10 rounded-xl text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
              />
              {ledgerFile && <p className="text-[11px] text-muted-foreground">{ledgerFile.name} will also be added to Documents.</p>}
            </div>
            <Button className="w-full rounded-xl bg-gradient-primary" disabled={busy === "expense"} onClick={() => void submitLedger("expense")}>
              {busy === "expense" ? <Loader2 className="h-4 w-4 animate-spin" /> : editingLedgerId ? "Save changes" : "Save expense"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={balOpen} onOpenChange={setBalOpen}>
        <DialogContent className="mx-4 max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Add balance</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={balDate} onChange={(e) => setBalDate(e.target.value)} className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Balance (£)</Label>
              <Input type="number" value={balAmount} onChange={(e) => setBalAmount(e.target.value)} className="h-10 rounded-xl" />
            </div>
            <Button
              className="w-full rounded-xl bg-gradient-primary"
              onClick={() => {
                const balance = Number(balAmount);
                if (!Number.isFinite(balance)) {
                  toast.error("Enter a balance");
                  return;
                }
                void addBalance({
                  date: balDate,
                  month: balDate.slice(0, 7),
                  balance,
                }).then(() => {
                  toast.success("Balance added");
                  setBalOpen(false);
                  setBalAmount("");
                });
              }}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={tagSettingsOpen} onOpenChange={setTagSettingsOpen}>
        <DialogContent className="mx-4 max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Document tags for {flat.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <p className="text-xs text-muted-foreground">
              These tags appear when uploading a document to this property.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {categoryDraft.map((c) => (
                <span
                  key={c}
                  className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{ background: tint(20) }}
                >
                  {c}
                  <button
                    type="button"
                    onClick={() => removeCategoryFromDraft(c)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCategoryToDraft();
                  }
                }}
                placeholder="Add a tag…"
                className="h-9 rounded-lg text-sm"
              />
              <Button size="sm" variant="outline" className="h-9 rounded-lg" onClick={addCategoryToDraft}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="space-y-2 pt-1">
              <Button
                className="w-full rounded-xl bg-gradient-primary"
                disabled={savingCategories}
                onClick={() => void saveTagSettings()}
              >
                {savingCategories ? <Loader2 className="h-4 w-4 animate-spin" /> : `Save for ${flat.name}`}
              </Button>
              {otherFlats.map((other) => (
                <Button
                  key={other.id}
                  variant="outline"
                  className="w-full rounded-xl"
                  disabled={savingCategories}
                  onClick={() => void saveTagSettings(other.id)}
                >
                  Use these settings for {other.name} too
                </Button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteDocTarget} onOpenChange={(o) => !o && setDeleteDocTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{deleteDocTarget?.name}</strong>. The file cannot be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingDoc}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletingDoc}
              onClick={(e) => {
                e.preventDefault();
                void confirmDeleteDoc();
              }}
            >
              {deletingDoc ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
