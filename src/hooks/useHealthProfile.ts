import { useEffect, useState, useCallback } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { differenceInYears, parseISO } from "date-fns";
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
  dob?: string;          // ISO date string e.g. "1990-05-15" — age calculated from this
  age?: number;          // kept for backwards compat, ignored when dob present
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

export function useHealthProfile(scopeUserId?: string) {
  const { dataUid } = useAuth();
  const uid = scopeUserId ?? dataUid;
  const [profile, setProfile] = useState<HealthProfile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setProfile(DEFAULT_PROFILE); setLoading(false); return; }

    const unsub = onSnapshot(doc(db, "healthProfile", uid), (snap) => {
      if (snap.exists()) {
        setProfile({ ...DEFAULT_PROFILE, ...(snap.data() as Partial<HealthProfile>) });
      }
      setLoading(false);
    }, () => setLoading(false));

    return unsub;
  }, [uid]);

  const saveProfile = useCallback(async (updates: Partial<HealthProfile>) => {
    if (!uid) return;
    await setDoc(doc(db, "healthProfile", uid), updates, { merge: true });
  }, [uid]);

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

/** Calculate current age in years from an ISO date-of-birth string */
export function ageFromDob(dob: string): number {
  return differenceInYears(new Date(), parseISO(dob));
}

/** Get the resolved age: from dob if present, else from legacy age field */
export function resolvedAge(profile: HealthProfile): number | undefined {
  if (profile.dob) return ageFromDob(profile.dob);
  return profile.age;
}
