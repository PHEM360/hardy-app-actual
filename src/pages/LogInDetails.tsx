import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { KeyRound, Plus, Eye, EyeOff, Copy, Trash2, Check, Globe, User, Lock, ChevronDown, ChevronUp } from "lucide-react";
import {
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot,
  serverTimestamp, query, orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Credential {
  id?: string;
  name: string;
  url?: string;
  username?: string;
  email?: string;
  password: string;
  notes?: string;
  category?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

const EMPTY: Omit<Credential, "id" | "createdAt" | "updatedAt"> = {
  name: "", url: "", username: "", email: "", password: "", notes: "", category: "",
};

const CATEGORIES = ["Banking", "Email", "Shopping", "Work", "Social", "Finance", "Health", "Government", "Other"];

const CAT_STYLES: Record<string, { border: string; avatar: string; avatarText: string }> = {
  Banking:    { border: "border-l-blue-400",   avatar: "bg-blue-100 dark:bg-blue-900/40",   avatarText: "text-blue-700 dark:text-blue-300" },
  Email:      { border: "border-l-green-400",  avatar: "bg-green-100 dark:bg-green-900/40", avatarText: "text-green-700 dark:text-green-300" },
  Shopping:   { border: "border-l-orange-400", avatar: "bg-orange-100 dark:bg-orange-900/40", avatarText: "text-orange-700 dark:text-orange-300" },
  Work:       { border: "border-l-purple-400", avatar: "bg-purple-100 dark:bg-purple-900/40", avatarText: "text-purple-700 dark:text-purple-300" },
  Social:     { border: "border-l-pink-400",   avatar: "bg-pink-100 dark:bg-pink-900/40",   avatarText: "text-pink-700 dark:text-pink-300" },
  Finance:    { border: "border-l-emerald-400",avatar: "bg-emerald-100 dark:bg-emerald-900/40", avatarText: "text-emerald-700 dark:text-emerald-300" },
  Health:     { border: "border-l-red-400",    avatar: "bg-red-100 dark:bg-red-900/40",     avatarText: "text-red-700 dark:text-red-300" },
  Government: { border: "border-l-slate-400",  avatar: "bg-slate-100 dark:bg-slate-800/60", avatarText: "text-slate-700 dark:text-slate-300" },
  Other:      { border: "border-l-gray-300",   avatar: "bg-gray-100 dark:bg-gray-800/60",   avatarText: "text-gray-600 dark:text-gray-400" },
};

function getCatStyle(cat?: string) {
  return CAT_STYLES[cat ?? ""] ?? { border: "border-l-primary/40", avatar: "bg-primary/10", avatarText: "text-primary" };
}

// ─── Credential Card ──────────────────────────────────────────────────────────

function CredentialCard({
  cred,
  onEdit,
  onDelete,
}: {
  cred: Credential;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [showPw, setShowPw] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(field);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const initials = cred.name.slice(0, 2).toUpperCase();
  const catStyle = getCatStyle(cred.category);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className={`rounded-2xl border border-border/60 border-l-4 ${catStyle.border} bg-card shadow-soft overflow-hidden`}
    >
      {/* Header row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${catStyle.avatar}`}>
          <span className={`text-xs font-bold ${catStyle.avatarText}`}>{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-card-foreground truncate">{cred.name}</p>
          {(cred.email || cred.username) && (
            <p className="text-[10px] text-muted-foreground truncate">{cred.email || cred.username}</p>
          )}
        </div>
        {cred.category && (
          <span className="text-[9px] font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full flex-shrink-0">
            {cred.category}
          </span>
        )}
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2.5 border-t border-border/40 pt-3">
              {/* URL */}
              {cred.url && (
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <a href={cred.url.startsWith("http") ? cred.url : `https://${cred.url}`} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-primary truncate flex-1 hover:underline" onClick={(e) => e.stopPropagation()}>
                    {cred.url}
                  </a>
                  <button onClick={() => copyToClipboard(cred.url!, "url")} className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                    {copied === "url" ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              )}

              {/* Username */}
              {cred.username && (
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs text-card-foreground flex-1 truncate">{cred.username}</span>
                  <button onClick={() => copyToClipboard(cred.username!, "username")} className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                    {copied === "username" ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              )}

              {/* Email */}
              {cred.email && (
                <div className="flex items-center gap-2">
                  <span className="w-3.5 text-center text-[10px] font-bold text-muted-foreground flex-shrink-0">@</span>
                  <span className="text-xs text-card-foreground flex-1 truncate">{cred.email}</span>
                  <button onClick={() => copyToClipboard(cred.email!, "email")} className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                    {copied === "email" ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              )}

              {/* Password */}
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-xs text-card-foreground flex-1 font-mono tracking-wider">
                  {showPw ? cred.password : "•".repeat(Math.min(cred.password.length, 16))}
                </span>
                <button onClick={() => setShowPw((v) => !v)} className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                  {showPw ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
                <button onClick={() => copyToClipboard(cred.password, "password")} className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                  {copied === "password" ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>

              {/* Notes */}
              {cred.notes && (
                <p className="text-[10px] text-muted-foreground bg-muted/50 rounded-xl px-3 py-2 leading-relaxed">{cred.notes}</p>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button onClick={onEdit} className="flex-1 text-xs font-semibold py-1.5 rounded-xl bg-muted hover:bg-muted/80 transition-colors text-card-foreground">
                  Edit
                </button>
                <button onClick={onDelete} className="p-1.5 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const LogInDetails = () => {
  const { dataUid } = useAuth();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCred, setEditCred] = useState<Credential | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [showFormPw, setShowFormPw] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");

  useEffect(() => {
    if (!dataUid) return;
    const q = query(
      collection(db, "users", dataUid, "credentials"),
      orderBy("name")
    );
    const unsub = onSnapshot(q, (snap) => {
      setCredentials(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Credential)));
      setLoading(false);
    });
    return unsub;
  }, [dataUid]);

  const openAdd = () => {
    setEditCred(null);
    setForm({ ...EMPTY });
    setShowFormPw(false);
    setDialogOpen(true);
  };

  const openEdit = (cred: Credential) => {
    setEditCred(cred);
    setForm({
      name: cred.name,
      url: cred.url ?? "",
      username: cred.username ?? "",
      email: cred.email ?? "",
      password: cred.password,
      notes: cred.notes ?? "",
      category: cred.category ?? "",
    });
    setShowFormPw(false);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!dataUid || !form.name.trim() || !form.password.trim()) return;
    setSaving(true);
    try {
      const data = {
        name: form.name.trim(),
        url: form.url?.trim() || "",
        username: form.username?.trim() || "",
        email: form.email?.trim() || "",
        password: form.password,
        notes: form.notes?.trim() || "",
        category: form.category || "",
        updatedAt: serverTimestamp(),
      };
      if (editCred?.id) {
        await updateDoc(doc(db, "users", dataUid, "credentials", editCred.id), data);
      } else {
        await addDoc(collection(db, "users", dataUid, "credentials"), {
          ...data,
          createdAt: serverTimestamp(),
        });
      }
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cred: Credential) => {
    if (!dataUid || !cred.id) return;
    await deleteDoc(doc(db, "users", dataUid, "credentials", cred.id));
  };

  const usedCategories = [...new Set(credentials.map((c) => c.category).filter(Boolean))] as string[];
  const filterTabs = ["All", ...usedCategories];

  const filtered = activeCategory === "All"
    ? credentials
    : credentials.filter((c) => c.category === activeCategory);

  return (
    <FeaturePageShell
      title="Log In Details"
      subtitle="Your saved credentials"
      icon={<KeyRound className="w-5 h-5" />}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          {filterTabs.map((tab) => (
            <button key={tab} onClick={() => setActiveCategory(tab)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all duration-150 ${
                activeCategory === tab ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}>
              {tab}
            </button>
          ))}
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 text-xs font-bold bg-primary text-primary-foreground px-3 py-2 rounded-full hover:bg-primary/90 transition-colors shadow-sm flex-shrink-0">
          <Plus className="w-3.5 h-3.5" />
          New
        </button>
      </div>

      {/* Credentials list */}
      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-10">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-14">
          <KeyRound className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-medium">No credentials saved yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Tap "New" to add your first one</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {filtered.map((cred) => (
              <CredentialCard
                key={cred.id}
                cred={cred}
                onEdit={() => openEdit(cred)}
                onDelete={() => handleDelete(cred)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditCred(null); }}>
        <DialogContent className="max-w-sm mx-4 max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="font-display">{editCred ? "Edit Credential" : "New Credential"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Netflix, HMRC" className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label>Website / URL</Label>
              <Input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="e.g. netflix.com" className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@example.com" className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label>Username</Label>
              <Input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} placeholder="Username (if different from email)" className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label>Password *</Label>
              <div className="relative">
                <Input
                  type={showFormPw ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Password"
                  className="h-9 rounded-xl pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowFormPw((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showFormPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((cat) => (
                  <button key={cat} type="button" onClick={() => setForm((f) => ({ ...f, category: f.category === cat ? "" : cat }))}
                    className={`text-[10px] font-semibold px-2.5 py-1 rounded-full transition-colors ${
                      form.category === cat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Security questions, pins, etc." className="h-9 rounded-xl" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1 h-9 rounded-xl">Cancel</Button>
              <Button onClick={handleSave} disabled={!form.name.trim() || !form.password.trim() || saving} className="flex-1 h-9 rounded-xl bg-gradient-primary">
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </FeaturePageShell>
  );
};

export default LogInDetails;
