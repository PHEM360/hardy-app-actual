import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAuth } from "@/auth/AuthContext";
import {
  APP_THEMES,
  applyThemeVars,
  getLoaderPreset,
  getTheme,
  type AppTheme,
} from "@/lib/appThemes";

type AppearancePatch = {
  themeId?: string;
  customPrimary?: string;
  customAccent?: string;
  loaderPreset?: string;
  loaderLeft?: string;
  loaderRight?: string;
};

export interface AppearanceState {
  themeId: string;
  customPrimary?: string;
  customAccent?: string;
  loaderPreset: string;
  theme: AppTheme;
  loader: { id: string; label: string; left: string; right: string };
  setThemeId: (id: string) => void;
  setCustomColors: (primary?: string, accent?: string) => void;
  setLoaderPreset: (id: string) => void;
  setLoaderEmojis: (left: string, right: string) => void;
}

const AppearanceContext = createContext<AppearanceState | null>(null);

const STORAGE_KEY = "appearance";

function readStored(): AppearancePatch | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null") as AppearancePatch | null;
  } catch {
    return null;
  }
}

const boot = readStored();
if (boot?.themeId) {
  applyThemeVars(getTheme(boot.themeId), boot.customPrimary, boot.customAccent);
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const { viewAs } = useAuth();
  const { profile, saveProfile } = useUserProfile();
  const [draft, setDraft] = useState<AppearancePatch>({});
  const stored = viewAs ? null : readStored();
  const appearance = { ...(stored || {}), ...(profile?.appearance || {}), ...draft };
  const themeId = appearance.themeId || "default";
  const customPrimary = appearance.customPrimary || undefined;
  const customAccent = appearance.customAccent || undefined;
  const loaderPreset = appearance.loaderPreset || "dogs";
  const theme = getTheme(themeId);
  const preset = getLoaderPreset(loaderPreset);
  const loader = {
    ...preset,
    left: appearance.loaderLeft || preset.left,
    right: appearance.loaderRight || preset.right,
  };

  useEffect(() => {
    applyThemeVars(theme, customPrimary, customAccent);
    const obs = new MutationObserver(() => applyThemeVars(theme, customPrimary, customAccent));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, [theme, customPrimary, customAccent]);

  const persist = useCallback((patch: AppearancePatch) => {
    const next = {
      themeId: patch.themeId ?? themeId,
      customPrimary: patch.customPrimary !== undefined ? patch.customPrimary : customPrimary,
      customAccent: patch.customAccent !== undefined ? patch.customAccent : customAccent,
      loaderPreset: patch.loaderPreset ?? loaderPreset,
      loaderLeft: patch.loaderLeft !== undefined ? patch.loaderLeft : appearance.loaderLeft,
      loaderRight: patch.loaderRight !== undefined ? patch.loaderRight : appearance.loaderRight,
    };
    setDraft(next);
    saveProfile({ appearance: next });
    if (typeof window !== "undefined" && !viewAs) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  }, [themeId, customPrimary, customAccent, loaderPreset, appearance.loaderLeft, appearance.loaderRight, saveProfile, viewAs]);

  const setThemeId = useCallback((id: string) => {
    const nextTheme = getTheme(id);
    persist({
      themeId: id,
      customPrimary: "",
      customAccent: "",
      loaderPreset: nextTheme.defaultLoader,
      loaderLeft: "",
      loaderRight: "",
    });
  }, [persist]);

  const setCustomColors = useCallback((primary?: string, accent?: string) => {
    persist({
      customPrimary: primary ?? customPrimary ?? "",
      customAccent: accent ?? customAccent ?? "",
    });
  }, [persist, customPrimary, customAccent]);

  const setLoaderPreset = useCallback((id: string) => {
    persist({ loaderPreset: id, loaderLeft: "", loaderRight: "" });
  }, [persist]);

  const setLoaderEmojis = useCallback((left: string, right: string) => {
    persist({ loaderLeft: left, loaderRight: right });
  }, [persist]);

  const value = useMemo<AppearanceState>(() => ({
    themeId,
    customPrimary,
    customAccent,
    loaderPreset,
    theme,
    loader,
    setThemeId,
    setCustomColors,
    setLoaderPreset,
    setLoaderEmojis,
  }), [themeId, customPrimary, customAccent, loaderPreset, theme, loader, setThemeId, setCustomColors, setLoaderPreset, setLoaderEmojis]);

  return createElement(AppearanceContext.Provider, { value }, children);
}

export function useAppearance() {
  const ctx = useContext(AppearanceContext);
  if (!ctx) {
    return {
      themeId: "default",
      loaderPreset: "dogs",
      theme: APP_THEMES[0],
      loader: getLoaderPreset("dogs"),
      setThemeId: () => {},
      setCustomColors: () => {},
      setLoaderPreset: () => {},
      setLoaderEmojis: () => {},
    } as AppearanceState;
  }
  return ctx;
}
