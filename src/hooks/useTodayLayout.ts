import { useEffect, useState, useCallback, useRef } from "react";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";

export type TodayWidgetType =
  | "ai"
  | "focus"
  | "tasks"
  | "intentions"
  | "habits"
  | "water"
  | "mood"
  | "note"
  | "checklist"
  | "reflection"
  | "calendar"
  | "birthdays"
  | "tomorrow"
  | "overdue"
  | "quick_add"
  | "reminders"
  | "messages"
  | "photos"
  | "weather"
  | "bills"
  | "fun_fact"
  | "pets_care"
  | "week"
  | "quicklinks"
  | "clock";

export interface TodayWidgetItem {
  id: string;
  type: TodayWidgetType;
  xFrac: number;
  wFrac: number;
  y: number;
  h: number;
  tintColor?: string;
  /** Per-widget-type settings, e.g. Quick Links' chosen buttons or the Clock's 12h/24h format. */
  config?: Record<string, unknown>;
}

export interface TodayPageStyle {
  headerColor?: string;
  canvasTint?: string;
}

/**
 * Geometry + defaults used only the moment a widget type is first added —
 * once added, an item lives in the user's saved `layout` array and this is
 * no longer consulted for it. Widgets NOT in the saved layout simply don't
 * exist on the page; there is no separate "visible" flag any more.
 */
export const WIDGET_GEOMETRY_DEFAULTS: Record<TodayWidgetType, { wFrac: number; h: number }> = {
  ai:         { wFrac: 1.0, h: 200 },
  focus:      { wFrac: 1.0, h: 140 },
  tasks:      { wFrac: 0.5, h: 300 },
  intentions: { wFrac: 0.5, h: 300 },
  habits:     { wFrac: 0.5, h: 220 },
  water:      { wFrac: 0.5, h: 220 },
  mood:       { wFrac: 0.5, h: 180 },
  note:       { wFrac: 0.5, h: 180 },
  checklist:  { wFrac: 1.0, h: 220 },
  reflection: { wFrac: 1.0, h: 160 },
  calendar:   { wFrac: 1.0, h: 240 },
  birthdays:  { wFrac: 0.5, h: 220 },
  tomorrow:   { wFrac: 0.5, h: 200 },
  overdue:    { wFrac: 0.5, h: 200 },
  quick_add:  { wFrac: 0.5, h: 200 },
  reminders:  { wFrac: 0.5, h: 220 },
  messages:   { wFrac: 0.5, h: 220 },
  photos:     { wFrac: 1.0, h: 220 },
  weather:    { wFrac: 0.5, h: 220 },
  bills:      { wFrac: 0.5, h: 220 },
  fun_fact:   { wFrac: 0.5, h: 180 },
  pets_care:  { wFrac: 0.5, h: 180 },
  week:       { wFrac: 1.0, h: 160 },
  quicklinks: { wFrac: 1.0, h: 160 },
  clock:      { wFrac: 0.5, h: 160 },
};

/** Sensible starter set for a brand-new user who has never touched this page. */
const STARTER_TYPES: TodayWidgetType[] = ["tasks", "calendar", "birthdays"];

function buildDefaultLayout(): TodayWidgetItem[] {
  let y = 0;
  const items: TodayWidgetItem[] = [];
  for (const type of STARTER_TYPES) {
    const g = WIDGET_GEOMETRY_DEFAULTS[type];
    items.push({ id: type, type, xFrac: 0, wFrac: g.wFrac, y, h: g.h });
    y += g.h + 18;
  }
  return items;
}

export const TODAY_WIDGET_LABELS: Record<TodayWidgetType, string> = {
  ai: "AI Assistant",
  focus: "Today's Focus",
  tasks: "Today's Tasks",
  intentions: "Morning Intentions",
  habits: "Habit Tracker",
  water: "Water Tracker",
  mood: "Mood Check-in",
  note: "Daily Note",
  checklist: "Quick Checklist",
  reflection: "Evening Reflection",
  calendar: "Today's calendar",
  birthdays: "Birthdays",
  tomorrow: "Tomorrow",
  overdue: "Overdue tasks",
  quick_add: "Quick add",
  reminders: "Reminders",
  messages: "Family board",
  photos: "Photos",
  weather: "Weather",
  bills: "Bills & renewals",
  fun_fact: "Fun fact",
  pets_care: "Pet care",
  week: "This week",
  quicklinks: "Quick Links",
  clock: "Clock",
};

export const TODAY_WIDGET_ICONS: Record<TodayWidgetType, string> = {
  ai: "🤖",
  focus: "🎯",
  tasks: "✅",
  intentions: "🌅",
  habits: "🔥",
  water: "💧",
  mood: "😊",
  note: "📝",
  checklist: "☑️",
  reflection: "🌙",
  calendar: "📅",
  birthdays: "🎂",
  tomorrow: "🌤️",
  overdue: "⏰",
  quick_add: "⚡",
  reminders: "🔔",
  messages: "💬",
  photos: "🖼️",
  weather: "🌍",
  bills: "🧾",
  fun_fact: "✨",
  pets_care: "🐾",
  week: "🗓️",
  quicklinks: "🔗",
  clock: "🕒",
};

/** Widgets can be added more than once (e.g. two Quick Links boxes for different pages). */
export const REPEATABLE_WIDGET_TYPES: TodayWidgetType[] = ["quicklinks", "note"];

const LAYOUT_VERSION = 4;

export const TODAY_TINT_PRESETS = [
  { label: "Sky", value: "#e0f2fe" },
  { label: "Lemon", value: "#fef9c3" },
  { label: "Mint", value: "#dcfce7" },
  { label: "Lilac", value: "#f3e8ff" },
  { label: "Rose", value: "#ffe4e6" },
  { label: "Peach", value: "#ffedd5" },
  { label: "Slate", value: "#f1f5f9" },
  { label: "Teal", value: "#ccfbf1" },
];

