import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { useAppUsers } from "@/hooks/useAppUsers";
import { usePageShares, type SharePermission } from "@/hooks/usePageShares";

const STORAGE_KEY_PREFIX = "shared-scope:";

export interface ScopeOption {
  uid: string;
  name: string;
  permission: SharePermission;
}

/**
 * Lets a page (finance, tasks, etc.) be viewed either as "my own data" or as
 * data another user has shared with me. Mirrors useActiveHousehold's shape.
 */
export function useSharedScope(page: string) {
  const { user } = useAuth();
  const appUsers = useAppUsers();
  const { sharedWithMe, loading } = usePageShares(page);
  const [scopeUserId, setScopeUserIdState] = useState<string | null>(null);

  const availableScopes = useMemo<ScopeOption[]>(() => {
    const self: ScopeOption[] = user ? [{ uid: user.uid, name: "Me", permission: "edit" }] : [];
    const others: ScopeOption[] = sharedWithMe.map((s) => ({
      uid: s.ownerId,
      name: appUsers.find((u) => u.id === s.ownerId)?.name || "Someone",
      permission: s.permission,
    }));
    return [...self, ...others];
  }, [user, sharedWithMe, appUsers]);

  const availableScopeIds = useMemo(() => availableScopes.map((s) => s.uid), [availableScopes]);

  useEffect(() => {
    if (!user) {
      setScopeUserIdState(null);
      return;
    }
    const storageKey = `${STORAGE_KEY_PREFIX}${page}:${user.uid}`;
    const stored = typeof window === "undefined" ? null : window.localStorage.getItem(storageKey);
    const next = stored && availableScopeIds.includes(stored) ? stored : user.uid;
    setScopeUserIdState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, next);
    }
  }, [availableScopeIds, user, page]);

  const setScopeUserId = (uid: string) => {
    if (!user || !availableScopeIds.includes(uid)) return;
    setScopeUserIdState(uid);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`${STORAGE_KEY_PREFIX}${page}:${user.uid}`, uid);
    }
  };

  const permission: SharePermission = scopeUserId === user?.uid
    ? "edit"
    : availableScopes.find((s) => s.uid === scopeUserId)?.permission ?? "view";

  return {
    scopeUserId: scopeUserId ?? user?.uid ?? null,
    permission,
    availableScopes,
    setScopeUserId,
    loading,
  };
}
