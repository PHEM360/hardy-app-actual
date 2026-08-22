import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { CheckSquare2, Receipt, KeyRound, CalendarPlus, ListPlus, Wallet, Camera, Paperclip, FileUp, Zap, Pencil, Home, CheckCircle2, StickyNote } from "lucide-react";
import { accentGradient, WIDGET_ACCENT } from "@/lib/widgetAccents";
import { UploadDocumentDialog } from "@/components/documents/UploadDocumentDialog";
import DocumentScannerSheet, { ScanModeChooser } from "@/components/DocumentScannerSheet";
import { ReceiptAttachCard, ReceiptLightbox } from "@/components/receipts/ReceiptPreview";
import { addDoc, collection, serverTimestamp, updateDoc, doc } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { toast } from "sonner";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";
import { useEffectiveRole } from "@/auth/useEffectiveRole";
import { useUserProfile } from "@/hooks/useUserProfile";
import { hasFeatureAccess, QUICK_LINK_FEATURE_KEY } from "@/lib/features";
import { companyReceiptStoragePath, expenseSaveMessage, useCompanies } from "@/hooks/useCompanies";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL_LINKS = [
  { id: "today",       icon: CheckSquare2, label: "Today",      sub: "Focus list",  bg: "bg-amber-500",   tint: "bg-amber-50 dark:bg-amber-500/15 border-amber-200/70 dark:border-amber-500/25",     href: "/today" },
  { id: "expense",     icon: Receipt,      label: "Expense",    sub: "Quick log",   bg: "bg-rose-500",     tint: "bg-rose-50 dark:bg-rose-500/15 border-rose-200/70 dark:border-rose-500/25",         action: "expense" as const },
  { id: "logins",      icon: KeyRound,     label: "Log Ins",    sub: "Credentials", bg: "bg-violet-500",   tint: "bg-violet-50 dark:bg-violet-500/15 border-violet-200/70 dark:border-violet-500/25", href: "/login-details" },
  { id: "event",       icon: CalendarPlus, label: "New Event",  sub: "Calendar",    bg: "bg-blue-500",     tint: "bg-blue-50 dark:bg-blue-500/15 border-blue-200/70 dark:border-blue-500/25",         href: "/calendar" },
  { id: "task",        icon: ListPlus,     label: "Add Task",   sub: "Tasks",       bg: "bg-emerald-500",  tint: "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200/70 dark:border-emerald-500/25", href: "/tasks" },
  { id: "note",        icon: StickyNote,   label: "Add Note",   sub: "Quick note",  bg: "bg-amber-500",    tint: "bg-amber-50 dark:bg-amber-500/15 border-amber-200/70 dark:border-amber-500/25",         href: "/notes/quick" },
  { id: "finance",     icon: Wallet,       label: "Finance",    sub: "Personal",    bg: "bg-teal-500",     tint: "bg-teal-50 dark:bg-teal-500/15 border-teal-200/70 dark:border-teal-500/25",         href: "/finance" },
  { id: "hh-finance",  icon: Home,         label: "HH Finance", sub: "Household",   bg: "bg-green-600",    tint: "bg-green-50 dark:bg-green-500/15 border-green-200/70 dark:border-green-500/25",     href: "/household-finance" },
  { id: "upload",      icon: FileUp,       label: "Upload",     sub: "Documents",   bg: "bg-sky-500",      tint: "bg-sky-50 dark:bg-sky-500/15 border-sky-200/70 dark:border-sky-500/25",             action: "upload" as const },
];

const DEFAULT_LINK_IDS = ALL_LINKS.map((l) => l.id);

