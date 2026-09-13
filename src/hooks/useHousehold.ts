import { useEffect, useState, useCallback } from "react";
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import {
  HouseholdItem,
  HouseholdSettings,
  DEFAULT_HOUSEHOLD_SETTINGS,
  HouseholdDocument,
  HouseholdNote,
} from "@/types/app";
import { useActiveHousehold } from "./useActiveHousehold";
import { useAuth } from "@/auth/AuthContext";

// ─── Items ────────────────────────────────────────────────────────────────────

export function useHouseholdItems() {
  const [items, setItems] = useState<HouseholdItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { activeHouseholdId } = useActiveHousehold();

  useEffect(() => {
    if (!activeHouseholdId) {
      setItems([]);
      setLoading(false);
      return;
    }

    setItems([]);
    setLoading(true);
    const col = collection(db, "household", activeHouseholdId, "items");
    const unsub = onSnapshot(col, (snap) => {
      setItems(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as HouseholdItem) }))
      );
      setLoading(false);
    });
    return unsub;
  }, [activeHouseholdId]);

  const addItem = useCallback(
    async (item: Omit<HouseholdItem, "id">) => {
      if (!activeHouseholdId) return;
      await addDoc(collection(db, "household", activeHouseholdId, "items"), {
        ...item,
        createdAt: serverTimestamp(),
      });
    },
    [activeHouseholdId]
  );

  const updateItem = useCallback(
    async (id: string, data: Partial<HouseholdItem>) => {
      if (!activeHouseholdId) return;
      await updateDoc(doc(db, "household", activeHouseholdId, "items", id), data as Record<string, unknown>);
    },
    [activeHouseholdId]
  );

  const deleteItem = useCallback(
    async (id: string) => {
      if (!activeHouseholdId) return;
      await deleteDoc(doc(db, "household", activeHouseholdId, "items", id));
    },
    [activeHouseholdId]
  );

  return { items, loading, addItem, updateItem, deleteItem };
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export function useHouseholdSettings() {
  const [settings, setSettings] = useState<HouseholdSettings>(
    DEFAULT_HOUSEHOLD_SETTINGS
  );
  const [loading, setLoading] = useState(true);
  const { activeHouseholdId } = useActiveHousehold();

  useEffect(() => {
    if (!activeHouseholdId) {
      setSettings(DEFAULT_HOUSEHOLD_SETTINGS);
      setLoading(false);
      return;
    }

    setSettings(DEFAULT_HOUSEHOLD_SETTINGS);
    setLoading(true);
    const ref = doc(db, "household", activeHouseholdId, "settings", "main");
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as HouseholdSettings;
        setSettings({
          ...DEFAULT_HOUSEHOLD_SETTINGS,
          ...data,
          categories: data.categories?.length ? data.categories : DEFAULT_HOUSEHOLD_SETTINGS.categories,
          noteTypes: data.noteTypes?.length ? data.noteTypes : DEFAULT_HOUSEHOLD_SETTINGS.noteTypes,
          members: data.members ?? [],
        });
      } else {
        setSettings(DEFAULT_HOUSEHOLD_SETTINGS);
      }
      setLoading(false);
    });
    return unsub;
  }, [activeHouseholdId]);

  const saveSettings = useCallback(
    async (next: HouseholdSettings) => {
      if (!activeHouseholdId) return;
      const ref = doc(db, "household", activeHouseholdId, "settings", "main");
      await setDoc(ref, next, { merge: true });
      setSettings(next);
    },
    [activeHouseholdId]
  );

  return { settings, loading, saveSettings };
}

// ─── Documents ────────────────────────────────────────────────────────────────

export function useHouseholdDocuments() {
  const [documents, setDocuments] = useState<HouseholdDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const { activeHouseholdId } = useActiveHousehold();

  useEffect(() => {
    if (!activeHouseholdId) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    setDocuments([]);
    setLoading(true);
    const col = collection(db, "household", activeHouseholdId, "documents");
    const unsub = onSnapshot(col, (snap) => {
      setDocuments(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as HouseholdDocument) }))
      );
      setLoading(false);
    });
    return unsub;
  }, [activeHouseholdId]);

  const addDocument = useCallback(async (doc_: Omit<HouseholdDocument, "id">) => {
    if (!activeHouseholdId) return;
    await addDoc(collection(db, "household", activeHouseholdId, "documents"), {
      ...doc_,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }, [activeHouseholdId]);

  const updateDocument = useCallback(async (id: string, data: Partial<HouseholdDocument>) => {
    if (!activeHouseholdId) return;
    await updateDoc(doc(db, "household", activeHouseholdId, "documents", id), {
      ...data,
      updatedAt: serverTimestamp(),
    } as Record<string, unknown>);
  }, [activeHouseholdId]);

  const deleteDocument = useCallback(async (id: string) => {
    if (!activeHouseholdId) return;
    await deleteDoc(doc(db, "household", activeHouseholdId, "documents", id));
  }, [activeHouseholdId]);

  return { documents, loading, addDocument, updateDocument, deleteDocument };
}

// ─── Notes ────────────────────────────────────────────────────────────────────

export function useHouseholdNotes() {
  const [notes, setNotes] = useState<HouseholdNote[]>([]);
  const [loading, setLoading] = useState(true);
  const { activeHouseholdId } = useActiveHousehold();
  const { user } = useAuth();

  useEffect(() => {
    if (!activeHouseholdId) {
      setNotes([]);
      setLoading(false);
      return;
    }

    setNotes([]);
    setLoading(true);
    const col = collection(db, "household", activeHouseholdId, "notes");
    const unsub = onSnapshot(col, (snap) => {
      const next = snap.docs.map((d) => ({ id: d.id, ...(d.data() as HouseholdNote) }));
      next.sort((a, b) => {
        if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
        const aTime = a.updatedAt?.toMillis?.() ?? a.updatedAt?.seconds * 1000 ?? 0;
        const bTime = b.updatedAt?.toMillis?.() ?? b.updatedAt?.seconds * 1000 ?? 0;
        return bTime - aTime;
      });
      setNotes(next);
      setLoading(false);
    });
    return unsub;
  }, [activeHouseholdId]);

  const addNote = useCallback(
    async (note: Omit<HouseholdNote, "id" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy">) => {
      if (!activeHouseholdId) return;
      await addDoc(collection(db, "household", activeHouseholdId, "notes"), {
        ...note,
        createdBy: user?.uid ?? null,
        updatedBy: user?.uid ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },
    [activeHouseholdId, user?.uid]
  );

  const updateNote = useCallback(
    async (id: string, data: Partial<HouseholdNote>) => {
      if (!activeHouseholdId) return;
      await updateDoc(doc(db, "household", activeHouseholdId, "notes", id), {
        ...data,
        updatedBy: user?.uid ?? null,
        updatedAt: serverTimestamp(),
      } as Record<string, unknown>);
    },
    [activeHouseholdId, user?.uid]
  );

  const deleteNote = useCallback(
    async (id: string) => {
      if (!activeHouseholdId) return;
      await deleteDoc(doc(db, "household", activeHouseholdId, "notes", id));
    },
    [activeHouseholdId]
  );

  return { notes, loading, addNote, updateNote, deleteNote };
}
