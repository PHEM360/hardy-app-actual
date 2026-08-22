import { useCallback, useEffect, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { useAuth } from "@/auth/AuthContext";
import { db } from "@/lib/firebase";
import {
  DEFAULT_SECURITY_SETTINGS,
  normalizeSecuritySettings,
  type AppSecuritySettings,
} from "@/types/security";

export function useSecuritySettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AppSecuritySettings>(DEFAULT_SECURITY_SETTINGS);
  const [passkeyEnrolled, setPasskeyEnrolled] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    if (!user) {
      setPasskeyEnrolled(false);
      setProfileLoaded(true);
      setSettingsLoaded(true);
      return;
    }
    setProfileLoaded(false);
    setSettingsLoaded(false);
    const profileUnsubscribe = onSnapshot(doc(db, "users", user.uid), (snapshot) => {
      setPasskeyEnrolled(snapshot.data()?.passkeyEnrolled === true);
      setProfileLoaded(true);
    }, () => setProfileLoaded(true));
    const settingsUnsubscribe = onSnapshot(doc(db, "users", user.uid, "security", "settings"), (snapshot) => {
      setSettings(normalizeSecuritySettings(snapshot.exists() ? snapshot.data() : null));
      setSettingsLoaded(true);
    }, () => {
      setSettings(DEFAULT_SECURITY_SETTINGS);
      setSettingsLoaded(true);
    });
    return () => {
      profileUnsubscribe();
      settingsUnsubscribe();
    };
  }, [user]);

  const saveSettings = useCallback(async (next: AppSecuritySettings) => {
    if (!user) return;
    const normalized = normalizeSecuritySettings(next);
    await setDoc(doc(db, "users", user.uid, "security", "settings"), {
      ...normalized,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    setSettings(normalized);
  }, [user]);

  return {
    settings,
    passkeyEnrolled,
    loading: !profileLoaded || !settingsLoaded,
    saveSettings,
  };
}
