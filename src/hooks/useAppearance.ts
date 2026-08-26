import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAuth } from "@/auth/AuthContext";
import {
  APP_THEMES,
  applyThemeVars,
  getLoaderPreset,
  getTheme,
  type AppTheme,
  type LoaderMotion,
} from "@/lib/appThemes";

export type AppearancePatch = {
  themeId?: string;
  customPrimary?: string;
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

export function mergeAppearance(current: AppearancePatch, patch: AppearancePatch): AppearancePatch {
  return {
    themeId: patch.themeId ?? current.themeId,
    customPrimary: patch.customPrimary !== undefined ? patch.customPrimary : current.customPrimary,
    customAccent: patch.customAccent !== undefined ? patch.customAccent : current.customAccent,
    loaderPreset: patch.loaderPreset ?? current.loaderPreset,
    loaderLeft: patch.loaderLeft !== undefined ? patch.loaderLeft : current.loaderLeft,
    loaderRight: patch.loaderRight !== undefined ? patch.loaderRight : current.loaderRight,
    headerScene: patch.headerScene !== undefined ? patch.headerScene : current.headerScene,
    headerColor: patch.headerColor !== undefined ? patch.headerColor : current.headerColor,
    headerPhotoUrl: patch.headerPhotoUrl !== undefined ? patch.headerPhotoUrl : current.headerPhotoUrl,
    headerShowWeather: patch.headerShowWeather !== undefined ? patch.headerShowWeather : current.headerShowWeather,
    headerShowDate: patch.headerShowDate !== undefined ? patch.headerShowDate : current.headerShowDate,
    headerShowTime: patch.headerShowTime !== undefined ? patch.headerShowTime : current.headerShowTime,
    greetingScene: patch.greetingScene !== undefined ? patch.greetingScene : current.greetingScene,
    greetingColor: patch.greetingColor !== undefined ? patch.greetingColor : current.greetingColor,
    greetingPhotoUrl: patch.greetingPhotoUrl !== undefined ? patch.greetingPhotoUrl : current.greetingPhotoUrl,
    greetingMatchHeader: patch.greetingMatchHeader !== undefined ? patch.greetingMatchHeader : current.greetingMatchHeader,
  };
}

export interface AppearanceState {
  themeId: string;
  customPrimary?: string;
  customAccent?: string;
  loaderPreset: string;
  theme: AppTheme;
  loader: { id: string; label: string; left: string; right: string; motion?: LoaderMotion };
  headerScene: string;
  headerColor: string;
  headerPhotoUrl: string;
  headerShowWeather: boolean;
  headerShowDate: boolean;
  headerShowTime: boolean;
  greetingScene: string;
  greetingColor: string;
  greetingPhotoUrl: string;
  greetingMatchHeader: boolean;
  setThemeId: (id: string) => void;
  setCustomColors: (primary?: string, accent?: string) => void;
  setLoaderPreset: (id: string) => void;
  setLoaderEmojis: (left: string, right: string) => void;
  setHeaderDisplay: (patch: AppearancePatch) => void;
  setGreetingDisplay: (patch: AppearancePatch) => void;
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
  const headerScene = appearance.headerScene || "auto";
  const headerColor = appearance.headerColor || "";
  const headerPhotoUrl = appearance.headerPhotoUrl || "";
  const headerShowWeather = appearance.headerShowWeather === true;
  const headerShowDate = appearance.headerShowDate !== false;
  const headerShowTime = appearance.headerShowTime !== false;
  const greetingMatchHeader = appearance.greetingMatchHeader === true;
  const greetingScene = appearance.greetingScene || "weather";
  const greetingColor = appearance.greetingColor || "";
  const greetingPhotoUrl = appearance.greetingPhotoUrl || "";

  useEffect(() => {
    applyThemeVars(theme, customPrimary, customAccent);
    const obs = new MutationObserver(() => applyThemeVars(theme, customPrimary, customAccent));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, [theme, customPrimary, customAccent]);

  const persist = useCallback((patch: AppearancePatch) => {
    const next = mergeAppearance({
      themeId,
      customPrimary,
      customAccent,
      loaderPreset,
      loaderLeft: appearance.loaderLeft,
      loaderRight: appearance.loaderRight,
      headerScene,
      headerColor,
      headerPhotoUrl,
      headerShowWeather,
      headerShowDate,
      headerShowTime,
      greetingScene,
      greetingColor,
      greetingPhotoUrl,
      greetingMatchHeader,
    }, patch);
    setDraft(next);
    saveProfile({ appearance: next });
    if (typeof window !== "undefined" && !viewAs) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  }, [
    themeId, customPrimary, customAccent, loaderPreset, appearance.loaderLeft, appearance.loaderRight,
    headerScene, headerColor, headerPhotoUrl, headerShowWeather, headerShowDate, headerShowTime,
    greetingScene, greetingColor, greetingPhotoUrl, greetingMatchHeader, saveProfile, viewAs,
  ]);

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

  const setHeaderDisplay = useCallback((patch: AppearancePatch) => {
    persist(patch);
  }, [persist]);

  const setGreetingDisplay = useCallback((patch: AppearancePatch) => {
    persist(patch);
  }, [persist]);

  const value = useMemo<AppearanceState>(() => ({
    themeId,
    customPrimary,
    customAccent,
    loaderPreset,
    theme,
    loader,
    headerScene,
    headerColor,
    headerPhotoUrl,
    headerShowWeather,
    headerShowDate,
    headerShowTime,
    greetingScene,
    greetingColor,
    greetingPhotoUrl,
    greetingMatchHeader,
    setThemeId,
    setCustomColors,
    setLoaderPreset,
    setLoaderEmojis,
    setHeaderDisplay,
    setGreetingDisplay,
  }), [
    themeId, customPrimary, customAccent, loaderPreset, theme, loader,
    headerScene, headerColor, headerPhotoUrl, headerShowWeather, headerShowDate, headerShowTime,
    greetingScene, greetingColor, greetingPhotoUrl, greetingMatchHeader,
    setThemeId, setCustomColors, setLoaderPreset, setLoaderEmojis, setHeaderDisplay, setGreetingDisplay,
  ]);

  return createElement(AppearanceContext.Provider, { value }, children);
}

const FALLBACK: AppearanceState = {
  themeId: "default",
  loaderPreset: "dogs",
  theme: APP_THEMES[0],
  loader: getLoaderPreset("dogs"),
  headerScene: "auto",
  headerColor: "",
  headerPhotoUrl: "",
  headerShowWeather: false,
  headerShowDate: true,
  headerShowTime: true,
  greetingScene: "weather",
  greetingColor: "",
  greetingPhotoUrl: "",
  greetingMatchHeader: false,
  setThemeId: () => {},
  setCustomColors: () => {},
  setLoaderPreset: () => {},
  setLoaderEmojis: () => {},
  setHeaderDisplay: () => {},
  setGreetingDisplay: () => {},
};

export function useAppearance() {
  const ctx = useContext(AppearanceContext);
  return ctx ?? FALLBACK;
}
