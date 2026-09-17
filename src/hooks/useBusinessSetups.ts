import { useCallback, useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";
import { BusinessSetup, mergeBusinessSetup } from "@/lib/businessSetupModel";

function payload(setup: Partial<BusinessSetup>) {
  const { id, createdAt, updatedAt, ownerId, ...rest } = setup;
  void id;
  void createdAt;
  void updatedAt;
  void ownerId;
  return rest;
}

export function useBusinessSetups() {
  const [setups, setSetups] = useState<BusinessSetup[]>([]);
  const [loading, setLoading] = useState(true);
  const { dataUid } = useAuth();

  useEffect(() => {
    if (!dataUid) return;
    const q = query(collection(db, "businessSetups"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const next = snap.docs
        .map((d) => mergeBusinessSetup({ id: d.id, ...d.data() }))
        .filter((s) => s.ownerId === dataUid);
      setSetups(next);
      setLoading(false);
    });
    return unsub;
  }, [dataUid]);

  const addSetup = useCallback(async (setup: BusinessSetup) => {
    if (!dataUid) return undefined;
    const ref = await addDoc(collection(db, "businessSetups"), {
      ...payload(setup),
      ownerId: dataUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  }, [dataUid]);

  const updateSetup = useCallback(async (id: string, updates: Partial<BusinessSetup>) => {
    await updateDoc(doc(db, "businessSetups", id), {
      ...payload(updates),
      updatedAt: serverTimestamp(),
    });
  }, []);

  const deleteSetup = useCallback(async (id: string) => {
    await deleteDoc(doc(db, "businessSetups", id));
  }, []);

  return { setups, loading, addSetup, updateSetup, deleteSetup };
}
