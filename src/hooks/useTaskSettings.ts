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
  const { user } = useAuth();
  const [settings, setSettings] = useState<TaskSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "taskSettings", user.uid);
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
  }, [user]);

  const saveSettings = async (next: TaskSettings) => {
    if (!user) return;
    const ref = doc(db, "taskSettings", user.uid);
    await setDoc(ref, next);
    setSettings(next);
  };

  return { settings, loading, saveSettings };
}
