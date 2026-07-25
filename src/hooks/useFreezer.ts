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

export function useFreezer(scopeUserId?: string) {
  const [items, setItems] = useState<FreezerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [ownUid, setOwnUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const uid = scopeUserId ?? ownUid;

  useEffect(() => onAuthStateChanged(auth, (user) => {
    setOwnUid(user?.uid ?? null);
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
    if (!uid) throw new Error("You must be signed in.");
    await addDoc(collection(db, "freezer", uid, "items"), { ...item, createdAt: serverTimestamp() });
  }, [uid]);

  const updateItem = useCallback(async (id: string, data: Partial<FreezerItem>) => {
    if (!uid) throw new Error("You must be signed in.");
    await updateDoc(doc(db, "freezer", uid, "items", id), data);
  }, [uid]);

  const removeItem = useCallback(async (id: string) => {
    if (!uid) throw new Error("You must be signed in.");
    await deleteDoc(doc(db, "freezer", uid, "items", id));
  }, [uid]);

  return { items, loading, addItem, updateItem, removeItem };
}
