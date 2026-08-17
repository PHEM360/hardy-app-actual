import { FEATURE_MODULES, type FeatureKey } from "@/types/app";
import type { WidgetType } from "@/hooks/useDashboardLayout";

export type AppRole = "superadmin" | "admin" | "member";

function normalizeFeatureKey(key: unknown): string {
  return String(key || "").toLowerCase().replace(/-/g, "_").trim();
}

export function featureEnabled(enabledFeatures: FeatureKey[], key: FeatureKey): boolean {
  const wanted = normalizeFeatureKey(key);
  return enabledFeatures.some((item) => normalizeFeatureKey(item) === wanted);
}

/** Admins/superadmins always have access; members need the feature explicitly enabled. */
export function hasFeatureAccess(
  role: AppRole,
  enabledFeatures: FeatureKey[],
  key: FeatureKey
): boolean {
  if (role === "admin" || role === "superadmin") return true;
  return featureEnabled(enabledFeatures, key);
}

/** Route path -> the FeatureKey that gates it. */
export const ROUTE_FEATURE_KEY: Record<string, FeatureKey> = {
  ...Object.fromEntries(FEATURE_MODULES.map((m) => [m.route, m.key])),
  "/health": "weight_tracking", // Health page is also served at /weight
};

/** Whether this signed-in (or viewed-as) user may open a route. */
export function canAccessRoute(
  role: AppRole,
  enabledFeatures: FeatureKey[],
  path: string,
): boolean {
  if (path === "/admin") return role === "admin" || role === "superadmin";
  const key = ROUTE_FEATURE_KEY[path];
  if (!key) return true;
  return hasFeatureAccess(role, enabledFeatures, key);
}

/** Dashboard widget type -> the FeatureKey that gates it. */
export const WIDGET_FEATURE_KEY: Partial<Record<WidgetType, FeatureKey>> = {
  finance: "finance_personal",
  households: "households",
  pets: "pets",
  tattersalls: "tattersalls",
  companies: "companies",
  weight: "weight_tracking",
  tasks: "tasks",
  calendar_mini: "calendar",
};

/** Quick-link id -> FeatureKey. Links without a key are always available. */
export const QUICK_LINK_FEATURE_KEY: Record<string, FeatureKey> = {
  finance: "finance_personal",
  "hh-finance": "finance_household",
  event: "calendar",
  task: "tasks",
  expense: "companies",
};

/** Default bottom-nav order. Access filtering decides which of these actually show. */
export const DEFAULT_BOTTOM_NAV = ["/dashboard", "/finance", "/pets", "/today", "/health"];
export const MAX_BOTTOM_NAV_ITEMS = 4;
