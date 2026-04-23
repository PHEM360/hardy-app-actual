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

export interface HeightEntry {
  id: string;
  date: string;
  height: number; // cm
}

export interface BotoxRecord {
  id: string;
  date: string;
  unitsRight: number;
  unitsLeft: number;
  notes: string;
}

export function useWeightTracker() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [heightEntries, setHeightEntries] = useState<HeightEntry[]>([]);
  const [botoxRecords, setBotoxRecords] = useState<BotoxRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setEntries([]);
      setHeightEntries([]);
      setBotoxRecords([]);
      setLoading(false);
      return;
    }

    let weightLoaded = false, heightLoaded = false, botoxLoaded = false;
    const checkDone = () => {
      if (weightLoaded && heightLoaded && botoxLoaded) setLoading(false);
    };

    const unsubWeight = onSnapshot(
      query(collection(db, "weightTracker", user.uid, "entries"), orderBy("date")),
      (snap) => {
        setEntries(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WeightEntry, "id">) })));
        weightLoaded = true; checkDone();
      },
      () => { weightLoaded = true; checkDone(); }
    );

    const unsubHeight = onSnapshot(
      query(collection(db, "weightTracker", user.uid, "height"), orderBy("date")),
      (snap) => {
        setHeightEntries(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<HeightEntry, "id">) })));
        heightLoaded = true; checkDone();
      },
      () => { heightLoaded = true; checkDone(); }
    );

    const unsubBotox = onSnapshot(
      query(collection(db, "weightTracker", user.uid, "botox"), orderBy("date", "desc")),
      (snap) => {
        setBotoxRecords(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BotoxRecord, "id">) })));
        botoxLoaded = true; checkDone();
      },
      () => { botoxLoaded = true; checkDone(); }
    );

    return () => { unsubWeight(); unsubHeight(); unsubBotox(); };
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

  const addHeightEntry = useCallback(
    async (height: number) => {
      if (!user) return;
      await addDoc(collection(db, "weightTracker", user.uid, "height"), {
        date: new Date().toISOString().split("T")[0],
        height,
        createdAt: serverTimestamp(),
      });
    },
    [user]
  );

  const addBotoxRecord = useCallback(
    async (record: Omit<BotoxRecord, "id">) => {
      if (!user) return;
      await addDoc(collection(db, "weightTracker", user.uid, "botox"), {
        ...record,
        createdAt: serverTimestamp(),
      });
    },
    [user]
  );

  return { entries, heightEntries, botoxRecords, loading, addEntry, addHeightEntry, addBotoxRecord };
}
