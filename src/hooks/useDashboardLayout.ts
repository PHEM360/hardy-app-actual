import { useEffect, useState, useCallback } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────

export type WidgetType =
  | "greeting"
  | "quick_links"
  | "today"
  | "tasks"
  | "calendar_mini"
  | "finance"
  | "households"
  | "pets"
  | "tattersalls"
  | "companies"
  | "weight";

export interface WidgetLayoutItem {
  id: string;       // stable unique id (matches type for single-instance widgets)
  type: WidgetType;
  xFrac: number;    // 0 or 0.5 — fraction of container width
  wFrac: number;    // 0.5 or 1.0 — fraction of container width
  y: number;        // absolute pixels from top
  h: number;        // absolute pixels height
  visible: boolean;
  tintColor?: string; // optional background tint colour (hex)
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_LAYOUT: WidgetLayoutItem[] = [
  { id: "greeting",      type: "greeting",      xFrac: 0,   wFrac: 1.0, y: 0,    h: 100,  visible: true  },
  { id: "quick_links",   type: "quick_links",   xFrac: 0,   wFrac: 1.0, y: 108,  h: 190,  visible: true  },
  { id: "today",         type: "today",         xFrac: 0,   wFrac: 0.5, y: 306,  h: 204,  visible: true  },
  { id: "tasks",         type: "tasks",         xFrac: 0.5, wFrac: 0.5, y: 306,  h: 204,  visible: true  },
  { id: "calendar_mini", type: "calendar_mini", xFrac: 0,   wFrac: 1.0, y: 518,  h: 264,  visible: true  },
  { id: "finance",       type: "finance",       xFrac: 0,   wFrac: 0.5, y: 790,  h: 188,  visible: true  },
  { id: "households",    type: "households",    xFrac: 0.5, wFrac: 0.5, y: 790,  h: 188,  visible: true  },
  { id: "pets",          type: "pets",          xFrac: 0,   wFrac: 0.5, y: 986,  h: 188,  visible: true  },
  { id: "tattersalls",   type: "tattersalls",   xFrac: 0.5, wFrac: 0.5, y: 986,  h: 188,  visible: true  },
  { id: "companies",     type: "companies",     xFrac: 0,   wFrac: 0.5, y: 1182, h: 188,  visible: true  },
  { id: "weight",        type: "weight",        xFrac: 0.5, wFrac: 0.5, y: 1182, h: 188,  visible: true  },
];

export const WIDGET_LABELS: Record<WidgetType, string> = {
  greeting:      "Greeting",
  quick_links:   "Quick Links",
  today:         "Today",
  tasks:         "Tasks",
  calendar_mini: "Calendar",
  finance:       "Finance",
  households:    "Households",
  pets:          "Pets",
  tattersalls:   "Tattersalls",
  companies:     "Companies",
  weight:        "Health",
};

export const WIDGET_ICONS: Record<WidgetType, string> = {
  greeting:      "👋",
  quick_links:   "⚡",
  today:         "☀️",
  tasks:         "✅",
  calendar_mini: "📅",
  finance:       "💰",
  households:    "🏠",
  pets:          "🐾",
  tattersalls:   "🏛️",
  companies:     "🏢",
  weight:        "⚖️",
};

// ─── Overlap resolution ───────────────────────────────────────────────────────

const OVERLAP_GAP = 8;

function resolveOverlaps(items: WidgetLayoutItem[]): WidgetLayoutItem[] {
  // Only operate on visible items; sort by y so higher widgets take precedence
  const sorted = [...items].sort((a, b) => a.y - b.y);
  const placed: WidgetLayoutItem[] = [];

  for (const item of sorted) {
    let y = item.y;
    // Keep pushing down until no collision with any already-placed widget
    let changed = true;
    while (changed) {
      changed = false;
      for (const p of placed) {
        // Check x-axis overlap using fractional coords
        const iL = item.xFrac, iR = item.xFrac + item.wFrac;
        const pL = p.xFrac,   pR = p.xFrac   + p.wFrac;
        if (iL >= pR || iR <= pL) continue; // no x overlap
        // Check y-axis overlap
        if (y < p.y + p.h && y + item.h > p.y) {
          y = p.y + p.h + OVERLAP_GAP;
          changed = true;
        }
      }
    }
    placed.push({ ...item, y });
  }

  // Map back preserving original order
  return items.map((orig) => placed.find((p) => p.id === orig.id) ?? orig);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDashboardLayout() {
  const { user } = useAuth();
  const [layout, setLayout] = useState<WidgetLayoutItem[]>(DEFAULT_LAYOUT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "dashboardLayouts", user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data?.layout) && data.layout.length > 0) {
          // Merge saved layout with defaults for any new widget types not yet in saved data
          const saved: WidgetLayoutItem[] = data.layout;
          const savedIds = new Set(saved.map((w) => w.id));
          const newDefaults = DEFAULT_LAYOUT.filter((d) => !savedIds.has(d.id));
          setLayout(resolveOverlaps([...saved, ...newDefaults]));
          return;
        }
      }
      setLayout(DEFAULT_LAYOUT);
    });
    return unsub;
  }, [user?.uid]);

  const saveLayout = useCallback(async (newLayout: WidgetLayoutItem[]) => {
    if (!user) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "dashboardLayouts", user.uid), { layout: newLayout }, { merge: true });
    } finally {
      setSaving(false);
    }
  }, [user]);

  const updateWidget = useCallback((id: string, patch: Partial<WidgetLayoutItem>) => {
    setLayout((prev) => {
      const patched = prev.map((w) => w.id === id ? { ...w, ...patch } : w);
      const next = resolveOverlaps(patched);
      // Fire-and-forget save
      if (user) {
        setDoc(doc(db, "dashboardLayouts", user.uid), { layout: next }, { merge: true }).catch(() => {});
      }
      return next;
    });
  }, [user]);

  const resetLayout = useCallback(() => {
    setLayout(DEFAULT_LAYOUT);
    if (user) {
      setDoc(doc(db, "dashboardLayouts", user.uid), { layout: DEFAULT_LAYOUT }, { merge: true }).catch(() => {});
    }
  }, [user]);

  return { layout, saveLayout, updateWidget, resetLayout, saving };
}
