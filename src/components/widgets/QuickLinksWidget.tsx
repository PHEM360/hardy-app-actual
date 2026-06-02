import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { CheckSquare2, Receipt, KeyRound, CalendarPlus, Plus, Camera, Paperclip, X } from "lucide-react";
import { addDoc, collection, serverTimestamp, updateDoc, doc } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";
import { useCompanies } from "@/hooks/useCompanies";
import { DEFAULT_COMPANY_SETTINGS } from "@/types/app";
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
  const [expForm, setExpForm] = useState({
    companyId: "", description: "", amount: "",
    date: new Date().toISOString().split("T")[0], category: "Other",
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const saveExpense = async () => {
    if (!expForm.companyId || !expForm.description || !expForm.amount || !user) return;
    setSaving(true);
    try {
      const docRef = await addDoc(collection(db, "companies", user.uid, "items", expForm.companyId, "expenses"), {
        description: expForm.description, amount: parseFloat(expForm.amount) || 0,
        date: expForm.date, category: expForm.category, receipts: [], createdAt: serverTimestamp(),
      });
      if (receiptFile) {
        const sRef = storageRef(storage, `companies/${user.uid}/${expForm.companyId}/receipts/${Date.now()}_${receiptFile.name}`);
        await uploadBytes(sRef, receiptFile);
        const url = await getDownloadURL(sRef);
        await updateDoc(doc(db, "companies", user.uid, "items", expForm.companyId, "expenses", docRef.id), { receipts: [url] });
      }
      setExpenseOpen(false);
      setReceiptFile(null);
      setExpForm({ companyId: "", description: "", amount: "", date: new Date().toISOString().split("T")[0], category: "Other" });
    } finally { setSaving(false); }
  };

  const links = [
    { icon: CheckSquare2, label: "Today",       sub: "Focus list",    color: "text-amber-500 bg-amber-50 dark:bg-amber-950/40",   action: () => navigate("/today") },
    { icon: Receipt,      label: "Expense",     sub: "Quick log",     color: "text-red-500 bg-red-50 dark:bg-red-950/40",         action: () => setExpenseOpen(true) },
    { icon: KeyRound,     label: "Log Ins",     sub: "Credentials",   color: "text-violet-500 bg-violet-50 dark:bg-violet-950/40", action: () => navigate("/login-details") },
    { icon: CalendarPlus, label: "New Event",   sub: "Calendar",      color: "text-blue-500 bg-blue-50 dark:bg-blue-950/40",      action: () => navigate("/calendar") },
    { icon: Plus,         label: "Add Task",    sub: "Tasks",         color: "text-green-500 bg-green-50 dark:bg-green-950/40",   action: () => navigate("/tasks") },
    { icon: Plus,         label: "Finance",     sub: "Household",     color: "text-teal-500 bg-teal-50 dark:bg-teal-950/40",      action: () => navigate("/household-finance") },
  ];

  return (
    <div className="w-full h-full p-3 flex flex-col">
      <div className="flex items-center gap-1.5 mb-2 flex-shrink-0">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Quick Links</span>
      </div>

      <div className="grid grid-cols-3 grid-rows-2 gap-1.5 flex-1 min-h-0">
        {links.map(({ icon: Icon, label, color, action }) => (
          <button
            key={label}
            onClick={action}
            className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl bg-card border border-border/50 hover:shadow-sm transition-all active:scale-[0.97] text-center"
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
              <Icon className="w-3.5 h-3.5" />
            </div>
            <p className="text-[10px] font-semibold text-card-foreground leading-tight">{label}</p>
          </button>
        ))}
      </div>

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
                  {DEFAULT_COMPANY_SETTINGS.expenseCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Receipt <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
              />
              {receiptFile ? (
                <div className="flex items-center gap-2 p-2 rounded-xl border border-border bg-muted/30">
                  <Paperclip className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-[11px] text-foreground flex-1 truncate">{receiptFile.name}</span>
                  <button onClick={() => setReceiptFile(null)} className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => { if (fileInputRef.current) { fileInputRef.current.removeAttribute("capture"); fileInputRef.current.click(); } }} className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl border border-border bg-muted/30 text-xs text-muted-foreground hover:bg-muted/60">
                    <Paperclip className="w-3.5 h-3.5" /> Upload file
                  </button>
                  <button onClick={() => { if (fileInputRef.current) { fileInputRef.current.setAttribute("capture", "environment"); fileInputRef.current.click(); } }} className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl border border-border bg-muted/30 text-xs text-muted-foreground hover:bg-muted/60">
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
    </div>
  );
}
