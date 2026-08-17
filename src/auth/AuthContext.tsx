import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

const SUPERADMIN_EMAILS = new Set(["chris.hardy.07@googlemail.com"]);
const VIEW_AS_STORAGE_KEY = "family-vault-view-as";

export interface ViewAsUser {
  uid: string;
  name: string;
  email: string;
}

export interface AuthState {
  user: User | null;
  initializing: boolean;
  forbidden: boolean;
  /** Real signed-in uid, or the impersonated uid when viewing as someone else. */
  dataUid: string | null;
  viewAs: ViewAsUser | null;
  canViewAs: boolean;
  startViewAs: (target: ViewAsUser) => void;
  stopViewAs: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

function readStoredViewAs(): ViewAsUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(VIEW_AS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ViewAsUser>;
    if (!parsed?.uid || typeof parsed.uid !== "string") return null;
    return {
      uid: parsed.uid,
      name: typeof parsed.name === "string" ? parsed.name : parsed.uid,
      email: typeof parsed.email === "string" ? parsed.email : "",
    };
  } catch {
    return null;
  }
}

function persistViewAs(target: ViewAsUser | null) {
  if (typeof window === "undefined") return;
  try {
    if (target) window.sessionStorage.setItem(VIEW_AS_STORAGE_KEY, JSON.stringify(target));
    else window.sessionStorage.removeItem(VIEW_AS_STORAGE_KEY);
  } catch {
    // Ignore quota / private-mode failures
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [viewAs, setViewAs] = useState<ViewAsUser | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setInitializing(false);
      setForbidden(false);

      if (!u) {
        setUser(null);
        setViewAs(null);
        persistViewAs(null);
        return;
      }

      setUser(u);
      const isSuperAdmin = SUPERADMIN_EMAILS.has(u.email || "");
      if (!isSuperAdmin) {
        setViewAs(null);
        persistViewAs(null);
        return;
      }

      const stored = readStoredViewAs();
      if (stored && stored.uid !== u.uid) setViewAs(stored);
      else setViewAs(null);
    });

    return () => unsub();
  }, []);

  const stopViewAs = useCallback(() => {
    setViewAs(null);
    persistViewAs(null);
  }, []);

  const startViewAs = useCallback((target: ViewAsUser) => {
    if (!user || !SUPERADMIN_EMAILS.has(user.email || "")) return;
    if (!target.uid || target.uid === user.uid) {
      stopViewAs();
      return;
    }
    setViewAs(target);
    persistViewAs(target);
  }, [user, stopViewAs]);

  const value = useMemo<AuthState>(() => ({
    user,
    initializing,
    forbidden,
    dataUid: viewAs?.uid ?? user?.uid ?? null,
    viewAs,
    canViewAs: SUPERADMIN_EMAILS.has(user?.email || ""),
    startViewAs,
    stopViewAs,
  }), [user, initializing, forbidden, viewAs, startViewAs, stopViewAs]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
