import { useEffect, useState, useCallback } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  | "reflection";

export interface TodayWidgetItem {
  id: string;
  type: TodayWidgetType;
  xFrac: number;    // 0 or 0.5
  wFrac: number;    // 0.5 or 1.0
  y: number;        // absolute px from top
  h: number;        // absolute px height
  visible: boolean;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

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
];

export const TODAY_WIDGET_LABELS: Record<TodayWidgetType, string> = {
  ai:         "AI Assistant",
  focus:      "Today's Focus",
  tasks:      "Today's Tasks",
  intentions: "Morning Intentions",
  habits:     "Habit Tracker",
  water:      "Water Tracker",
  mood:       "Mood Check-in",
  note:       "Daily Note",
  checklist:  "Quick Checklist",
  reflection: "Evening Reflection",
};

export const TODAY_WIDGET_ICONS: Record<TodayWidgetType, string> = {
  ai:         "🤖",
  focus:      "🎯",
  tasks:      "✅",
  intentions: "🌅",
  habits:     "🔥",
  water:      "💧",
  mood:       "😊",
  note:       "📝",
  checklist:  "☑️",
  reflection: "🌙",
};

// Bump whenever DEFAULT_TODAY_LAYOUT's geometry changes meaningfully — see the
// matching constant/comment in useDashboardLayout.ts for the full rationale.
const LAYOUT_VERSION = 2;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTodayLayout() {
  const { dataUid } = useAuth();
  const [layout, setLayout] = useState<TodayWidgetItem[]>(DEFAULT_TODAY_LAYOUT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!dataUid) return;
    const ref = doc(db, "todayLayouts", dataUid);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const saved: TodayWidgetItem[] = data.layout ?? [];
      const savedVersion: number = data.layoutVersion ?? 0;

      if (savedVersion < LAYOUT_VERSION) {
        const savedById = new Map(saved.map((w) => [w.id, w]));
        const refreshed = DEFAULT_TODAY_LAYOUT.map((def) => {
          const prev = savedById.get(def.id);
          return prev ? { ...def, visible: prev.visible } : def;
        });
        setLayout(refreshed);
        setDoc(ref, { layout: refreshed, layoutVersion: LAYOUT_VERSION }, { merge: true }).catch(() => {});
        return;
      }

      // Merge saved with defaults (ensures new widget types are added)
      const merged = DEFAULT_TODAY_LAYOUT.map((def) => {
        const found = saved.find((s) => s.id === def.id);
        return found ?? def;
      });
      setLayout(merged);
    });
    return unsub;
  }, [dataUid]);

  const saveLayout = useCallback(async (next: TodayWidgetItem[]) => {
    if (!dataUid) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "todayLayouts", dataUid), { layout: next, layoutVersion: LAYOUT_VERSION }, { merge: true });
    } finally {
      setSaving(false);
    }
  }, [dataUid]);

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

  return { layout, saveLayout, updateWidget, resetLayout, saving };
}
