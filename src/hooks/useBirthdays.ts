import { useEffect, useState, useCallback } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";
import type { Birthday } from "@/types/birthdays";

/** Live birthdays visible to the current user: ones they created, plus ones
 *  shared with their active household (rules filter out anything not
 *  actually shared with this uid). */
export function useBirthdays(householdId: string | null) {
  const { dataUid } = useAuth();
  const [own, setOwn] = useState<Birthday[]>([]);
  const [householdShared, setHouseholdShared] = useState<Birthday[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dataUid) {
      setOwn([]);
      setLoading(false);
      return;
    }
    const q = query(collection(db, "birthdays"), where("createdBy", "==", dataUid));
    const unsub = onSnapshot(q, (snap) => {
      setOwn(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Birthday)));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [dataUid]);

  useEffect(() => {
    let unsub: Unsubscribe | undefined;
    if (householdId) {
      const q = query(collection(db, "birthdays"), where("householdId", "==", householdId));
      unsub = onSnapshot(q, (snap) => {
        setHouseholdShared(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Birthday)));
      }, () => setHouseholdShared([]));
    } else {
      setHouseholdShared([]);
    }
    return () => unsub?.();
  }, [householdId]);

  const byId = new Map<string, Birthday>();
  for (const b of householdShared) byId.set(b.id, b);
  for (const b of own) byId.set(b.id, b);
  const birthdays = Array.from(byId.values());

  const addBirthday = useCallback(async (input: Omit<Birthday, "id" | "createdBy" | "createdAt" | "updatedAt">) => {
    if (!dataUid) return;
    await addDoc(collection(db, "birthdays"), {
      ...input,
      createdBy: dataUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }, [dataUid]);

  const updateBirthday = useCallback(async (id: string, patch: Partial<Omit<Birthday, "id" | "createdBy">>) => {
    await updateDoc(doc(db, "birthdays", id), { ...patch, updatedAt: serverTimestamp() });
  }, []);

  const deleteBirthday = useCallback(async (id: string) => {
    await deleteDoc(doc(db, "birthdays", id));
  }, []);

  return { birthdays, loading, addBirthday, updateBirthday, deleteBirthday };
}
