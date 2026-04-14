import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";
import type { FeatureKey } from "@/types/app";

export interface UserProfile {
  uid: string;
  firstName: string;
  surname: string;
  displayName?: string;
  email: string;
  role: "superadmin" | "admin" | "member";
  enabledFeatures: FeatureKey[];
  householdId?: string;
  suspended: boolean;
}

export function useUserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.data() as any;
        if (!data) {
          setProfile(null);
          setLoading(false);
          return;
        }

        const rawRole = String(data.role || "").toLowerCase().replace(/\s+/g, "").replace(/-/g, "");
        let role: UserProfile["role"] = "member";
        if (rawRole === "superadmin" || data.isSuperAdmin === true) role = "superadmin";
        else if (rawRole === "admin" || data.isAdmin === true) role = "admin";

        setProfile({
          uid: user.uid,
          firstName: data.firstName ?? "",
          surname: data.surname ?? "",
          displayName: data.displayName,
          email: data.email ?? user.email ?? "",
          role,
          enabledFeatures: Array.isArray(data.enabledFeatures) ? data.enabledFeatures : [],
          householdId: data.householdId,
          suspended: data.enabled === false,
        });
        setLoading(false);
      },
      () => {
        setProfile(null);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user?.uid]);

  return { profile, loading };
}
