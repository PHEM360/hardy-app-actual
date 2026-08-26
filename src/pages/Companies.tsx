import { useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import {
  Building2, Plus, Edit2, Trash2, QrCode, UserPlus, X,
  ImagePlus, ExternalLink, Mail, Phone, Megaphone,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import CompanyLogoMark from "@/components/companies/CompanyLogoMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { storage } from "@/lib/firebase";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useAuth } from "@/auth/AuthContext";
import { useAppUsers } from "@/hooks/useAppUsers";
import { useCompanies } from "@/hooks/useCompanies";
import { useSharedScope } from "@/hooks/useSharedScope";
import { Company } from "@/types/app";
import { toast } from "sonner";

function taxYearBounds(taxYearStart?: string) {
  const base = taxYearStart ? new Date(taxYearStart) : new Date(`${new Date().getFullYear()}-04-06`);
  const now = new Date();
  let start = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  while (new Date(start.getFullYear() + 1, start.getMonth(), start.getDate()) <= now) {
    start = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
  }
  const end = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
  end.setDate(end.getDate() - 1);
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86_400_000));
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
    daysLeft,
    label: `${start.getFullYear()}/${String(start.getFullYear() + 1).slice(2)}`,
  };
}

function shortDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

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
  logoUrl: "",
  isRegistered: false,
  companyType: "other",
  parentCompanyId: undefined,
  taxYearStart: `${new Date().getFullYear()}-04-06`,
  contact: {},
};

interface SharingProps {
  isOwner: boolean;
  sharedWith: string[];
  appUsers: { id: string; name: string; email: string }[];
  shareEmail: string;
  onShareEmailChange: (v: string) => void;
  onShare: () => void;
  onUnshare: (uid: string) => void;
  shareLoading: boolean;
  shareError: string | null;
  shareSuccess: boolean;
}

function SharingSection({ sharing }: { sharing: SharingProps }) {
  const {
    sharedWith, appUsers, shareEmail, onShareEmailChange, onShare, onUnshare,
    shareLoading, shareError, shareSuccess,
  } = sharing;

  return (
    <div className="space-y-2 pt-1 border-t border-border/40">
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Shared With</Label>
      {sharedWith.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {sharedWith.map((uid) => {
            const person = appUsers.find((u) => u.id === uid);
            return (
              <span key={uid} className="flex items-center gap-1 text-[11px] font-medium bg-muted px-2 py-1 rounded-full text-foreground">
                {person?.name || "Unknown user"}
                <button onClick={() => onUnshare(uid)} className="text-muted-foreground hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          type="email"
          value={shareEmail}
          onChange={(e) => onShareEmailChange(e.target.value)}
          placeholder="name@example.com"
          className="h-9 rounded-xl text-sm flex-1"
          autoCapitalize="none"
          autoCorrect="off"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onShare}
          disabled={!shareEmail.trim() || shareLoading}
          className="h-9 rounded-xl gap-1 flex-shrink-0"
        >
          <UserPlus className="w-3.5 h-3.5" /> Share
        </Button>
      </div>
      {shareError && <p className="text-[11px] text-destructive">{shareError}</p>}
      {shareSuccess && <p className="text-[11px] text-success font-medium">✓ Shared successfully!</p>}
    </div>
  );
}

function CompanyForm({
  initial,
  allCompanies,
  editId,
  onSave,
  onCancel,
  saving,
  sharing,
}: {
  initial: Omit<Company, "id" | "createdAt" | "updatedAt">;
  allCompanies: Company[];
  editId?: string;
  onSave: (c: Omit<Company, "id" | "createdAt" | "updatedAt">) => void;
  onCancel: () => void;
  saving: boolean;
  sharing?: SharingProps;
}) {
  const [form, setForm] = useState(initial);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const setContact = (k: keyof Company["contact"], v: string) =>
    setForm((f) => ({ ...f, contact: { ...f.contact, [k]: v } }));

  const parentCandidates = allCompanies.filter(
    (c) => c.companyType !== "trading_name" && c.id !== editId
  );
  const isTrading = form.companyType === "trading_name";
  const showCompanyNo = form.companyType === "registered" || form.isRegistered;

  const uploadLogo = async (file: File) => {
    setUploadingLogo(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) || "logo";
      const logoRef = ref(storage, `companies/logos/${Date.now()}_${safeName}`);
      await uploadBytes(logoRef, file, { contentType: file.type || "image/*" });
      set("logoUrl", await getDownloadURL(logoRef));
      toast.success("Logo ready");
    } catch (error) {
      console.error("Failed to upload company logo", error);
      toast.error("Couldn’t upload the logo. Please try again.");
    } finally {
      setUploadingLogo(false);
    }
  };

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
        <Label>Logo or Icon</Label>
        <p className="text-[10px] text-muted-foreground">The website icon is used automatically. Upload a logo here to override it.</p>
        <input
          ref={logoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void uploadLogo(file);
          }}
        />
        <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/30 p-2.5">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl text-2xl"
            style={{ background: `color-mix(in srgb, ${form.color} 25%, hsl(var(--card)))` }}
          >
            <CompanyLogoMark
              logoUrl={form.logoUrl}
              website={form.contact.website}
              emoji={form.emoji}
              name={form.name || "Company"}
            />
          </div>
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              disabled={uploadingLogo}
              className="flex items-center gap-1.5 text-xs font-semibold text-primary disabled:opacity-50"
            >
              <ImagePlus className="h-3.5 w-3.5" /> {uploadingLogo ? "Uploading…" : form.logoUrl ? "Replace logo" : "Upload logo"}
            </button>
            {form.logoUrl && (
              <button type="button" onClick={() => set("logoUrl", "")} className="mt-1 block text-[10px] text-muted-foreground hover:text-destructive">
                Remove logo
              </button>
            )}
          </div>
        </div>
        {!form.logoUrl && (
          <div className="flex gap-1.5 flex-wrap">
            {EMOJIS.map((e) => (
              <button key={e} type="button" onClick={() => set("emoji", e)}
                className={`text-xl w-9 h-9 rounded-lg flex items-center justify-center transition-all ${form.emoji === e ? "bg-muted ring-2 ring-primary" : "hover:bg-muted/60"}`}>
                {e}
              </button>
            ))}
          </div>
        )}
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

      {sharing?.isOwner && <SharingSection sharing={sharing} />}

      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} className="flex-1 h-10 rounded-xl">Cancel</Button>
        <Button onClick={() => onSave(form)} disabled={!form.name.trim() || saving || uploadingLogo} className="flex-1 h-10 rounded-xl text-white" style={{ backgroundColor: form.color }}>
          {saving ? "Saving…" : uploadingLogo ? "Uploading logo…" : "Save Company"}
        </Button>
      </div>
    </div>
  );
}

