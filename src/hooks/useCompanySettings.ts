import { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { CompanySettings, DEFAULT_COMPANY_SETTINGS } from "@/types/app";

export function useCompanySettings(companyId: string) {
  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_COMPANY_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const ref = doc(db, "companySettings", uid, "items", companyId);
    getDoc(ref).then((snap) => {
      if (snap.exists()) {
        setSettings({ ...DEFAULT_COMPANY_SETTINGS, ...(snap.data() as CompanySettings) });
      } else {
        setSettings(DEFAULT_COMPANY_SETTINGS);
      }
    }).finally(() => setLoading(false));
  }, [companyId]);

  async function saveSettings(updated: CompanySettings) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const ref = doc(db, "companySettings", uid, "items", companyId);
    await setDoc(ref, updated);
    setSettings(updated);
  }

  return { settings, loading, saveSettings };
}
