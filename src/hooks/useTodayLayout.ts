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
  | "week";

export interface TodayWidgetItem {
  id: string;
  type: TodayWidgetType;
  xFrac: number;
  wFrac: number;
  y: number;
  h: number;
  visible: boolean;
  tintColor?: string;
}

export interface TodayPageStyle {
  headerColor?: string;
  canvasTint?: string;
}

export const DEFAULT_TODAY_LAYOUT: TodayWidgetItem[] = [
  { id: "ai",         type: "ai",         xFrac: 0,   wFrac: 1.0, y: 0,    h: 200, visible: true  },
  { id: "focus",      type: "focus",      xFrac: 0,   wFrac: 1.0, y: 218,  h: 140, visible: true  },
  { id: "tasks",      type: "tasks",      xFrac: 0,   wFrac: 0.5, y: 376,  h: 300, visible: true  },
  { id: "intentions", type: "intentions", xFrac: 0.5, wFrac: 0.5, y: 376,  h: 300, visible: true  },
  { id: "habits",     type: "habits",     xFrac: 0,   wFrac: 0.5, y: 694,  h: 220, visible: false },
  { id: "water",      type: "water",      xFrac: 0.5, wFrac: 0.5, y: 694,  h: 220, visible: true  },
  { id: "mood",       type: "mood",       xFrac: 0,   wFrac: 0.5, y: 932,  h: 180, visible: true  },
  { id: "note",       type: "note",       xFrac: 0.5, wFrac: 0.5, y: 932,  h: 180, visible: true  },
  { id: "checklist",  type: "checklist",  xFrac: 0,   wFrac: 1.0, y: 1130, h: 220, visible: true  },
  { id: "reflection", type: "reflection", xFrac: 0,   wFrac: 1.0, y: 1368, h: 160, visible: false },
  { id: "calendar",   type: "calendar",   xFrac: 0,   wFrac: 1.0, y: 1546, h: 240, visible: true  },
  { id: "birthdays",  type: "birthdays",  xFrac: 0,   wFrac: 0.5, y: 1804, h: 200, visible: true  },
  { id: "tomorrow",   type: "tomorrow",   xFrac: 0.5, wFrac: 0.5, y: 1804, h: 200, visible: true  },
  { id: "overdue",    type: "overdue",    xFrac: 0,   wFrac: 0.5, y: 2022, h: 200, visible: true  },
  { id: "quick_add",  type: "quick_add",  xFrac: 0.5, wFrac: 0.5, y: 2022, h: 200, visible: true  },
  { id: "reminders",  type: "reminders",  xFrac: 0,   wFrac: 0.5, y: 2240, h: 220, visible: true  },
  { id: "messages",   type: "messages",   xFrac: 0.5, wFrac: 0.5, y: 2240, h: 220, visible: true  },
  { id: "photos",     type: "photos",     xFrac: 0,   wFrac: 1.0, y: 2478, h: 220, visible: true  },
  { id: "weather",    type: "weather",    xFrac: 0,   wFrac: 0.5, y: 2716, h: 220, visible: true  },
  { id: "bills",      type: "bills",      xFrac: 0.5, wFrac: 0.5, y: 2716, h: 220, visible: true  },
  { id: "fun_fact",   type: "fun_fact",   xFrac: 0,   wFrac: 0.5, y: 2954, h: 180, visible: true  },
  { id: "pets_care",  type: "pets_care",  xFrac: 0.5, wFrac: 0.5, y: 2954, h: 180, visible: true  },
  { id: "week",       type: "week",       xFrac: 0,   wFrac: 1.0, y: 3152, h: 160, visible: false },
];

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
};

const LAYOUT_VERSION = 3;

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

export function useTodayLayout() {
  const { dataUid } = useAuth();
  const [layout, setLayout] = useState<TodayWidgetItem[]>(DEFAULT_TODAY_LAYOUT);
  const [pageStyle, setPageStyleState] = useState<TodayPageStyle>({});
  const [saving, setSaving] = useState(false);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  useEffect(() => {
    if (!dataUid) return;
    const ref = doc(db, "users", dataUid);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const stored = snap.data()?.todayLayout;
      if (!stored || typeof stored !== "object") {
        void getDoc(doc(db, "todayLayouts", dataUid)).then((legacy) => {
          const data = legacy.data();
          if (!legacy.exists() || !Array.isArray(data?.layout)) return;
          setDoc(ref, {
            todayLayout: {
              layout: data.layout,
              layoutVersion: data.layoutVersion ?? 0,
              pageStyle: data.pageStyle && typeof data.pageStyle === "object" ? data.pageStyle : {},
            },
          }, { merge: true }).catch(() => {});
        }).catch(() => {});
        return;
      }
      const saved: TodayWidgetItem[] = Array.isArray(stored.layout) ? stored.layout : [];
      const savedVersion: number = stored.layoutVersion ?? 0;
      const style = (stored.pageStyle && typeof stored.pageStyle === "object") ? stored.pageStyle as TodayPageStyle : {};
      setPageStyleState(style);

      if (savedVersion < LAYOUT_VERSION) {
        const savedById = new Map(saved.map((w) => [w.id, w]));
        const refreshed = DEFAULT_TODAY_LAYOUT.map((def) => {
          const prev = savedById.get(def.id);
          return prev ? { ...def, visible: prev.visible, tintColor: prev.tintColor } : def;
        });
        setLayout(refreshed);
        setDoc(ref, { todayLayout: { layout: refreshed, layoutVersion: LAYOUT_VERSION, pageStyle: style } }, { merge: true }).catch(() => {});
        return;
      }

      const merged = DEFAULT_TODAY_LAYOUT.map((def) => {
        const found = saved.find((s) => s.id === def.id);
        return found ?? def;
      });
      setLayout(merged);
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

  const resetLayout = useCallback(() => {
    setLayout(DEFAULT_TODAY_LAYOUT);
    saveLayout(DEFAULT_TODAY_LAYOUT);
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

  return { layout, pageStyle, saveLayout, updateWidget, resetLayout, setPageStyle, saving };
}
