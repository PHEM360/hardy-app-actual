import { useEffect, useState, useCallback } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";

export interface WeightEntry {
  id: string;
  date: string;
  weight: number;
}

export function useWeightTracker() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setEntries([]);
      setLoading(false);
      return;
    }

    const ref = collection(db, "weightTracker", user.uid, "entries");
    const q = query(ref, orderBy("date"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        setEntries(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WeightEntry, "id">) }))
        );
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user?.uid]);

  const addEntry = useCallback(
    async (weight: number) => {
      if (!user) return;
      await addDoc(collection(db, "weightTracker", user.uid, "entries"), {
        date: new Date().toISOString().split("T")[0],
        weight,
        createdAt: serverTimestamp(),
      });
    },
    [user]
  );

  return { entries, loading, addEntry };
}
