import { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CompanySettings, DEFAULT_COMPANY_SETTINGS, sortCategoriesOtherLast } from "@/types/app";

function normalize(settings: CompanySettings): CompanySettings {
  return {
    ...settings,
    incomeCategories: sortCategoriesOtherLast(settings.incomeCategories),
    expenseCategories: sortCategoriesOtherLast(settings.expenseCategories),
  };
}

export function useCompanySettings(companyId: string) {
  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_COMPANY_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;

    const ref = doc(db, "companySettings", companyId);
    getDoc(ref).then((snap) => {
      if (snap.exists()) {
        setSettings(normalize({ ...DEFAULT_COMPANY_SETTINGS, ...(snap.data() as CompanySettings) }));
      } else {
        setSettings(DEFAULT_COMPANY_SETTINGS);
      }
    }).finally(() => setLoading(false));
  }, [companyId]);

  async function saveSettings(updated: CompanySettings) {
    const normalized = normalize(updated);
    const ref = doc(db, "companySettings", companyId);
    await setDoc(ref, normalized);
    setSettings(normalized);
  }

  return { settings, loading, saveSettings };
}
