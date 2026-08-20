import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { hashPin } from "@/lib/noteCrypto";
import type { NotesVaultSettings } from "@/types/notes";

const SESSION_KEY = "hardy-hub-notes-vault";
const SESSION_MS = 15 * 60 * 1000;

interface VaultSession {
  unlockedAt: number;
  pin?: string;
}

interface NoteVaultStore {
  unlocked: boolean;
  pin: string | null;
  unlockWithPin: (pin: string, settings: NotesVaultSettings) => Promise<void>;
  markUnlocked: (pin?: string) => void;
  lock: () => void;
}

const Ctx = createContext<NoteVaultStore | null>(null);

function readSession(): VaultSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VaultSession;
    if (!parsed?.unlockedAt || Date.now() - parsed.unlockedAt > SESSION_MS) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function NoteVaultProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<VaultSession | null>(() => (typeof window === "undefined" ? null : readSession()));
  const timer = useRef<number | null>(null);

  const persist = useCallback((next: VaultSession | null) => {
    setSession(next);
    try {
      if (next) sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
      else sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const lock = useCallback(() => persist(null), [persist]);

  const markUnlocked = useCallback((pin?: string) => {
    persist({ unlockedAt: Date.now(), pin });
  }, [persist]);

  const unlockWithPin = useCallback(async (pin: string, settings: NotesVaultSettings) => {
    if (!settings.pinSalt || !settings.pinHash) throw new Error("No passcode is set");
    const { hash } = await hashPin(pin, settings.pinSalt);
    if (hash !== settings.pinHash) throw new Error("Incorrect passcode");
    markUnlocked(pin);
  }, [markUnlocked]);

  useEffect(() => {
    if (!session) return;
    const remaining = SESSION_MS - (Date.now() - session.unlockedAt);
    timer.current = window.setTimeout(lock, Math.max(1000, remaining));
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [session, lock]);

  const value = useMemo<NoteVaultStore>(() => ({
    unlocked: !!session,
    pin: session?.pin ?? null,
    unlockWithPin,
    markUnlocked,
    lock,
  }), [session, unlockWithPin, markUnlocked, lock]);

  return createElement(Ctx.Provider, { value }, children);
}

export function useNoteVault() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useNoteVault must be used within NoteVaultProvider");
  return ctx;
}
