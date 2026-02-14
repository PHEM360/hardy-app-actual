import { useState } from "react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Shield, Users, AlertTriangle, CheckCircle, Activity, ChevronDown, ChevronUp, ArrowLeft, Lock, Trash2, UserX, UserCheck, Filter } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface MockUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "active" | "suspended";
  lastLogin: string;
  permissions: string[];
}

// Demo/test users have been removed.
// Until this page is wired to Firebase Auth/Firestore admin data,
// start with an empty list and show empty states.
const MOCK_USERS: MockUser[] = [];

type EventType = "login" | "password_change" | "alert" | "settings_change";
type EventStatus = "success" | "failed" | "suspicious";

interface SecurityEvent {
  id: string;
  type: EventType;
  user: string;
  description: string;
  ip: string;
  status: EventStatus;
  timestamp: string;
}

// Demo/test events removed.
const MOCK_EVENTS: SecurityEvent[] = [];

const STATUS_STYLES: Record<EventStatus, string> = {
  success: "bg-success/10 text-success",
  failed: "bg-destructive/10 text-destructive",
  suspicious: "bg-warning/10 text-warning",
};

const TYPE_LABELS: Record<EventType, string> = {
  login: "Login", password_change: "Password", alert: "Alert", settings_change: "Settings",
};

const STATS = [
  { label: "Active Users", value: "—", icon: Users, color: "text-muted-foreground" },
  { label: "Login Events", value: "—", icon: Activity, color: "text-muted-foreground" },
  { label: "Alerts", value: "—", icon: AlertTriangle, color: "text-muted-foreground" },
  { label: "Health", value: "Not configured", icon: CheckCircle, color: "text-muted-foreground" },
];

type AdminView = "main" | "security";

