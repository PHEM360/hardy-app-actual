import { useCallback, useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  DEFAULT_SHARED_CATEGORY_SETTINGS,
  SHARED_CATEGORY_SETTINGS_ID,
  sortCategoriesOtherLast,
  type SharedCategorySettings,
} from "@/types/app";

function normalize(settings: Partial<SharedCategorySettings> | undefined): SharedCategorySettings {
  return {
    incomeCategories: sortCategoriesOtherLast(
      settings?.incomeCategories?.length ? settings.incomeCategories : DEFAULT_SHARED_CATEGORY_SETTINGS.incomeCategories,
    ),
    expenseCategories: sortCategoriesOtherLast(
      settings?.expenseCategories?.length ? settings.expenseCategories : DEFAULT_SHARED_CATEGORY_SETTINGS.expenseCategories,
    ),
    documentCategories: sortCategoriesOtherLast(
      settings?.documentCategories?.length ? settings.documentCategories : DEFAULT_SHARED_CATEGORY_SETTINGS.documentCategories,
    ),
  };
}

export function useSharedCategorySettings() {
  const [settings, setSettings] = useState<SharedCategorySettings>(DEFAULT_SHARED_CATEGORY_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = doc(db, "companySettings", SHARED_CATEGORY_SETTINGS_ID);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setSettings(normalize(snap.data() as SharedCategorySettings | undefined));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, []);

  const saveSettings = useCallback(async (updated: SharedCategorySettings) => {
    const normalized = normalize(updated);
    // Write only the shared category fields — never merge per-company tax fields onto __family__.
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
