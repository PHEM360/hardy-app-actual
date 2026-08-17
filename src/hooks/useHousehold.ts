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
} from "@/types/app";
import { useActiveHousehold } from "./useActiveHousehold";

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
        setSettings(snap.data() as HouseholdSettings);
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
