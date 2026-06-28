import { useState, useEffect, useCallback } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";
import { NotificationPrefs, DEFAULT_NOTIF_PREFS } from "@/types/notifications";

export function useNotificationPrefs() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIF_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.uid) { setLoading(false); return; }
    const ref = doc(db, "notificationPrefs", user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setPrefs({ ...DEFAULT_NOTIF_PREFS, ...(snap.data() as NotificationPrefs) });
        }
        setLoading(false);
      },
      (err) => {
        console.warn("Notification prefs unavailable:", err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, [user?.uid]);

  const savePrefs = useCallback(async (updated: NotificationPrefs) => {
    if (!user?.uid) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "notificationPrefs", user.uid), updated, { merge: true });
      setPrefs(updated);
    } finally {
      setSaving(false);
    }
  }, [user?.uid]);

  return { prefs, loading, saving, savePrefs };
}
