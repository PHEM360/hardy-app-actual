import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Building,
  Building2,
  Cable,
  Calculator,
  CalendarDays,
  CheckSquare,
  Heart,
  Images,
  Inbox,
  KeyRound,
  Mail,
  MonitorSmartphone,
  Phone,
  PiggyBank,
  Plane,
  Palmtree,
  Snowflake,
  Sparkles,
  StickyNote,
  Sun,
  Users,
  Wallet,
  Zap,
  AlarmClock,
} from "lucide-react";
import { JEWEL } from "@/lib/brandPalette";

export type HomeLayoutMode = "today" | "tiles";

export interface HomeTileDef {
  id: string;
  label: string;
  route?: string;
  icon: LucideIcon;
  accent: string;
  gradient: string;
}

export type HomeTilesPresetId =
  | "classic"
  | "compact"
  | "magazine"
  | "bento"
  | "river"
  | "spotlight"
  | "orbit"
  | "mosaic";

export const HOME_TILE_PRESETS: { id: HomeTilesPresetId; label: string; hint: string; feel: string }[] = [
  { id: "classic", label: "Quiet rows", hint: "Ink-bar cards on cream — the original Home.", feel: "Simple" },
  { id: "compact", label: "Compact grid", hint: "Flat paper chips, no tint. Three across.", feel: "Simple" },
  { id: "magazine", label: "Magazine", hint: "Warm paper, hero banner, editorial type.", feel: "Polished" },
  { id: "bento", label: "Glass bento", hint: "Cool slate frost and round icons.", feel: "Polished" },
  { id: "river", label: "River", hint: "Teal water wash, pill tiles that float.", feel: "Lively" },
  { id: "spotlight", label: "Spotlight", hint: "Dark stage, one bright hero, dim chorus.", feel: "Lively" },
  { id: "orbit", label: "Orbit", hint: "Night indigo, ringed circular tiles.", feel: "Playful" },
  { id: "mosaic", label: "Mosaic", hint: "Terracotta collage, stamp icons, mixed cuts.", feel: "Playful" },
];

export interface HomeTilesState {
  order: string[];
  hidden: string[];
  rowSizes: number[];
  preset?: HomeTilesPresetId;
}

function jewelFill(from: string, to: string) {
  return `linear-gradient(155deg, color-mix(in oklab, ${from} 78%, #ffffff) 0%, ${from} 42%, ${to} 100%)`;
}

