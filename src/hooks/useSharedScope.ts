import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/auth/AuthContext";
import { useAppUsers } from "@/hooks/useAppUsers";
import { usePageShares, type SharePermission } from "@/hooks/usePageShares";

const STORAGE_KEY_PREFIX = "shared-scope:";

export const PAGE_NOUNS: Record<string, string> = {
  finance: "Finances",
  tasks: "Tasks",
  health: "Health",
  calendar: "Calendar",
  freezer: "Freezer",
  qrcodes: "QR Codes",
  pets: "Pets",
  companies: "Companies",
  login_details: "Log Ins",
  annual_leave: "Annual Leave",
  holidays: "Holidays",
  ai_analysis: "AI Analysis",
  tattersalls: "Flats",
  inheritance: "IHT Planner",
  notes: "Notes",
};

export interface ScopeOption {
  uid: string;
  name: string;
  permission: SharePermission;
}

interface SharedScopeStore {
  scopes: Record<string, string>;
  setScope: (page: string, uid: string) => void;
}

const SharedScopeContext = createContext<SharedScopeStore | null>(null);

export function possessiveName(name: string) {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

export function formatPageTitle(page: string, name: string, isOwn: boolean) {
  const noun = PAGE_NOUNS[page] ?? "Page";
  if (isOwn) return page === "finance" ? "My Finances" : noun;
  return `${possessiveName(name)} ${noun}`;
}

export function formatViewLabel(page: string, name: string, isOwn: boolean) {
  const noun = PAGE_NOUNS[page] ?? "Page";
  if (isOwn) return `My ${noun}`;
  return `View ${possessiveName(name)} ${noun}`;
}

export function SharedScopeProvider({ children }: { children: ReactNode }) {
  const { dataUid } = useAuth();
  const [scopes, setScopes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!dataUid) setScopes({});
  }, [dataUid]);

  const setScope = useCallback((page: string, uid: string) => {
    setScopes((prev) => (prev[page] === uid ? prev : { ...prev, [page]: uid }));
    if (dataUid && typeof window !== "undefined") {
      window.localStorage.setItem(`${STORAGE_KEY_PREFIX}${page}:${dataUid}`, uid);
    }
  }, [dataUid]);

  const value = useMemo(() => ({ scopes, setScope }), [scopes, setScope]);

  return createElement(SharedScopeContext.Provider, { value }, children);
}

/**
 * Lets a page (finance, tasks, etc.) be viewed either as "my own data" or as
 * data another user has shared with me. Selected scope is shared app-wide so
 * the switcher and the page's data hooks stay in sync.
 */
export function useSharedScope(page: string) {
  const ctx = useContext(SharedScopeContext);
  if (!ctx) {
    throw new Error("useSharedScope must be used within SharedScopeProvider");
  }

  const { dataUid } = useAuth();
  const appUsers = useAppUsers();
  const { sharedWithMe, loading } = usePageShares(page);

  const availableScopes = useMemo<ScopeOption[]>(() => {
    const self: ScopeOption[] = dataUid ? [{ uid: dataUid, name: "Me", permission: "edit" }] : [];
    const others: ScopeOption[] = sharedWithMe.map((s) => ({
      uid: s.ownerId,
      name: appUsers.find((u) => u.id === s.ownerId)?.name || "Someone",
      permission: s.permission,
    }));
    return [...self, ...others];
  }, [dataUid, sharedWithMe, appUsers]);

  const availableScopeIds = useMemo(() => availableScopes.map((s) => s.uid), [availableScopes]);

  useEffect(() => {
    if (!dataUid) return;
    const storageKey = `${STORAGE_KEY_PREFIX}${page}:${dataUid}`;
    const stored = typeof window === "undefined" ? null : window.localStorage.getItem(storageKey);
    const current = ctx.scopes[page];
    if (current && availableScopeIds.includes(current)) return;
    if (stored && availableScopeIds.includes(stored)) {
      if (current !== stored) ctx.setScope(page, stored);
      return;
    }
    if (loading) return;
    if (current !== dataUid) ctx.setScope(page, dataUid);
  }, [availableScopeIds, dataUid, page, loading, ctx, ctx.scopes, ctx.setScope]);

  const setScopeUserId = useCallback((uid: string) => {
    if (!dataUid || !availableScopeIds.includes(uid)) return;
    ctx.setScope(page, uid);
  }, [dataUid, availableScopeIds, ctx, page]);

  const scopeUserId = ctx.scopes[page] ?? dataUid ?? null;
  const currentScope = availableScopes.find((s) => s.uid === scopeUserId);
  const isOwnScope = !scopeUserId || scopeUserId === dataUid;
  const permission: SharePermission = isOwnScope
    ? "edit"
    : currentScope?.permission ?? "view";

  const scopeName = isOwnScope ? "Me" : (currentScope?.name ?? "Someone");
  const pageTitle = formatPageTitle(page, scopeName, isOwnScope);

  return {
    scopeUserId,
    permission,
    availableScopes,
    setScopeUserId,
    loading,
    isOwnScope,
    scopeName,
    pageTitle,
  };
}
