import { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CompanySettings, DEFAULT_COMPANY_SETTINGS, sortCategoriesOtherLast } from "@/types/app";

// Income/expense categories are shared across every company now (see
// useSharedCategorySettings / companySettings/shared_family) — saveSettings
// below deliberately never writes them per-company. Some companies still
// carry the fields from before that migration; normalize() ignores them
// entirely rather than reading stale data no UI can ever update again.
function normalize(settings: CompanySettings): CompanySettings {
  return {
    ...settings,
    incomeCategories: sortCategoriesOtherLast(DEFAULT_COMPANY_SETTINGS.incomeCategories),
    expenseCategories: sortCategoriesOtherLast(DEFAULT_COMPANY_SETTINGS.expenseCategories),
    corporateTaxRate: Number.isFinite(settings.corporateTaxRate)
      ? settings.corporateTaxRate
      : DEFAULT_COMPANY_SETTINGS.corporateTaxRate,
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

  async function saveSettings(updated: Partial<CompanySettings>) {
    const next = normalize({ ...settings, ...updated });
    const ref = doc(db, "companySettings", companyId);
    // Persist tax rate only — shared income/expense lists live on companySettings/shared_family.
    await setDoc(ref, { corporateTaxRate: next.corporateTaxRate }, { merge: true });
    setSettings(next);
  }

  return { settings, loading, saveSettings };
}
