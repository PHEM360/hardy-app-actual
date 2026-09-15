import { useCallback, useEffect, useState } from "react";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { getToken } from "firebase/messaging";
import { db, getMessagingIfSupported } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";
import {
  getKeepAfterLogout,
  setKeepAfterLogout as persistKeepAfterLogout,
  stopNotificationsOnThisDevice,
} from "@/lib/fcmDeviceSettings";

// Set in Firebase Console → Project Settings → Cloud Messaging → Web Push certificates
const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY as string | undefined;

/**
 * When pushEnabled is true, requests notification permission (if not already
 * granted), fetches the device's FCM token, and stores it in Firestore under
 * users/{uid}.fcmTokens so Cloud Functions can reach every registered device.
 *
 * Also exposes this device's own "keep notifications after I sign out"
 * preference (see fcmDeviceSettings.ts) and a way to unregister this device
 * outright — surfaced in NotificationSettings.tsx.
 *
 * Safari/WebKit (this matters a lot on iOS) only honours
 * Notification.requestPermission() when it's called synchronously as part of
 * a real user gesture (a tap/click) — a request fired from a useEffect on
 * mount/prop-change is too far removed from any click to count, and Safari
 * silently does nothing rather than prompting. So besides the automatic
 * effect below (which is enough for Chrome/Firefox), `registerToken` is also
 * returned so a caller can invoke it directly inside an onClick/onCheckedChange
 * handler — see the Push switch in NotificationSettings.tsx.
 */
export function useFcmToken(pushEnabled: boolean) {
  const { user } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [keepAfterLogout, setKeepAfterLogoutState] = useState(false);

  const registerToken = useCallback(async () => {
    if (!user?.uid) return;
    if (!VAPID_KEY) {
      console.warn("FCM: VITE_FCM_VAPID_KEY is not set — push tokens cannot be registered.");
      return;
    }

    const messaging = await getMessagingIfSupported();
    if (!messaging) return;

    // Request permission if not already granted
    if (Notification.permission === "default") {
      const result = await Notification.requestPermission();
      if (result !== "granted") return;
    }
    if (Notification.permission !== "granted") return;

    try {
      const nextToken = await getToken(messaging, { vapidKey: VAPID_KEY });
      if (nextToken) {
        await updateDoc(doc(db, "users", user.uid), {
          fcmTokens: arrayUnion(nextToken),
        });
        setToken(nextToken);
      }
    } catch (err) {
      console.warn("FCM token registration failed:", err);
    }
  }, [user?.uid]);

  // Automatic path — sufficient on Chrome/Firefox, which don't require the
  // request to trace back to a gesture. Safari needs the direct call below.
  useEffect(() => {
    if (pushEnabled) registerToken();
  }, [pushEnabled, registerToken]);

  // Load this device's own "keep after logout" preference once we know its token.
  useEffect(() => {
    if (!user?.uid || !token) return;
    let cancelled = false;
    getKeepAfterLogout(user.uid, token).then((keep) => {
      if (!cancelled) setKeepAfterLogoutState(keep);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.uid, token]);

  const setKeepAfterLogout = useCallback(
    async (keep: boolean) => {
      if (!user?.uid || !token) return;
      setKeepAfterLogoutState(keep);
      await persistKeepAfterLogout(user.uid, token, keep);
    },
    [user?.uid, token],
  );

  const stopThisDevice = useCallback(async () => {
    if (!user?.uid || !token) return;
    await stopNotificationsOnThisDevice(user.uid, token);
    setToken(null);
    setKeepAfterLogoutState(false);
  }, [user?.uid, token]);

  return { registerToken, hasToken: Boolean(token), keepAfterLogout, setKeepAfterLogout, stopThisDevice };
}