function CompanyCard({
  co, index, tradingNameChildren, currentUid, appUsers,
  onEdit, onDelete, onNavigate, onEditChild, onDeleteChild, onNavigateChild,
}: {
  co: Company;
  index: number;
  tradingNameChildren?: Company[];
  currentUid?: string;
  appUsers: { id: string; name: string; email: string }[];
  onEdit: () => void;
  onDelete: () => void;
  onNavigate: () => void;
  onEditChild?: (c: Company) => void;
  onDeleteChild?: (c: Company) => void;
  onNavigateChild?: (c: Company) => void;
}) {
  const typeLabel = co.companyType ? COMPANY_TYPE_LABELS[co.companyType] : null;
  const snap = taxYearBounds(co.taxYearStart);
  const isOwner = !co.ownerId || co.ownerId === currentUid;
  const sharedWith = co.sharedWith ?? [];
  const sharedLabel = isOwner
    ? (sharedWith.length > 0 ? `Shared with ${sharedWith.map((uid) => appUsers.find((u) => u.id === uid)?.name || "someone").join(", ")}` : null)
    : (() => {
        const owner = appUsers.find((u) => u.id === co.ownerId);
        return owner ? `Shared by ${owner.name}` : "Shared with you";
      })();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      role="button"
      tabIndex={0}
      onClick={onNavigate}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onNavigate(); } }}
      className="cursor-pointer overflow-hidden rounded-2xl border border-border/40 shadow-card transition-shadow hover:shadow-md"
      style={{
        background: `color-mix(in srgb, ${co.color} 15%, hsl(var(--card)))`,
        borderTopWidth: 3,
        borderTopColor: co.color,
      }}
    >
      <div className="p-4">
        <div className="mb-3 flex items-start gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
            style={{ background: `color-mix(in srgb, ${co.color} 28%, hsl(var(--card)))` }}
          >
            <CompanyLogoMark logoUrl={co.logoUrl} website={co.contact.website} emoji={co.emoji} name={co.name} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-bold leading-tight text-foreground">{co.name}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {[typeLabel, co.isRegistered ? "Registered" : null, co.contact.companyNumber ? `No. ${co.contact.companyNumber}` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {sharedLabel && <p className="mt-0.5 text-[10px] text-muted-foreground">{sharedLabel}</p>}
          </div>
          <div className="flex shrink-0 gap-0.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-background/50 hover:text-foreground"
              title="Edit / share"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            {isOwner && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-background/50 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {co.description && (
          <p className="mb-3 line-clamp-2 text-[11px] leading-relaxed text-foreground/70">{co.description}</p>
        )}

        <div className="grid grid-cols-1 gap-1.5 rounded-xl bg-background/55 p-2.5 text-[10px]">
          {(co.companyType === "registered" || co.isRegistered) && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Company number</span>
              <span className="truncate font-semibold text-foreground">{co.contact.companyNumber || "Not added"}</span>
            </div>
          )}
          {co.contact.vatNumber && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">VAT number</span>
              <span className="truncate font-semibold text-foreground">{co.contact.vatNumber}</span>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Accounting year</span>
            <span className="text-right font-semibold text-foreground">{shortDate(snap.start)} – {shortDate(snap.end)}</span>
          </div>
          {co.contact.email && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Email</span>
              <a href={`mailto:${co.contact.email}`} onClick={(e) => e.stopPropagation()} className="truncate font-semibold text-primary hover:underline">
                {co.contact.email}
              </a>
            </div>
          )}
          {co.contact.phone && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Phone</span>
              <a href={`tel:${co.contact.phone}`} onClick={(e) => e.stopPropagation()} className="truncate font-semibold text-primary hover:underline">
                {co.contact.phone}
              </a>
            </div>
          )}
          {co.contact.website && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Website</span>
              <span className="truncate font-semibold text-foreground">{co.contact.website.replace(/^https?:\/\//, "")}</span>
            </div>
          )}
          {co.contact.address && (
            <div className="flex justify-between gap-2">
              <span className="shrink-0 text-muted-foreground">Address</span>
              <span className="line-clamp-2 text-right font-semibold text-foreground">{co.contact.address}</span>
            </div>
          )}
        </div>

        {(co.contact.website || co.contact.email || co.contact.phone) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {co.contact.website && (
              <a
                href={/^https?:\/\//i.test(co.contact.website) ? co.contact.website : `https://${co.contact.website}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 rounded-lg bg-primary px-2 py-1.5 text-[10px] font-semibold text-primary-foreground"
              >
                <ExternalLink className="h-3 w-3" /> Website
              </a>
            )}
            {co.contact.email && (
              <a
                href={`mailto:${co.contact.email}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 rounded-lg bg-background/70 px-2 py-1.5 text-[10px] font-semibold text-foreground"
              >
                <Mail className="h-3 w-3" /> Email
              </a>
            )}
            {co.contact.phone && (
              <a
                href={`tel:${co.contact.phone}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 rounded-lg bg-background/70 px-2 py-1.5 text-[10px] font-semibold text-foreground"
              >
                <Phone className="h-3 w-3" /> Call
              </a>
            )}
          </div>
        )}

        <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/30 pt-2">
          <span className="text-[10px] text-muted-foreground">Tax year {snap.label} · {snap.daysLeft} days left</span>
          <span className="text-[10px] font-semibold text-primary">View details →</span>
        </div>

        {tradingNameChildren && tradingNameChildren.length > 0 && (
          <div className="mt-3 space-y-1.5 border-t border-border/40 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Trading as</p>
            {tradingNameChildren.map((child) => {
              const childTaxYear = taxYearBounds(child.taxYearStart);
              return (
                <div
                  key={child.id}
                  onClick={(e) => { e.stopPropagation(); onNavigateChild?.(child); }}
                  className="rounded-xl p-2.5"
                  style={{ background: `color-mix(in srgb, ${child.color || co.color} 20%, hsl(var(--card)))` }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-card/70 text-sm">
                      <CompanyLogoMark
                        logoUrl={child.logoUrl}
                        website={child.contact.website}
                        emoji={child.emoji || "🏷️"}
                        name={child.name}
                        className="h-full w-full object-contain p-0.5"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-semibold text-foreground">{child.name}</span>
                      <span className="block truncate text-[9px] font-medium text-muted-foreground">Trading name of {co.name}</span>
                    </span>
                    <button type="button" onClick={(e) => { e.stopPropagation(); onEditChild?.(child); }} className="p-1 text-muted-foreground hover:text-foreground">
                      <Edit2 className="h-3 w-3" />
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); onDeleteChild?.(child); }} className="p-1 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="mt-2 grid gap-1 text-[9px] text-foreground/70">
                    <p>Accounting year: {shortDate(childTaxYear.start)} – {shortDate(childTaxYear.end)}</p>
                    {child.contact.email && <p className="truncate">Email: {child.contact.email}</p>}
                    {child.contact.phone && <p className="truncate">Phone: {child.contact.phone}</p>}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    {child.contact.website ? (
                      <a
                        href={/^https?:\/\//i.test(child.contact.website) ? child.contact.website : `https://${child.contact.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 rounded-lg bg-card/80 px-2 py-1 text-[9px] font-semibold text-primary"
                      >
                        <ExternalLink className="h-2.5 w-2.5" /> Website
                      </a>
                    ) : <span />}
                    <span className="text-[9px] font-semibold text-primary">View details →</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const Companies = () => {
  const { scopeUserId, permission, pageTitle, isOwnScope } = useSharedScope("companies");
  const canEdit = permission === "edit";
  const { companies, loading, addCompany, updateCompany, deleteCompany, shareCompany, unshareCompany } = useCompanies(scopeUserId ?? undefined);
  const { user } = useAuth();
  const appUsers = useAppUsers();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCompany, setEditCompany] = useState<Company | null>(null);
  const [saving, setSaving] = useState(false);

  const [shareEmail, setShareEmail] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareSuccess, setShareSuccess] = useState(false);

  const handleSave = async (form: Omit<Company, "id" | "createdAt" | "updatedAt">) => {
    setSaving(true);
    try {
      if (editCompany?.id) await updateCompany(editCompany.id, form);
      else await addCompany(form);
      setDialogOpen(false);
      setEditCompany(null);
      toast.success(editCompany ? "Company updated" : "Company added");
    } catch (error) {
      console.error("Failed to save company", error);
      toast.error("Couldn’t save the company. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    if (!shareEmail.trim() || !editCompany?.id) return;
    setShareError(null);
    setShareLoading(true);
    setShareSuccess(false);
    try {
      const usersQ = query(collection(db, "users"), where("email", "==", shareEmail.trim().toLowerCase()));
      const snap = await getDocs(usersQ);
      if (snap.empty) {
        setShareError("No user found with that email address.");
        return;
      }
      const targetUid = snap.docs[0].id;
      if (targetUid === user?.uid) {
        setShareError("That's your own account!");
        return;
      }
      if (editCompany.sharedWith?.includes(targetUid)) {
        setShareError("Already shared with this user.");
        return;
      }
      await shareCompany(editCompany.id, targetUid);
      setEditCompany((prev) => prev ? { ...prev, sharedWith: [...(prev.sharedWith ?? []), targetUid] } : prev);
      setShareSuccess(true);
      setShareEmail("");
    } catch (err: any) {
      setShareError(err?.message ?? "Failed to share. Try again.");
    } finally {
      setShareLoading(false);
    }
  };

  const handleUnshare = async (targetUid: string) => {
    if (!editCompany?.id) return;
    await unshareCompany(editCompany.id, targetUid);
    setEditCompany((prev) => prev ? { ...prev, sharedWith: (prev.sharedWith ?? []).filter((id) => id !== targetUid) } : prev);
  };

  const tradingNames = useMemo(() => companies.filter((c) => c.companyType === "trading_name"), [companies]);
  const topLevel = useMemo(() => companies.filter((c) => c.companyType !== "trading_name"), [companies]);
  const registered = useMemo(() => topLevel.filter((c) => c.companyType === "registered"), [topLevel]);
  const soleTraders = useMemo(() => topLevel.filter((c) => c.companyType === "sole_trader"), [topLevel]);
  const others = useMemo(() => topLevel.filter((c) => !c.companyType || c.companyType === "other"), [topLevel]);
  const unlinkedTradingNames = useMemo(
    () => tradingNames.filter((c) => !c.parentCompanyId || !companies.some((parent) => parent.id === c.parentCompanyId)),
    [companies, tradingNames],
  );
  const getChildren = (id: string) => tradingNames.filter((c) => c.parentCompanyId === id);

  const openAdd = () => { setEditCompany(null); setDialogOpen(true); };

  const renderCard = (co: Company, i: number) => (
    <CompanyCard
      key={co.id}
      co={co}
      index={i}
      currentUid={user?.uid}
      appUsers={appUsers}
      tradingNameChildren={getChildren(co.id!)}
      onEdit={() => { setEditCompany(co); setShareEmail(""); setShareError(null); setShareSuccess(false); setDialogOpen(true); }}
      onDelete={() => co.id && deleteCompany(co.id)}
      onNavigate={() => navigate(`/companies/${co.id}`)}
      onEditChild={(child) => { setEditCompany(child); setShareEmail(""); setShareError(null); setShareSuccess(false); setDialogOpen(true); }}
      onDeleteChild={(child) => child.id && deleteCompany(child.id)}
      onNavigateChild={(child) => navigate(`/companies/${child.id}`)}
    />
  );

  if (loading) {
    return (
      <FeaturePageShell title={pageTitle} subtitle="Business management" icon={<Building2 className="w-5 h-5" />} sharePage="companies">
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </FeaturePageShell>
    );
  }

  return (
    <FeaturePageShell
      title={pageTitle}
      subtitle={isOwnScope ? "Overview of all companies" : "Shared with you"}
      icon={<Building2 className="w-5 h-5" />}
      sharePage="companies"
      action={
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/qr-codes")} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground" title="QR codes">
            <QrCode className="h-4 w-4" />
          </button>
          {canEdit && (
            <button onClick={openAdd} className="flex items-center gap-1 text-xs font-semibold text-primary">
              <Plus className="h-4 w-4" /> Add
            </button>
          )}
        </div>
      }
    >
      {companies.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4 py-20">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-primary text-3xl shadow-elevated">🏢</div>
          <div className="text-center">
            <p className="text-base font-bold text-card-foreground">No companies yet</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">Add a company to build your business structure and keep its records together.</p>
          </div>
          {canEdit && (
            <Button size="sm" onClick={openAdd} className="mt-1 gap-1.5 rounded-xl bg-gradient-primary text-white shadow-glow">
              <Plus className="h-3.5 w-3.5" /> Add first company
            </Button>
          )}
        </motion.div>
      ) : (
        <div className="space-y-5">
          <section
            className="flex gap-3 rounded-2xl border border-border/50 bg-card p-4 shadow-card"
            style={{ borderLeft: "3px solid hsl(var(--primary))" }}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
              <Megaphone className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="font-display text-base font-bold">Social & Ads</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Open a company, then Social & Ads. Save how the brand sounds, add competitors and what's happening now, then generate a month of posts with pictures. Review each one before you copy it onto Instagram, Facebook or LinkedIn.
              </p>
            </div>
          </section>
          <section className="space-y-3">
            <div className="flex items-center justify-between px-0.5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Company structure</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Trading names are shown beneath their legal entity.</p>
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">{companies.length} total</span>
            </div>
            {registered.length > 0 && (
              <div className="space-y-2.5">
                <p className="px-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Registered companies</p>
                <div className="grid grid-cols-2 items-start gap-3">
                  {registered.map((co, i) => renderCard(co, i))}
                </div>
              </div>
            )}
            {soleTraders.length > 0 && (
              <div className="space-y-2.5">
                <p className="px-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Sole traders</p>
                <div className="grid grid-cols-2 items-start gap-3">
                  {soleTraders.map((co, i) => renderCard(co, registered.length + i))}
                </div>
              </div>
            )}
            {others.length > 0 && (
              <div className="space-y-2.5">
                {(registered.length > 0 || soleTraders.length > 0) && (
                  <p className="px-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Other</p>
                )}
                <div className="grid grid-cols-2 items-start gap-3">
                  {others.map((co, i) => renderCard(co, registered.length + soleTraders.length + i))}
                </div>
              </div>
            )}
            {unlinkedTradingNames.length > 0 && (
              <div className="space-y-2.5">
                <p className="px-0.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">Unlinked trading names</p>
                <div className="grid grid-cols-2 items-start gap-3">
                  {unlinkedTradingNames.map((co, i) => renderCard(co, topLevel.length + i))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditCompany(null); }}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editCompany ? "Edit Company" : "Add Company"}</DialogTitle>
          </DialogHeader>
          <CompanyForm
            allCompanies={companies}
            editId={editCompany?.id}
            initial={editCompany ? {
              name: editCompany.name,
              description: editCompany.description || "",
              color: editCompany.color,
              emoji: editCompany.emoji || "🏢",
              logoUrl: editCompany.logoUrl || "",
              isRegistered: editCompany.isRegistered ?? false,
              companyType: editCompany.companyType || "other",
              parentCompanyId: editCompany.parentCompanyId,
              taxYearStart: editCompany.taxYearStart,
              contact: editCompany.contact,
            } : EMPTY}
            onSave={handleSave}
            onCancel={() => { setDialogOpen(false); setEditCompany(null); }}
            saving={saving}
            sharing={editCompany ? {
              isOwner: !editCompany.ownerId || editCompany.ownerId === user?.uid,
              sharedWith: editCompany.sharedWith ?? [],
              appUsers,
              shareEmail,
              onShareEmailChange: setShareEmail,
              onShare: handleShare,
              onUnshare: handleUnshare,
              shareLoading,
              shareError,
              shareSuccess,
            } : undefined}
          />
        </DialogContent>
      </Dialog>
    </FeaturePageShell>
  );
};

export default Companies;
