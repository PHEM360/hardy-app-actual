import type { FeatureKey } from "@/types/app";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Briefcase,
  Building2,
  Calculator,
  CalendarDays,
  CheckSquare,
  Home,
  Image,
  KeyRound,
  LayoutGrid,
  MonitorSmartphone,
  NotebookPen,
  PawPrint,
  Plane,
  Snowflake,
  Sparkles,
  StickyNote,
  Sun,
  Users,
  Wallet,
  Palmtree,
} from "lucide-react";

/** A page the user can open after login. */
export interface LandingPageOption {
  path: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Feature gate; omit for always-available pages. */
  featureKey?: FeatureKey;
  /** Always offer even without the feature (e.g. Home, Today, Settings). */
  always?: boolean;
}

/**
 * Preferred order: Today, Home, Tasks first — then everything else.
 * Filtered at runtime by the caller's access check.
 */
export const LANDING_PAGE_OPTIONS: LandingPageOption[] = [
  {
    path: "/today",
    label: "Today",
    description: "Your daily planner with movable widgets",
    icon: Sun,
    always: true,
  },
  {
    path: "/dashboard",
    label: "Home",
    description: "Welcome screen and page tiles",
    icon: Home,
    always: true,
  },
  {
    path: "/tasks",
    label: "Tasks",
    description: "Lists, priorities and to-dos",
    icon: CheckSquare,
    featureKey: "tasks",
  },
  {
    path: "/notes",
    label: "Notes",
    description: "Notes and checklists",
    icon: StickyNote,
    featureKey: "notes",
  },
  {
    path: "/calendar",
    label: "Calendar",
    description: "Events and reminders",
    icon: CalendarDays,
    featureKey: "calendar",
  },
  {
    path: "/finance",
    label: "Finance",
    description: "Accounts and balances",
    icon: Wallet,
    featureKey: "finance_personal",
  },
  {
    path: "/pets",
    label: "Pets",
    description: "Pets and care",
    icon: PawPrint,
    featureKey: "pets",
  },
  {
    path: "/pictures",
    label: "Pictures",
    description: "Albums synced with Google Drive",
    icon: Image,
    featureKey: "pictures",
  },
  {
    path: "/households",
    label: "Households",
    description: "Shared household records",
    icon: Users,
    featureKey: "households",
  },
  {
    path: "/household-finance",
    label: "Household Finance",
    description: "Shared budgets",
    icon: LayoutGrid,
    featureKey: "finance_household",
  },
  {
    path: "/companies",
    label: "Companies",
    description: "Business logins and expenses",
    icon: Briefcase,
    featureKey: "companies",
  },
  {
    path: "/weight",
    label: "Health",
    description: "Weight and wellbeing",
    icon: Activity,
    featureKey: "weight_tracking",
  },
  {
    path: "/tattersalls",
    label: "Flats",
    description: "Rental properties",
    icon: Building2,
    featureKey: "tattersalls",
  },
  {
    path: "/freezer",
    label: "Freezer",
    description: "What's in the freezer",
    icon: Snowflake,
    always: true,
  },
  {
    path: "/inheritance",
    label: "IHT Planner",
    description: "Inheritance tax scenarios",
    icon: Calculator,
    featureKey: "inheritance_tax",
  },
  {
    path: "/annual-leave",
    label: "Annual Leave",
    description: "Leave tracker",
    icon: Plane,
    featureKey: "annual_leave",
  },
  {
    path: "/holidays",
    label: "Holidays",
    description: "Holiday price watches",
    icon: Palmtree,
    featureKey: "holidays",
  },
  {
    path: "/ai-analysis",
    label: "AI Analysis",
    description: "Ask questions about documents",
    icon: Sparkles,
    featureKey: "ai_analysis",
  },
  {
    path: "/login-details",
    label: "Log Ins",
    description: "Saved logins",
    icon: KeyRound,
    always: true,
  },
  {
    path: "/remote-displays",
    label: "Remote Displays",
    description: "Always-on screens",
    icon: MonitorSmartphone,
    always: true,
  },
  {
    path: "/settings",
    label: "Settings",
    description: "Profile and preferences",
    icon: NotebookPen,
    always: true,
  },
];

export const DEFAULT_LANDING_PATH = "/dashboard";

export function isValidLandingPath(path: string | null | undefined): path is string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return false;
  return LANDING_PAGE_OPTIONS.some((o) => o.path === path);
}

export function resolveLandingPath(saved: string | null | undefined): string {
  return isValidLandingPath(saved) ? saved : DEFAULT_LANDING_PATH;
}
