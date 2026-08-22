import type { AppSecuritySettings } from "@/types/security";

interface SecuritySessionRecord {
  lastAuthAt?: number;
  lastPasswordAt?: number;
  lastPasskeyAt?: number;
}

const LOCAL_PREFIX = "hardy-hub-security-session:";
const OPEN_PREFIX = "hardy-hub-open-session:";

function read(uid: string): SecuritySessionRecord {
  try {
    return JSON.parse(window.localStorage.getItem(`${LOCAL_PREFIX}${uid}`) || "{}") as SecuritySessionRecord;
  } catch {
    return {};
  }
}

export function markSecurityAuthentication(uid: string, method: "password" | "passkey") {
  const now = Date.now();
  const next = {
    ...read(uid),
    lastAuthAt: now,
    ...(method === "passkey" ? { lastPasskeyAt: now } : { lastPasswordAt: now }),
  };
  window.localStorage.setItem(`${LOCAL_PREFIX}${uid}`, JSON.stringify(next));
}

export function markOpenSessionSatisfied(uid: string) {
  window.sessionStorage.setItem(`${OPEN_PREFIX}${uid}`, "yes");
}

export function appSessionRequiresAuthentication(uid: string, settings: AppSecuritySettings) {
  if (settings.appUnlockMode === "every_open") {
    return window.sessionStorage.getItem(`${OPEN_PREFIX}${uid}`) !== "yes";
  }
  const record = read(uid);
  const maxAge = settings.appUnlockIntervalDays * 24 * 60 * 60 * 1000;
  const lastVerified = settings.appUnlockMode === "passkey_freshness"
    ? record.lastPasskeyAt
    : record.lastAuthAt;
  return !lastVerified || Date.now() - lastVerified > maxAge;
}

export function clearSecuritySession(uid: string) {
  window.localStorage.removeItem(`${LOCAL_PREFIX}${uid}`);
  window.sessionStorage.removeItem(`${OPEN_PREFIX}${uid}`);
}