export const HOME_TILES: HomeTileDef[] = [
  { id: "quick_links", label: "Quick Links", icon: Zap, accent: JEWEL.teal, gradient: jewelFill(JEWEL.teal, JEWEL.petrol) },
  { id: "unallocated", label: "Unallocated", route: "/unallocated", icon: Inbox, accent: JEWEL.oxblood, gradient: jewelFill(JEWEL.oxblood, JEWEL.burgundy) },
  { id: "finance", label: "Finance", route: "/finance", icon: PiggyBank, accent: JEWEL.bronze, gradient: jewelFill("#6E4E1A", JEWEL.bronze) },
  { id: "pets", label: "Pets", route: "/pets", icon: Heart, accent: JEWEL.burgundy, gradient: jewelFill(JEWEL.burgundy, JEWEL.plum) },
  { id: "notes", label: "Notes", route: "/notes", icon: StickyNote, accent: JEWEL.bronze, gradient: jewelFill(JEWEL.bronze, "#5C4318") },
  { id: "photos", label: "Photos", route: "/photos", icon: Images, accent: JEWEL.plum, gradient: jewelFill(JEWEL.plum, JEWEL.aubergine) },
  { id: "tasks", label: "Tasks", route: "/tasks", icon: CheckSquare, accent: JEWEL.indigo, gradient: jewelFill(JEWEL.indigo, JEWEL.aubergine) },
  { id: "today", label: "Today", route: "/today", icon: Sun, accent: JEWEL.petrol, gradient: jewelFill(JEWEL.petrol, JEWEL.ink) },
  { id: "calendar", label: "Calendar", route: "/calendar", icon: CalendarDays, accent: JEWEL.cobalt, gradient: jewelFill(JEWEL.cobalt, JEWEL.marine) },
  { id: "alarms", label: "Alarms", route: "/alarms", icon: AlarmClock, accent: JEWEL.bronze, gradient: jewelFill("#5C4318", JEWEL.bronze) },
  { id: "households", label: "Households", route: "/households", icon: Users, accent: JEWEL.marine, gradient: jewelFill(JEWEL.marine, JEWEL.petrol) },
  { id: "hh-finance", label: "HH Finance", route: "/household-finance", icon: Wallet, accent: JEWEL.forest, gradient: jewelFill(JEWEL.forest, "#163828") },
  { id: "companies", label: "Companies", route: "/companies", icon: Building2, accent: JEWEL.slate, gradient: jewelFill(JEWEL.slate, JEWEL.ink) },
  { id: "health", label: "Health", route: "/weight", icon: Activity, accent: JEWEL.forest, gradient: jewelFill("#1F6B4F", JEWEL.forest) },
  { id: "logins", label: "Log Ins", route: "/login-details", icon: KeyRound, accent: JEWEL.aubergine, gradient: jewelFill(JEWEL.aubergine, JEWEL.indigo) },
  { id: "tattersalls", label: "Flats", route: "/tattersalls", icon: Building, accent: JEWEL.marine, gradient: jewelFill(JEWEL.petrol, JEWEL.marine) },
  { id: "freezer", label: "Freezer", route: "/freezer", icon: Snowflake, accent: JEWEL.petrol, gradient: jewelFill("#123E48", JEWEL.petrol) },
  { id: "inheritance", label: "IHT Planner", route: "/inheritance", icon: Calculator, accent: JEWEL.oxblood, gradient: jewelFill(JEWEL.burgundy, JEWEL.oxblood) },
  { id: "leave", label: "Annual Leave", route: "/annual-leave", icon: Plane, accent: JEWEL.cobalt, gradient: jewelFill(JEWEL.marine, JEWEL.cobalt) },
  { id: "holidays", label: "Holidays", route: "/holidays", icon: Palmtree, accent: JEWEL.teal, gradient: jewelFill(JEWEL.teal, JEWEL.forest) },
  { id: "ai", label: "AI Analysis", route: "/ai-analysis", icon: Sparkles, accent: JEWEL.indigo, gradient: jewelFill(JEWEL.aubergine, JEWEL.indigo) },
  { id: "email", label: "Email", route: "/email", icon: Mail, accent: JEWEL.aubergine, gradient: jewelFill(JEWEL.plum, JEWEL.aubergine) },
  { id: "softphone", label: "Phone", route: "/softphone", icon: Phone, accent: JEWEL.forest, gradient: jewelFill(JEWEL.teal, JEWEL.forest) },
  { id: "displays", label: "Displays", route: "/remote-displays", icon: MonitorSmartphone, accent: JEWEL.marine, gradient: jewelFill(JEWEL.cobalt, JEWEL.marine) },
  { id: "connected_devices", label: "Devices", route: "/connected-devices", icon: Cable, accent: JEWEL.teal, gradient: jewelFill(JEWEL.forest, JEWEL.teal) },
];

export const HOME_TILE_BY_ID = Object.fromEntries(HOME_TILES.map((tile) => [tile.id, tile])) as Record<string, HomeTileDef>;

export const DEFAULT_HOME_TILE_ORDER = [
  "quick_links",
  "unallocated",
  "finance",
  "pets",
  "notes",
  "photos",
  "tasks",
  "today",
  "calendar",
  "alarms",
  "households",
  "companies",
  "health",
  "hh-finance",
  "logins",
  "freezer",
  "tattersalls",
  "inheritance",
  "leave",
  "holidays",
  "ai",
  "email",
  "softphone",
  "displays",
  "connected_devices",
];

export const DEFAULT_HOME_ROW_SIZES = [1, 2, 2, 3, 3, 4];

