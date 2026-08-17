import { useState, useEffect, useCallback } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";
import { NotificationPrefs, DEFAULT_NOTIF_PREFS } from "@/types/notifications";

export function useNotificationPrefs() {
  const { dataUid } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIF_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!dataUid) { setLoading(false); return; }
    const ref = doc(db, "notificationPrefs", dataUid);
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
  }, [dataUid]);

  const savePrefs = useCallback(async (updated: NotificationPrefs) => {
    if (!dataUid) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "notificationPrefs", dataUid), updated, { merge: true });
      setPrefs(updated);
    } finally {
      setSaving(false);
    }
  }, [dataUid]);

  return { prefs, loading, saving, savePrefs };
}
