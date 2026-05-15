import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import DocumentScannerSheet from "@/components/DocumentScannerSheet";
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
  // ── Additional tile icons
  Droplets,
  Flame,
  Thermometer,
  Router,
  Monitor,
  Smartphone,
  Shield,
  ShieldCheck,
  Lock,
  Umbrella,
  CreditCard,
  PiggyBank,
  Wallet,
  Banknote,
  Receipt,
  Key,
  DoorOpen,
  Sofa,
  Bed,
  Plane,
  Train,
  Bus,
  Bike,
  Dog,
  Cat,
  Bird,
  Fish,
  Tv,
  Film,
  Music,
  Headphones,
  Gamepad2,
  Activity,
  Stethoscope,
  Pill,
  ShoppingCart,
  Coffee,
  TreePine,
  Sun,
  Cloud,
  Dumbbell,
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
import { useAppUsers } from "@/hooks/useAppUsers";

// ─── Tile background catalogue ────────────────────────────────────────────────

interface TileBgDef {
  label: string;
  gradient: string;   // CSS background value
  dark?: boolean;     // true → white text on tile
}

const TILE_BACKGROUNDS: Record<string, TileBgDef> = {
  // ── Utilities / services (soft pastels)
  water:       { label: "Water",         gradient: "linear-gradient(135deg,#e0f2fe 0%,#bae6fd 60%,#e0f2fe 100%)" },
  gas:         { label: "Gas",           gradient: "linear-gradient(135deg,#fef9c3 0%,#fde68a 60%,#fef9c3 100%)" },
  electricity: { label: "Electric",      gradient: "linear-gradient(135deg,#eef2ff 0%,#c7d2fe 60%,#eef2ff 100%)" },
  internet:    { label: "Broadband",     gradient: "linear-gradient(135deg,#f0fdfa 0%,#99f6e4 60%,#f0fdfa 100%)" },
  phone:       { label: "Phone",         gradient: "linear-gradient(135deg,#f0f9ff 0%,#bae6fd 60%,#f0f9ff 100%)" },
  mobile:      { label: "Mobile",        gradient: "linear-gradient(135deg,#fdf4ff 0%,#e9d5ff 60%,#fdf4ff 100%)" },
  email:       { label: "Email",         gradient: "linear-gradient(135deg,#f8fafc 0%,#cbd5e1 60%,#f8fafc 100%)" },
  // ── Insurance / protection
  insurance:   { label: "Insurance",     gradient: "linear-gradient(135deg,#eff6ff 0%,#bfdbfe 60%,#eff6ff 100%)" },
  fire:        { label: "Fire / Home",   gradient: "linear-gradient(135deg,#fff7ed 0%,#fdba74 60%,#fff7ed 100%)" },
  life:        { label: "Life",          gradient: "linear-gradient(135deg,#fdf2f8 0%,#fbcfe8 60%,#fdf2f8 100%)" },
  health:      { label: "Health",        gradient: "linear-gradient(135deg,#ecfdf5 0%,#86efac 60%,#ecfdf5 100%)" },
  // ── Entertainment / subscriptions
  streaming:   { label: "Streaming",     gradient: "linear-gradient(135deg,#1e1b4b 0%,#3730a3 60%,#1e1b4b 100%)", dark: true },
  tv:          { label: "TV",            gradient: "linear-gradient(135deg,#0f172a 0%,#1e293b 60%,#334155 100%)", dark: true },
  amazon:      { label: "Amazon Prime",  gradient: "linear-gradient(135deg,#082f49 0%,#0c4a6e 60%,#082f49 100%)", dark: true },
  // ── Travel
  travel:      { label: "Travel",        gradient: "linear-gradient(135deg,#ecfdf5 0%,#6ee7b7 60%,#ecfdf5 100%)" },
  flights:     { label: "Flights",       gradient: "linear-gradient(160deg,#e0f2fe 0%,#7dd3fc 50%,#e0f2fe 100%)" },
  // ── Vehicles
  car:         { label: "Car",           gradient: "linear-gradient(135deg,#f1f5f9 0%,#94a3b8 60%,#f1f5f9 100%)" },
  // ── Pets / dogs
  pets:        { label: "Pets",          gradient: "linear-gradient(135deg,#fffbeb 0%,#fde68a 60%,#fffbeb 100%)" },
  dogs:        { label: "Dogs",          gradient: "linear-gradient(135deg,#fef3c7 0%,#d97706 40%,#fef3c7 100%)" },
  // ── Home / finance
  home:        { label: "Home",          gradient: "linear-gradient(135deg,#fffbf7 0%,#fed7aa 60%,#fffbf7 100%)" },
  mortgage:    { label: "Mortgage",      gradient: "linear-gradient(135deg,#f0fdf4 0%,#86efac 60%,#f0fdf4 100%)" },
  council:     { label: "Council Tax",   gradient: "linear-gradient(135deg,#f5f3ff 0%,#c4b5fd 60%,#f5f3ff 100%)" },
  finance:     { label: "Finance",       gradient: "linear-gradient(135deg,#fffbeb 0%,#fef08a 60%,#fffbeb 100%)" },
  // ── Vivid accent (dark)
  ocean:       { label: "Ocean",         gradient: "linear-gradient(160deg,#0369a1 0%,#0ea5e9 50%,#0369a1 100%)", dark: true },
  forest:      { label: "Forest",        gradient: "linear-gradient(160deg,#14532d 0%,#16a34a 50%,#14532d 100%)", dark: true },
  slate:       { label: "Slate",         gradient: "linear-gradient(160deg,#1e293b 0%,#475569 50%,#1e293b 100%)", dark: true },
  rose:        { label: "Rose",          gradient: "linear-gradient(160deg,#9f1239 0%,#e11d48 50%,#9f1239 100%)", dark: true },
  arctic:      { label: "Arctic",        gradient: "linear-gradient(135deg,#f0f9ff 0%,#e0f2fe 50%,#bfdbfe 100%)" },
  stone:       { label: "Stone",         gradient: "linear-gradient(135deg,#fafaf9 0%,#e7e5e4 60%,#fafaf9 100%)" },
  night:       { label: "Night",         gradient: "linear-gradient(160deg,#020617 0%,#0f172a 50%,#1e1b4b 100%)", dark: true },
  neutral:     { label: "Plain",         gradient: "" },

  // ── 20 extra styles ──────────────────────────────────────────────────────────
  coral:       { label: "Coral",         gradient: "radial-gradient(ellipse at top left,#fecdd3 0%,#fda4af 50%,#fb7185 100%)" },
  mint:        { label: "Mint",          gradient: "linear-gradient(135deg,#d1fae5 0%,#6ee7b7 50%,#34d399 100%)" },
  lavender:    { label: "Lavender",      gradient: "linear-gradient(150deg,#ede9fe 0%,#ddd6fe 50%,#c4b5fd 100%)" },
  sunset:      { label: "Sunset",        gradient: "linear-gradient(135deg,#f97316 0%,#ec4899 50%,#8b5cf6 100%)", dark: true },
  dawn:        { label: "Dawn",          gradient: "linear-gradient(160deg,#fff1f2 0%,#ffe4e6 40%,#fecdd3 100%)" },
  steel:       { label: "Steel",         gradient: "linear-gradient(135deg,#94a3b8 0%,#64748b 60%,#475569 100%)", dark: true },
  cobalt:      { label: "Cobalt",        gradient: "linear-gradient(135deg,#1d4ed8 0%,#3b82f6 60%,#1d4ed8 100%)", dark: true },
  amber:       { label: "Amber",         gradient: "linear-gradient(135deg,#92400e 0%,#d97706 60%,#f59e0b 100%)", dark: true },
  crimson:     { label: "Crimson",       gradient: "linear-gradient(135deg,#7f1d1d 0%,#b91c1c 60%,#ef4444 100%)", dark: true },
  teal:        { label: "Teal",          gradient: "linear-gradient(135deg,#134e4a 0%,#0d9488 60%,#2dd4bf 100%)", dark: true },
  sage:        { label: "Sage",          gradient: "linear-gradient(135deg,#ecfdf5 0%,#d1fae5 40%,#a7f3d0 100%)" },
  sand:        { label: "Sand",          gradient: "linear-gradient(135deg,#fef9c3 0%,#fef3c7 50%,#fde68a 100%)" },
  plum:        { label: "Plum",          gradient: "linear-gradient(135deg,#4a044e 0%,#7e22ce 60%,#a855f7 100%)", dark: true },
  copper:      { label: "Copper",        gradient: "linear-gradient(135deg,#92400e 0%,#b45309 40%,#d97706 80%,#92400e 100%)", dark: true },
  navy:        { label: "Navy",          gradient: "linear-gradient(160deg,#172554 0%,#1e3a8a 50%,#1d4ed8 100%)", dark: true },
  jade:        { label: "Jade",          gradient: "linear-gradient(135deg,#052e16 0%,#14532d 50%,#166534 100%)", dark: true },
  dusk:        { label: "Dusk",          gradient: "linear-gradient(160deg,#312e81 0%,#4c1d95 40%,#1e1b4b 100%)", dark: true },
  gold:        { label: "Gold",          gradient: "linear-gradient(135deg,#78350f 0%,#d97706 40%,#fbbf24 70%,#d97706 100%)", dark: true },
  storm:       { label: "Storm",         gradient: "linear-gradient(160deg,#1e293b 0%,#334155 50%,#475569 100%)", dark: true },
  blush:       { label: "Blush",         gradient: "radial-gradient(ellipse at bottom right,#fce7f3 0%,#fbcfe8 50%,#f9a8d4 100%)" },
};

