import { useEffect, useState, useCallback } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";

export type Sex            = "male" | "female";
export type ActivityLevel  = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type SmokingStatus  = "never" | "ex" | "current";
export type WeightGoal     = "lose" | "maintain" | "gain";

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary:  "Sedentary (desk job, little exercise)",
  light:      "Lightly active (1–3 days/week)",
  moderate:   "Moderately active (3–5 days/week)",
  active:     "Very active (6–7 days/week)",
  very_active:"Extra active (physical job + training)",
};

export interface HealthProfile {
  // Demographics
  age?: number;
  sex?: Sex;
  activityLevel?: ActivityLevel;
  smokingStatus?: SmokingStatus;
  alcoholUnitsPerWeek?: number;
  diabetic?: boolean;
  targetWeightGoal?: WeightGoal;

  // Medical history
  pastConditions: string[];   // e.g. "Hypertension", "Type 2 Diabetes"
  familyHistory: string[];    // e.g. "Heart disease (father)"
  allergies: string[];        // e.g. "Penicillin"
  surgeries: string[];        // e.g. "Appendectomy 2010"
  otherNotes?: string;

  // Overview show/hide prefs
  showWeightOnOverview: boolean;
  showBpOnOverview: boolean;
  showWaistOnOverview: boolean;
  showMedsOnOverview: boolean;
}

const DEFAULT_PROFILE: HealthProfile = {
  pastConditions: [],
  familyHistory:  [],
  allergies:      [],
  surgeries:      [],
  showWeightOnOverview: true,
  showBpOnOverview:     true,
  showWaistOnOverview:  true,
  showMedsOnOverview:   true,
};

export function useHealthProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<HealthProfile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setProfile(DEFAULT_PROFILE); setLoading(false); return; }

    const unsub = onSnapshot(doc(db, "healthProfile", user.uid), (snap) => {
      if (snap.exists()) {
        setProfile({ ...DEFAULT_PROFILE, ...(snap.data() as Partial<HealthProfile>) });
      }
      setLoading(false);
    }, () => setLoading(false));

    return unsub;
  }, [user?.uid]);

  const saveProfile = useCallback(async (updates: Partial<HealthProfile>) => {
    if (!user) return;
    await setDoc(doc(db, "healthProfile", user.uid), updates, { merge: true });
  }, [user]);

  return { profile, loading, saveProfile };
}

/** Calculate ideal weight range (healthy BMI 18.5–24.9) for a given height in cm */
export function idealWeightRange(heightCm: number): { min: number; max: number } {
  const h = heightCm / 100;
  return { min: +(18.5 * h * h).toFixed(1), max: +(24.9 * h * h).toFixed(1) };
}

/** Estimated target weight based on demographics and goal */
export function estimatedTargetWeight(heightCm: number, goal: WeightGoal): number {
  const h = heightCm / 100;
  const midBMI = goal === "lose" ? 22 : goal === "gain" ? 23 : 22;
  return +(midBMI * h * h).toFixed(1);
}
