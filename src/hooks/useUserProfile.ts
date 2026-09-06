import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";
import type { FeatureKey } from "@/types/app";
import type { HomeLayoutMode, HomeTilesState } from "@/lib/homeLayout";

export interface UserProfile {
  uid: string;
  firstName: string;
  surname: string;
  displayName?: string;
  email: string;
  role: "superadmin" | "admin" | "member";
  enabledFeatures: FeatureKey[];
  householdId?: string;
  householdIds?: string[];   // user can belong to multiple named households
  suspended: boolean;
  avatarType?: string;
  avatarEmoji?: string;
  avatarInitials?: string;
  avatarBgColor?: string;
  avatarTextColor?: string;
  navItems?: string[];   // ordered list of route paths for bottom nav
  appearance?: {
    themeId?: string;
    customPrimary?: string; // HSL components, e.g. "178 62% 30%"
    customAccent?: string;
    loaderPreset?: string;
    loaderLeft?: string;
    loaderRight?: string;
    headerScene?: string;
    headerColor?: string;
    headerPhotoUrl?: string;
    headerShowWeather?: boolean;
    headerShowDate?: boolean;
    headerShowTime?: boolean;
    greetingScene?: string;
    greetingColor?: string;
    greetingPhotoUrl?: string;
    greetingMatchHeader?: boolean;
  };
  quickLinks?: string[];
  homeLayout?: HomeLayoutMode;
  homeTiles?: HomeTilesState;
  defaultRoute?: string;
}

export function useUserProfile() {
  const { dataUid, user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dataUid) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const ref = doc(db, "users", dataUid);
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
          uid: dataUid,
          firstName: data.firstName ?? "",
          surname: data.surname ?? "",
          displayName: data.displayName,
          email: data.email ?? (dataUid === user?.uid ? (user?.email ?? "") : ""),
          role,
          enabledFeatures: Array.isArray(data.enabledFeatures) ? data.enabledFeatures : [],
          householdId: data.householdId,
          householdIds: Array.isArray(data.householdIds) ? data.householdIds : (data.householdId ? [data.householdId] : []),
          suspended: data.enabled === false,
          avatarType: data.avatarType ?? "initials",
          avatarEmoji: data.avatarEmoji ?? "😊",
          avatarInitials: data.avatarInitials,
          avatarBgColor: data.avatarBgColor,
          avatarTextColor: data.avatarTextColor,
          navItems: Array.isArray(data.navItems) ? data.navItems : undefined,
          appearance: data.appearance && typeof data.appearance === "object" ? data.appearance : undefined,
          quickLinks: Array.isArray(data.quickLinks) ? data.quickLinks : undefined,
          homeLayout: data.homeLayout === "today" || data.homeLayout === "tiles" ? data.homeLayout : undefined,
          homeTiles: data.homeTiles && typeof data.homeTiles === "object" ? data.homeTiles : undefined,
          defaultRoute: typeof data.defaultRoute === "string" ? data.defaultRoute : undefined,
        });
        setLoading(false);
      },
      () => {
        setProfile(null);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [dataUid, user?.uid, user?.email]);

  const saveProfile = async (updates: Partial<Omit<UserProfile, "uid" | "role" | "enabledFeatures" | "suspended">>) => {
    if (!dataUid) return;
    const ref = doc(db, "users", dataUid);
    await setDoc(ref, updates, { merge: true });
  };

  return { profile, loading, saveProfile };
}
