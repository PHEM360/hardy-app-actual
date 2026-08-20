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
  | "weight"
  | "notes";

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
  { id: "quick_links",   type: "quick_links",   xFrac: 0,   wFrac: 1.0, y: 118,  h: 280,  visible: true  },
  { id: "today",         type: "today",         xFrac: 0,   wFrac: 0.5, y: 416,  h: 248,  visible: true  },
  { id: "tasks",         type: "tasks",         xFrac: 0.5, wFrac: 0.5, y: 416,  h: 248,  visible: true  },
  { id: "calendar_mini", type: "calendar_mini", xFrac: 0,   wFrac: 1.0, y: 682,  h: 264,  visible: true  },
  { id: "finance",       type: "finance",       xFrac: 0,   wFrac: 0.5, y: 964,  h: 230,  visible: true  },
  { id: "households",    type: "households",    xFrac: 0.5, wFrac: 0.5, y: 964,  h: 230,  visible: true  },
  { id: "pets",          type: "pets",          xFrac: 0,   wFrac: 0.5, y: 1212, h: 230,  visible: true  },
  { id: "tattersalls",   type: "tattersalls",   xFrac: 0.5, wFrac: 0.5, y: 1212, h: 230,  visible: true  },
  { id: "companies",     type: "companies",     xFrac: 0,   wFrac: 0.5, y: 1460, h: 230,  visible: true  },
  { id: "weight",        type: "weight",        xFrac: 0.5, wFrac: 0.5, y: 1460, h: 230,  visible: true  },
  { id: "notes",         type: "notes",         xFrac: 0,   wFrac: 1.0, y: 1708, h: 230,  visible: false },
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
  notes:         "Notes",
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
  notes:         "📝",
};

// Bump whenever DEFAULT_LAYOUT's geometry (xFrac/wFrac/y/h) changes meaningfully.
// Saved layouts from an older version get their geometry refreshed from the new
// defaults automatically (visibility and tint choices are preserved), so a
// design iteration reaches every account without requiring a manual "Reset".
const LAYOUT_VERSION = 3;

// ─── Overlap resolution ───────────────────────────────────────────────────────

const OVERLAP_GAP = 18;

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
  const { dataUid } = useAuth();
  const [layout, setLayout] = useState<WidgetLayoutItem[]>(DEFAULT_LAYOUT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!dataUid) return;
    const ref = doc(db, "dashboardLayouts", dataUid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data?.layout) && data.layout.length > 0) {
          const saved: WidgetLayoutItem[] = data.layout;
          const savedVersion: number = data.layoutVersion ?? 0;

          if (savedVersion < LAYOUT_VERSION) {
            // Geometry has moved on since this was saved — take fresh
            // xFrac/wFrac/y/h from the current defaults, but keep this
            // account's own visibility and tint choices where they exist.
            const savedById = new Map(saved.map((w) => [w.id, w]));
            const refreshed = DEFAULT_LAYOUT.map((def) => {
              const prev = savedById.get(def.id);
              return prev ? { ...def, visible: prev.visible, tintColor: prev.tintColor } : def;
            });
            const resolved = resolveOverlaps(refreshed);
            setLayout(resolved);
            setDoc(ref, { layout: resolved, layoutVersion: LAYOUT_VERSION }, { merge: true }).catch(() => {});
            return;
          }

          // Merge saved layout with defaults for any new widget types not yet in saved data
          const savedIds = new Set(saved.map((w) => w.id));
          const newDefaults = DEFAULT_LAYOUT.filter((d) => !savedIds.has(d.id));
          setLayout(resolveOverlaps([...saved, ...newDefaults]));
          return;
        }
      }
      setLayout(DEFAULT_LAYOUT);
    });
    return unsub;
  }, [dataUid]);

  const saveLayout = useCallback(async (newLayout: WidgetLayoutItem[]) => {
    if (!dataUid) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "dashboardLayouts", dataUid), { layout: newLayout, layoutVersion: LAYOUT_VERSION }, { merge: true });
    } finally {
      setSaving(false);
    }
  }, [dataUid]);

  const updateWidget = useCallback((id: string, patch: Partial<WidgetLayoutItem>) => {
    setLayout((prev) => {
      const patched = prev.map((w) => w.id === id ? { ...w, ...patch } : w);
      const next = resolveOverlaps(patched);
      // Fire-and-forget save
      if (dataUid) {
        setDoc(doc(db, "dashboardLayouts", dataUid), { layout: next, layoutVersion: LAYOUT_VERSION }, { merge: true }).catch(() => {});
      }
      return next;
    });
  }, [dataUid]);

  const resetLayout = useCallback(() => {
    setLayout(DEFAULT_LAYOUT);
    if (dataUid) {
      setDoc(doc(db, "dashboardLayouts", dataUid), { layout: DEFAULT_LAYOUT, layoutVersion: LAYOUT_VERSION }, { merge: true }).catch(() => {});
    }
  }, [dataUid]);

  return { layout, saveLayout, updateWidget, resetLayout, saving };
}
