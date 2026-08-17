import { useEffect, useState, useCallback } from "react";
import {
  collection, addDoc, onSnapshot, query, orderBy,
  doc, updateDoc, deleteDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";

export type FieldType = "counter" | "number" | "text" | "boolean" | "sobriety";

export interface TabField {
  id: string;
  label: string;
  type: FieldType;
  unit?: string;
  description?: string;
}

export interface HealthTab {
  id: string;
  name: string;
  emoji: string;
  color: string;  // hex
  order: number;
  enableAiChat: boolean;
  sobrietyStartDate?: string; // yyyy-MM-dd — if this tab is a sobriety tracker
  fields: TabField[];
}

export interface TabEntry {
  id: string;
  tabId: string;
  date: string; // yyyy-MM-dd
  values: Record<string, any>; // fieldId → value
  note?: string;
}

export function useHealthTabs(scopeUserId?: string) {
  const { dataUid } = useAuth();
  const uid = scopeUserId ?? dataUid;
  const [tabs, setTabs] = useState<HealthTab[]>([]);
  const [entries, setEntries] = useState<TabEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setTabs([]); setEntries([]); setLoading(false); return; }

    let tabsLoaded = false, entriesLoaded = false;
    const checkDone = () => { if (tabsLoaded && entriesLoaded) setLoading(false); };

    const unsubTabs = onSnapshot(
      query(collection(db, "healthTabs", uid, "tabs"), orderBy("order")),
      (snap) => {
        setTabs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<HealthTab, "id">) })));
        tabsLoaded = true; checkDone();
      },
      () => { tabsLoaded = true; checkDone(); }
    );

    const unsubEntries = onSnapshot(
      query(collection(db, "healthTabs", uid, "entries"), orderBy("date", "desc")),
      (snap) => {
        setEntries(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TabEntry, "id">) })));
        entriesLoaded = true; checkDone();
      },
      () => { entriesLoaded = true; checkDone(); }
    );

    return () => { unsubTabs(); unsubEntries(); };
  }, [uid]);

  const addTab = useCallback(async (tab: Omit<HealthTab, "id">) => {
    if (!uid) return;
    const ref = await addDoc(collection(db, "healthTabs", uid, "tabs"), {
      ...tab, createdAt: serverTimestamp(),
    });
    return ref.id;
  }, [uid]);

  const updateTab = useCallback(async (id: string, updates: Partial<Omit<HealthTab, "id">>) => {
    if (!uid) return;
    await updateDoc(doc(db, "healthTabs", uid, "tabs", id), updates as any);
  }, [uid]);

  const deleteTab = useCallback(async (id: string) => {
    if (!uid) return;
    await deleteDoc(doc(db, "healthTabs", uid, "tabs", id));
  }, [uid]);

  const saveEntry = useCallback(async (entry: Omit<TabEntry, "id">) => {
    if (!uid) return;
    await addDoc(collection(db, "healthTabs", uid, "entries"), {
      ...entry, createdAt: serverTimestamp(),
    });
  }, [uid]);

  const getTodayEntry = useCallback((tabId: string): TabEntry | null => {
    const today = new Date().toISOString().split("T")[0];
    return entries.find((e) => e.tabId === tabId && e.date === today) ?? null;
  }, [entries]);

  const getEntriesForTab = useCallback((tabId: string): TabEntry[] => {
    return entries.filter((e) => e.tabId === tabId);
  }, [entries]);

  return {
    tabs, entries, loading,
    addTab, updateTab, deleteTab, saveEntry,
    getTodayEntry, getEntriesForTab,
  };
}
