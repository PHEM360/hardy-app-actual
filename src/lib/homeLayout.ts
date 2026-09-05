import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Building,
  Building2,
  Calculator,
  CalendarDays,
  CheckSquare,
  Heart,
  KeyRound,
  Mail,
  MonitorSmartphone,
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
} from "lucide-react";

export type HomeLayoutMode = "today" | "tiles";

export interface HomeTileDef {
  id: string;
  label: string;
  route?: string;
  icon: LucideIcon;
  accent: string;
  gradient: string;
}

export interface HomeTilesState {
  order: string[];
  hidden: string[];
  rowSizes: number[];
}

export const HOME_TILES: HomeTileDef[] = [
  { id: "quick_links", label: "Quick Links", icon: Zap, accent: "hsl(178,55%,36%)", gradient: "linear-gradient(135deg,hsl(178,58%,42%),hsl(182,55%,46%))" },
  { id: "finance", label: "Finance", route: "/finance", icon: PiggyBank, accent: "hsl(25,62%,55%)", gradient: "linear-gradient(135deg,hsl(25,65%,58%),hsl(15,58%,52%))" },
  { id: "pets", label: "Pets", route: "/pets", icon: Heart, accent: "hsl(0,65%,50%)", gradient: "linear-gradient(135deg,hsl(0,68%,55%),hsl(340,60%,48%))" },
  { id: "notes", label: "Notes", route: "/notes", icon: StickyNote, accent: "hsl(42,85%,48%)", gradient: "linear-gradient(135deg,hsl(42,92%,52%),hsl(28,85%,48%))" },
  { id: "tasks", label: "Tasks", route: "/tasks", icon: CheckSquare, accent: "hsl(260,55%,55%)", gradient: "linear-gradient(135deg,hsl(258,62%,60%),hsl(270,55%,52%))" },
  { id: "today", label: "Today", route: "/today", icon: Sun, accent: "hsl(38,92%,50%)", gradient: "linear-gradient(135deg,hsl(38,95%,54%),hsl(25,88%,47%))" },
  { id: "calendar", label: "Calendar", route: "/calendar", icon: CalendarDays, accent: "hsl(220,60%,55%)", gradient: "linear-gradient(135deg,hsl(218,63%,58%),hsl(230,58%,50%))" },
  { id: "households", label: "Households", route: "/households", icon: Users, accent: "hsl(30,60%,50%)", gradient: "linear-gradient(135deg,hsl(30,65%,54%),hsl(20,58%,47%))" },
  { id: "hh-finance", label: "HH Finance", route: "/household-finance", icon: Wallet, accent: "hsl(140,55%,40%)", gradient: "linear-gradient(135deg,hsl(140,58%,44%),hsl(150,53%,37%))" },
  { id: "companies", label: "Companies", route: "/companies", icon: Building2, accent: "hsl(210,50%,50%)", gradient: "linear-gradient(135deg,hsl(210,53%,54%),hsl(220,48%,47%))" },
  { id: "health", label: "Health", route: "/weight", icon: Activity, accent: "hsl(152,55%,40%)", gradient: "linear-gradient(135deg,hsl(152,58%,44%),hsl(160,53%,37%))" },
  { id: "logins", label: "Log Ins", route: "/login-details", icon: KeyRound, accent: "hsl(265,55%,55%)", gradient: "linear-gradient(135deg,hsl(265,58%,58%),hsl(275,53%,50%))" },
  { id: "tattersalls", label: "Flats", route: "/tattersalls", icon: Building, accent: "hsl(195,50%,45%)", gradient: "linear-gradient(135deg,hsl(195,53%,48%),hsl(205,48%,42%))" },
  { id: "freezer", label: "Freezer", route: "/freezer", icon: Snowflake, accent: "hsl(198,75%,50%)", gradient: "linear-gradient(135deg,hsl(198,75%,55%),hsl(215,70%,48%))" },
  { id: "inheritance", label: "IHT Planner", route: "/inheritance", icon: Calculator, accent: "hsl(0,60%,52%)", gradient: "linear-gradient(135deg,hsl(0,60%,52%),hsl(340,55%,46%))" },
  { id: "leave", label: "Annual Leave", route: "/annual-leave", icon: Plane, accent: "hsl(198,60%,50%)", gradient: "linear-gradient(135deg,hsl(198,60%,50%),hsl(210,55%,44%))" },
  { id: "holidays", label: "Holidays", route: "/holidays", icon: Palmtree, accent: "hsl(172,48%,38%)", gradient: "linear-gradient(135deg,hsl(172,52%,42%),hsl(188,48%,36%))" },
  { id: "ai", label: "AI Analysis", route: "/ai-analysis", icon: Sparkles, accent: "hsl(270,55%,52%)", gradient: "linear-gradient(135deg,hsl(270,55%,52%),hsl(250,50%,46%))" },
  { id: "email", label: "Email", route: "/email", icon: Mail, accent: "hsl(239,70%,58%)", gradient: "linear-gradient(135deg,hsl(239,70%,58%),hsl(260,60%,50%))" },
  { id: "displays", label: "Displays", route: "/remote-displays", icon: MonitorSmartphone, accent: "hsl(198,60%,46%)", gradient: "linear-gradient(135deg,hsl(198,65%,50%),hsl(210,60%,44%))" },
];

export const HOME_TILE_BY_ID = Object.fromEntries(HOME_TILES.map((tile) => [tile.id, tile])) as Record<string, HomeTileDef>;

export const DEFAULT_HOME_TILE_ORDER = [
  "quick_links",
  "finance",
  "pets",
  "notes",
  "tasks",
  "today",
  "calendar",
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
  "displays",
];

export const DEFAULT_HOME_ROW_SIZES = [1, 2, 2, 3, 3, 4];

export const DEFAULT_HOME_TILES_STATE: HomeTilesState = {
  order: DEFAULT_HOME_TILE_ORDER,
  hidden: [],
  rowSizes: DEFAULT_HOME_ROW_SIZES,
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
  return {
    order: [...savedOrder, ...extras],
    hidden: (saved?.hidden ?? []).filter((id) => known.has(id)),
    rowSizes: (saved?.rowSizes?.length ? saved.rowSizes : DEFAULT_HOME_ROW_SIZES).map(normalizeRowSize),
  };
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