/** Page-banner tint choices — same idea as the per-widget tints above, plus an
 *  explicit "Theme" swatch (an empty value falls back to the app's own default
 *  background, i.e. whatever the current theme's colours already are) and a
 *  wider set of options since this covers the whole page, not just one tile. */
export const PAGE_TINT_PRESETS = [
  { label: "Theme", value: "" },
  ...TODAY_TINT_PRESETS,
  { label: "Sand", value: "#f5f0e6" },
  { label: "Blush", value: "#fde2e7" },
  { label: "Ice", value: "#e6f6fb" },
  { label: "Sage", value: "#e7f0e3" },
  { label: "Wisteria", value: "#ece3fb" },
  { label: "Coral", value: "#ffe0d6" },
];

/** v3 items carried a `visible` flag and were always fully instantiated; keep only
 *  what was actually shown, drop the rest so they appear in "Add widget" instead. */
function migrateFromV3(saved: Array<TodayWidgetItem & { visible?: boolean }>): TodayWidgetItem[] {
  return saved
    .filter((w) => w.visible !== false)
    .map(({ visible: _visible, ...rest }) => rest);
}

export function useTodayLayout() {
  const { dataUid } = useAuth();
  const [layout, setLayout] = useState<TodayWidgetItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pageStyle, setPageStyleState] = useState<TodayPageStyle>({});
  const [saving, setSaving] = useState(false);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  useEffect(() => {
    if (!dataUid) return;
    const ref = doc(db, "users", dataUid);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setLayout(buildDefaultLayout());
        setLoaded(true);
        return;
      }
      const stored = snap.data()?.todayLayout;
      if (!stored || typeof stored !== "object") {
        void getDoc(doc(db, "todayLayouts", dataUid)).then((legacy) => {
          const data = legacy.data();
          if (!legacy.exists() || !Array.isArray(data?.layout)) {
            setLayout(buildDefaultLayout());
            setLoaded(true);
            return;
          }
          const migrated = migrateFromV3(data.layout);
          setLayout(migrated);
          setLoaded(true);
          setDoc(ref, {
            todayLayout: {
              layout: migrated,
              layoutVersion: LAYOUT_VERSION,
              pageStyle: data.pageStyle && typeof data.pageStyle === "object" ? data.pageStyle : {},
            },
          }, { merge: true }).catch(() => {});
        }).catch(() => {
          setLayout(buildDefaultLayout());
          setLoaded(true);
        });
        return;
      }
      const saved: TodayWidgetItem[] = Array.isArray(stored.layout) ? stored.layout : [];
      const savedVersion: number = stored.layoutVersion ?? 0;
      const style = (stored.pageStyle && typeof stored.pageStyle === "object") ? stored.pageStyle as TodayPageStyle : {};
      setPageStyleState(style);

      if (savedVersion < LAYOUT_VERSION) {
        const migrated = migrateFromV3(saved);
        setLayout(migrated);
        setLoaded(true);
        setDoc(ref, { todayLayout: { layout: migrated, layoutVersion: LAYOUT_VERSION, pageStyle: style } }, { merge: true }).catch(() => {});
        return;
      }

      setLayout(saved);
      setLoaded(true);
    });
    return unsub;
  }, [dataUid]);

  const saveLayout = useCallback(async (next: TodayWidgetItem[], style?: TodayPageStyle) => {
    if (!dataUid) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "users", dataUid), {
        todayLayout: {
          layout: next,
          layoutVersion: LAYOUT_VERSION,
          pageStyle: style ?? pageStyle,
        },
      }, { merge: true });
    } finally {
      setSaving(false);
    }
  }, [dataUid, pageStyle]);

  const updateWidget = useCallback((id: string, patch: Partial<TodayWidgetItem>) => {
    setLayout((prev) => {
      const next = prev.map((w) => w.id === id ? { ...w, ...patch } : w);
      saveLayout(next);
      return next;
    });
  }, [saveLayout]);

  /** Adds a new instance of `type` just below everything else already on the page. */
  const addWidget = useCallback((type: TodayWidgetType) => {
    const g = WIDGET_GEOMETRY_DEFAULTS[type];
    setLayout((prev) => {
      const bottomY = prev.reduce((max, w) => Math.max(max, w.y + w.h), 0);
      const id = `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const next = [...prev, { id, type, xFrac: 0, wFrac: g.wFrac, y: bottomY ? bottomY + 18 : 0, h: g.h }];
      saveLayout(next);
      return next;
    });
  }, [saveLayout]);

  const removeWidget = useCallback((id: string) => {
    setLayout((prev) => {
      const next = prev.filter((w) => w.id !== id);
      saveLayout(next);
      return next;
    });
  }, [saveLayout]);

  const resetLayout = useCallback(() => {
    const fresh = buildDefaultLayout();
    setLayout(fresh);
    saveLayout(fresh);
  }, [saveLayout]);

  const setPageStyle = useCallback((patch: TodayPageStyle) => {
    setPageStyleState((prev) => {
      const next = { ...prev, ...patch };
      if (dataUid) {
        setDoc(doc(db, "users", dataUid), {
          todayLayout: { layout: layoutRef.current, layoutVersion: LAYOUT_VERSION, pageStyle: next },
        }, { merge: true }).catch(() => {});
      }
      return next;
    });
  }, [dataUid]);

  return { layout, loaded, pageStyle, saveLayout, updateWidget, addWidget, removeWidget, resetLayout, setPageStyle, saving };
}
