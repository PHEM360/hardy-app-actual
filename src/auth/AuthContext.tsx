import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

const SUPERADMIN_EMAILS = new Set(["chris.hardy.07@googlemail.com"]);

export interface AuthState {
  user: User | null;
  initializing: boolean;
  forbidden: boolean;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setInitializing(false);
      setForbidden(false);

      if (!u) {
        setUser(null);
        return;
      }

      setUser(u);
    });

    return () => unsub();
  }, []);

  const value = useMemo<AuthState>(() => ({ user, initializing, forbidden }), [user, initializing, forbidden]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
