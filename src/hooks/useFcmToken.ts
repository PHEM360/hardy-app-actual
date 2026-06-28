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
 */
export function useFcmToken(pushEnabled: boolean) {
  const { user } = useAuth();

  const registerToken = useCallback(async () => {
    if (!user?.uid || !pushEnabled) return;
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
  }, [user?.uid, pushEnabled]);

  useEffect(() => {
    registerToken();
  }, [registerToken]);
}
