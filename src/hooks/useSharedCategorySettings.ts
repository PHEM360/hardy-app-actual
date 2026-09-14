import { useCallback, useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { normalizeSharedCategories } from "@/lib/sharedCategories";
import {
  DEFAULT_SHARED_CATEGORY_SETTINGS,
  SHARED_CATEGORY_SETTINGS_ID,
  type SharedCategorySettings,
} from "@/types/app";

export function useSharedCategorySettings() {
  const [settings, setSettings] = useState<SharedCategorySettings>(DEFAULT_SHARED_CATEGORY_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = doc(db, "companySettings", SHARED_CATEGORY_SETTINGS_ID);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setSettings(normalizeSharedCategories(snap.exists() ? (snap.data() as SharedCategorySettings) : undefined));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, []);

  const saveSettings = useCallback(async (updated: SharedCategorySettings) => {
    const normalized = normalizeSharedCategories({
      incomeCategories: updated.incomeCategories,
      expenseCategories: updated.expenseCategories,
      documentCategories: updated.documentCategories,
    });
    await setDoc(
      doc(db, "companySettings", SHARED_CATEGORY_SETTINGS_ID),
      {
        incomeCategories: normalized.incomeCategories,
        expenseCategories: normalized.expenseCategories,
        documentCategories: normalized.documentCategories,
      },
      { merge: true },
    );
    setSettings(normalized);
  }, []);

  return { settings, loading, saveSettings };
}