const Admin = () => {
  const [view, setView] = useState<AdminView>("main");
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [users, setUsers] = useState(MOCK_USERS);

  const filteredEvents = MOCK_EVENTS.filter((e) => {
    if (filterType !== "all" && e.type !== filterType) return false;
    if (filterStatus !== "all" && e.status !== filterStatus) return false;
    return true;
  });

  const currentUser = selectedUser ? users.find(u => u.id === selectedUser) : null;

  if (view === "security") {
    return (
      <FeaturePageShell title="Security Dashboard" subtitle="Login events, alerts & audit log" icon={<Shield className="w-5 h-5" />}>
        <button onClick={() => setView("main")} className="flex items-center gap-1.5 text-xs text-primary font-medium mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Admin
        </button>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-8 rounded-lg text-xs w-28"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="login">Logins</SelectItem>
              <SelectItem value="password_change">Passwords</SelectItem>
              <SelectItem value="alert">Alerts</SelectItem>
              <SelectItem value="settings_change">Settings</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-8 rounded-lg text-xs w-28"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="suspicious">Suspicious</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-[10px] text-muted-foreground ml-auto">{filteredEvents.length} events</span>
        </div>

        {/* Event Log */}
        <div className="space-y-2">
          {filteredEvents.map((event, i) => {
            const expanded = expandedEvent === event.id;
            return (
              <motion.div key={event.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 * i }} className="rounded-xl bg-card border border-border/50 overflow-hidden">
                <button onClick={() => setExpandedEvent(expanded ? null : event.id)} className="w-full flex items-center gap-2.5 p-3 text-left">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_STYLES[event.status]}`}>
                    {event.status === "success" ? "✓" : event.status === "failed" ? "✗" : "⚠"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-card-foreground truncate">{event.description}</p>
                    <p className="text-[10px] text-muted-foreground">{event.user} · {TYPE_LABELS[event.type]}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {new Date(event.timestamp).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </span>
                  {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
                <AnimatePresence>
                  {expanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="px-3 pb-3 space-y-1.5 border-t border-border/30 pt-2">
                        {[
                          ["IP Address", event.ip],
                          ["Status", event.status.charAt(0).toUpperCase() + event.status.slice(1)],
                          ["Type", TYPE_LABELS[event.type]],
                          ["Time", new Date(event.timestamp).toLocaleString("en-GB")],
                          ["User", event.user],
                        ].map(([label, value]) => (
                          <div key={label} className="flex justify-between">
                            <span className="text-[10px] text-muted-foreground">{label}</span>
                            <span className="text-[10px] font-medium text-card-foreground">{value}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </FeaturePageShell>
    );
  }

  return (
    <FeaturePageShell title="Admin" subtitle="Users & system management" icon={<Shield className="w-5 h-5" />}>
      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 mb-5">
        {STATS.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div key={stat.label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 * i }} className="p-3 rounded-xl bg-card border border-border/50 shadow-soft text-center">
              <Icon className={`w-4 h-4 ${stat.color} mx-auto mb-1`} />
              <p className="text-sm font-bold font-display text-card-foreground">{stat.value}</p>
              <p className="text-[8px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Users */}
      <div className="mb-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">Users</h3>
        <div className="rounded-xl bg-card border border-border/50 shadow-soft overflow-hidden divide-y divide-border/30">
          {users.map((user) => (
            <button
              key={user.id}
              onClick={() => setSelectedUser(user.id)}
              className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-muted/30 transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">{user.name.charAt(0)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-card-foreground">{user.name}</p>
                <p className="text-[10px] text-muted-foreground">{user.email}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-muted-foreground">{user.role}</span>
                <div className="flex items-center gap-1 justify-end mt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${user.status === "active" ? "bg-success" : "bg-destructive"}`} />
                  <span className="text-[10px] text-muted-foreground">{user.lastLogin}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Security Dashboard Link */}
      <button
        onClick={() => setView("security")}
        className="w-full p-4 rounded-xl bg-gradient-hero text-left flex items-center gap-3 shadow-card hover:opacity-95 transition-opacity"
      >
        <Shield className="w-5 h-5 text-primary-foreground" />
        <div>
          <p className="text-sm font-semibold text-primary-foreground">Security Dashboard</p>
          <p className="text-[10px] text-primary-foreground/70">View login events, alerts & audit log</p>
        </div>
      </button>

      {/* User Profile Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={(o) => !o && setSelectedUser(null)}>
        <DialogContent className="max-w-md mx-4">
          {currentUser && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">{currentUser.name.charAt(0)}</span>
                  </div>
                  {currentUser.name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                {/* Details */}
                <div className="space-y-2">
                  {[
                    ["Email", currentUser.email],
                    ["Role", currentUser.role],
                    ["Status", currentUser.status === "active" ? "Active" : "Suspended"],
                    ["Last Login", currentUser.lastLogin],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <span className="text-xs font-medium text-card-foreground">{value}</span>
                    </div>
                  ))}
                </div>

                {/* Permissions */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Permissions</p>
                  <div className="flex flex-wrap gap-1.5">
                    {currentUser.permissions.map((p) => (
                      <span key={p} className="text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full capitalize">{p}</span>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-2">
                  <Button variant="outline" className="w-full h-9 rounded-lg text-xs justify-start gap-2">
                    <Lock className="w-3.5 h-3.5" /> Reset Password
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full h-9 rounded-lg text-xs justify-start gap-2"
                    onClick={() => {
                      setUsers(prev => prev.map(u => u.id === currentUser.id ? { ...u, status: u.status === "active" ? "suspended" : "active" } : u));
                    }}
                  >
                    {currentUser.status === "active"
                      ? <><UserX className="w-3.5 h-3.5" /> Suspend Account</>
                      : <><UserCheck className="w-3.5 h-3.5" /> Reinstate Account</>
                    }
                  </Button>
                  <Button variant="outline" className="w-full h-9 rounded-lg text-xs justify-start gap-2 text-destructive hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" /> Delete Account
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </FeaturePageShell>
  );
};

export default Admin;