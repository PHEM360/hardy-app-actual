import { useState, useEffect, useRef } from "react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Home,
  Car,
  Heart,
  Zap,
  Building2,
  Landmark,
  Phone,
  Wifi,
  PawPrint,
  Package,
  Plus,
  Settings,
  LayoutGrid,
  Trash2,
  Bell,
  BellOff,
  Pencil,
  X,
} from "lucide-react";
import {
  HouseholdItem,
  HouseholdMember,
  HouseholdSettings,
  HouseholdReminder,
} from "@/types/app";
import { useHouseholdItems, useHouseholdSettings } from "@/hooks/useHousehold";
import { usePushNotifications } from "@/hooks/usePushNotifications";

// ─── Category meta ─────────────────────────────────────────────────────────────

const CATEGORY_META: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  "Home Insurance":   { icon: Home,      color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  "Car Insurance":    { icon: Car,       color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  "Life Insurance":   { icon: Heart,     color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  "Utilities":        { icon: Zap,       color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" },
  "Council Tax":      { icon: Building2, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  "Mortgage":         { icon: Landmark,  color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  "Phone Contract":   { icon: Phone,     color: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" },
  "TV / Broadband":   { icon: Wifi,      color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" },
  "Pet Insurance":    { icon: PawPrint,  color: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300" },
};

function getCategoryMeta(type: string) {
  return (
    CATEGORY_META[type] ?? {
      icon: Package,
      color: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    }
  );
}

function daysUntil(dateStr?: string) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function RenewalBadge({ days }: { days: number | null }) {
  if (days === null) return null;
  if (days < 0)
    return <span className="text-xs font-medium text-red-500">Expired</span>;
  if (days <= 30)
    return <span className="text-xs font-medium text-amber-500">{days}d left</span>;
  return <span className="text-xs text-muted-foreground">{days}d left</span>;
}

// ─── Item tile ─────────────────────────────────────────────────────────────────

function ItemTile({
  item,
  onOpen,
  onDelete,
}: {
  item: HouseholdItem;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const { icon: Icon, color } = getCategoryMeta(item.type);
  const days = daysUntil(item.endDate);

  return (
    <div className="relative group">
      <button
        onClick={onOpen}
        className="w-full text-left rounded-xl border bg-card p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-2"
      >
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="font-medium text-sm leading-tight">{item.type}</div>
        <div className="text-xs text-muted-foreground truncate">{item.provider}</div>
        {item.monthlyPremium !== undefined && (
          <div className="text-xs font-semibold">£{item.monthlyPremium}/mo</div>
        )}
        <RenewalBadge days={days} />
        {item.pushEnabled && (
          <Bell className="w-3 h-3 text-muted-foreground absolute bottom-3 right-3" />
        )}
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity
                   w-6 h-6 rounded-full bg-destructive/90 text-destructive-foreground
                   flex items-center justify-center hover:bg-destructive z-10"
        title="Delete"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

function EmptyState({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    <button
      onClick={onAdd}
      className="rounded-xl border-2 border-dashed border-muted p-6 flex flex-col items-center gap-2
                 text-muted-foreground hover:border-primary hover:text-primary transition-colors w-full"
    >
      <Plus className="w-6 h-6" />
      <span className="text-sm">{label}</span>
    </button>
  );
}

// ─── Add / Edit dialog ─────────────────────────────────────────────────────────

const UNITS: HouseholdReminder["unit"][] = ["hours", "days", "weeks", "months"];

const BLANK: Omit<HouseholdItem, "id" | "createdAt"> = {
  type: "",
  provider: "",
  policyNumber: "",
  monthlyPremium: undefined,
  startDate: "",
  endDate: "",
  assignedTo: "",
  notes: "",
  pushEnabled: false,
  reminders: [{ amount: 7, unit: "days", via: "push" }],
};

function AddEditDialog({
  open,
  item,
  categories,
  members,
  onClose,
  onSave,
  permission,
  requestPermission,
}: {
  open: boolean;
  item: Omit<HouseholdItem, "id" | "createdAt"> | null;
  categories: string[];
  members: HouseholdMember[];
  onClose: () => void;
  onSave: (data: Omit<HouseholdItem, "id" | "createdAt">) => void;
  permission: NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
}) {
  const [form, setForm] = useState<Omit<HouseholdItem, "id" | "createdAt">>(BLANK);

  useEffect(() => {
    setForm(item ?? BLANK);
  }, [item, open]);

  function set<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  const reminder: HouseholdReminder = form.reminders?.[0] ?? { amount: 7, unit: "days", via: "push" };
  const setReminder = (r: HouseholdReminder) =>
    setForm((f) => ({ ...f, reminders: [r] }));

  const handlePushToggle = async (checked: boolean) => {
    if (checked && permission !== "granted") {
      const p = await requestPermission();
      if (p !== "granted") return;
    }
    set("pushEnabled", checked);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item?.provider ? "Edit Item" : "Add Item"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={(v) => set("type", v)}>
              <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Provider</Label>
            <Input value={form.provider} onChange={(e) => set("provider", e.target.value)} placeholder="e.g. Aviva, British Gas…" />
          </div>

          <div className="space-y-1.5">
            <Label>Policy / Account Number</Label>
            <Input value={form.policyNumber ?? ""} onChange={(e) => set("policyNumber", e.target.value)} placeholder="Optional" />
          </div>

          <div className="space-y-1.5">
            <Label>Monthly Cost (£)</Label>
            <Input
              type="number" min={0} step={0.01}
              value={form.monthlyPremium ?? ""}
              onChange={(e) => set("monthlyPremium", e.target.value === "" ? undefined : parseFloat(e.target.value))}
              placeholder="0.00"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <Input type="date" value={form.startDate ?? ""} onChange={(e) => set("startDate", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Renewal / End Date</Label>
              <Input type="date" value={form.endDate ?? ""} onChange={(e) => set("endDate", e.target.value)} />
            </div>
          </div>

          {members.length > 0 && (
            <div className="space-y-1.5">
              <Label>Assign To</Label>
              <Select value={form.assignedTo ?? ""} onValueChange={(v) => set("assignedTo", v)}>
                <SelectTrigger><SelectValue placeholder="Nobody (shared)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nobody (shared)</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.emoji ? `${m.emoji} ` : ""}{m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} placeholder="Optional" />
          </div>

          {/* Reminders */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Bell className="w-4 h-4" /> Reminders
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground shrink-0">Remind me</span>
              <Input
                type="number" min={1} className="w-20"
                value={reminder.amount}
                onChange={(e) => setReminder({ ...reminder, amount: Math.max(1, parseInt(e.target.value) || 1) })}
              />
              <Select value={reminder.unit} onValueChange={(v) => setReminder({ ...reminder, unit: v as HouseholdReminder["unit"] })}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground shrink-0">before renewal</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                {form.pushEnabled ? <Bell className="w-4 h-4 text-primary" /> : <BellOff className="w-4 h-4 text-muted-foreground" />}
                <span>Push notification</span>
                {permission === "denied" && <span className="text-xs text-destructive">(blocked)</span>}
              </div>
              <Switch checked={!!form.pushEnabled} onCheckedChange={handlePushToggle} disabled={permission === "denied"} />
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={() => onSave(form)} disabled={!form.type || !form.provider}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Settings tab ──────────────────────────────────────────────────────────────

function SettingsTab({ settings, onSave }: { settings: HouseholdSettings; onSave: (s: HouseholdSettings) => void }) {
  const [members, setMembers] = useState<HouseholdMember[]>(settings.members);
  const [categories, setCategories] = useState<string[]>(settings.categories);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("👤");
  const [newCat, setNewCat] = useState("");

  useEffect(() => { setMembers(settings.members); setCategories(settings.categories); }, [settings]);

  const save = (m: HouseholdMember[], c: string[]) => onSave({ members: m, categories: c });

  const addMember = () => {
    if (!newName.trim()) return;
    const next = [...members, { id: crypto.randomUUID(), name: newName.trim(), role: "member" as const, emoji: newEmoji }];
    setMembers(next); save(next, categories); setNewName(""); setNewEmoji("👤");
  };

  const removeMember = (id: string) => {
    const next = members.filter((m) => m.id !== id); setMembers(next); save(next, categories);
  };

  const addCategory = () => {
    const t = newCat.trim();
    if (!t || categories.includes(t)) return;
    const next = [...categories, t]; setCategories(next); save(members, next); setNewCat("");
  };

  const removeCategory = (c: string) => {
    const next = categories.filter((x) => x !== c); setCategories(next); save(members, next);
  };

  return (
    <div className="space-y-8">
      {/* Members */}
      <section className="space-y-4">
        <h3 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Household Members</h3>
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
              <span className="text-xl">{m.emoji ?? "👤"}</span>
              <div className="flex-1">
                <div className="font-medium text-sm">{m.name}</div>
                <div className="text-xs text-muted-foreground capitalize">{m.role}</div>
              </div>
              <button onClick={() => removeMember(m.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input className="w-14 text-center px-1 text-xl" value={newEmoji} onChange={(e) => setNewEmoji(e.target.value)} placeholder="👤" />
          <Input className="flex-1" placeholder="Name…" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addMember()} />
          <Button onClick={addMember} disabled={!newName.trim()}><Plus className="w-4 h-4 mr-1" /> Add</Button>
        </div>
      </section>

      {/* Categories */}
      <section className="space-y-4">
        <h3 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Item Categories</h3>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <div key={c} className="flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-sm">
              {c}
              <button onClick={() => removeCategory(c)} className="text-muted-foreground hover:text-destructive transition-colors">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input className="flex-1" placeholder="New category…" value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCategory()} />
          <Button onClick={addCategory} disabled={!newCat.trim()}><Plus className="w-4 h-4 mr-1" /> Add</Button>
        </div>
      </section>
    </div>
  );
}

// ─── Detail dialog ─────────────────────────────────────────────────────────────

function DetailDialog({
  item,
  members,
  onClose,
  onEdit,
  onDelete,
}: {
  item: HouseholdItem | null;
  members: HouseholdMember[];
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  if (!item) return null;
  const { icon: Icon, color } = getCategoryMeta(item.type);
  const days = daysUntil(item.endDate);
  const assignedMember = members.find((m) => m.id === item.assignedTo);

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
              <Icon className="w-4 h-4" />
            </span>
            {item.type}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <Row label="Provider" value={item.provider} />
          {item.policyNumber && <Row label="Policy #" value={item.policyNumber} />}
          {item.monthlyPremium !== undefined && <Row label="Monthly" value={`£${item.monthlyPremium}`} />}
          {item.startDate && <Row label="Start" value={item.startDate} />}
          {item.endDate && (
            <Row label="Renewal" value={<span className="flex items-center gap-2">{item.endDate} <RenewalBadge days={days} /></span>} />
          )}
          {assignedMember && <Row label="Assigned" value={`${assignedMember.emoji ?? "👤"} ${assignedMember.name}`} />}
          {item.notes && <Row label="Notes" value={item.notes} />}
          {item.pushEnabled && item.reminders?.[0] && (
            <Row label="Reminder" value={`${item.reminders[0].amount} ${item.reminders[0].unit} before renewal`} />
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onEdit}>
            <Pencil className="w-3 h-3 mr-1" /> Edit
          </Button>
          <Button variant="destructive" size="sm" className="flex-1" onClick={onDelete}>
            <Trash2 className="w-3 h-3 mr-1" /> Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

type Tab = "overview" | "settings";

export default function Households() {
  const { items, loading, addItem, updateItem, deleteItem } = useHouseholdItems();
  const { settings, saveSettings } = useHouseholdSettings();
  const { permission, requestPermission, checkAndScheduleAll, scheduleReminder } = usePushNotifications();

  const [tab, setTab] = useState<Tab>("overview");
  const [addOpen, setAddOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<HouseholdItem | null>(null);
  const [editItem, setEditItem] = useState<Omit<HouseholdItem, "id" | "createdAt"> | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HouseholdItem | null>(null);

  useEffect(() => {
    if (!loading) checkAndScheduleAll(items);
  }, [loading, items]);

  const openAdd = () => { setEditId(null); setEditItem(null); setAddOpen(true); };

  const openEdit = (item: HouseholdItem) => {
    const { id, createdAt, ...rest } = item;
    setEditId(id ?? null);
    setEditItem(rest);
    setDetailItem(null);
    setAddOpen(true);
  };

  const handleSave = async (data: Omit<HouseholdItem, "id" | "createdAt">) => {
    if (editId) { await updateItem(editId, data); }
    else { await addItem(data); }
    if (data.pushEnabled) scheduleReminder(data as HouseholdItem);
    setAddOpen(false); setEditItem(null); setEditId(null);
  };

  const handleDelete = async (item: HouseholdItem) => {
    if (item.id) await deleteItem(item.id);
    setDeleteTarget(null); setDetailItem(null);
  };

  const shared = items.filter((i) => !i.assignedTo);
  const memberItems = (id: string) => items.filter((i) => i.assignedTo === id);

  return (
    <FeaturePageShell title="Household" subtitle="Manage household items, policies & renewals">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl bg-muted p-1 mb-6">
        {(["overview", "settings"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors
              ${tab === t ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t === "overview" ? <LayoutGrid className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === "overview" && (
        <div className="space-y-8">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">All Items</h3>
              <Button size="sm" variant="outline" onClick={openAdd}><Plus className="w-4 h-4 mr-1" /> Add</Button>
            </div>
            {items.length === 0 ? (
              <EmptyState label="Add your first household item" onAdd={openAdd} />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {shared.map((item) => (
                  <ItemTile key={item.id} item={item} onOpen={() => setDetailItem(item)} onDelete={() => setDeleteTarget(item)} />
                ))}
              </div>
            )}
          </section>

          {settings.members.map((m) => (
            <section key={m.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{m.emoji ?? "👤"}</span>
                <h3 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">{m.name}'s Items</h3>
              </div>
              {memberItems(m.id).length === 0 ? (
                <p className="text-xs text-muted-foreground">No items assigned to {m.name} yet.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {memberItems(m.id).map((item) => (
                    <ItemTile key={item.id} item={item} onOpen={() => setDetailItem(item)} onDelete={() => setDeleteTarget(item)} />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {/* Settings tab */}
      {tab === "settings" && (
        <SettingsTab settings={settings} onSave={saveSettings} />
      )}

      {/* Add / Edit */}
      <AddEditDialog
        open={addOpen}
        item={editItem}
        categories={settings.categories}
        members={settings.members}
        onClose={() => { setAddOpen(false); setEditItem(null); setEditId(null); }}
        onSave={handleSave}
        permission={permission}
        requestPermission={requestPermission}
      />

      {/* Detail */}
      <DetailDialog
        item={detailItem}
        members={settings.members}
        onClose={() => setDetailItem(null)}
        onEdit={() => detailItem && openEdit(detailItem)}
        onDelete={() => detailItem && setDeleteTarget(detailItem)}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete item?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{deleteTarget?.type} — {deleteTarget?.provider}</strong>. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FeaturePageShell>
  );
}
