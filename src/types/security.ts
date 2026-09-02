export type SecurityRequirement = "none" | "passkey" | "password";
export type AppUnlockMode = "every_open" | "interval" | "passkey_freshness";
export type AppUnlockMethod = "passkey" | "password" | "either";

export interface AppSecuritySettings {
  version: 2;
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
  { id: "holidays", label: "Holidays", routes: ["/holidays"] },
  { id: "ai_analysis", label: "AI Analysis", routes: ["/ai-analysis"] },
  { id: "qr_codes", label: "QR Codes", routes: ["/qr-codes"] },
  { id: "remote_displays", label: "Remote Displays", routes: ["/remote-displays"] },
  { id: "admin", label: "Admin", routes: ["/admin"] },
  { id: "more", label: "More", routes: ["/more"] },
  { id: "settings", label: "Settings", routes: ["/settings", "/themes", "/notifications"] },
] as const;

export const DEFAULT_SECURITY_SETTINGS: AppSecuritySettings = {
  version: 2,
  appUnlockMode: "passkey_freshness",
  appUnlockMethod: "passkey",
  appUnlockIntervalDays: 7,
  moduleRequirements: {
    personal_finance: "passkey",
    passwords: "passkey",
    remote_displays: "passkey",
  },
};

export function moduleForPath(pathname: string) {
  return SECURITY_MODULES.find((module) =>
    module.routes.some((route) => pathname === route || pathname.startsWith(`${route}/`)),
  )?.id ?? null;
}

type StoredSecuritySettings = Partial<Omit<AppSecuritySettings, "version">> & { version?: number };

export function normalizeSecuritySettings(value?: StoredSecuritySettings | null): AppSecuritySettings {
  const savedInterval = Number(value?.appUnlockIntervalDays);
  const intervalDays = Number(value?.version || 0) < 2 && savedInterval === 30 ? 7 : savedInterval || 7;
  return {
    ...DEFAULT_SECURITY_SETTINGS,
    ...value,
    version: 2,
    appUnlockIntervalDays: Math.min(365, Math.max(1, intervalDays)),
    moduleRequirements: {
      ...DEFAULT_SECURITY_SETTINGS.moduleRequirements,
      ...(value?.moduleRequirements || {}),
    },
  };
}
