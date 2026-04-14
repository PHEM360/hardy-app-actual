import { useEffect, useState, useCallback } from "react";
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import {
  HouseholdItem,
  HouseholdSettings,
  DEFAULT_HOUSEHOLD_SETTINGS,
} from "@/types/app";

// ─── Items ────────────────────────────────────────────────────────────────────

export function useHouseholdItems() {
  const [items, setItems] = useState<HouseholdItem[]>([]);
  const [loading, setLoading] = useState(true);

  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) return;
    const col = collection(db, "household", uid, "items");
    const unsub = onSnapshot(col, (snap) => {
      setItems(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as HouseholdItem) }))
      );
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  const addItem = useCallback(
    async (item: Omit<HouseholdItem, "id">) => {
      if (!uid) return;
      await addDoc(collection(db, "household", uid, "items"), {
        ...item,
        createdAt: serverTimestamp(),
      });
    },
    [uid]
  );

  const updateItem = useCallback(
    async (id: string, data: Partial<HouseholdItem>) => {
      if (!uid) return;
      await updateDoc(doc(db, "household", uid, "items", id), data);
    },
    [uid]
  );

  const deleteItem = useCallback(
    async (id: string) => {
      if (!uid) return;
      await deleteDoc(doc(db, "household", uid, "items", id));
    },
    [uid]
  );

  return { items, loading, addItem, updateItem, deleteItem };
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export function useHouseholdSettings() {
  const [settings, setSettings] = useState<HouseholdSettings>(
    DEFAULT_HOUSEHOLD_SETTINGS
  );
  const [loading, setLoading] = useState(true);

  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) return;
    const ref = doc(db, "household", uid, "settings", "main");
    getDoc(ref).then((snap) => {
      if (snap.exists()) {
        setSettings(snap.data() as HouseholdSettings);
      }
      setLoading(false);
    });
  }, [uid]);

  const saveSettings = useCallback(
    async (next: HouseholdSettings) => {
      if (!uid) return;
      const ref = doc(db, "household", uid, "settings", "main");
      await setDoc(ref, next, { merge: true });
      setSettings(next);
    },
    [uid]
  );

  return { settings, loading, saveSettings };
}
