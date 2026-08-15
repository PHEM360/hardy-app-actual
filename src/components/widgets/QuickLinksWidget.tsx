import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CheckSquare2, Receipt, KeyRound, CalendarPlus, ListPlus, Wallet, Camera, Paperclip, X, FileUp, Zap } from "lucide-react";
import { accentGradient, WIDGET_ACCENT } from "@/lib/widgetAccents";
import { UploadDocumentDialog } from "@/components/documents/UploadDocumentDialog";
import DocumentScannerSheet, { ScanModeChooser } from "@/components/DocumentScannerSheet";
import { addDoc, collection, serverTimestamp, updateDoc, doc } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { toast } from "sonner";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";
import { useCompanies } from "@/hooks/useCompanies";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function QuickLinksWidget() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { companies } = useCompanies();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [expenseOpen, setExpenseOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [expForm, setExpForm] = useState({
    companyId: "", description: "", amount: "",
    date: new Date().toISOString().split("T")[0], category: "Other",
  });
  const { settings: companySettings } = useCompanySettings(expForm.companyId);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string>("");
  const [scanCapture, setScanCapture] = useState<File | null>(null);
  const [chooserOpen, setChooserOpen] = useState(false);
  // Chosen up front for the camera path (asked before the camera opens). Left
  // null for uploads, so DocumentScannerSheet asks its own post-hoc question
  // once the picked file's type is known (could be a photo already on the
  // phone, no way to know in advance).
  const [chosenMode, setChosenMode] = useState<"scan" | "picture" | null>(null);
  const [saving, setSaving] = useState(false);

  // Thumbnail for whatever receipt is currently attached
  useEffect(() => {
    if (!receiptFile) { setReceiptPreviewUrl(""); return; }
    const url = URL.createObjectURL(receiptFile);
    setReceiptPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [receiptFile]);

  const openUpload = () => {
    const input = fileInputRef.current;
    if (!input) return;
    input.removeAttribute("capture");
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
      const docRef = await addDoc(collection(db, "companies", expForm.companyId, "expenses"), {
        description: expForm.description, amount: parseFloat(expForm.amount) || 0,
        date: expForm.date, category: expForm.category, receipts: [], createdAt: serverTimestamp(),
      });
      if (receiptFile) {
        const sRef = storageRef(storage, `companies/${expForm.companyId}/receipts/${Date.now()}_${receiptFile.name}`);
        await uploadBytes(sRef, receiptFile);
        const url = await getDownloadURL(sRef);
        await updateDoc(doc(db, "companies", expForm.companyId, "expenses", docRef.id), { receipts: [url] });
      }
      setExpenseOpen(false);
      setReceiptFile(null);
      setExpForm({ companyId: "", description: "", amount: "", date: new Date().toISOString().split("T")[0], category: "Other" });
      toast.success("Expense saved");
    } catch (err) {
      console.error("Failed to save expense", err);
      toast.error("Couldn't save expense. Please try again.");
    } finally { setSaving(false); }
  };

  const links = [
    { icon: CheckSquare2, label: "Today",      sub: "Focus list",  bg: "bg-amber-500",   tint: "bg-amber-50 dark:bg-amber-500/15 border-amber-200/70 dark:border-amber-500/25",     action: () => navigate("/today") },
    { icon: Receipt,      label: "Expense",    sub: "Quick log",   bg: "bg-rose-500",     tint: "bg-rose-50 dark:bg-rose-500/15 border-rose-200/70 dark:border-rose-500/25",         action: () => setExpenseOpen(true) },
    { icon: KeyRound,     label: "Log Ins",    sub: "Credentials", bg: "bg-violet-500",   tint: "bg-violet-50 dark:bg-violet-500/15 border-violet-200/70 dark:border-violet-500/25", action: () => navigate("/login-details") },
    { icon: CalendarPlus, label: "New Event",  sub: "Calendar",    bg: "bg-blue-500",     tint: "bg-blue-50 dark:bg-blue-500/15 border-blue-200/70 dark:border-blue-500/25",         action: () => navigate("/calendar") },
    { icon: ListPlus,     label: "Add Task",   sub: "Tasks",       bg: "bg-emerald-500",  tint: "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200/70 dark:border-emerald-500/25", action: () => navigate("/tasks") },
    { icon: Wallet,       label: "Finance",    sub: "Household",   bg: "bg-teal-500",     tint: "bg-teal-50 dark:bg-teal-500/15 border-teal-200/70 dark:border-teal-500/25",         action: () => navigate("/household-finance") },
    { icon: FileUp,       label: "Upload",     sub: "Documents",   bg: "bg-sky-500",      tint: "bg-sky-50 dark:bg-sky-500/15 border-sky-200/70 dark:border-sky-500/25",             action: () => setUploadOpen(true) },
  ];

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
      </div>

      {/* Fixed tile height (not flex-grown) so rows can never compress below
          a tile's own content and overlap the row beneath. Each tile is tinted
          to match its own icon colour, so they read as distinct chips against
          the white card body instead of flat grey. */}
      <div className="grid grid-cols-3 gap-1.5 mt-2.5 flex-shrink-0">
        {links.map(({ icon: Icon, label, bg, tint, action }) => (
          <button
            key={label}
            onClick={action}
            className={`group flex flex-col items-center justify-center gap-1 h-16 rounded-xl border shadow-2xs hover:shadow-sm hover:-translate-y-0.5 transition-all active:scale-[0.96] text-center ${tint}`}
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm text-white ${bg}`}>
              <Icon className="w-3.5 h-3.5" />
            </div>
            <p className="text-[10px] font-semibold text-card-foreground leading-tight">{label}</p>
          </button>
        ))}
      </div>

      <UploadDocumentDialog open={uploadOpen} onOpenChange={setUploadOpen} />

      {/* Add Expense Dialog */}
      <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
          <DialogHeader><DialogTitle className="font-display">Add Expense</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <Label>Company *</Label>
              <Select value={expForm.companyId} onValueChange={(v) => setExpForm((f) => ({ ...f, companyId: v }))}>
                <SelectTrigger className="h-9 rounded-xl"><SelectValue placeholder="Select company" /></SelectTrigger>
                <SelectContent>
                  {companies.map((c) => <SelectItem key={c.id} value={c.id!}>{c.emoji ? `${c.emoji} ` : ""}{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
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
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  e.target.value = "";
                  if (f) setScanCapture(f);
                }}
              />
              {receiptFile ? (
                <div className="flex items-center gap-2 p-2 rounded-xl border border-border bg-muted/30">
                  {receiptPreviewUrl ? (
                    <img src={receiptPreviewUrl} alt="Receipt preview" className="w-8 h-8 rounded-lg object-cover flex-shrink-0 border border-border/40" />
                  ) : (
                    <Paperclip className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className="text-[11px] text-foreground flex-1 truncate">{receiptFile.name}</span>
                  <button onClick={() => setReceiptFile(null)} className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
                </div>
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
    </div>
  );
}
