import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Bell, Check } from "lucide-react";
import FeatureCard from "@/components/dashboard/FeatureCard";
import { FEATURE_MODULES, MOCK_USER, getDisplayName } from "@/types/app";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const user = MOCK_USER;
  const displayName = getDisplayName(user);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [addReminderOpen, setAddReminderOpen] = useState(false);
  const [newReminder, setNewReminder] = useState("");

  const enabledModules = FEATURE_MODULES.filter((m) =>
    user.enabledFeatures.includes(m.key)
  );

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
