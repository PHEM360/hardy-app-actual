import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import {
  Building2, Plus, Edit2, Trash2, Globe, Hash, MapPin,
  CheckCircle2, XCircle, ChevronRight,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompanies } from "@/hooks/useCompanies";
import { Company } from "@/types/app";

const PALETTE = [
  "#6366f1","#8b5cf6","#ec4899","#ef4444","#f97316",
  "#eab308","#22c55e","#14b8a6","#0ea5e9","#64748b",
];

const EMOJIS = ["🏢","🚀","💼","🔥","⚡","🎯","🌿","🦁","🐉","🛠️","💡","🎨"];

const COMPANY_TYPE_LABELS: Record<string, string> = {
  registered: "Ltd Company",
  sole_trader: "Sole Trader",
  trading_name: "Trading Name",
  other: "Other",
};

const EMPTY: Omit<Company, "id" | "createdAt" | "updatedAt"> = {
  name: "",
  description: "",
  color: "#6366f1",
  emoji: "🏢",
  isRegistered: false,
  companyType: "other",
  parentCompanyId: undefined,
  taxYearStart: `${new Date().getFullYear()}-04-06`,
  contact: {},
};

function CompanyForm({
  initial,
  allCompanies,
  onSave,
  onCancel,
  saving,
}: {
  initial: Omit<Company, "id" | "createdAt" | "updatedAt">;
  allCompanies: Company[];
  onSave: (c: Omit<Company, "id" | "createdAt" | "updatedAt">) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState(initial);
  const set = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const setContact = (k: keyof Company["contact"], v: string) =>
    setForm((f) => ({ ...f, contact: { ...f.contact, [k]: v } }));

  const parentCandidates = allCompanies.filter(
    (c) => c.companyType === "registered" || c.companyType === "sole_trader"
  );
  const isTrading = form.companyType === "trading_name";
  const showCompanyNo = form.companyType === "registered" || form.isRegistered;

  return (
    <div className="space-y-4 pt-1">
      <div className="space-y-1.5">
        <Label>Company Name *</Label>
        <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. BGM Health Ltd" className="h-10 rounded-xl" />
      </div>

      <div className="space-y-1.5">
        <Label>Company Type</Label>
        <Select value={form.companyType || "other"} onValueChange={(v) => {
          set("companyType", v);
          if (v !== "trading_name") set("parentCompanyId", undefined);
          if (v === "registered") set("isRegistered", true);
          if (v === "sole_trader") set("isRegistered", false);
        }}>
          <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="registered">Ltd Company (Registered)</SelectItem>
            <SelectItem value="sole_trader">Sole Trader</SelectItem>
            <SelectItem value="trading_name">Trading Name</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isTrading && (
        <div className="space-y-1.5">
          <Label>Parent Company</Label>
          <Select value={form.parentCompanyId || ""} onValueChange={(v) => set("parentCompanyId", v || undefined)}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Select parent company…" /></SelectTrigger>
            <SelectContent>
              {parentCandidates.map((c) => (
                <SelectItem key={c.id} value={c.id!}>{c.emoji} {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">Tax filed under the parent company</p>
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea value={form.description || ""} onChange={(e) => set("description", e.target.value)} placeholder="What does this company do?" className="rounded-xl resize-none" rows={2} />
      </div>

      {!isTrading && (
        <div className="flex items-center justify-between py-1">
          <div>
            <Label>Registered at Companies House</Label>
            <p className="text-[11px] text-muted-foreground">Has a Companies House number</p>
          </div>
          <Switch checked={!!form.isRegistered} onCheckedChange={(v) => set("isRegistered", v)} />
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Brand Colour</Label>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 flex-wrap">
            {PALETTE.map((c) => (
              <button key={c} onClick={() => set("color", c)} style={{ backgroundColor: c }}
                className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? "border-foreground scale-110" : "border-transparent"}`} />
            ))}
          </div>
          <input type="color" value={form.color} onChange={(e) => set("color", e.target.value)} className="w-8 h-8 rounded-lg border border-border cursor-pointer" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Icon</Label>
        <div className="flex gap-1.5 flex-wrap">
          {EMOJIS.map((e) => (
            <button key={e} onClick={() => set("emoji", e)}
              className={`text-xl w-9 h-9 rounded-lg flex items-center justify-center transition-all ${form.emoji === e ? "bg-muted ring-2 ring-primary" : "hover:bg-muted/60"}`}>
              {e}
            </button>
          ))}
        </div>
      </div>

      {!isTrading && (
        <div className="space-y-1.5">
          <Label>Tax Year Start</Label>
          <Input type="date" value={form.taxYearStart} onChange={(e) => set("taxYearStart", e.target.value)} className="h-10 rounded-xl" />
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact Details</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Phone" value={form.contact.phone || ""} onChange={(e) => setContact("phone", e.target.value)} className="h-9 rounded-xl text-sm" />
          <Input placeholder="Email" value={form.contact.email || ""} onChange={(e) => setContact("email", e.target.value)} className="h-9 rounded-xl text-sm" />
          <Input placeholder="Website" value={form.contact.website || ""} onChange={(e) => setContact("website", e.target.value)} className="h-9 rounded-xl text-sm" />
          <Input placeholder="VAT Number" value={form.contact.vatNumber || ""} onChange={(e) => setContact("vatNumber", e.target.value)} className="h-9 rounded-xl text-sm" />
          {showCompanyNo && (
            <Input placeholder="Company Number" value={form.contact.companyNumber || ""} onChange={(e) => setContact("companyNumber", e.target.value)} className="h-9 rounded-xl text-sm col-span-2" />
          )}
          <Textarea placeholder="Registered Address" value={form.contact.address || ""} onChange={(e) => setContact("address", e.target.value)} className="rounded-xl text-sm col-span-2 resize-none" rows={2} />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} className="flex-1 h-10 rounded-xl">Cancel</Button>
        <Button onClick={() => onSave(form)} disabled={!form.name.trim() || saving} className="flex-1 h-10 rounded-xl text-white" style={{ backgroundColor: form.color }}>
          {saving ? "Saving…" : "Save Company"}
        </Button>
      </div>
    </div>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-2 pt-3 pb-1.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-medium">{count}</span>
    </div>
  );
}

function CompanyTile({ co, children, index, onEdit, onDelete, onNavigate, onNavigateChild }: {
  co: Company; children: Company[]; index: number;
  onEdit: () => void; onDelete: () => void; onNavigate: () => void; onNavigateChild: (id: string) => void;
}) {
  const typeLabel = co.companyType ? COMPANY_TYPE_LABELS[co.companyType] : null;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
      className="rounded-2xl border border-border/50 bg-card shadow-soft overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
      onClick={onNavigate}
    >
      <div className="h-1.5 w-full" style={{ backgroundColor: co.color }} />
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-1 mb-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ backgroundColor: `${co.color}20` }}>
            {co.emoji || "🏢"}
          </div>
          <div className="flex gap-0.5">
            <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
              <Edit2 className="w-3 h-3" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        <p className="text-sm font-bold text-card-foreground leading-tight">{co.name}</p>
        {typeLabel && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground mt-0.5 inline-block">{typeLabel}</span>
        )}
        {co.description && <p className="text-[11px] text-muted-foreground line-clamp-1 mt-1">{co.description}</p>}

        <div className="space-y-1.5 mt-2.5">
          <div className="flex items-center gap-1.5">
            {co.isRegistered
              ? <CheckCircle2 className="w-3 h-3 text-green-600 flex-shrink-0" />
              : <XCircle className="w-3 h-3 text-muted-foreground/40 flex-shrink-0" />}
            <span className={`text-[11px] font-medium ${co.isRegistered ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}`}>
              {co.isRegistered ? "Registered" : "Not registered"}
            </span>
          </div>
          {co.contact.companyNumber && (
            <div className="flex items-center gap-1.5">
              <Hash className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <span className="text-[11px] text-muted-foreground font-mono">{co.contact.companyNumber}</span>
            </div>
          )}
          {co.contact.website && (
            <div className="flex items-center gap-1.5 min-w-0">
              <Globe className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <span className="text-[11px] text-muted-foreground truncate">{co.contact.website.replace(/^https?:\/\//, "")}</span>
            </div>
          )}
          {co.contact.address && (
            <div className="flex items-start gap-1.5 min-w-0">
              <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-0.5" />
              <span className="text-[11px] text-muted-foreground line-clamp-2 leading-tight">{co.contact.address}</span>
            </div>
          )}
        </div>

        {/* Trading names sub-tiles */}
        {children.length > 0 && (
          <div className="mt-3 pt-2.5 border-t border-border/30">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1.5">Trades as</p>
            <div className="flex flex-col gap-1">
              {children.map((child) => (
                <button
                  key={child.id}
                  onClick={(e) => { e.stopPropagation(); onNavigateChild(child.id!); }}
                  className="flex items-center gap-1.5 text-[11px] px-2 py-1.5 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/60 transition-colors w-full text-left"
                  style={{ borderLeftColor: child.color, borderLeftWidth: 2 }}
                >
                  <span className="text-sm">{child.emoji || "🏢"}</span>
                  <span className="font-medium flex-1">{child.name}</span>
                  <ChevronRight className="w-2.5 h-2.5 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

const Companies = () => {
  const { companies, loading, addCompany, updateCompany, deleteCompany } = useCompanies();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCompany, setEditCompany] = useState<Company | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async (form: Omit<Company, "id" | "createdAt" | "updatedAt">) => {
    setSaving(true);
    try {
      if (editCompany?.id) await updateCompany(editCompany.id, form);
      else await addCompany(form);
      setDialogOpen(false);
      setEditCompany(null);
    } finally { setSaving(false); }
  };

  const tradingNames = useMemo(() => companies.filter((c) => c.companyType === "trading_name"), [companies]);
  const topLevel = useMemo(() => companies.filter((c) => c.companyType !== "trading_name"), [companies]);
  const registered = useMemo(() => topLevel.filter((c) => c.companyType === "registered"), [topLevel]);
  const soleTraders = useMemo(() => topLevel.filter((c) => c.companyType === "sole_trader"), [topLevel]);
  const others = useMemo(() => topLevel.filter((c) => !c.companyType || c.companyType === "other"), [topLevel]);
  const getChildren = (id: string) => tradingNames.filter((c) => c.parentCompanyId === id);

  const renderTile = (co: Company, i: number) => (
    <CompanyTile
      key={co.id}
      co={co}
      children={getChildren(co.id!)}
      index={i}
      onEdit={() => { setEditCompany(co); setDialogOpen(true); }}
      onDelete={() => co.id && deleteCompany(co.id)}
      onNavigate={() => navigate(`/companies/${co.id}`)}
      onNavigateChild={(id) => navigate(`/companies/${id}`)}
    />
  );

  if (loading) {
    return (
      <FeaturePageShell title="Companies" subtitle="Business management" icon={<Building2 className="w-5 h-5" />}>
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </FeaturePageShell>
    );
  }

  return (
    <FeaturePageShell
      title="Companies"
      subtitle="Business management"
      icon={<Building2 className="w-5 h-5" />}
      action={
        <button onClick={() => { setEditCompany(null); setDialogOpen(true); }} className="flex items-center gap-1 text-xs text-primary font-semibold">
          <Plus className="w-4 h-4" /> Add
        </button>
      }
    >
      <AnimatePresence mode="popLayout">
        {companies.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-16 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center text-2xl">🏢</div>
            <div className="text-center">
              <p className="text-sm font-medium">No companies yet</p>
              <p className="text-xs text-muted-foreground mt-1">Add your first company to get started</p>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-0">
            {registered.length > 0 && (
              <div>
                <SectionHeader title="Registered Companies" count={registered.length} />
                <div className="grid grid-cols-2 gap-3">
                  {registered.map((co, i) => renderTile(co, i))}
                </div>
              </div>
            )}
            {soleTraders.length > 0 && (
              <div>
                <SectionHeader title="Sole Traders" count={soleTraders.length} />
                <div className="grid grid-cols-2 gap-3">
                  {soleTraders.map((co, i) => renderTile(co, registered.length + i))}
                </div>
              </div>
            )}
            {others.length > 0 && (
              <div>
                {(registered.length > 0 || soleTraders.length > 0) && (
                  <SectionHeader title="Other" count={others.length} />
                )}
                <div className="grid grid-cols-2 gap-3">
                  {others.map((co, i) => renderTile(co, registered.length + soleTraders.length + i))}
                </div>
              </div>
            )}
          </div>
        )}
      </AnimatePresence>

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditCompany(null); }}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editCompany ? "Edit Company" : "Add Company"}</DialogTitle>
          </DialogHeader>
          <CompanyForm
            allCompanies={companies}
            initial={editCompany ? {
              name: editCompany.name,
              description: editCompany.description || "",
              color: editCompany.color,
              emoji: editCompany.emoji || "🏢",
              isRegistered: editCompany.isRegistered ?? false,
              companyType: editCompany.companyType || "other",
              parentCompanyId: editCompany.parentCompanyId,
              taxYearStart: editCompany.taxYearStart,
              contact: editCompany.contact,
            } : EMPTY}
            onSave={handleSave}
            onCancel={() => { setDialogOpen(false); setEditCompany(null); }}
            saving={saving}
          />
        </DialogContent>
      </Dialog>
    </FeaturePageShell>
  );
};

export default Companies;
