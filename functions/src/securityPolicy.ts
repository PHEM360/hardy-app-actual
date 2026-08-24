import * as admin from "firebase-admin";

export const DEFAULT_PASSKEY_FRESHNESS_DAYS = 7;

/**
 * How long one passkey verification counts for, as chosen by the account owner.
 * Mirrors normalizeSecuritySettings on the client and the Firestore rules,
 * including the migration of the original 30-day default down to 7 days.
 */
export async function passkeyFreshnessDays(uid: string) {
  try {
    const snapshot = await admin.firestore().doc(`users/${uid}/security/settings`).get();
    if (!snapshot.exists) return DEFAULT_PASSKEY_FRESHNESS_DAYS;
    const data = snapshot.data() || {};
    const requested = Number(data.appUnlockIntervalDays ?? DEFAULT_PASSKEY_FRESHNESS_DAYS);
    const version = Number(data.version ?? 1);
    const days = version < 2 && requested === 30 ? DEFAULT_PASSKEY_FRESHNESS_DAYS : requested;
    if (!Number.isFinite(days)) return DEFAULT_PASSKEY_FRESHNESS_DAYS;
    return Math.min(365, Math.max(1, Math.floor(days)));
  } catch {
    return DEFAULT_PASSKEY_FRESHNESS_DAYS;
  }
}

export function hasFreshPasskey(token: Record<string, unknown> | undefined, days: number) {
  const verifiedAt = Number(token?.passkeyVerifiedAt || 0);
  return verifiedAt > 0 && verifiedAt >= Date.now() / 1000 - days * 86_400;
}
