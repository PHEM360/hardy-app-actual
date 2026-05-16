import { useEffect, useState, useCallback } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";
import { format } from "date-fns";

// ─── Block types ──────────────────────────────────────────────────────────────

export type BlockType =
  | "tasks"        // today-flagged tasks from the task system (read-only)
  | "focus"        // single "one big thing" text input
  | "intentions"   // 3 morning intentions
  | "habits"       // user-defined daily habits with checkboxes
  | "water"        // 8-glass water tracker
  | "mood"         // emoji mood + energy slider
  | "note"         // free-text daily note
  | "checklist"    // quick ad-hoc checklist
  | "reflection";  // evening reflection text

export const BLOCK_META: Record<BlockType, { label: string; icon: string; description: string }> = {
  tasks:       { label: "Tasks",               icon: "✅", description: "Today-flagged tasks from your task list" },
  focus:       { label: "Today's Focus",       icon: "🎯", description: "One big thing to achieve today" },
  intentions:  { label: "Morning Intentions",  icon: "🌅", description: "3 things you intend to do today" },
  habits:      { label: "Habit Tracker",       icon: "🔥", description: "Your daily habits" },
  water:       { label: "Water Tracker",       icon: "💧", description: "Track glasses of water" },
  mood:        { label: "Mood Check-in",       icon: "😊", description: "How are you feeling today?" },
  note:        { label: "Daily Note",          icon: "📝", description: "Free notes for the day" },
  checklist:   { label: "Quick Checklist",     icon: "☑️",  description: "Ad-hoc items for today" },
  reflection:  { label: "Evening Reflection",  icon: "🌙", description: "Review and reflect on your day" },
};

export interface BlockConfig {
  id: string;
  type: BlockType;
  enabled: boolean;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface DailyData {
  focus: string;
  intentions: [string, string, string];
  habitsDone: Record<string, boolean>;
  waterCount: number;
  mood: string;   // emoji string e.g. "😊"
  energy: number; // 1-5
  note: string;
  checklist: ChecklistItem[];
  reflection: string;
}

export interface TodayConfig {
  blocks: BlockConfig[];
  habits: string[];   // user-defined habit names
}

const DEFAULT_BLOCKS: BlockConfig[] = [
  { id: "tasks",       type: "tasks",       enabled: true  },
  { id: "focus",       type: "focus",       enabled: true  },
  { id: "intentions",  type: "intentions",  enabled: true  },
  { id: "habits",      type: "habits",      enabled: false },
  { id: "water",       type: "water",       enabled: true  },
  { id: "mood",        type: "mood",        enabled: true  },
  { id: "note",        type: "note",        enabled: true  },
  { id: "checklist",   type: "checklist",   enabled: true  },
  { id: "reflection",  type: "reflection",  enabled: false },
];

const DEFAULT_CONFIG: TodayConfig = {
  blocks: DEFAULT_BLOCKS,
  habits: [],
};

const EMPTY_DAILY: DailyData = {
  focus: "",
  intentions: ["", "", ""],
  habitsDone: {},
  waterCount: 0,
  mood: "",
  energy: 3,
  note: "",
  checklist: [],
  reflection: "",
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTodayPage() {
  const { user } = useAuth();
  const todayKey = format(new Date(), "yyyy-MM-dd");

  const [config, setConfig] = useState<TodayConfig>(DEFAULT_CONFIG);
  const [daily, setDaily] = useState<DailyData>(EMPTY_DAILY);
  const [loading, setLoading] = useState(true);

  // Listen to config
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "todayConfig", user.uid);
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<TodayConfig>;
        // Merge saved blocks with any new block types not yet in saved config
        const savedBlocks = Array.isArray(data.blocks) ? data.blocks : [];
        const savedIds = new Set(savedBlocks.map((b) => b.id));
        const newDefaults = DEFAULT_BLOCKS.filter((b) => !savedIds.has(b.id));
        setConfig({
          blocks: [...savedBlocks, ...newDefaults],
          habits: Array.isArray(data.habits) ? data.habits : [],
        });
      } else {
        setConfig(DEFAULT_CONFIG);
      }
    });
  }, [user?.uid]);

  // Listen to today's daily data
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "todayData", user.uid, "days", todayKey);
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setDaily({ ...EMPTY_DAILY, ...(snap.data() as Partial<DailyData>) });
      } else {
        setDaily(EMPTY_DAILY);
      }
      setLoading(false);
    });
  }, [user?.uid, todayKey]);

  const saveConfig = useCallback(async (updates: Partial<TodayConfig>) => {
    if (!user) return;
    const next = { ...config, ...updates };
    setConfig(next);
    await setDoc(doc(db, "todayConfig", user.uid), next, { merge: true });
  }, [user, config]);

  const saveDaily = useCallback(async (updates: Partial<DailyData>) => {
    if (!user) return;
    const next = { ...daily, ...updates };
    setDaily(next);
    await setDoc(doc(db, "todayData", user.uid, "days", todayKey), next, { merge: true });
  }, [user, daily, todayKey]);

  // Block management helpers
  const setBlockEnabled = useCallback((id: string, enabled: boolean) => {
    const newBlocks = config.blocks.map((b) => b.id === id ? { ...b, enabled } : b);
    saveConfig({ blocks: newBlocks });
  }, [config, saveConfig]);

  const reorderBlocks = useCallback((fromIdx: number, toIdx: number) => {
    const newBlocks = [...config.blocks];
    const [moved] = newBlocks.splice(fromIdx, 1);
    newBlocks.splice(toIdx, 0, moved);
    saveConfig({ blocks: newBlocks });
  }, [config, saveConfig]);

  return {
    config,
    daily,
    loading,
    todayKey,
    saveConfig,
    saveDaily,
    setBlockEnabled,
    reorderBlocks,
  };
}
