export type SecurityRequirement = "none" | "passkey" | "password";
export type AppUnlockMode = "every_open" | "interval" | "passkey_freshness";
export type AppUnlockMethod = "passkey" | "password" | "either";

export interface AppSecuritySettings {
  version: 1;
  appUnlockMode: AppUnlockMode;
  appUnlockMethod: AppUnlockMethod;
  appUnlockIntervalDays: number;
  moduleRequirements: Record<string, SecurityRequirement>;
}

export const SECURITY_MODULES = [
  { id: "dashboard", label: "Home", routes: ["/dashboard", "/today"] },
  { id: "personal_finance", label: "Personal Finance", routes: ["/finance"] },
  { id: "passwords", label: "Log Ins & Passwords", routes: ["/login-details"] },
  { id: "health", label: "Health", routes: ["/health", "/weight"] },
  { id: "notes", label: "Notes", routes: ["/notes"] },
  { id: "companies", label: "Companies", routes: ["/companies"] },
  { id: "households", label: "Households", routes: ["/households", "/household-finance"] },
  { id: "pets", label: "Pets", routes: ["/pets"] },
  { id: "tasks", label: "Tasks", routes: ["/tasks"] },
  { id: "calendar", label: "Calendar", routes: ["/calendar"] },
  { id: "inheritance", label: "IHT Planner", routes: ["/inheritance"] },
  { id: "freezer", label: "Freezer", routes: ["/freezer"] },
  { id: "tattersalls", label: "Tattersalls", routes: ["/tattersalls"] },
  { id: "annual_leave", label: "Annual Leave", routes: ["/annual-leave"] },
  { id: "ai_analysis", label: "AI Analysis", routes: ["/ai-analysis"] },
  { id: "qr_codes", label: "QR Codes", routes: ["/qr-codes"] },
  { id: "admin", label: "Admin", routes: ["/admin"] },
  { id: "more", label: "More", routes: ["/more"] },
  { id: "settings", label: "Settings", routes: ["/settings", "/themes", "/notifications"] },
] as const;

export const DEFAULT_SECURITY_SETTINGS: AppSecuritySettings = {
  version: 1,
  appUnlockMode: "passkey_freshness",
  appUnlockMethod: "passkey",
  appUnlockIntervalDays: 30,
  moduleRequirements: {
    personal_finance: "passkey",
    passwords: "passkey",
  },
};

export function moduleForPath(pathname: string) {
  return SECURITY_MODULES.find((module) =>
    module.routes.some((route) => pathname === route || pathname.startsWith(`${route}/`)),
  )?.id ?? null;
}

export function normalizeSecuritySettings(value?: Partial<AppSecuritySettings> | null): AppSecuritySettings {
  return {
    ...DEFAULT_SECURITY_SETTINGS,
    ...value,
    version: 1,
    appUnlockIntervalDays: Math.min(365, Math.max(1, Number(value?.appUnlockIntervalDays) || 30)),
    moduleRequirements: {
      ...DEFAULT_SECURITY_SETTINGS.moduleRequirements,
      ...(value?.moduleRequirements || {}),
    },
  };
}
