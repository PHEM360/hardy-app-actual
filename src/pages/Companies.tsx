import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Building2, Plus, ChevronRight, Trash2, Edit2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCompanies } from "@/hooks/useCompanies";
import { Company } from "@/types/app";

const PALETTE = [
  "#6366f1","#8b5cf6","#ec4899","#ef4444","#f97316",
  "#eab308","#22c55e","#14b8a6","#0ea5e9","#64748b",
];

const EMOJIS = ["🏢","🚀","💼","🔥","⚡","🎯","🌿","🦁","🐉","🛠️","💡","🎨"];

const EMPTY: Omit<Company, "id" | "createdAt" | "updatedAt"> = {
  name: "",
  description: "",
  color: "#6366f1",
  emoji: "🏢",
  taxYearStart: `${new Date().getFullYear()}-04-06`,
  contact: {},
};

function CompanyForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: Omit<Company, "id" | "createdAt" | "updatedAt">;
  onSave: (c: Omit<Company, "id" | "createdAt" | "updatedAt">) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState(initial);
  const set = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const setContact = (k: keyof Company["contact"], v: string) =>
    setForm((f) => ({ ...f, contact: { ...f.contact, [k]: v } }));

  return (
    <div className="space-y-4 pt-1">
      <div className="space-y-1.5">
        <Label>Company Name *</Label>
        <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. PHEM360 Ltd" className="h-10 rounded-xl" />
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea value={form.description || ""} onChange={(e) => set("description", e.target.value)} placeholder="What does this company do?" className="rounded-xl resize-none" rows={2} />
      </div>

      {/* Colour picker */}
      <div className="space-y-1.5">
        <Label>Brand Colour</Label>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 flex-wrap">
            {PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => set("color", c)}
                style={{ backgroundColor: c }}
                className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? "border-foreground scale-110" : "border-transparent"}`}
              />
            ))}
          </div>
          <input type="color" value={form.color} onChange={(e) => set("color", e.target.value)} className="w-8 h-8 rounded-lg border border-border cursor-pointer" title="Custom colour" />
        </div>
      </div>

      {/* Emoji picker */}
      <div className="space-y-1.5">
        <Label>Icon</Label>
        <div className="flex gap-1.5 flex-wrap">
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => set("emoji", e)}
              className={`text-xl w-9 h-9 rounded-lg flex items-center justify-center transition-all ${form.emoji === e ? "bg-muted ring-2 ring-primary" : "hover:bg-muted/60"}`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Tax Year Start</Label>
        <Input type="date" value={form.taxYearStart} onChange={(e) => set("taxYearStart", e.target.value)} className="h-10 rounded-xl" />
      </div>

      {/* Contact details */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact Details</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Phone" value={form.contact.phone || ""} onChange={(e) => setContact("phone", e.target.value)} className="h-9 rounded-xl text-sm" />
          <Input placeholder="Email" value={form.contact.email || ""} onChange={(e) => setContact("email", e.target.value)} className="h-9 rounded-xl text-sm" />
          <Input placeholder="Website" value={form.contact.website || ""} onChange={(e) => setContact("website", e.target.value)} className="h-9 rounded-xl text-sm" />
          <Input placeholder="VAT Number" value={form.contact.vatNumber || ""} onChange={(e) => setContact("vatNumber", e.target.value)} className="h-9 rounded-xl text-sm" />
          <Input placeholder="Company Number" value={form.contact.companyNumber || ""} onChange={(e) => setContact("companyNumber", e.target.value)} className="h-9 rounded-xl text-sm col-span-2" />
          <Input placeholder="Address" value={form.contact.address || ""} onChange={(e) => setContact("address", e.target.value)} className="h-9 rounded-xl text-sm col-span-2" />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} className="flex-1 h-10 rounded-xl">Cancel</Button>
        <Button onClick={() => onSave(form)} disabled={!form.name.trim() || saving} className="flex-1 h-10 rounded-xl" style={{ backgroundColor: form.color }}>
          {saving ? "Saving…" : "Save Company"}
        </Button>
      </div>
    </div>
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
      if (editCompany?.id) {
        await updateCompany(editCompany.id, form);
      } else {
        await addCompany(form);
      }
      setDialogOpen(false);
      setEditCompany(null);
    } finally {
      setSaving(false);
    }
  };

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
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {companies.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-16 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center text-2xl">🏢</div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">No companies yet</p>
                <p className="text-xs text-muted-foreground mt-1">Add your first company to get started</p>
              </div>
            </motion.div>
          ) : (
            companies.map((co, i) => (
              <motion.div
                key={co.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-2xl border border-border/50 bg-card shadow-soft overflow-hidden"
              >
                {/* Colour bar */}
                <div className="h-1.5 w-full" style={{ backgroundColor: co.color }} />
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ backgroundColor: `${co.color}20` }}>
                    {co.emoji || "🏢"}
                  </div>
                  <div className="flex-1 min-w-0" onClick={() => navigate(`/companies/${co.id}`)}>
                    <p className="text-sm font-semibold text-card-foreground">{co.name}</p>
                    {co.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{co.description}</p>}
                    <div className="flex gap-2 mt-1">
                      {co.contact.website && <span className="text-[10px] text-muted-foreground truncate">{co.contact.website}</span>}
                      {co.contact.companyNumber && <span className="text-[10px] text-muted-foreground">#{co.contact.companyNumber}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditCompany(co); setDialogOpen(true); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => co.id && deleteCompany(co.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => navigate(`/companies/${co.id}`)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditCompany(null); }}>
        <DialogContent className="max-w-sm mx-4 max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="font-display">{editCompany ? "Edit Company" : "Add Company"}</DialogTitle>
          </DialogHeader>
          <CompanyForm
            initial={editCompany ? {
              name: editCompany.name,
              description: editCompany.description || "",
              color: editCompany.color,
              emoji: editCompany.emoji || "🏢",
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
