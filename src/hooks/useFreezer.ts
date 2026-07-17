import { useCallback, useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";

export interface FreezerItem {
  id: string;
  name: string;
  quantity: number;
  dateAdded: string;
  barcode?: string;
  imageUrl?: string;
}

export function useFreezer() {
  const [items, setItems] = useState<FreezerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);

  useEffect(() => onAuthStateChanged(auth, (user) => {
    setUid(user?.uid ?? null);
    if (!user) setLoading(false);
  }), []);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(collection(db, "freezer", uid, "items"), (snapshot) => {
      setItems(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as FreezerItem)));
      setLoading(false);
    });
  }, [uid]);

  const addItem = useCallback(async (item: Omit<FreezerItem, "id">) => {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) throw new Error("You must be signed in.");
    await addDoc(collection(db, "freezer", currentUid, "items"), { ...item, createdAt: serverTimestamp() });
  }, []);

  const updateItem = useCallback(async (id: string, data: Partial<FreezerItem>) => {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) throw new Error("You must be signed in.");
    await updateDoc(doc(db, "freezer", currentUid, "items", id), data);
  }, []);

  const removeItem = useCallback(async (id: string) => {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) throw new Error("You must be signed in.");
    await deleteDoc(doc(db, "freezer", currentUid, "items", id));
  }, []);

  return { items, loading, addItem, updateItem, removeItem };
}
