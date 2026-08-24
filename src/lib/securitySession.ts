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

export function markSecurityAuthenticationAt(uid: string, method: "password" | "passkey", atMs: number) {
  const record = read(uid);
  const previous = method === "passkey" ? record.lastPasskeyAt : record.lastPasswordAt;
  if (previous && previous >= atMs) return;
  const next = {
    ...record,
    lastAuthAt: Math.max(record.lastAuthAt || 0, atMs),
    ...(method === "passkey" ? { lastPasskeyAt: atMs } : { lastPasswordAt: atMs }),
  };
  window.localStorage.setItem(`${LOCAL_PREFIX}${uid}`, JSON.stringify(next));
}

export function markSecurityAuthentication(uid: string, method: "password" | "passkey") {
  markSecurityAuthenticationAt(uid, method, Date.now());
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

export function hasFreshSecurityAuthentication(
  uid: string,
  method: "password" | "passkey",
  maxAgeDays: number,
) {
  const record = read(uid);
  const verifiedAt = method === "passkey" ? record.lastPasskeyAt : record.lastPasswordAt;
  const maxAge = Math.max(1, maxAgeDays) * 24 * 60 * 60 * 1000;
  return !!verifiedAt && Date.now() - verifiedAt <= maxAge;
}

/**
 * The passkey claim on the Firebase ID token is what Firestore rules and the
 * Cloud Functions check, so the app uses it as the single source of truth for
 * "have they shown a passkey recently" rather than per-browser storage.
 */
export function passkeyClaimVerifiedAt(claims: { passkeyVerifiedAt?: unknown } | undefined) {
  return Number(claims?.passkeyVerifiedAt || 0) * 1000;
}

export function passkeyClaimIsFresh(claims: { passkeyVerifiedAt?: unknown }, maxAgeDays: number) {
  const verifiedAtMs = passkeyClaimVerifiedAt(claims);
  return verifiedAtMs > 0 && Date.now() - verifiedAtMs <= Math.max(1, maxAgeDays) * 24 * 60 * 60 * 1000;
}

export function clearSecuritySession(uid: string) {
  window.localStorage.removeItem(`${LOCAL_PREFIX}${uid}`);
  window.sessionStorage.removeItem(`${OPEN_PREFIX}${uid}`);
}
