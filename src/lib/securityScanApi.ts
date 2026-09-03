import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import type { SecurityReport, SecurityScanPrefs } from "@/types/securityReport";

export async function runSecurityScan(): Promise<SecurityReport> {
  const call = httpsCallable<Record<string, never>, SecurityReport>(functions, "runSecurityScan");
  const res = await call({});
  return res.data;
}

export async function saveSecurityScanPrefs(
  prefs: Omit<SecurityScanPrefs, "updatedAt" | "lastRunAt" | "nextRunAt"> & {
    lastRunAt?: string | null;
    nextRunAt?: string | null;
  },
): Promise<SecurityScanPrefs> {
  const call = httpsCallable<typeof prefs, SecurityScanPrefs>(functions, "saveSecurityScanPrefs");
  const res = await call(prefs);
  return res.data;
}
