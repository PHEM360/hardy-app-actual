import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
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
  Trash2,
  Bell,
  BellOff,
  Pencil,
  X,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  History,
  TrendingUp,
  CalendarIcon,
  Paperclip,
  Camera,
  FileText,
  Loader2,
} from "lucide-react";
import { format, parse, isValid } from "date-fns";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage, auth } from "@/lib/firebase";
import {
  HouseholdItem,
  HouseholdHistoryEntry,
  HouseholdMember,
  HouseholdSettings,
  HouseholdReminder,
  CostPeriod,
} from "@/types/app";
import { useHouseholdItems, useHouseholdSettings } from "@/hooks/useHousehold";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAuth } from "@/auth/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";

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

// ─── Cost helpers ──────────────────────────────────────────────────────────────

const PERIOD_OPTIONS: { value: CostPeriod; label: string }[] = [
  { value: "days",    label: "per day" },
  { value: "weeks",   label: "per week" },
  { value: "months",  label: "per month" },
  { value: "years",   label: "per year" },
  { value: "one-off", label: "one-off" },
  { value: "other",   label: "other…" },
];

function toMonthly(amount?: number, period?: CostPeriod): number | null {
  if (!amount || !period) return null;
  switch (period) {
    case "days":    return (amount * 365) / 12;
    case "weeks":   return (amount * 52) / 12;
    case "months":  return amount;
    case "years":   return amount / 12;
    default:        return null;
  }
}

function formatCost(amount?: number, period?: CostPeriod, custom?: string) {
  if (!amount) return null;
  const label = period === "other"
    ? (custom || "other")
    : PERIOD_OPTIONS.find((p) => p.value === period)?.label ?? "";
  return `£${amount.toFixed(2)} ${label}`.trim();
}

// ─── Date picker ───────────────────────────────────────────────────────────────

function DatePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string; // "YYYY-MM-DD" or ""
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const parsed = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
  const valid = parsed && isValid(parsed);

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-left hover:bg-accent transition-colors"
          >
            <CalendarIcon className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className={valid ? "text-foreground" : "text-muted-foreground"}>
              {valid ? format(parsed!, "d MMM yyyy") : "Pick a date…"}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0"
          align="start"
          side="bottom"
          avoidCollisions={false}
          sticky="always"
        >
          <Calendar
            mode="single"
            selected={valid ? parsed : undefined}
            onSelect={(d) => {
              onChange(d ? format(d, "yyyy-MM-dd") : "");
              setOpen(false);
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ─── Sanitise form before Firestore write ─────────────────────────────────────

function sanitiseForFirestore(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;           // Firestore rejects undefined
    if (Array.isArray(v)) {
      out[k] = v.map((el) =>
        el && typeof el === "object" ? sanitiseForFirestore(el as Record<string, unknown>) : el
      );
    } else if (v && typeof v === "object" && !(v instanceof Date)) {
      out[k] = sanitiseForFirestore(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
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
  const costStr = formatCost(item.costAmount, item.costPeriod, item.costPeriodCustom)
    ?? (item.monthlyPremium != null ? `£${item.monthlyPremium}/mo` : null);

  return (
    <div className="relative group">
      <button
        onClick={onOpen}
        className="w-full text-left rounded-2xl border bg-card p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-2"
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="font-medium text-sm leading-tight">{item.type}</div>
        <div className="text-xs text-muted-foreground truncate">{item.provider}</div>
        {costStr && <div className="text-xs font-semibold">{costStr}</div>}
        <RenewalBadge days={days} />
        {item.pushEnabled && (
          <Bell className="w-3 h-3 text-muted-foreground absolute bottom-3 right-3" />
        )}
        {(item.history?.length ?? 0) > 0 && (
          <History className="w-3 h-3 text-muted-foreground absolute bottom-3 left-3" />
        )}
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
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
      className="rounded-2xl border-2 border-dashed border-muted p-6 flex flex-col items-center gap-2
                 text-muted-foreground hover:border-primary hover:text-primary transition-colors w-full"
    >
      <Plus className="w-6 h-6" />
      <span className="text-sm">{label}</span>
    </button>
  );
}

// ─── Add / Edit dialog ─────────────────────────────────────────────────────────

const REMINDER_UNITS: HouseholdReminder["unit"][] = ["hours", "days", "weeks", "months"];

const getBlankForm = (): Omit<HouseholdItem, "id" | "createdAt"> => ({
  type: "",
  provider: "",
  policyNumber: "",
  costAmount: undefined,
  costPeriod: "months",
  costPeriodCustom: "",
  startDate: "",
  endDate: "",
  assignedTo: "",
  notes: "",
  pushEnabled: false,
  reminders: [{ amount: 7, unit: "days", via: "push" }],
  history: [],
});

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
  const [form, setForm] = useState<Omit<HouseholdItem, "id" | "createdAt">>(getBlankForm());
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (item) {
      const migrated = { ...item };
      if (!migrated.costAmount && migrated.monthlyPremium != null) {
        migrated.costAmount = migrated.monthlyPremium;
        migrated.costPeriod = "months";
      }
      migrated.costPeriod = migrated.costPeriod ?? "months";
      setForm(migrated);
    } else {
      setForm(getBlankForm());
    }
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

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const path = `household/${uid}/${Date.now()}_${file.name}`;
        const r = storageRef(storage, path);
        await uploadBytes(r, file);
        urls.push(await getDownloadURL(r));
      }
      set("documents", [...(form.documents ?? []), ...urls]);
    } finally {
      setUploading(false);
    }
  };

  const removeDocument = (url: string) => {
    set("documents", (form.documents ?? []).filter((u) => u !== url));
  };

  const handleSave = () => {
    const cleaned = sanitiseForFirestore(form as unknown as Record<string, unknown>);
    onSave(cleaned as unknown as Omit<HouseholdItem, "id" | "createdAt">);
  };

  // ── Draggable / resizable panel ──────────────────────────────────────────
  const panelRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startX: number; startY: number; origLeft: number; origTop: number } | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 448, height: 600 });
  const resizeState = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);

  // Centre on first open
  useEffect(() => {
    if (open) {
      setPos({
        left: Math.max(16, (window.innerWidth - size.width) / 2),
        top: Math.max(16, (window.innerHeight - size.height) / 2),
      });
    }
  }, [open]);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    dragState.current = { startX: e.clientX, startY: e.clientY, origLeft: rect.left, origTop: rect.top };
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragState.current) return;
      const dx = e.clientX - dragState.current.startX;
      const dy = e.clientY - dragState.current.startY;
      setPos({
        left: Math.max(0, dragState.current.origLeft + dx),
        top: Math.max(0, dragState.current.origTop + dy),
      });
    };
    const onUp = () => { dragState.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    resizeState.current = { startX: e.clientX, startY: e.clientY, origW: size.width, origH: size.height };
    e.preventDefault();
    e.stopPropagation();
  }, [size]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizeState.current) return;
      const dw = e.clientX - resizeState.current.startX;
      const dh = e.clientY - resizeState.current.startY;
      setSize({
        width: Math.max(320, resizeState.current.origW + dw),
        height: Math.max(300, resizeState.current.origH + dh),
      });
    };
    const onUp = () => { resizeState.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  if (!open) return null;

  return createPortal(
    <>
      {/* Backdrop — clicking it closes, but doesn't block interaction behind */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Floating panel */}
      <div
        ref={panelRef}
        style={{
          position: "fixed",
          left: pos?.left ?? "50%",
          top: pos?.top ?? "50%",
          transform: pos ? "none" : "translate(-50%, -50%)",
          width: size.width,
          height: size.height,
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
        }}
        className="bg-background border rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Drag handle */}
        <div
          className="flex items-center justify-between px-5 py-3.5 border-b cursor-grab active:cursor-grabbing select-none shrink-0 bg-muted/30"
          onMouseDown={onDragStart}
        >
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <div className="w-3 h-3 rounded-full bg-red-400 hover:bg-red-500 cursor-pointer" onClick={onClose} title="Close" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <span className="text-sm font-semibold ml-1">
              {item?.provider ? "Edit Item" : "Add Item"}
            </span>
          </div>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Type */}
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

          {/* Provider */}
          <div className="space-y-1.5">
            <Label>Provider</Label>
            <Input value={form.provider} onChange={(e) => set("provider", e.target.value)} placeholder="e.g. Aviva, British Gas…" />
          </div>

          {/* Policy number */}
          <div className="space-y-1.5">
            <Label>Policy / Account Number</Label>
            <Input value={form.policyNumber ?? ""} onChange={(e) => set("policyNumber", e.target.value)} placeholder="Optional" />
          </div>

          {/* Cost */}
          <div className="space-y-1.5">
            <Label>Cost</Label>
            <div className="flex gap-2">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">£</span>
                <Input
                  type="number" min={0} step={0.01}
                  className="pl-7 w-28"
                  value={form.costAmount ?? ""}
                  onChange={(e) => set("costAmount", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                  placeholder="0.00"
                />
              </div>
              <Select value={form.costPeriod ?? "months"} onValueChange={(v) => set("costPeriod", v as CostPeriod)}>
                <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.costPeriod === "other" && (
              <Input
                className="mt-2"
                value={form.costPeriodCustom ?? ""}
                onChange={(e) => set("costPeriodCustom", e.target.value)}
                placeholder="Describe the billing period…"
              />
            )}
          </div>

          {/* Dates — stacked on mobile, side-by-side on sm+ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DatePicker
              label="Start Date"
              value={form.startDate ?? ""}
              onChange={(v) => set("startDate", v)}
            />
            <DatePicker
              label="Renewal / End Date"
              value={form.endDate ?? ""}
              onChange={(v) => set("endDate", v)}
            />
          </div>

          {/* Assign to */}
          {members.length > 0 && (
            <div className="space-y-1.5">
              <Label>Assign To</Label>
              <Select value={form.assignedTo || "none"} onValueChange={(v) => set("assignedTo", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Nobody (shared)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nobody (shared)</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.emoji ? `${m.emoji} ` : ""}{m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} placeholder="Optional" />
          </div>

          {/* Documents */}
          <div className="space-y-2">
            <Label>Documents / Photos</Label>
            <div className="flex gap-2">
              {/* File picker */}
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
              {/* Camera capture */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl flex-1 gap-1.5"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                Attach File
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl flex-1 gap-1.5"
                onClick={() => cameraInputRef.current?.click()}
                disabled={uploading}
              >
                <Camera className="w-4 h-4" />
                Take Photo
              </Button>
            </div>

            {/* Existing documents */}
            {(form.documents ?? []).length > 0 && (
              <div className="space-y-1.5">
                {(form.documents ?? []).map((url, i) => {
                  const isPdf = url.toLowerCase().includes(".pdf") || url.toLowerCase().includes("application%2Fpdf");
                  const name = decodeURIComponent(url.split("/").pop()?.split("?")[0] ?? `File ${i + 1}`).replace(/^\d+_/, "");
                  return (
                    <div key={url} className="flex items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2 text-sm">
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      <a href={url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-primary underline-offset-2 hover:underline">
                        {name}
                      </a>
                      <button onClick={() => removeDocument(url)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Reminders */}
          <div className="rounded-xl border p-4 space-y-3">
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
                  {REMINDER_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
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

        {/* Footer */}
        <div className="flex gap-2 px-5 py-3.5 border-t shrink-0 bg-muted/20">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 rounded-xl" onClick={handleSave} disabled={!form.type || !form.provider || uploading}>
            {uploading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Uploading…</> : "Save"}
          </Button>
        </div>

        {/* Resize handle */}
        <div
          className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize"
          onMouseDown={onResizeStart}
          style={{ zIndex: 10 }}
        >
          <svg viewBox="0 0 10 10" className="w-4 h-4 absolute bottom-1 right-1 text-muted-foreground/50">
            <path d="M0 10 L10 0 M5 10 L10 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
      </div>
    </>,
    document.body
  );
}

// ─── Settings sheet ────────────────────────────────────────────────────────────

function SettingsSheet({ open, onClose, settings, onSave }: {
  open: boolean;
  onClose: () => void;
  settings: HouseholdSettings;
  onSave: (s: HouseholdSettings) => void;
}) {
  const [members, setMembers] = useState<HouseholdMember[]>(settings.members);
  const [categories, setCategories] = useState<string[]>(settings.categories);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("👤");
  const [newCat, setNewCat] = useState("");

  useEffect(() => {
    setMembers(settings.members);
    setCategories(settings.categories);
  }, [settings, open]);

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
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-lg">Household Settings</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 pt-4">

          {/* ── Members ── */}
          <section className="rounded-2xl border bg-card/50 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm">👥</span>
              </div>
              <h3 className="font-semibold text-sm">Household Members</h3>
            </div>

            {/* Existing members */}
            {members.length > 0 ? (
              <div className="space-y-2">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-2.5 group">
                    <div className="w-9 h-9 rounded-full bg-background border flex items-center justify-center text-lg shrink-0 shadow-sm">
                      {m.emoji ?? "👤"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm leading-tight">{m.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{m.role}</div>
                    </div>
                    <button
                      onClick={() => removeMember(m.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1 rounded-lg hover:bg-destructive/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-2">No members yet</p>
            )}

            {/* Add member row */}
            <div className="flex gap-2 pt-1">
              <div className="w-10 h-10 rounded-xl border bg-background flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
                <Input
                  className="w-full h-full border-0 text-center text-xl p-0 bg-transparent focus-visible:ring-0 shadow-none"
                  value={newEmoji}
                  onChange={(e) => setNewEmoji(e.target.value)}
                  placeholder="👤"
                />
              </div>
              <Input
                className="flex-1 rounded-xl"
                placeholder="Member name…"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addMember()}
              />
              <Button
                onClick={addMember}
                disabled={!newName.trim()}
                size="sm"
                className="rounded-xl px-3 shrink-0"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </section>

          {/* ── Categories ── */}
          <section className="rounded-2xl border bg-card/50 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm">🏷️</span>
              </div>
              <h3 className="font-semibold text-sm">Item Categories</h3>
            </div>

            {/* Category chips */}
            {categories.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <div
                    key={c}
                    className="group flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-sm shadow-sm hover:border-destructive/40 transition-colors"
                  >
                    <span>{c}</span>
                    <button
                      onClick={() => removeCategory(c)}
                      className="text-muted-foreground group-hover:text-destructive transition-colors -mr-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-2">No custom categories yet</p>
            )}

            {/* Add category row */}
            <div className="flex gap-2 pt-1">
              <Input
                className="flex-1 rounded-xl"
                placeholder="New category…"
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCategory()}
              />
              <Button
                onClick={addCategory}
                disabled={!newCat.trim()}
                size="sm"
                className="rounded-xl px-3 shrink-0"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </section>

        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Detail dialog ─────────────────────────────────────────────────────────────

function DetailDialog({
  item,
  members,
  onClose,
  onEdit,
  onDelete,
  onRenew,
}: {
  item: HouseholdItem | null;
  members: HouseholdMember[];
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRenew: () => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const [confirmRenew, setConfirmRenew] = useState(false);

  if (!item) return null;
  const { icon: Icon, color } = getCategoryMeta(item.type);
  const days = daysUntil(item.endDate);
  const assignedMember = members.find((m) => m.id === item.assignedTo);
  const costStr = formatCost(item.costAmount, item.costPeriod, item.costPeriodCustom)
    ?? (item.monthlyPremium != null ? `£${item.monthlyPremium}/mo` : null);

  return (
    <>
      <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${color}`}>
                <Icon className="w-4 h-4" />
              </span>
              {item.type}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <Row label="Provider" value={item.provider} />
            {item.policyNumber && <Row label="Policy #" value={item.policyNumber} />}
            {costStr && <Row label="Cost" value={costStr} />}
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

          {(item.history?.length ?? 0) > 0 && (
            <div className="mt-3 border rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium bg-muted/40 hover:bg-muted/60 transition-colors"
                onClick={() => setShowHistory((s) => !s)}
              >
                <span className="flex items-center gap-2"><History className="w-4 h-4" /> History ({item.history!.length})</span>
                {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showHistory && (
                <div className="divide-y text-xs">
                  {[...item.history!].reverse().map((h, i) => (
                    <div key={i} className="px-4 py-3 space-y-1">
                      <div className="font-medium text-muted-foreground">Archived {h.archivedAt}</div>
                      {h.provider && <div>Provider: {h.provider}</div>}
                      {h.costAmount != null && <div>Cost: {formatCost(h.costAmount, h.costPeriod, h.costPeriodCustom)}</div>}
                      {h.startDate && <div>Start: {h.startDate}</div>}
                      {h.endDate && <div>End: {h.endDate}</div>}
                      {h.policyNumber && <div>Policy: {h.policyNumber}</div>}
                      {h.notes && <div>Notes: {h.notes}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" className="flex-1 rounded-xl" onClick={onEdit}>
              <Pencil className="w-3 h-3 mr-1" /> Edit
            </Button>
            <Button size="sm" className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setConfirmRenew(true)}>
              <RefreshCw className="w-3 h-3 mr-1" /> Renew
            </Button>
            <Button variant="destructive" size="sm" className="rounded-xl" onClick={onDelete}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmRenew} onOpenChange={(o) => !o && setConfirmRenew(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Renew / New Policy?</AlertDialogTitle>
            <AlertDialogDescription>
              The current policy details will be saved to history and you'll be taken to enter the new policy details.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmRenew(false); onRenew(); }}>
              Renew
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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

// ─── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({ items, members }: { items: HouseholdItem[]; members: HouseholdMember[] }) {
  const calc = (subset: HouseholdItem[]) =>
    subset.reduce((sum, item) => {
      const m = toMonthly(item.costAmount, item.costPeriod)
        ?? toMonthly(item.monthlyPremium, "months")
        ?? 0;
      return sum + m;
    }, 0);

  const monthlyTotal = calc(items);
  const yearlyTotal = monthlyTotal * 12;

  if (monthlyTotal === 0) return null;

  const sharedItems = items.filter((i) => !i.assignedTo);
  const sharedMonthly = calc(sharedItems);

  const memberRows = members.map((m) => {
    const mItems = items.filter((i) => i.assignedTo === m.id);
    return { member: m, monthly: calc(mItems) };
  }).filter((r) => r.monthly > 0);

  const recurringCount = items.filter(
    (i) => i.costAmount && i.costPeriod !== "one-off" && i.costPeriod !== "other"
  ).length;

  return (
    <div className="rounded-2xl border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <TrendingUp className="w-4 h-4 text-primary" />
        Expenditure Summary
      </div>

      {/* Per-member breakdown */}
      {(sharedMonthly > 0 || memberRows.length > 0) && (
        <div className="space-y-1.5 border-b border-border/40 pb-3">
          {sharedMonthly > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Shared</span>
              <span className="font-medium">£{sharedMonthly.toFixed(2)}/mo</span>
            </div>
          )}
          {memberRows.map(({ member, monthly }) => (
            <div key={member.id} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{member.emoji ?? "👤"} {member.name}</span>
              <span className="font-medium">£{monthly.toFixed(2)}/mo</span>
            </div>
          ))}
        </div>
      )}

      {/* Grand total */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-0.5">
          <div className="text-xs text-muted-foreground">Total / Month</div>
          <div className="text-xl font-bold">£{monthlyTotal.toFixed(2)}</div>
        </div>
        <div className="space-y-0.5">
          <div className="text-xs text-muted-foreground">Total / Year</div>
          <div className="text-xl font-bold">£{yearlyTotal.toFixed(2)}</div>
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        Based on {recurringCount} recurring item{recurringCount !== 1 ? "s" : ""}
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function Households() {
  const { items, loading, addItem, updateItem, deleteItem } = useHouseholdItems();
  const { settings, saveSettings } = useHouseholdSettings();
  const { permission, requestPermission, checkAndScheduleAll, scheduleReminder } = usePushNotifications();
  const { user } = useAuth();
  const { profile } = useUserProfile();

  // Auto-include the logged-in user in the members list if not already present
  const effectiveMembers: HouseholdMember[] = (() => {
    if (!user) return settings.members;
    const userName = profile?.displayName || profile?.firstName || user.displayName || user.email?.split("@")[0] || "Me";
    const alreadyIn = settings.members.some(
      (m) => m.name.toLowerCase() === userName.toLowerCase()
    );
    if (alreadyIn) return settings.members;
    const selfMember: HouseholdMember = {
      id: user.uid,
      name: userName,
      emoji: profile?.avatarType === "emoji" ? (profile?.avatarEmoji ?? "👤") : "👤",
      role: "member",
    };
    return [selfMember, ...settings.members];
  })();

  const [settingsOpen, setSettingsOpen] = useState(false);
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
    const clean = sanitiseForFirestore(data as unknown as Record<string, unknown>) as Omit<HouseholdItem, "id" | "createdAt">;
    try {
      if (editId) {
        await updateItem(editId, clean);
      } else {
        await addItem(clean);
      }
      if (clean.pushEnabled) scheduleReminder(clean as HouseholdItem);
      setAddOpen(false); setEditItem(null); setEditId(null);
    } catch (err: any) {
      console.error("Save failed", err);
      alert("Failed to save item: " + err.message);
    }
  };

  const handleRenew = async (item: HouseholdItem) => {
    if (!item.id) return;

    const entry: HouseholdHistoryEntry = {
      archivedAt: new Date().toISOString().split("T")[0],
      costAmount: item.costAmount,
      costPeriod: item.costPeriod,
      costPeriodCustom: item.costPeriodCustom,
      startDate: item.startDate,
      endDate: item.endDate,
      provider: item.provider,
      policyNumber: item.policyNumber,
      notes: item.notes,
    };

    const newHistory = [...(item.history ?? []), entry];
    await updateItem(item.id, { history: newHistory });

    const { id, createdAt, ...rest } = item;
    const renewed: Omit<HouseholdItem, "id" | "createdAt"> = {
      ...rest,
      costAmount: undefined,
      costPeriod: "months",
      costPeriodCustom: "",
      startDate: "",
      endDate: "",
      policyNumber: "",
      notes: "",
      history: newHistory,
    };

    setDetailItem(null);
    setEditId(item.id);
    setEditItem(renewed);
    setAddOpen(true);
  };

  const handleDelete = async (item: HouseholdItem) => {
    if (item.id) await deleteItem(item.id);
    setDeleteTarget(null); setDetailItem(null);
  };

  const shared = items.filter((i) => !i.assignedTo);
  const memberItems = (id: string) => items.filter((i) => i.assignedTo === id);

  return (
    <FeaturePageShell title="Household" subtitle="Manage household items, policies & renewals">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button size="sm" className="rounded-full" onClick={openAdd}>
          <Plus className="w-4 h-4 mr-1" /> Add Item
        </Button>
        <Button size="sm" variant="ghost" className="rounded-full gap-1.5" onClick={() => setSettingsOpen(true)}>
          <Settings className="w-4 h-4" />
          <span className="hidden sm:inline">Settings</span>
        </Button>
      </div>

      {/* Items */}
      <div className="space-y-8">
        <section className="space-y-3">
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

        {effectiveMembers.map((m) => (
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

        {items.length > 0 && <SummaryCard items={items} members={effectiveMembers} />}
      </div>

      {/* Settings sheet */}
      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSave={saveSettings}
      />

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
        onRenew={() => detailItem && handleRenew(detailItem)}
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
