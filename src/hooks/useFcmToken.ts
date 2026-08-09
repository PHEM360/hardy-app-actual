import { useEffect, useCallback } from "react";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { getToken } from "firebase/messaging";
import { db, getMessagingIfSupported } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";

// Set in Firebase Console → Project Settings → Cloud Messaging → Web Push certificates
const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY as string | undefined;

/**
 * When pushEnabled is true, requests notification permission (if not already
 * granted), fetches the device's FCM token, and stores it in Firestore under
 * users/{uid}.fcmTokens so Cloud Functions can reach every registered device.
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
      const token = await getToken(messaging, { vapidKey: VAPID_KEY });
      if (token) {
        await updateDoc(doc(db, "users", user.uid), {
          fcmTokens: arrayUnion(token),
        });
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

  return { registerToken };
}
