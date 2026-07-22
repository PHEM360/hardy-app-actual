import { FEATURE_MODULES, type FeatureKey } from "@/types/app";
import type { WidgetType } from "@/hooks/useDashboardLayout";

export type AppRole = "superadmin" | "admin" | "member";

/** Admins/superadmins always have access; members need the feature explicitly enabled. */
export function hasFeatureAccess(
  role: AppRole,
  enabledFeatures: FeatureKey[],
  key: FeatureKey
): boolean {
  if (role === "admin" || role === "superadmin") return true;
  return enabledFeatures.includes(key);
}

/** Route path -> the FeatureKey that gates it. */
export const ROUTE_FEATURE_KEY: Record<string, FeatureKey> = {
  ...Object.fromEntries(FEATURE_MODULES.map((m) => [m.route, m.key])),
  "/health": "weight_tracking", // Health page is also served at /weight
};

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