// ─── Tile icon catalogue ───────────────────────────────────────────────────────

interface TileIconDef {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TILE_ICONS: Record<string, TileIconDef> = {
  // Utilities
  droplets:     { label: "Water",        icon: Droplets },
  flame:        { label: "Gas / Fire",   icon: Flame },
  zap:          { label: "Electricity",  icon: Zap },
  thermometer:  { label: "Heating",      icon: Thermometer },
  // Internet / Tech
  wifi:         { label: "Wi-Fi",        icon: Wifi },
  router:       { label: "Broadband",    icon: Router },
  monitor:      { label: "Monitor",      icon: Monitor },
  smartphone:   { label: "Mobile",       icon: Smartphone },
  phone_icon:   { label: "Phone",        icon: Phone },
  // Insurance / Protection
  shield:       { label: "Insurance",    icon: Shield },
  shield_check: { label: "Protected",    icon: ShieldCheck },
  lock:         { label: "Security",     icon: Lock },
  umbrella:     { label: "Cover",        icon: Umbrella },
  // Finance
  credit_card:  { label: "Card",         icon: CreditCard },
  piggy_bank:   { label: "Savings",      icon: PiggyBank },
  wallet:       { label: "Wallet",       icon: Wallet },
  banknote:     { label: "Cash",         icon: Banknote },
  receipt:      { label: "Bills",        icon: Receipt },
  landmark:     { label: "Bank",         icon: Landmark },
  trending_up:  { label: "Investments",  icon: TrendingUp },
  // Home
  home_icon:    { label: "Home",         icon: Home },
  key:          { label: "Keys",         icon: Key },
  door:         { label: "Entry",        icon: DoorOpen },
  sofa:         { label: "Living Room",  icon: Sofa },
  bed:          { label: "Bedroom",      icon: Bed },
  building:     { label: "Building",     icon: Building2 },
  // Travel / Transport
  plane:        { label: "Flights",      icon: Plane },
  car_icon:     { label: "Car",          icon: Car },
  train:        { label: "Train",        icon: Train },
  bus:          { label: "Bus",          icon: Bus },
  bike:         { label: "Cycling",      icon: Bike },
  // Pets
  paw:          { label: "Pets",         icon: PawPrint },
  dog:          { label: "Dog",          icon: Dog },
  cat:          { label: "Cat",          icon: Cat },
  bird:         { label: "Bird",         icon: Bird },
  fish:         { label: "Fish",         icon: Fish },
  // Entertainment
  tv:           { label: "TV",           icon: Tv },
  film:         { label: "Films",        icon: Film },
  music:        { label: "Music",        icon: Music },
  headphones:   { label: "Audio",        icon: Headphones },
  gamepad:      { label: "Gaming",       icon: Gamepad2 },
  package_icon: { label: "Subscriptions",icon: Package },
  // Health / Life
  heart:        { label: "Health / Life",icon: Heart },
  activity:     { label: "Activity",     icon: Activity },
  stethoscope:  { label: "Medical",      icon: Stethoscope },
  pill:         { label: "Medication",   icon: Pill },
  dumbbell:     { label: "Fitness",      icon: Dumbbell },
  // Shopping / Lifestyle
  shopping:     { label: "Shopping",     icon: ShoppingCart },
  coffee:       { label: "Coffee",       icon: Coffee },
  // Nature / Environment
  tree:         { label: "Garden",       icon: TreePine },
  sun:          { label: "Solar",        icon: Sun },
  cloud:        { label: "Cloud",        icon: Cloud },
};

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

function formatDaysLeft(days: number): string {
  if (days <= 30) return `${days}d`;
  const years  = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  const rem    = days % 30;
  const parts: string[] = [];
  if (years  > 0) parts.push(`${years}y`);
  if (months > 0) parts.push(`${months}mo`);
  if (rem    > 0) parts.push(`${rem}d`);
  return parts.join(" ");
}

function RenewalBadge({ days }: { days: number | null }) {
  if (days === null) return null;
  if (days < 0)
    return <span className="text-xs font-medium text-red-500">Expired</span>;
  if (days <= 7)
    return <span className="text-xs font-semibold text-red-500">{formatDaysLeft(days)} left</span>;
  if (days <= 30)
    return <span className="text-xs font-medium text-amber-500">{formatDaysLeft(days)} left</span>;
  return <span className="text-xs text-muted-foreground">{formatDaysLeft(days)} left</span>;
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
  // Raw text as the user types — kept in sync with value prop
  const [text, setText] = useState(() => {
    if (!value) return "";
    const p = parse(value, "yyyy-MM-dd", new Date());
    return isValid(p) ? format(p, "dd/MM/yyyy") : value;
  });

  const parsed = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
  const valid = parsed && isValid(parsed);

  // When the parent value changes externally (e.g. calendar pick), sync text
  const prevValue = useRef(value);
  if (prevValue.current !== value) {
    prevValue.current = value;
    const p = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
    setText(p && isValid(p) ? format(p, "dd/MM/yyyy") : "");
  }

  const handleTextChange = (raw: string) => {
    setText(raw);
    // Accept dd/MM/yyyy, d/M/yyyy, dd-MM-yyyy, and plain YYYY-MM-DD
    const formats = ["dd/MM/yyyy", "d/M/yyyy", "dd-MM-yyyy", "d-M-yyyy", "yyyy-MM-dd"];
    for (const fmt of formats) {
      const p = parse(raw, fmt, new Date());
      if (isValid(p)) {
        onChange(format(p, "yyyy-MM-dd"));
        return;
      }
    }
    // If cleared, reset value
    if (!raw.trim()) onChange("");
  };

  const handleTextBlur = () => {
    // Re-format to dd/MM/yyyy on blur if we have a valid date
    if (valid) setText(format(parsed!, "dd/MM/yyyy"));
    else if (!text.trim()) setText("");
  };

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-1.5">
        {/* Typed input */}
        <input
          type="text"
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onBlur={handleTextBlur}
          placeholder="dd/mm/yyyy"
          className="flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 transition-colors"
        />
        {/* Calendar picker button */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              title="Pick from calendar"
              className={`flex items-center justify-center w-10 h-10 rounded-xl border border-input bg-background hover:bg-accent transition-colors shrink-0 ${valid ? "text-primary" : "text-muted-foreground"}`}
            >
              <CalendarIcon className="w-4 h-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-0"
            align="end"
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
  const { icon: CategoryIcon, color } = getCategoryMeta(item.type);
  const days = daysUntil(item.endDate);
  const costStr = formatCost(item.costAmount, item.costPeriod, item.costPeriodCustom)
    ?? (item.monthlyPremium != null ? `£${item.monthlyPremium}/mo` : null);

  const bg = item.tileBg ? TILE_BACKGROUNDS[item.tileBg] : null;
  const isDark = bg?.dark ?? false;

  // Resolve the icon: custom selection → category default
  const iconDef = item.tileIcon ? TILE_ICONS[item.tileIcon] : null;
  const TileIcon = iconDef?.icon ?? CategoryIcon;

  const iconBg = isDark ? "bg-white/15" : color;
  const iconColor = isDark ? "text-white" : "";

  return (
    <div className="relative group h-full">
      <button
        onClick={onOpen}
        className="w-full h-full text-left rounded-2xl border p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden min-h-[10rem]"
        style={bg?.gradient ? { background: bg.gradient } : undefined}
      >
        {/* Icon badge — always same size */}
        <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${iconBg}`}>
          <TileIcon className={`w-5 h-5 ${iconColor}`} />
        </div>

        {/* Main content — grows to fill available space */}
        <div className="flex-1 flex flex-col gap-0.5 mt-2 min-w-0">
          <div className={`font-medium text-sm leading-snug line-clamp-2 ${isDark ? "text-white" : ""}`}>
            {item.type}
          </div>
          <div className={`text-xs truncate ${isDark ? "text-white/70" : "text-muted-foreground"}`}>
            {item.provider}
          </div>
        </div>

        {/* Footer — always at bottom */}
        <div className="flex flex-col gap-1 mt-2 shrink-0">
          {costStr && (
            <div className={`text-xs font-semibold ${isDark ? "text-white/90" : ""}`}>{costStr}</div>
          )}
          <RenewalBadge days={days} />
        </div>

        {/* Floating micro-indicators */}
        {item.pushEnabled && (
          <Bell className={`w-3 h-3 absolute bottom-3 right-3 ${isDark ? "text-white/40" : "text-muted-foreground"}`} />
        )}
        {(item.history?.length ?? 0) > 0 && (
          <History className={`w-3 h-3 absolute bottom-3 ${item.pushEnabled ? "right-7" : "right-3"} ${isDark ? "text-white/40" : "text-muted-foreground"}`} />
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
  tileBg: "",
  tileIcon: "",
  carReg: "",
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
  const [scannerFile, setScannerFile] = useState<File | null>(null);
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

          {/* Car registration — shown for car-related types */}
          {(form.type === "Car Insurance" || form.type.toLowerCase().includes("car tax") || form.type.toLowerCase().includes("vehicle")) && (
            <div className="space-y-1.5">
              <Label>Car Registration</Label>
              <Input
                value={form.carReg ?? ""}
                onChange={(e) => set("carReg", e.target.value.toUpperCase())}
                placeholder="e.g. AB12 CDE"
                className="uppercase tracking-widest font-mono"
              />
            </div>
          )}

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

          {/* Dates — stacked to avoid calendar popover overlap */}
          <div className="grid grid-cols-1 gap-3">
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

          {/* Tile Icon */}
          <div className="space-y-2">
            <Label>Tile Icon</Label>
            <div className="grid grid-cols-8 gap-1.5">
              {/* "Auto" slot — uses category default */}
              <button
                type="button"
                title="Auto (category default)"
                onClick={() => set("tileIcon", "")}
                className={`h-9 w-full rounded-lg border-2 bg-card flex items-center justify-center transition-all ${
                  !form.tileIcon ? "border-primary shadow-md" : "border-muted hover:border-primary/40"
                }`}
              >
                <Settings className="w-4 h-4 text-muted-foreground" />
              </button>
              {Object.entries(TILE_ICONS).map(([key, def]) => {
                const IconEl = def.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    title={def.label}
                    onClick={() => set("tileIcon", form.tileIcon === key ? "" : key)}
                    className={`h-9 w-full rounded-lg border-2 bg-card flex items-center justify-center transition-all ${
                      form.tileIcon === key
                        ? "border-primary shadow-md bg-primary/5"
                        : "border-transparent hover:border-primary/40"
                    }`}
                  >
                    <IconEl className="w-4 h-4 text-foreground" />
                  </button>
                );
              })}
            </div>
            {form.tileIcon && TILE_ICONS[form.tileIcon] && (
              <p className="text-[10px] text-muted-foreground">{TILE_ICONS[form.tileIcon].label}</p>
            )}
          </div>

          {/* Tile Background */}
          <div className="space-y-2">
            <Label>Tile Background</Label>
            <div className="grid grid-cols-6 gap-1.5">
              {/* "None" swatch */}
              <button
                type="button"
                title="None"
                onClick={() => set("tileBg", "")}
                className={`h-8 rounded-lg border-2 bg-card transition-all ${
                  !form.tileBg ? "border-primary scale-105 shadow-md" : "border-muted hover:border-primary/40"
                }`}
              />
              {Object.entries(TILE_BACKGROUNDS).map(([key, bgDef]) => (
                <button
                  key={key}
                  type="button"
                  title={bgDef.label}
                  onClick={() => set("tileBg", form.tileBg === key ? "" : key)}
                  style={{ background: bgDef.gradient }}
                  className={`h-8 rounded-lg border-2 transition-all ${
                    form.tileBg === key
                      ? "border-primary scale-105 shadow-md"
                      : "border-transparent hover:border-primary/40"
                  }`}
                />
              ))}
            </div>
            {form.tileBg && TILE_BACKGROUNDS[form.tileBg] && (
              <p className="text-[10px] text-muted-foreground">{TILE_BACKGROUNDS[form.tileBg].label}</p>
            )}
          </div>

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
              {/* Camera capture — rear camera, routed through document scanner */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  e.target.value = "";
                  setScannerFile(file);
                }}
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

            {/* Document scanner — shown when a camera image is captured */}
            <DocumentScannerSheet
              imageFile={scannerFile}
              onConfirm={async (scannedFile) => {
                setScannerFile(null);
                await handleFileUpload(
                  (() => {
                    const dt = new DataTransfer();
                    dt.items.add(scannedFile);
                    return dt.files;
                  })()
                );
              }}
              onCancel={() => setScannerFile(null)}
            />

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

function SettingsSheet({ open, onClose, settings, onSave, appUsers }: {
  open: boolean;
  onClose: () => void;
  settings: HouseholdSettings;
  onSave: (s: HouseholdSettings) => void;
  appUsers: { id: string; name: string; email: string }[];
}) {
  const [members, setMembers] = useState<HouseholdMember[]>(settings.members);
  const [categories, setCategories] = useState<string[]>(settings.categories);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("👤");
  const [newCat, setNewCat] = useState("");
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);
  const memberInputRef = useRef<HTMLInputElement>(null);
  const memberContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMembers(settings.members);
    setCategories(settings.categories);
  }, [settings, open]);

  // Close member dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!memberContainerRef.current?.contains(e.target as Node)) setMemberDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const save = (m: HouseholdMember[], c: string[]) => onSave({ members: m, categories: c });

  // Filtered app users: those not already added as members
  const filteredAppUsers = appUsers.filter(
    (u) => !members.some((m) => m.userId === u.id || m.name.toLowerCase() === u.name.toLowerCase())
  ).filter((u) => !newName || u.name.toLowerCase().includes(newName.toLowerCase()) || u.email.toLowerCase().includes(newName.toLowerCase()));

  const showManualAdd = newName.trim() && !appUsers.some((u) => u.name.toLowerCase() === newName.trim().toLowerCase());

  const addAppUser = (appUser: { id: string; name: string; email: string }) => {
    const next = [...members, { id: crypto.randomUUID(), name: appUser.name, role: "member" as const, emoji: "👤", userId: appUser.id }];
    setMembers(next); save(next, categories); setNewName(""); setMemberDropdownOpen(false);
  };

  const addManualMember = () => {
    if (!newName.trim()) return;
    const next = [...members, { id: crypto.randomUUID(), name: newName.trim(), role: "member" as const, emoji: newEmoji }];
    setMembers(next); save(next, categories); setNewName(""); setNewEmoji("👤");
    setMemberDropdownOpen(false);
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

            {/* Add member — app user or manual */}
            <div ref={memberContainerRef} className="relative pt-1">
              <div className="flex gap-2">
                <div className="w-10 h-10 rounded-xl border bg-background flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
                  <Input
                    className="w-full h-full border-0 text-center text-xl p-0 bg-transparent focus-visible:ring-0 shadow-none"
                    value={newEmoji}
                    onChange={(e) => setNewEmoji(e.target.value)}
                    placeholder="👤"
                  />
                </div>
                <Input
                  ref={memberInputRef}
                  className="flex-1 rounded-xl"
                  placeholder="Search app users or type a name…"
                  value={newName}
                  onChange={(e) => { setNewName(e.target.value); setMemberDropdownOpen(true); }}
                  onFocus={() => setMemberDropdownOpen(true)}
                  onKeyDown={(e) => e.key === "Enter" && showManualAdd && addManualMember()}
                />
                <Button
                  onClick={addManualMember}
                  disabled={!newName.trim()}
                  size="sm"
                  className="rounded-xl px-3 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {/* Dropdown */}
              {memberDropdownOpen && (filteredAppUsers.length > 0 || showManualAdd) && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border bg-popover shadow-lg z-50 overflow-hidden max-h-48 overflow-y-auto">
                  {filteredAppUsers.length > 0 && (
                    <>
                      <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">App Users</p>
                      {filteredAppUsers.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); addAppUser(u); }}
                          className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors flex items-center gap-2"
                        >
                          <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">{u.name.charAt(0)}</span>
                          <div className="min-w-0">
                            <p className="font-medium text-card-foreground truncate">{u.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                  {showManualAdd && (
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); addManualMember(); }}
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors flex items-center gap-2 text-primary border-t border-border/40"
                    >
                      <Plus className="w-3.5 h-3.5 shrink-0" />
                      <span>Add <span className="font-semibold">"{newName.trim()}"</span> manually</span>
                    </button>
                  )}
                </div>
              )}
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
            {item.carReg && <Row label="Reg" value={<span className="font-mono tracking-widest uppercase">{item.carReg}</span>} />}
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
                      {h.carReg && <div>Reg: {h.carReg}</div>}
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
  const appUsers = useAppUsers();

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
    <FeaturePageShell title={profile?.householdIds?.[0] || profile?.householdId || "Household"} subtitle="Manage household items, policies & renewals">
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-stretch">
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-stretch">
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
        appUsers={appUsers}
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
