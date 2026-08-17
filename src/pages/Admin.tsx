import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Shield, Users, AlertTriangle, CheckCircle, Activity, ChevronDown, ChevronUp, ArrowLeft, Trash2, UserX, UserCheck, KeyRound, Mail, Eye } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CreatableMultiSelect } from "@/components/ui/creatable-multi-select";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";
import { useAllHouseholds, useHouseholds } from "@/hooks/useHouseholds";
import { useAllPageShares, revokePageShareById } from "@/hooks/usePageShares";
import { useAppUsers } from "@/hooks/useAppUsers";
import { FEATURE_MODULES, type FeatureKey } from "@/types/app";
import { featureEnabled } from "@/lib/features";
import { looksLikeGeneratedId } from "@/lib/householdIds";

const ADMIN_EMAIL = "chris.hardy.07@googlemail.com";

interface MockUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "active" | "suspended";
  lastLogin: string;
  permissions: string[];
  enabledFeatures: FeatureKey[];
  householdId?: string;
  householdIds?: string[];
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
  { label: "Active Users",  value: "—",              icon: Users,         gradient: "linear-gradient(135deg,hsl(258,62%,60%),hsl(270,55%,52%))" },
  { label: "Login Events",  value: "—",              icon: Activity,      gradient: "linear-gradient(135deg,hsl(206,60%,52%),hsl(216,55%,45%))" },
  { label: "Alerts",        value: "—",              icon: AlertTriangle, gradient: "linear-gradient(135deg,hsl(38,95%,54%),hsl(25,88%,47%))" },
  { label: "Health",        value: "Good",           icon: CheckCircle,   gradient: "linear-gradient(135deg,hsl(152,58%,44%),hsl(160,53%,37%))" },
];

type AdminView = "main" | "security" | "sharing";