export function QuickLinksWidget() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { role, loading: roleLoading } = useEffectiveRole();
  const { profile, saveProfile, loading: profileLoading } = useUserProfile();
  const { companies } = useCompanies();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editOpen, setEditOpen] = useState(false);

  const [expenseOpen, setExpenseOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [expForm, setExpForm] = useState({
    companyId: "", description: "", amount: "",
    date: new Date().toISOString().split("T")[0], category: "Other",
  });
  const { settings: companySettings } = useCompanySettings(expForm.companyId);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptViewerOpen, setReceiptViewerOpen] = useState(false);
  const [scanCapture, setScanCapture] = useState<File | null>(null);
  const [chooserOpen, setChooserOpen] = useState(false);
  // Chosen up front for the camera path (asked before the camera opens). Left
  // null for uploads, so DocumentScannerSheet asks its own post-hoc question
  // once the picked file's type is known (could be a photo already on the
  // phone, no way to know in advance).
  const [chosenMode, setChosenMode] = useState<"scan" | "picture" | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [savedSummary, setSavedSummary] = useState("");

  const openUpload = () => {
    const input = fileInputRef.current;
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
    setScanCapture(file);
  };

  const saveExpense = async () => {
    if (!expForm.companyId || !expForm.description || !expForm.amount || !user) return;
    setSaving(true);
    try {
      const amount = Number.parseFloat(expForm.amount);
      const docRef = await addDoc(collection(db, "companies", expForm.companyId, "expenses"), {
        description: expForm.description.trim(),
        amount: Number.isFinite(amount) ? amount : 0,
        date: expForm.date,
        category: expForm.category || "Other",
        receipts: [],
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      });
      let receiptFailed = false;
      if (receiptFile) {
        try {
          const sRef = storageRef(storage, companyReceiptStoragePath(expForm.companyId, receiptFile.name));
          await uploadBytes(sRef, receiptFile, { contentType: receiptFile.type || "application/octet-stream" });
          const url = await getDownloadURL(sRef);
          await updateDoc(doc(db, "companies", expForm.companyId, "expenses", docRef.id), {
            receipts: [url],
            receiptNames: [receiptFile.name],
          });
        } catch (receiptErr) {
          console.error("Failed to upload receipt", receiptErr);
          receiptFailed = true;
        }
      }
      const companyName = companies.find((c) => c.id === expForm.companyId)?.name || "the company";
      const summary = `${expForm.description} · £${(Number.isFinite(amount) ? amount : 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} saved to ${companyName}`;
      setSavedSummary(receiptFailed ? `${summary}. The receipt didn’t upload — you can attach it from the company page.` : summary);
      setSavedOk(true);
      toast.success("Expense saved", {
        description: receiptFailed ? "Saved, but the receipt didn’t upload." : summary,
        duration: 5000,
      });
      setReceiptFile(null);
      setExpForm({ companyId: "", description: "", amount: "", date: new Date().toISOString().split("T")[0], category: "Other" });
    } catch (err) {
      console.error("Failed to save expense", err);
      toast.error(expenseSaveMessage(err));
    } finally { setSaving(false); }
  };

  const enabledIds = profile?.quickLinks?.length ? profile.quickLinks : DEFAULT_LINK_IDS;
  const accessibleLinks = ALL_LINKS.filter((l) => {
    const key = QUICK_LINK_FEATURE_KEY[l.id];
    if (!key) return true;
    if (roleLoading || profileLoading) return false;
    return hasFeatureAccess(role, profile?.enabledFeatures ?? [], key);
  });
  const visibleLinks = accessibleLinks.filter((l) => enabledIds.includes(l.id));

  const toggleLink = (id: string) => {
    const next = enabledIds.includes(id)
      ? enabledIds.filter((x) => x !== id)
      : [...enabledIds, id];
    saveProfile({ quickLinks: next.length ? next : DEFAULT_LINK_IDS });
  };

  const runLink = (link: (typeof ALL_LINKS)[number]) => {
    if ("action" in link && link.action === "expense") setExpenseOpen(true);
    else if ("action" in link && link.action === "upload") setUploadOpen(true);
    else if ("href" in link && link.href) navigate(link.href);
  };

  return (
    <div className="w-full h-full p-3 pb-3.5 flex flex-col overflow-y-auto">
      <div
        className="flex items-center gap-2 -mx-3 -mt-3 px-3 py-2.5 flex-shrink-0"
        style={{ background: accentGradient(WIDGET_ACCENT.quick_links) }}
      >
        <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-white/20 flex-shrink-0 text-white">
          <Zap className="w-3.5 h-3.5" />
        </span>
        <span className="text-[11px] font-bold text-white uppercase tracking-wider">Quick Links</span>
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="ml-auto p-1 rounded-md text-white/80 hover:text-white hover:bg-white/15"
          title="Edit quick links"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Fixed tile height (not flex-grown) so rows can never compress below
          a tile's own content and overlap the row beneath. Each tile is tinted
          to match its own icon colour, so they read as distinct chips against
          the white card body instead of flat grey. */}
      <div className="grid grid-cols-3 gap-1.5 mt-2.5 flex-shrink-0">
        {visibleLinks.map((link) => {
          const Icon = link.icon;
          return (
          <button
            key={link.id}
            onClick={() => runLink(link)}
            className={`group flex flex-col items-center justify-center gap-1 h-16 rounded-xl border shadow-2xs hover:shadow-sm hover:-translate-y-0.5 transition-all active:scale-[0.96] text-center ${link.tint}`}
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm text-white ${link.bg}`}>
              <Icon className="w-3.5 h-3.5" />
            </div>
            <p className="text-[10px] font-semibold text-card-foreground leading-tight">{link.label}</p>
          </button>
          );
        })}
      </div>

      <UploadDocumentDialog open={uploadOpen} onOpenChange={setUploadOpen} />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="font-display">Edit Quick Links</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Choose which shortcuts appear. Turn off anything that doesn’t apply — like expenses.</p>
          <div className="space-y-1.5 pt-1">
            {accessibleLinks.map((link) => {
              const on = enabledIds.includes(link.id);
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => toggleLink(link.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                    on ? "border-primary/30 bg-primary/5" : "border-border/50 bg-muted/30 opacity-60"
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white ${link.bg}`}>
                    <link.icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{link.label}</p>
                    <p className="text-[10px] text-muted-foreground">{link.sub}</p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wide ${on ? "text-primary" : "text-muted-foreground"}`}>
                    {on ? "On" : "Off"}
                  </span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Expense Dialog */}
      <Dialog open={expenseOpen} onOpenChange={(open) => {
        setExpenseOpen(open);
        if (!open) {
          setSavedOk(false);
          setSavedSummary("");
        }
      }}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
          {savedOk ? (
            <div className="py-6 px-2 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <DialogHeader>
                <DialogTitle className="font-display text-center">Expense saved</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{savedSummary}</p>
              <Button
                className="mt-5 w-full h-10 rounded-xl bg-gradient-primary"
                onClick={() => {
                  setExpenseOpen(false);
                  setSavedOk(false);
                  setSavedSummary("");
                }}
              >
                Done
              </Button>
            </div>
          ) : (
          <>
          <DialogHeader><DialogTitle className="font-display">Add Expense</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <Label>Company *</Label>
              <Select value={expForm.companyId} onValueChange={(v) => setExpForm((f) => ({ ...f, companyId: v }))}>
                <SelectTrigger className="h-9 rounded-xl"><SelectValue placeholder={companies.length ? "Select company" : "No companies available"} /></SelectTrigger>
                <SelectContent>
                  {companies.map((c) => <SelectItem key={c.id} value={c.id!}>{c.emoji ? `${c.emoji} ` : ""}{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {companies.length === 0 && (
                <p className="text-[11px] text-muted-foreground">No companies to log against. Shared companies should appear here once they’ve been shared with you.</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Description *</Label>
              <Input value={expForm.description} onChange={(e) => setExpForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. Office supplies" className="h-9 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Amount (£) *</Label>
                <Input type="number" step="0.01" value={expForm.amount} onChange={(e) => setExpForm((f) => ({ ...f, amount: e.target.value }))} className="h-9 rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" value={expForm.date} onChange={(e) => setExpForm((f) => ({ ...f, date: e.target.value }))} className="h-9 rounded-xl" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={expForm.category} onValueChange={(v) => setExpForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger className="h-9 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {companySettings.expenseCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Receipt <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  e.target.value = "";
                  if (!f) return;
                  if (!f.type.startsWith("image/")) {
                    setReceiptFile(f);
                    return;
                  }
                  setScanCapture(f);
                }}
              />
              {receiptFile ? (
                <ReceiptAttachCard
                  file={receiptFile}
                  onRemove={() => setReceiptFile(null)}
                  onPreview={() => setReceiptViewerOpen(true)}
                />
              ) : (
                <div className="flex gap-2">
                  <button onClick={openUpload} className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl border border-border bg-muted/30 text-xs text-muted-foreground hover:bg-muted/60">
                    <Paperclip className="w-3.5 h-3.5" /> Upload file
                  </button>
                  <button onClick={openCameraChooser} className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl border border-border bg-muted/30 text-xs text-muted-foreground hover:bg-muted/60">
                    <Camera className="w-3.5 h-3.5" /> Take photo
                  </button>
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setExpenseOpen(false)} className="flex-1 h-9 rounded-xl">Cancel</Button>
              <Button onClick={saveExpense} disabled={!expForm.companyId || !expForm.description || !expForm.amount || saving} className="flex-1 h-9 rounded-xl bg-gradient-primary">
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
          </>
          )}
        </DialogContent>
      </Dialog>

      {/* Ask scan vs picture before the camera opens */}
      <ScanModeChooser
        open={chooserOpen}
        onPick={handlePick}
        onCancel={() => setChooserOpen(false)}
      />

      {/* Scan & crop (or just confirm + rename) the receipt before attaching it */}
      <DocumentScannerSheet
        imageFile={scanCapture}
        initialMode={chosenMode ?? undefined}
        onConfirm={(scannedFile) => { setReceiptFile(scannedFile); setScanCapture(null); setChosenMode(null); }}
        onCancel={() => { setScanCapture(null); setChosenMode(null); }}
      />
      <ReceiptLightbox
        source={receiptFile ? { file: receiptFile, name: receiptFile.name } : null}
        open={receiptViewerOpen && !!receiptFile}
        onClose={() => setReceiptViewerOpen(false)}
      />
    </div>
  );
}
