import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Bell, Check, CheckSquare2, Receipt, Upload, KeyRound } from "lucide-react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useUserRole } from "@/auth/useUserRole";
import { useTasks } from "@/hooks/useTasks";
import { useCompanies } from "@/hooks/useCompanies";
import FeatureCard from "@/components/dashboard/FeatureCard";
import { FEATURE_MODULES } from "@/types/app";
import { DEFAULT_COMPANY_SETTINGS } from "@/types/app";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Notification {
  id: string;
  message: string;
  type: "reminder" | "alert" | "info";
  icon: string;
  taggedUsers?: string[];
  done: boolean;
  hidden: boolean;
  createdAt: string;
}

// Demo/test notifications have been removed.
// Until notifications are wired to Firestore, the dashboard starts empty.
const INITIAL_NOTIFICATIONS: Notification[] = [];

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { role } = useUserRole();
  const { tasks } = useTasks();
  const { companies } = useCompanies();
  const displayName = profile?.displayName || profile?.firstName || user?.displayName || user?.email?.split("@")[0] || "";
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [addReminderOpen, setAddReminderOpen] = useState(false);
  const [newReminder, setNewReminder] = useState("");

  // Quick link: Add Expense dialog state
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expForm, setExpForm] = useState({
    companyId: "",
    description: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    category: "Other",
  });
  const [expFile, setExpFile] = useState<File | null>(null);
  const [expSaving, setExpSaving] = useState(false);

  // Today's tasks count
  const todayCount = tasks.filter((t) => t.isToday && t.status !== "done").length;

  const saveExpense = async () => {
    if (!expForm.companyId || !expForm.description || !expForm.amount) return;
    if (!user) return;
    setExpSaving(true);
    try {
      await addDoc(collection(db, "companies", user.uid, "items", expForm.companyId, "expenses"), {
        description: expForm.description,
        amount: parseFloat(expForm.amount) || 0,
        date: expForm.date,
        category: expForm.category,
        receipts: [],
        createdAt: serverTimestamp(),
      });
      setExpenseOpen(false);
      setExpForm({ companyId: "", description: "", amount: "", date: new Date().toISOString().split("T")[0], category: "Other" });
      setExpFile(null);
    } finally {
      setExpSaving(false);
    }
  };

  // Show modules based on user's enabledFeatures. Admins/superadmins see all.
  const enabledModules = (role === "admin" || role === "superadmin" || !profile || profile.enabledFeatures.length === 0)
    ? FEATURE_MODULES
    : FEATURE_MODULES.filter((m) => profile.enabledFeatures.includes(m.key));

  const visibleNotifications = notifications.filter(n => !n.hidden && !n.done);

  const hideNotification = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, hidden: true } : n));
  };

  const markDone = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, done: true } : n));
  };

  const addReminder = () => {
    if (!newReminder.trim()) return;
    setNotifications(prev => [...prev, {
      id: `n${Date.now()}`,
      message: newReminder,
      type: "reminder",
      icon: "📌",
      done: false,
      hidden: false,
      createdAt: new Date().toISOString(),
    }]);
    setNewReminder("");
    setAddReminderOpen(false);
  };

  return (
    <div className="px-4 py-5">
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-5 p-5 rounded-2xl bg-gradient-hero"
      >
        <p className="text-lg font-bold font-display text-primary-foreground">
          Hi, {displayName} 👋
        </p>
        <p className="text-sm text-primary-foreground/80 mt-1">
          {visibleNotifications.length > 0
            ? <>You have <span className="font-semibold text-primary-foreground">{visibleNotifications.length} item{visibleNotifications.length !== 1 ? "s" : ""}</span> that need attention.</>
            : "Everything's looking good today! 🎉"
          }
        </p>
      </motion.div>

      {/* Quick Links */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="mb-6"
      >
        <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">Quick Links</h2>
        <div className="grid grid-cols-3 gap-2.5">
          {/* Today's Tasks */}
          <button
            onClick={() => navigate("/tasks")}
            className="flex flex-col items-start gap-2 p-4 rounded-2xl bg-card border border-border/50 shadow-soft hover:shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <CheckSquare2 className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold text-card-foreground leading-tight">View Today's Tasks</p>
              {todayCount > 0 && (
                <p className="text-[10px] text-primary font-medium mt-0.5">{todayCount} pending</p>
              )}
            </div>
          </button>

          {/* Add Expense */}
          <button
            onClick={() => setExpenseOpen(true)}
            className="flex flex-col items-start gap-2 p-4 rounded-2xl bg-card border border-border/50 shadow-soft hover:shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center">
              <Receipt className="w-4.5 h-4.5 text-destructive" />
            </div>
            <div>
              <p className="text-xs font-semibold text-card-foreground leading-tight">Add Expense</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Quick log</p>
            </div>
          </button>

          {/* Log In Details */}
          <button
            onClick={() => navigate("/login-details")}
            className="flex flex-col items-start gap-2 p-4 rounded-2xl bg-card border border-border/50 shadow-soft hover:shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <KeyRound className="w-4.5 h-4.5 text-violet-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-card-foreground leading-tight">Log In Details</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Saved credentials</p>
            </div>
          </button>
        </div>
      </motion.div>

      {/* Add Expense Dialog */}
      <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
        <DialogContent className="max-w-sm mx-4" aria-describedby={undefined}>
          <DialogHeader><DialogTitle className="font-display">Add Expense</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <Label>Company *</Label>
              <Select value={expForm.companyId} onValueChange={(v) => setExpForm((f) => ({ ...f, companyId: v }))}>
                <SelectTrigger className="h-9 rounded-xl"><SelectValue placeholder="Select company" /></SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id!}>
                      {c.emoji ? `${c.emoji} ` : ""}{c.name}
                    </SelectItem>
                  ))}
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
                  {DEFAULT_COMPANY_SETTINGS.expenseCategories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Attach receipt (optional)</Label>
              <label className="flex items-center gap-1.5 text-xs text-primary cursor-pointer border border-dashed border-border rounded-xl px-3 py-2 hover:bg-muted/40 transition-colors">
                <Upload className="w-3.5 h-3.5" />
                {expFile ? expFile.name : "Choose file"}
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setExpFile(e.target.files?.[0] || null)} />
              </label>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setExpenseOpen(false)} className="flex-1 h-9 rounded-xl">Cancel</Button>
              <Button onClick={saveExpense} disabled={!expForm.companyId || !expForm.description || !expForm.amount || expSaving} className="flex-1 h-9 rounded-xl bg-gradient-primary">
                {expSaving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Notifications / Reminders */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <div className="flex items-center justify-between px-1 mb-2">
          <div className="flex items-center gap-2">
            <Bell className="w-3.5 h-3.5 text-warning" />
            <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Notifications
            </h2>
          </div>
          <Dialog open={addReminderOpen} onOpenChange={setAddReminderOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-1 text-[10px] text-primary font-medium">
                <Plus className="w-3 h-3" /> Add
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-sm mx-4">
              <DialogHeader><DialogTitle className="font-display">Add Reminder</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Reminder</Label>
                  <Input
                    placeholder="e.g. Book vet appointment for Billy"
                    value={newReminder}
                    onChange={(e) => setNewReminder(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>
                <Button onClick={addReminder} className="w-full h-11 rounded-xl bg-gradient-primary">Add Reminder</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <AnimatePresence>
          {visibleNotifications.map((notif) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20, height: 0, marginBottom: 0 }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-muted/90 border border-border/50 shadow-soft mb-1.5"
            >
              <span className="text-sm flex-shrink-0">{notif.icon}</span>
              <p className="flex-1 text-[11px] text-card-foreground leading-tight">{notif.message}</p>
              <button onClick={() => markDone(notif.id)} className="p-1 rounded-md hover:bg-success/10 transition-colors text-success">
                <Check className="w-3 h-3" />
              </button>
              <button onClick={() => hideNotification(notif.id)} className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground">
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {visibleNotifications.length === 0 && (
          <p className="text-[10px] text-muted-foreground text-center py-2">All clear! No pending notifications 🎉</p>
        )}
      </motion.div>

      {/* Feature Grid */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
          Your Modules
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {enabledModules.map((module, index) => (
            <FeatureCard key={module.key} module={module} index={index} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