const Admin = () => {
  const { user, startViewAs, viewAs } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<AdminView>("main");
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [users, setUsers] = useState(MOCK_USERS);
  const [usersLoading, setUsersLoading] = useState(true);

  // ── Restrict to admin email ───────────────────────────────────────────────
  if (user && user.email !== ADMIN_EMAIL) {
    return (
      <FeaturePageShell title="Admin" subtitle="System management" icon={<Shield className="w-5 h-5" />}>
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Shield className="w-10 h-10 text-muted-foreground/40" />
          <p className="text-sm font-semibold text-muted-foreground">Access restricted</p>
          <p className="text-xs text-muted-foreground text-center max-w-xs">This page is only accessible to the system administrator.</p>
        </div>
      </FeaturePageShell>
    );
  }

  useEffect(() => {
    let cancelled = false;
    const loadUsers = async () => {
      setUsersLoading(true);
      try {
        const call = httpsCallable(functions, "listAppUsers");
        const result = await call();
        const next = Array.isArray((result.data as any)?.users) ? (result.data as any).users : [];
        if (!cancelled) setUsers(next as MockUser[]);
      } catch {
        if (!cancelled) setUsers([]);
      } finally {
        if (!cancelled) setUsersLoading(false);
      }
    };
    void loadUsers();
    return () => { cancelled = true; };
  }, []);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteSurname, setInviteSurname] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  const canInvite = useMemo(() => {
    // UI gate only; real permission enforced server-side.
    return Boolean(user?.email);
  }, [user?.email]);

  const doInvite = async () => {
    setInviteError(null);
    setInviteLoading(true);
    try {
      const call = httpsCallable(functions, "inviteUser");
      const result = await call({
        firstName: inviteFirstName,
        surname: inviteSurname,
        email: inviteEmail,
        password: invitePassword,
        role: inviteRole,
      });

      const newUid = (result.data as any)?.uid || `u_${Date.now()}`;
      setUsers((prev) => [
        {
          id: newUid,
          name: `${inviteFirstName}${inviteSurname ? ` ${inviteSurname}` : ""}`,
          email: inviteEmail,
          role: inviteRole === "admin" ? "Admin" : "Member",
          status: "active",
          lastLogin: "—",
          permissions: [],
          enabledFeatures: [],
          householdId: undefined,
        },
        ...prev,
      ]);

      setInviteOpen(false);
      setInviteFirstName("");
      setInviteSurname("");
      setInviteEmail("");
      setInvitePassword("");
    } catch (err: any) {
      setInviteError(err?.message?.replace(/^.*HttpsError:\s*/i, "").replace(/\s*\(.*\)$/, "").trim() || "Failed to invite user");
    } finally {
      setInviteLoading(false);
    }
  };

  // ── User management actions (write to Firestore) ──────────────────────────

  const [actionLoading, setActionLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MockUser | null>(null);
  const [deleteStep, setDeleteStep] = useState<"ask" | "type">("ask");
  const [deleteNameInput, setDeleteNameInput] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── Password reset ─────────────────────────────────────────────────────────
  const [resetPwOpen, setResetPwOpen] = useState(false);
  const [resetPwMode, setResetPwMode] = useState<"email" | "temp">("email");
  const [tempPassword, setTempPassword] = useState("");
  const [resetPwLoading, setResetPwLoading] = useState(false);
  const [resetPwResult, setResetPwResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const doResetPassword = async () => {
    if (!currentUser) return;
    setResetPwLoading(true);
    setResetPwResult(null);
    try {
      if (resetPwMode === "email") {
        const call = httpsCallable(functions, "sendPasswordResetLink");
        await call({ uid: currentUser.id });
        setResetPwResult({ ok: true, msg: `Reset link sent to ${currentUser.email}` });
      } else {
        // Set password directly via Cloud Function
        const call = httpsCallable(functions, "resetUserPassword");
        await call({ uid: currentUser.id, newPassword: tempPassword });
        setResetPwResult({ ok: true, msg: "Password set successfully." });
        setTempPassword("");
      }
    } catch (err: any) {
      const msg = String(err?.message ?? "").replace(/^.*HttpsError:\s*/i, "").replace(/\s*\(.*\)$/, "").trim();
      setResetPwResult({ ok: false, msg: msg || "Failed to reset password." });
    } finally {
      setResetPwLoading(false);
    }
  };

  const changeRole = async (userId: string, newRole: "member" | "admin" | "superadmin") => {
    setActionLoading(true);
    try {
      await setDoc(doc(db, "users", userId), { role: newRole }, { merge: true });
      setUsers(prev => prev.map(u => u.id === userId ? {
        ...u,
        role: newRole === "superadmin" ? "Superadmin" : newRole === "admin" ? "Admin" : "Member",
      } : u));
    } finally {
      setActionLoading(false);
    }
  };

  const toggleSuspend = async (userId: string, currentStatus: "active" | "suspended") => {
    const newEnabled = currentStatus === "suspended"; // reinstate → enabled:true; suspend → enabled:false
    setActionLoading(true);
    try {
      await setDoc(doc(db, "users", userId), { enabled: newEnabled }, { merge: true });
      setUsers(prev => prev.map(u => u.id === userId ? {
        ...u,
        status: newEnabled ? "active" : "suspended",
      } : u));
    } finally {
      setActionLoading(false);
    }
  };

  const closeDeleteDialog = () => {
    if (actionLoading) return;
    setDeleteTarget(null);
    setDeleteStep("ask");
    setDeleteNameInput("");
    setDeleteError(null);
  };

  const normalizeConfirmText = (value: string) =>
    value.trim().toLowerCase().replace(/\s+/g, " ");

  const deleteConfirmMatches = (target: MockUser, typed: string) => {
    const entered = normalizeConfirmText(typed);
    if (!entered) return false;
    const name = normalizeConfirmText(target.name);
    const email = normalizeConfirmText(target.email);
    return (name && entered === name) || (email && entered === email);
  };

  const doDeleteUser = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.id === user?.uid) return;
    if (!deleteConfirmMatches(deleteTarget, deleteNameInput)) return;
    setActionLoading(true);
    setDeleteError(null);
    try {
      const call = httpsCallable(functions, "deleteUserAccount");
      await call({ uid: deleteTarget.id });
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      setSelectedUser(null);
      setDeleteTarget(null);
      setDeleteStep("ask");
      setDeleteNameInput("");
    } catch (err: any) {
      const msg = String(err?.message ?? "").replace(/^.*HttpsError:\s*/i, "").replace(/\s*\(.*\)$/, "").trim();
      setDeleteError(msg || "Couldn't delete this account. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const updateFeatures = async (userId: string, features: FeatureKey[]) => {
    const prev = users.find((u) => u.id === userId)?.enabledFeatures ?? [];
    const added = features.filter((key) => !featureEnabled(prev, key));
    const payload: { enabledFeatures: FeatureKey[]; navItems?: string[] } = { enabledFeatures: features };

    if (added.length) {
      const snap = await getDoc(doc(db, "users", userId));
      const navItems = snap.data()?.navItems;
      if (Array.isArray(navItems) && navItems.length > 0) {
        const nextNav = [...navItems];
        for (const key of added) {
          const route = FEATURE_MODULES.find((m) => m.key === key)?.route;
          if (!route || route === "/admin" || nextNav.includes(route)) continue;
          const moreIdx = nextNav.indexOf("/more");
          if (moreIdx >= 0) nextNav.splice(moreIdx, 0, route);
          else nextNav.push(route);
        }
        if (nextNav.length !== navItems.length) payload.navItems = nextNav;
      }
    }

    await setDoc(doc(db, "users", userId), payload, { merge: true });
    setUsers((prevUsers) => prevUsers.map((u) => (u.id === userId ? { ...u, enabledFeatures: features } : u)));
  };

  const { households: allHouseholds } = useAllHouseholds();
  const { createHouseholdFor, addHouseholdMemberById, removeHouseholdMember, deleteHousehold, renameHousehold } = useHouseholds();
  const { shares: allPageShares } = useAllPageShares();
  const appUsersForSharing = useAppUsers();
  const nameForUid = (uid: string) => appUsersForSharing.find((u) => u.id === uid)?.name || uid;
  const existingHouseholdNames = useMemo(
    () => Array.from(new Set(allHouseholds.filter((h) => !looksLikeGeneratedId(h.name)).map((h) => h.name))).sort(),
    [allHouseholds]
  );

  const [hhAssignOpen, setHhAssignOpen] = useState(false);
  const [hhAssignUserId, setHhAssignUserId] = useState<string | null>(null);
  const [hhAssignFeatures, setHhAssignFeatures] = useState<FeatureKey[] | null>(null);
  const [hhMode, setHhMode] = useState<"new" | "existing">("new");
  const [hhName, setHhName] = useState("");
  const [hhExistingId, setHhExistingId] = useState("");

  const namedHouseholds = useMemo(
    () => allHouseholds.filter((h) => !looksLikeGeneratedId(h.name)),
    [allHouseholds]
  );

  const confirmHouseholdAssign = async () => {
    if (!hhAssignUserId || !hhAssignFeatures) return;
    setActionLoading(true);
    try {
      if (hhMode === "existing") {
        if (!hhExistingId) return;
        await addHouseholdMemberById(hhExistingId, hhAssignUserId);
      } else if (hhName.trim()) {
        const unnamed = allHouseholds.find(
          (h) => h.memberIds.includes(hhAssignUserId) && looksLikeGeneratedId(h.name)
        );
        if (unnamed) await renameHousehold(unnamed.id, hhName.trim());
        else await createHouseholdFor(hhName.trim(), hhAssignUserId);
      } else {
        return;
      }
      await updateFeatures(hhAssignUserId, hhAssignFeatures);
      setHhAssignOpen(false);
      setHhAssignUserId(null);
      setHhAssignFeatures(null);
    } finally {
      setActionLoading(false);
    }
  };

  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);
  const runBackfill = async () => {
    setBackfillLoading(true);
    setBackfillResult(null);
    try {
      const call = httpsCallable(functions, "backfillHouseholds");
      const result = await call({});
      const data = result.data as { householdsTouched: number; skipped: string[] };
      setBackfillResult(`Updated ${data.householdsTouched} household(s).${data.skipped.length ? ` Skipped ${data.skipped.length} invalid id(s).` : ""}`);
    } catch (err: any) {
      setBackfillResult(err.message || "Backfill failed.");
    } finally {
      setBackfillLoading(false);
    }
  };

  const saveHouseholds = async (userId: string, selectedNames: string[]) => {
    setActionLoading(true);
    try {
      const currentMemberships = allHouseholds.filter((h) => h.memberIds.includes(userId));
      const currentNames = currentMemberships.map((h) => h.name);

      for (const h of currentMemberships) {
        if (!selectedNames.includes(h.name)) {
          await removeHouseholdMember(h.id, userId);
        }
      }
      for (const name of selectedNames) {
        if (currentNames.includes(name)) continue;
        const existing = allHouseholds.find((h) => h.name === name);
        if (existing) {
          await addHouseholdMemberById(existing.id, userId);
        } else {
          await createHouseholdFor(name, userId);
        }
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Local dialog edit state
  const [editRole, setEditRole] = useState<"member" | "admin" | "superadmin">("member");
  const [editHouseholds, setEditHouseholds] = useState<string[]>([]);

  // Sync local edit state when selected user changes
  useEffect(() => {
    if (!currentUser) return;
    const r = currentUser.role.toLowerCase() as "member" | "admin" | "superadmin";
    setEditRole(r);
    setEditHouseholds(allHouseholds.filter((h) => h.memberIds.includes(currentUser.id)).map((h) => h.name));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser, allHouseholds]);

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

  if (view === "sharing") {
    return (
      <FeaturePageShell title="Households & Sharing" subtitle="Oversight of household membership and page shares" icon={<Users className="w-5 h-5" />}>
        <button onClick={() => setView("main")} className="flex items-center gap-1.5 text-xs text-primary font-medium mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Admin
        </button>

        {/* Backfill */}
        <div className="mb-6 p-4 rounded-xl bg-muted/40 space-y-2">
          <p className="text-sm font-semibold text-card-foreground">Household backfill</p>
          <p className="text-xs text-muted-foreground">
            Creates a households/{"{id}"} membership doc for every legacy householdId/householdIds value already
            assigned to a user, without moving any existing data. Safe to re-run any time.
          </p>
          <Button size="sm" className="h-8 rounded-lg text-xs" disabled={backfillLoading} onClick={runBackfill}>
            {backfillLoading ? "Running…" : "Run backfill"}
          </Button>
          {backfillResult && <p className="text-xs text-muted-foreground">{backfillResult}</p>}
        </div>

        {/* Households */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Households ({allHouseholds.length})</p>
          <div className="space-y-2">
            {allHouseholds.length === 0 && <p className="text-xs text-muted-foreground">No households yet.</p>}
            {allHouseholds.map((h) => (
              <div key={h.id} className="p-3 rounded-xl bg-card border border-border/50 space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-card-foreground">{h.name}</p>
                  <button
                    onClick={() => deleteHousehold(h.id)}
                    className="text-[10px] text-destructive font-medium flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {h.memberIds.map((uid) => (
                    <span key={uid} className="flex items-center gap-1 text-[10px] font-medium bg-muted px-2 py-1 rounded-full text-foreground">
                      {nameForUid(uid)}
                      <button onClick={() => removeHouseholdMember(h.id, uid)} className="text-muted-foreground hover:text-destructive">
                        <UserX className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Page shares */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Page shares ({allPageShares.length})</p>
          <div className="space-y-2">
            {allPageShares.length === 0 && <p className="text-xs text-muted-foreground">No page shares yet.</p>}
            {allPageShares.map((s) => (
              <div key={s.id} className="p-3 rounded-xl bg-card border border-border/50 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-card-foreground truncate">
                    {nameForUid(s.ownerId)} → {nameForUid(s.targetUid)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{s.page} · {s.permission}</p>
                </div>
                <button
                  onClick={() => revokePageShareById(s.id)}
                  className="text-[10px] text-destructive font-medium flex items-center gap-1 flex-shrink-0"
                >
                  <Trash2 className="w-3 h-3" /> Revoke
                </button>
              </div>
            ))}
          </div>
        </div>
      </FeaturePageShell>
    );
  }

  return (
    <FeaturePageShell title="Admin" subtitle="Users & system management" icon={<Shield className="w-5 h-5" />}>
      {/* Invite User */}
      <div className="mb-5">
        <div className="flex items-center justify-between px-1 mb-1">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Users</h3>
          <Button
            size="sm"
            className="h-8 rounded-lg text-xs"
            onClick={() => setInviteOpen(true)}
            disabled={!canInvite}
          >
            Invite user
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground px-1 mb-2">Everyone with a Firebase login. Deleting here also removes that login.</p>

        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogContent className="max-w-md mx-4">
            <DialogHeader>
              <DialogTitle className="font-display">Invite user</DialogTitle>
              <DialogDescription>Fill in the details below to create a new account and send an invitation.</DialogDescription>
            </DialogHeader>

            <form
              className="space-y-4 pt-2"
              onSubmit={(e) => {
                e.preventDefault();
                void doInvite();
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="inviteFirstName">First name</Label>
                  <Input
                    id="inviteFirstName"
                    value={inviteFirstName}
                    onChange={(e) => setInviteFirstName(e.target.value)}
                    placeholder="Chris"
                    autoComplete="given-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inviteSurname">Surname</Label>
                  <Input
                    id="inviteSurname"
                    value={inviteSurname}
                    onChange={(e) => setInviteSurname(e.target.value)}
                    placeholder="Hardy"
                    autoComplete="family-name"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="inviteEmail">Email</Label>
                <Input
                  id="inviteEmail"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="name@example.com"
                  type="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="off"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="invitePassword">Temporary password</Label>
                <Input
                  id="invitePassword"
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  placeholder="Min 8 chars, 1 number, 1 special char"
                  type="password"
                  autoComplete="new-password"
                />
                <p className="text-[10px] text-muted-foreground">
                  Must be 8+ characters, include a number (0–9) and a special character (e.g. ! @ # $). The user can change this after logging in.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="inviteRole">Role</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "member" | "admin")}>
                  <SelectTrigger id="inviteRole" className="h-9 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {inviteError && (
                <p className="text-xs text-destructive">{inviteError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-lg text-xs"
                  onClick={() => setInviteOpen(false)}
                  disabled={inviteLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="h-9 rounded-lg text-xs"
                  disabled={
                    inviteLoading ||
                    !inviteEmail.trim() ||
                    !invitePassword.trim() ||
                    !inviteFirstName.trim()
                  }
                >
                  {inviteLoading ? "Inviting…" : "Invite"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-4 gap-2 mb-5 mt-4">
          {STATS.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div key={stat.label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 * i }}
                className="p-3 rounded-xl shadow-soft text-center text-white overflow-hidden"
                style={{ background: stat.gradient }}
              >
                <Icon className="w-4 h-4 text-white/80 mx-auto mb-1" />
                <p className="text-sm font-bold font-display">{stat.value}</p>
                <p className="text-[8px] text-white/70 uppercase tracking-wider">{stat.label}</p>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      {/* Users */}
      <div className="mb-5">
        <div className="rounded-xl bg-card border border-border/50 shadow-soft overflow-hidden divide-y divide-border/30">
          {!usersLoading && users.length === 0 && (
            <div className="p-4">
              <p className="text-sm font-medium text-card-foreground">No users found</p>
              <p className="text-[10px] text-muted-foreground">This list is pulled from Firestore collection <span className="font-mono">users</span>.</p>
            </div>
          )}

          {usersLoading && (
            <div className="p-4">
              <p className="text-sm font-medium text-card-foreground">Loading users…</p>
              <p className="text-[10px] text-muted-foreground">Reading from Firestore.</p>
            </div>
          )}

          {users.map((user) => {
            const roleGrad = user.role.toLowerCase() === "superadmin"
              ? "linear-gradient(135deg,hsl(0,65%,55%),hsl(340,60%,48%))"
              : user.role.toLowerCase() === "admin"
              ? "linear-gradient(135deg,hsl(38,95%,54%),hsl(25,88%,47%))"
              : "linear-gradient(135deg,hsl(178,58%,42%),hsl(182,55%,46%))";
            return (
            <button
              key={user.id}
              onClick={() => setSelectedUser(user.id)}
              className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-muted/30 transition-colors"
            >
              <div className="w-9 h-9 rounded-full flex items-center justify-center shadow-sm" style={{ background: roleGrad }}>
                <span className="text-xs font-bold text-white">{user.name.charAt(0)}</span>
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
            );
          })}
        </div>
      </div>

      {/* Households & Sharing Link */}
      <button
        onClick={() => setView("sharing")}
        className="w-full p-4 rounded-xl bg-card border border-border text-left flex items-center gap-3 shadow-card hover:bg-muted/40 transition-colors mb-3"
      >
        <Users className="w-5 h-5 text-primary" />
        <div>
          <p className="text-sm font-semibold text-card-foreground">Households & Sharing</p>
          <p className="text-[10px] text-muted-foreground">Manage household membership & page shares, run backfill</p>
        </div>
      </button>

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
        <DialogContent className="max-w-md mx-4 max-h-[90vh] overflow-y-auto">
          {currentUser && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">{currentUser.name.charAt(0)}</span>
                  </div>
                  {currentUser.name}
                </DialogTitle>
                <DialogDescription>Manage role, household, feature access and account status.</DialogDescription>
              </DialogHeader>
              <div className="space-y-5 pt-2">

                {/* Details */}
                <div className="space-y-2">
                  {[
                    ["Email", currentUser.email],
                    ["Status", currentUser.status === "active" ? "Active" : "Suspended"],
                    ["Last Login", currentUser.lastLogin],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <span className="text-xs font-medium text-card-foreground">{value}</span>
                    </div>
                  ))}
                </div>

                {/* Role */}
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</p>
                  <Select value={editRole} onValueChange={(v) => setEditRole(v as typeof editRole)}>
                    <SelectTrigger className="h-9 rounded-lg text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="superadmin">Superadmin</SelectItem>
                    </SelectContent>
                  </Select>
                  {editRole !== currentUser.role.toLowerCase() && (
                    <Button
                      size="sm"
                      className="h-8 rounded-lg text-xs w-full mt-1"
                      disabled={actionLoading}
                      onClick={() => changeRole(currentUser.id, editRole)}
                    >
                      Save role change
                    </Button>
                  )}
                </div>

                {/* Household */}
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Household(s)</p>
                  <CreatableMultiSelect
                    value={editHouseholds}
                    onChange={setEditHouseholds}
                    options={existingHouseholdNames}
                    placeholder="Select or add a household…"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-lg text-xs w-full mt-1"
                    disabled={
                      actionLoading ||
                      JSON.stringify([...editHouseholds].sort()) ===
                        JSON.stringify(allHouseholds.filter((h) => h.memberIds.includes(currentUser.id)).map((h) => h.name).sort())
                    }
                    onClick={() => saveHouseholds(currentUser.id, editHouseholds)}
                  >
                    Save households
                  </Button>
                </div>

                {/* Feature Access */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Feature Access</p>
                  <p className="text-[10px] text-muted-foreground -mt-1">Admins & superadmins always see everything. These toggles apply to members only.</p>
                  <div className="space-y-1.5">
                    {FEATURE_MODULES.map((mod) => {
                      const enabled = featureEnabled(currentUser.enabledFeatures, mod.key);
                      return (
                        <div
                          key={mod.key}
                          className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/40"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-card-foreground">{mod.label}</span>
                          </div>
                          <Switch
                            checked={enabled}
                            disabled={actionLoading}
                            onCheckedChange={async (checked) => {
                              const next = checked
                                ? (featureEnabled(currentUser.enabledFeatures, mod.key)
                                  ? currentUser.enabledFeatures
                                  : [...currentUser.enabledFeatures, mod.key])
                                : currentUser.enabledFeatures.filter((k) => !featureEnabled([k], mod.key));
                              const householdFeature = mod.key === "finance_household" || mod.key === "households";
                              const alreadyNamed = namedHouseholds.some((h) => h.memberIds.includes(currentUser.id));
                              if (checked && householdFeature && !alreadyNamed) {
                                setHhAssignUserId(currentUser.id);
                                setHhAssignFeatures(next);
                                setHhMode(namedHouseholds.length > 0 ? "existing" : "new");
                                setHhName("");
                                setHhExistingId(namedHouseholds[0]?.id ?? "");
                                setHhAssignOpen(true);
                                return;
                              }
                              await updateFeatures(currentUser.id, next);
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-1 border-t border-border/40">
                  <Button
                    variant="outline"
                    className="w-full h-9 rounded-lg text-xs justify-start gap-2"
                    disabled={actionLoading || currentUser.id === user?.uid}
                    onClick={() => {
                      startViewAs({ uid: currentUser.id, name: currentUser.name, email: currentUser.email });
                      setSelectedUser(null);
                      navigate("/dashboard");
                    }}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    {currentUser.id === user?.uid
                      ? "This is you"
                      : viewAs?.uid === currentUser.id
                        ? "Already viewing as this user"
                        : "View as this user"}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full h-9 rounded-lg text-xs justify-start gap-2"
                    disabled={actionLoading}
                    onClick={() => { setResetPwResult(null); setTempPassword(""); setResetPwMode("email"); setResetPwOpen(true); }}
                  >
                    <KeyRound className="w-3.5 h-3.5" /> Reset Password
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full h-9 rounded-lg text-xs justify-start gap-2"
                    disabled={actionLoading}
                    onClick={() => toggleSuspend(currentUser.id, currentUser.status)}
                  >
                    {currentUser.status === "active"
                      ? <><UserX className="w-3.5 h-3.5" /> Suspend Account</>
                      : <><UserCheck className="w-3.5 h-3.5" /> Reinstate Account</>
                    }
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full h-9 rounded-lg text-xs justify-start gap-2 text-destructive hover:text-destructive"
                    disabled={actionLoading || currentUser.id === user?.uid}
                    onClick={() => {
                      setDeleteTarget(currentUser);
                      setDeleteStep("ask");
                      setDeleteNameInput("");
                      setDeleteError(null);
                      setSelectedUser(null);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Account
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={hhAssignOpen} onOpenChange={setHhAssignOpen}>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="font-display">Household for this user</DialogTitle>
            <DialogDescription>
              Household Finance and Household bills need a named household. Create a new one or add them to an existing household.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="flex rounded-lg overflow-hidden border border-border/50 text-xs font-medium">
              <button
                type="button"
                onClick={() => setHhMode("new")}
                className={`flex-1 py-2 ${hhMode === "new" ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground"}`}
              >
                New household
              </button>
              <button
                type="button"
                onClick={() => setHhMode("existing")}
                className={`flex-1 py-2 ${hhMode === "existing" ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground"}`}
              >
                Existing
              </button>
            </div>
            {hhMode === "new" ? (
              <div className="space-y-1.5">
                <Label className="text-xs">Household name</Label>
                <Input value={hhName} onChange={(e) => setHhName(e.target.value)} placeholder="e.g. 35PFP" className="h-10 rounded-xl" />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs">Add to</Label>
                <Select value={hhExistingId} onValueChange={setHhExistingId}>
                  <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Choose a household" /></SelectTrigger>
                  <SelectContent>
                    {namedHouseholds.map((h) => (
                      <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {namedHouseholds.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">No named households yet — create a new one.</p>
                )}
              </div>
            )}
            <Button
              className="w-full h-10 rounded-xl"
              disabled={actionLoading || (hhMode === "new" ? !hhName.trim() : !hhExistingId)}
              onClick={confirmHouseholdAssign}
            >
              {actionLoading ? "Saving…" : "Save and enable feature"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) closeDeleteDialog(); }}>
        <DialogContent className="max-w-sm mx-4" aria-describedby={undefined}>
          {deleteTarget && deleteStep === "ask" && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display flex items-center gap-2 text-destructive">
                  <Trash2 className="w-4 h-4" /> Delete this account?
                </DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete <span className="font-semibold text-foreground">{deleteTarget.name}</span>
                  {deleteTarget.email ? <> ({deleteTarget.email})</> : null}? This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1 h-10 rounded-xl" onClick={closeDeleteDialog}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 h-10 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => setDeleteStep("type")}
                >
                  Yes, continue
                </Button>
              </div>
            </>
          )}
          {deleteTarget && deleteStep === "type" && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">Type the name to confirm</DialogTitle>
                <DialogDescription>
                  Type <span className="font-semibold text-foreground">{deleteTarget.name}</span> to permanently delete this account.
                  {deleteTarget.email ? <> You can also type their email.</> : null}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 pt-1">
                <div className="space-y-1.5">
                  <Label className="text-xs">Confirmation</Label>
                  <Input
                    autoFocus
                    value={deleteNameInput}
                    onChange={(e) => setDeleteNameInput(e.target.value)}
                    placeholder={deleteTarget.name}
                    className="h-10 rounded-xl"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && deleteConfirmMatches(deleteTarget, deleteNameInput)) {
                        void doDeleteUser();
                      }
                    }}
                  />
                </div>
                {deleteError && (
                  <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{deleteError}</p>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 h-10 rounded-xl" disabled={actionLoading} onClick={closeDeleteDialog}>
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 h-10 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={actionLoading || !deleteConfirmMatches(deleteTarget, deleteNameInput)}
                    onClick={() => void doDeleteUser()}
                  >
                    {actionLoading ? "Deleting…" : "Delete account"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetPwOpen} onOpenChange={(o) => { setResetPwOpen(o); if (!o) setResetPwResult(null); }}>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2"><KeyRound className="w-4 h-4" /> Reset Password</DialogTitle>
            <DialogDescription>Choose how to reset the password for {currentUser?.name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Mode toggle */}
            <div className="flex rounded-lg overflow-hidden border border-border/50 text-xs font-medium">
              <button
                onClick={() => { setResetPwMode("email"); setResetPwResult(null); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors ${resetPwMode === "email" ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted"}`}
              >
                <Mail className="w-3.5 h-3.5" /> Send Reset Link
              </button>
              <button
                onClick={() => { setResetPwMode("temp"); setResetPwResult(null); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors ${resetPwMode === "temp" ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted"}`}
              >
                <KeyRound className="w-3.5 h-3.5" /> Set Temporary
              </button>
            </div>

            {resetPwMode === "email" ? (
              <p className="text-xs text-muted-foreground">
                A password reset link will be emailed to <span className="font-medium text-card-foreground">{currentUser?.email}</span>. The link expires after 1 hour.
              </p>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs">New Temporary Password</Label>
                <Input
                  type="password"
                  placeholder="Min 8 chars, 1 number, 1 special char"
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  className="h-10 rounded-xl text-sm"
                />
                <p className="text-[10px] text-muted-foreground">The user should change this after logging in.</p>
              </div>
            )}

            {resetPwResult && (
              <p className={`text-xs rounded-lg px-3 py-2 ${resetPwResult.ok ? "text-green-700 bg-green-50 dark:bg-green-900/20" : "text-destructive bg-destructive/10"}`}>
                {resetPwResult.ok ? "✓ " : "✗ "}{resetPwResult.msg}
              </p>
            )}

            <Button
              onClick={doResetPassword}
              disabled={resetPwLoading || (resetPwMode === "temp" && !tempPassword.trim())}
              className="w-full h-10 rounded-xl bg-gradient-primary text-sm"
            >
              {resetPwLoading ? "Processing…" : resetPwMode === "email" ? "Send Reset Email" : "Set Password"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </FeaturePageShell>
  );
};

export default Admin;