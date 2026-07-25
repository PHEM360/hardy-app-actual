import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useMyHouseholds } from "@/hooks/useHouseholds";

const STORAGE_KEY_PREFIX = "active-household:";

export interface HouseholdOption {
  id: string;
  name: string;
}

function normaliseHouseholdIds(ids: string[] | undefined, fallbackId?: string): string[] {
  const next = (ids ?? []).map((id) => id.trim()).filter(Boolean);
  if (!next.length && fallbackId?.trim()) {
    next.push(fallbackId.trim());
  }
  return Array.from(new Set(next));
}

export function useActiveHousehold() {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();
  const { households, loading: householdsLoading } = useMyHouseholds();
  const [activeHouseholdId, setActiveHouseholdIdState] = useState<string | null>(null);

  // Legacy fallback: household ids assigned via Admin's free-text field before a
  // real households/{id} doc existed for them (or before the backfill has run).
  // Unioned with the live households query so access never regresses.
  const legacyIds = useMemo(
    () => normaliseHouseholdIds(profile?.householdIds, profile?.householdId),
    [profile?.householdId, profile?.householdIds]
  );

  const availableHouseholds = useMemo<HouseholdOption[]>(() => {
    const byId = new Map<string, HouseholdOption>();
    households.forEach((h) => byId.set(h.id, { id: h.id, name: h.name || h.id }));
    legacyIds.forEach((id) => {
      if (!byId.has(id)) byId.set(id, { id, name: id });
    });
    if (byId.size === 0 && user?.uid) {
      byId.set(user.uid, { id: user.uid, name: user.uid });
    }
    return Array.from(byId.values());
  }, [households, legacyIds, user?.uid]);

  const availableHouseholdIds = useMemo(
    () => availableHouseholds.map((h) => h.id),
    [availableHouseholds]
  );

  useEffect(() => {
    if (!user) {
      setActiveHouseholdIdState(null);
      return;
    }

    const storageKey = `${STORAGE_KEY_PREFIX}${user.uid}`;
    const stored = typeof window === "undefined" ? null : window.localStorage.getItem(storageKey);
    const next = stored && availableHouseholdIds.includes(stored)
      ? stored
      : (availableHouseholdIds[0] ?? user.uid);

    setActiveHouseholdIdState(next);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, next);
    }
  }, [availableHouseholdIds, user]);

  const setActiveHouseholdId = (householdId: string) => {
    if (!user || !availableHouseholdIds.includes(householdId)) return;
    setActiveHouseholdIdState(householdId);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`${STORAGE_KEY_PREFIX}${user.uid}`, householdId);
    }
  };

  return {
    activeHouseholdId,
    availableHouseholds,
    loading: profileLoading || householdsLoading,
    hasExplicitHouseholds: availableHouseholds.length > 0 && (legacyIds.length > 0 || households.length > 0),
    setActiveHouseholdId,
  };
}
