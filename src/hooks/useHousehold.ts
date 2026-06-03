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
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import {
  HouseholdItem,
  HouseholdSettings,
  DEFAULT_HOUSEHOLD_SETTINGS,
  HouseholdDocument,
} from "@/types/app";

// ─── Items ────────────────────────────────────────────────────────────────────

export function useHouseholdItems() {
  const [items, setItems] = useState<HouseholdItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setUid(user?.uid ?? null));
    return unsub;
  }, []);

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
      const currentUid = auth.currentUser?.uid;
      if (!currentUid) return;
      await addDoc(collection(db, "household", currentUid, "items"), {
        ...item,
        createdAt: serverTimestamp(),
      });
    },
    []
  );

  const updateItem = useCallback(
    async (id: string, data: Partial<HouseholdItem>) => {
      const currentUid = auth.currentUser?.uid;
      if (!currentUid) return;
      await updateDoc(doc(db, "household", currentUid, "items", id), data as Record<string, unknown>);
    },
    []
  );

  const deleteItem = useCallback(
    async (id: string) => {
      const currentUid = auth.currentUser?.uid;
      if (!currentUid) return;
      await deleteDoc(doc(db, "household", currentUid, "items", id));
    },
    []
  );

  return { items, loading, addItem, updateItem, deleteItem };
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export function useHouseholdSettings() {
  const [settings, setSettings] = useState<HouseholdSettings>(
    DEFAULT_HOUSEHOLD_SETTINGS
  );
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setUid(user?.uid ?? null));
    return unsub;
  }, []);

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
      const currentUid = auth.currentUser?.uid;
      if (!currentUid) return;
      const ref = doc(db, "household", currentUid, "settings", "main");
      await setDoc(ref, next, { merge: true });
      setSettings(next);
    },
    []
  );

  return { settings, loading, saveSettings };
}

// ─── Documents ────────────────────────────────────────────────────────────────

export function useHouseholdDocuments() {
  const [documents, setDocuments] = useState<HouseholdDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setUid(user?.uid ?? null));
    return unsub;
  }, []);

  useEffect(() => {
    if (!uid) return;
    const col = collection(db, "household", uid, "documents");
    const unsub = onSnapshot(col, (snap) => {
      setDocuments(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as HouseholdDocument) }))
      );
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  const addDocument = useCallback(async (doc_: Omit<HouseholdDocument, "id">) => {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;
    await addDoc(collection(db, "household", currentUid, "documents"), {
      ...doc_,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }, []);

  const updateDocument = useCallback(async (id: string, data: Partial<HouseholdDocument>) => {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;
    await updateDoc(doc(db, "household", currentUid, "documents", id), {
      ...data,
      updatedAt: serverTimestamp(),
    } as Record<string, unknown>);
  }, []);

  const deleteDocument = useCallback(async (id: string) => {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;
    await deleteDoc(doc(db, "household", currentUid, "documents", id));
  }, []);

  return { documents, loading, addDocument, updateDocument, deleteDocument };
}
