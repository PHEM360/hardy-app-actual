import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckSquare2, Receipt, KeyRound, CalendarPlus, Plus } from "lucide-react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
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

  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expForm, setExpForm] = useState({
    companyId: "", description: "", amount: "",
    date: new Date().toISOString().split("T")[0], category: "Other",
  });
  const [saving, setSaving] = useState(false);

  const saveExpense = async () => {
    if (!expForm.companyId || !expForm.description || !expForm.amount || !user) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "companies", user.uid, "items", expForm.companyId, "expenses"), {
        description: expForm.description, amount: parseFloat(expForm.amount) || 0,
        date: expForm.date, category: expForm.category, receipts: [], createdAt: serverTimestamp(),
      });
      setExpenseOpen(false);
      setExpForm({ companyId: "", description: "", amount: "", date: new Date().toISOString().split("T")[0], category: "Other" });
    } finally { setSaving(false); }
  };

  const links = [
    { icon: CheckSquare2, label: "Today's Tasks", sub: "View focus list", color: "text-amber-500 bg-amber-50", action: () => navigate("/today") },
    { icon: Receipt,      label: "Add Expense",   sub: "Quick log",       color: "text-red-500 bg-red-50",    action: () => setExpenseOpen(true) },
    { icon: KeyRound,     label: "Log Ins",        sub: "Saved creds",     color: "text-violet-500 bg-violet-50", action: () => navigate("/login-details") },
    { icon: CalendarPlus, label: "New Event",      sub: "Calendar",        color: "text-blue-500 bg-blue-50",  action: () => navigate("/calendar") },
  ];

  return (
    <div className="w-full h-full p-3 flex flex-col">
      <div className="flex items-center gap-1.5 mb-2 flex-shrink-0">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Quick Links</span>
      </div>

      <div className="grid grid-cols-2 gap-1.5 flex-1">
        {links.map(({ icon: Icon, label, sub, color, action }) => (
          <button
            key={label}
            onClick={action}
            className="flex flex-col items-start gap-1.5 p-2.5 rounded-xl bg-card border border-border/50 hover:shadow-sm transition-all active:scale-[0.97] text-left"
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-card-foreground leading-tight">{label}</p>
              <p className="text-[9px] text-muted-foreground">{sub}</p>
            </div>
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
