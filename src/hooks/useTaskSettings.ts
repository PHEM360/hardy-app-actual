import { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";
import { TaskSettings } from "@/types/app";

const DEFAULT_CATEGORIES = [
  "Admin", "Development", "Marketing", "Finance", "Legal",
  "Personal", "Operations", "HR", "Other",
];

const DEFAULT_SETTINGS: TaskSettings = {
  categories: DEFAULT_CATEGORIES,
  companies: [],
  customFields: [],
};

export function useTaskSettings() {
  const { dataUid } = useAuth();
  const [settings, setSettings] = useState<TaskSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dataUid) return;
    const ref = doc(db, "taskSettings", dataUid);
    getDoc(ref).then((snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<TaskSettings>;
        setSettings({
          categories: data.categories ?? DEFAULT_CATEGORIES,
          companies: data.companies ?? [],
          customFields: data.customFields ?? [],
          categoryColors: data.categoryColors ?? {},
          companyColors: data.companyColors ?? {},
          showCompleted: data.showCompleted ?? false,
        });
      }
    }).finally(() => setLoading(false));
  }, [dataUid]);

  const saveSettings = async (next: TaskSettings) => {
    if (!dataUid) return;
    const ref = doc(db, "taskSettings", dataUid);
    await setDoc(ref, next);
    setSettings(next);
  };

  return { settings, loading, saveSettings };
}