export const DEFAULT_HOME_TILES_STATE: HomeTilesState = {
  order: DEFAULT_HOME_TILE_ORDER,
  hidden: [],
  rowSizes: DEFAULT_HOME_ROW_SIZES,
  preset: "classic",
};

export function normalizeRowSize(value: number): 1 | 2 | 3 | 4 {
  if (value <= 1) return 1;
  if (value === 2) return 2;
  if (value === 3) return 3;
  return 4;
}

export function mergeHomeTilesState(saved?: Partial<HomeTilesState> | null): HomeTilesState {
  const known = new Set(HOME_TILES.map((tile) => tile.id));
  const savedOrder = (saved?.order ?? []).filter((id) => known.has(id));
  const extras = DEFAULT_HOME_TILE_ORDER.filter((id) => !savedOrder.includes(id));
  const preset = HOME_TILE_PRESETS.some((item) => item.id === saved?.preset) ? saved?.preset : "classic";
  return {
    order: [...savedOrder, ...extras],
    hidden: (saved?.hidden ?? []).filter((id) => known.has(id)),
    rowSizes: (saved?.rowSizes?.length ? saved.rowSizes : DEFAULT_HOME_ROW_SIZES).map(normalizeRowSize),
    preset,
  };
}

export function visibleHomeTiles(state: HomeTilesState, accessibleIds: string[]): HomeTileDef[] {
  const allowed = new Set(accessibleIds);
  return state.order
    .filter((id) => allowed.has(id) && !state.hidden.includes(id))
    .map((id) => HOME_TILE_BY_ID[id])
    .filter(Boolean);
}

export function packHomeTiles(
  state: HomeTilesState,
  accessibleIds: string[],
): { cols: 1 | 2 | 3 | 4; tiles: HomeTileDef[] }[] {
  const allowed = new Set(accessibleIds);
  const visible = state.order
    .filter((id) => allowed.has(id) && !state.hidden.includes(id))
    .map((id) => HOME_TILE_BY_ID[id])
    .filter(Boolean);

  const sizes = state.rowSizes.length ? state.rowSizes.map(normalizeRowSize) : [2];
  const rows: { cols: 1 | 2 | 3 | 4; tiles: HomeTileDef[] }[] = [];
  let index = 0;
  let row = 0;
  while (index < visible.length) {
    const cols = sizes[Math.min(row, sizes.length - 1)];
    rows.push({ cols, tiles: visible.slice(index, index + cols) });
    index += cols;
    row += 1;
  }
  return rows;
}

export type HomeTileQuickAction = { label: string; to: string };

export function homeTileQuickActions(tile: HomeTileDef): HomeTileQuickAction[] {
  const open = tile.route ? [{ label: `Open ${tile.label}`, to: tile.route }] : [];
  switch (tile.id) {
    case "calendar":
      return [
        { label: "New event", to: "/calendar?new=1" },
        { label: "Week view", to: "/calendar?view=week" },
        { label: "Calendar app", to: "/calendar-app" },
      ];
    case "tasks":
      return [
        { label: "New task", to: "/tasks?new=1" },
        { label: "Today's tasks", to: "/tasks?filter=today" },
        ...open,
      ];
    case "notes":
      return [
        { label: "New note", to: "/notes?new=1" },
        { label: "Pinned notes", to: "/notes?filter=pinned" },
        ...open,
      ];
    case "today":
      return [{ label: "Open Today", to: "/today" }, { label: "Home tiles", to: "/" }];
    case "alarms":
      return [{ label: "Open alarms", to: "/alarms" }];
    case "finance":
      return [{ label: "Open Finance", to: "/finance" }, { label: "Bank links", to: "/finance" }];
    default:
      return open;
  }
}

export function moveHomeTile(order: string[], id: string, delta: number): string[] {
  const from = order.indexOf(id);
  if (from < 0) return order;
  const to = Math.max(0, Math.min(order.length - 1, from + delta));
  if (to === from) return order;
  const next = [...order];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
