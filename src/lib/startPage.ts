import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { canAccessRoute, type AppRole } from "@/lib/features";
import type { FeatureKey } from "@/types/app";

export const DEFAULT_START_PAGE = "/dashboard";

export const START_PAGE_OPTIONS = [
  { path: "/dashboard", label: "Home" },
  { path: "/today", label: "Today" },
  { path: "/tasks", label: "Tasks" },
  { path: "/notes", label: "Notes" },
  { path: "/photos", label: "Photos" },
  { path: "/email", label: "Email" },
  { path: "/calendar", label: "Calendar" },
  { path: "/finance", label: "Finance" },
  { path: "/pets", label: "Pets" },
  { path: "/health", label: "Health" },
  { path: "/households", label: "Households" },
  { path: "/household-finance", label: "Household Finance" },
  { path: "/freezer", label: "Freezer" },
  { path: "/companies", label: "Companies" },
  { path: "/login-details", label: "Log In Details" },
  { path: "/tattersalls", label: "Flats" },
  { path: "/ai-analysis", label: "AI Analysis" },
  { path: "/holidays", label: "Holidays" },
  { path: "/annual-leave", label: "Annual leave" },
  { path: "/remote-displays", label: "Remote Displays" },
  { path: "/qr-codes", label: "QR codes" },
  { path: "/admin", label: "Admin" },
] as const;

export function isSafeAppPath(path: string | undefined | null): path is string {
  return !!path && path.startsWith("/") && !path.startsWith("//") && !path.includes("://");
}

export function roleFromUserDoc(data: Record<string, unknown> | undefined): AppRole {
  const rawRole = String(data?.role || "").toLowerCase().replace(/\s+/g, "").replace(/-/g, "");
  if (rawRole === "superadmin" || data?.isSuperAdmin === true) return "superadmin";
  if (rawRole === "admin" || data?.isAdmin === true) return "admin";
  return "member";
}

export function resolveStartPage(
  preferred: string | undefined,
  from: string | undefined | null,
  canOpen: (path: string) => boolean,
): string {
  if (isSafeAppPath(from) && from !== "/" && from !== "/login") return from;
  if (isSafeAppPath(preferred) && canOpen(preferred)) return preferred;
  return DEFAULT_START_PAGE;
}

export async function landingPathForUser(uid: string, from?: string | null): Promise<string> {
  if (isSafeAppPath(from) && from !== "/" && from !== "/login") return from;
  try {
    const snap = await getDoc(doc(db, "users", uid));
    const data = (snap.data() || {}) as Record<string, unknown>;
    const preferred = typeof data.defaultRoute === "string" ? data.defaultRoute : undefined;
    const role = roleFromUserDoc(data);
    const features = Array.isArray(data.enabledFeatures) ? data.enabledFeatures as FeatureKey[] : [];
    return resolveStartPage(preferred, from, (path) => canAccessRoute(role, features, path));
  } catch {
    return DEFAULT_START_PAGE;
  }
}
