import { doc, getDoc, updateDoc, arrayRemove } from "firebase/firestore";
import { getToken } from "firebase/messaging";
import { db, getMessagingIfSupported } from "@/lib/firebase";

const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY as string | undefined;

export type FcmTokenSetting = { token: string; keepAfterLogout: boolean; updatedAt: number };

/**
 * This browser's current FCM token, if push has ever been granted here.
 * `getToken` is deterministic per browser/service-worker registration, so
 * this doesn't need any local bookkeeping to "find" the device's own token.
 */
export async function currentDeviceToken(): Promise<string | null> {
  try {
    if (!VAPID_KEY) return null;
    const messaging = await getMessagingIfSupported();
    if (!messaging) return null;
    if (Notification.permission !== "granted") return null;
    return (await getToken(messaging, { vapidKey: VAPID_KEY })) || null;
  } catch {
    return null;
  }
}

async function readTokenSettings(uid: string): Promise<FcmTokenSetting[]> {
  const snap = await getDoc(doc(db, "users", uid));
  const list = snap.data()?.fcmTokenSettings;
  return Array.isArray(list) ? (list as FcmTokenSetting[]) : [];
}

export async function getKeepAfterLogout(uid: string, token: string): Promise<boolean> {
  const settings = await readTokenSettings(uid);
  return Boolean(settings.find((s) => s?.token === token)?.keepAfterLogout);
}

/** Per-device opt-in: keep receiving pushes on this device even after signing out of it. */
export async function setKeepAfterLogout(uid: string, token: string, keep: boolean): Promise<void> {
  const current = await readTokenSettings(uid);
  const next = [...current.filter((s) => s?.token !== token), { token, keepAfterLogout: keep, updatedAt: Date.now() }];
  await updateDoc(doc(db, "users", uid), { fcmTokenSettings: next });
}

/** Immediately unregisters this device — for "stop notifications on this device" / before uninstalling. */
export async function stopNotificationsOnThisDevice(uid: string, token: string): Promise<void> {
  const current = await readTokenSettings(uid);
  await updateDoc(doc(db, "users", uid), {
    fcmTokens: arrayRemove(token),
    fcmTokenSettings: current.filter((s) => s?.token !== token),
  });
}

/**
 * Called right before signOut(). Removes this device's push token unless the
 * user explicitly opted this device in to keep notifications after logging
 * out of it. Best-effort and silent — a failed cleanup just leaves a stale
 * token (the pre-existing behaviour), it should never block sign-out.
 */
export async function cleanupFcmTokenOnSignOut(uid: string | undefined | null): Promise<void> {
  if (!uid) return;
  try {
    const token = await currentDeviceToken();
    if (!token) return;
    const keep = await getKeepAfterLogout(uid, token);
    if (keep) return;
    await updateDoc(doc(db, "users", uid), { fcmTokens: arrayRemove(token) });
  } catch {
    /* best-effort */
  }
}
