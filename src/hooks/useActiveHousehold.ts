import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/auth/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useMyHouseholds } from "@/hooks/useHouseholds";
import { looksLikeGeneratedId } from "@/lib/householdIds";

const STORAGE_KEY_PREFIX = "active-household:";

export interface HouseholdOption {
  id: string;
  name: string;
}

interface ActiveHouseholdState {
  activeHouseholdId: string | null;
  availableHouseholds: HouseholdOption[];
  loading: boolean;
  hasExplicitHouseholds: boolean;
  setActiveHouseholdId: (householdId: string) => void;
}

const ActiveHouseholdContext = createContext<ActiveHouseholdState | null>(null);

function normaliseHouseholdIds(ids: string[] | undefined, fallbackId?: string): string[] {
  const next = (ids ?? []).map((id) => id.trim()).filter(Boolean);
  if (!next.length && fallbackId?.trim()) {
    next.push(fallbackId.trim());
  }
  return Array.from(new Set(next));
}

export function ActiveHouseholdProvider({ children }: { children: ReactNode }) {
  const { dataUid } = useAuth();
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
    households.forEach((h) => {
      const name = h.name?.trim() || h.id;
      if (looksLikeGeneratedId(name)) return;
      byId.set(h.id, { id: h.id, name });
    });
    legacyIds.forEach((id) => {
      if (byId.has(id) || looksLikeGeneratedId(id) || id === dataUid) return;
      byId.set(id, { id, name: id });
    });
    return Array.from(byId.values());
  }, [households, legacyIds, dataUid]);

  const availableHouseholdIds = useMemo(
    () => availableHouseholds.map((h) => h.id),
    [availableHouseholds]
  );

  useEffect(() => {
    if (!dataUid) {
      setActiveHouseholdIdState(null);
      return;
    }

    const storageKey = `${STORAGE_KEY_PREFIX}${dataUid}`;
    const stored = typeof window === "undefined" ? null : window.localStorage.getItem(storageKey);
    const next = stored && availableHouseholdIds.includes(stored)
      ? stored
      : (availableHouseholdIds[0] ?? null);

    setActiveHouseholdIdState((current) => {
      const resolved = current && availableHouseholdIds.includes(current) ? current : next;
      if (resolved && typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, resolved);
      }
      return resolved;
    });
  }, [availableHouseholdIds, dataUid]);

  const setActiveHouseholdId = useCallback((householdId: string) => {
    if (!dataUid || !availableHouseholdIds.includes(householdId)) return;
    setActiveHouseholdIdState(householdId);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`${STORAGE_KEY_PREFIX}${dataUid}`, householdId);
    }
  }, [dataUid, availableHouseholdIds]);

  const value = useMemo<ActiveHouseholdState>(() => ({
    activeHouseholdId,
    availableHouseholds,
    loading: profileLoading || householdsLoading,
    hasExplicitHouseholds: availableHouseholds.length > 0,
    setActiveHouseholdId,
  }), [activeHouseholdId, availableHouseholds, profileLoading, householdsLoading, legacyIds.length, households.length, setActiveHouseholdId]);

  return createElement(ActiveHouseholdContext.Provider, { value }, children);
}

export function useActiveHousehold() {
  const ctx = useContext(ActiveHouseholdContext);
  if (!ctx) {
    throw new Error("useActiveHousehold must be used within ActiveHouseholdProvider");
  }
  return ctx;
}
