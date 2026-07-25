import { useEffect, useState, useCallback } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  deleteDoc,
  doc,
  updateDoc,
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

export interface BPEntry {
  id: string;
  date: string;
  systolic: number;
  diastolic: number;
  heartRate?: number;
  notes?: string;
}

export interface MeasurementEntry {
  id: string;
  date: string;
  chestCm: number;
  waistCm?: number;
  hipCm?: number;
}

export function useWeightTracker(scopeUserId?: string) {
  const { user } = useAuth();
  const uid = scopeUserId ?? user?.uid;
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [heightEntries, setHeightEntries] = useState<HeightEntry[]>([]);
  const [botoxRecords, setBotoxRecords] = useState<BotoxRecord[]>([]);
  const [bpEntries, setBpEntries] = useState<BPEntry[]>([]);
  const [measurements, setMeasurements] = useState<MeasurementEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setEntries([]);
      setHeightEntries([]);
      setBotoxRecords([]);
      setBpEntries([]);
      setMeasurements([]);
      setLoading(false);
      return;
    }

    let weightLoaded = false, heightLoaded = false, botoxLoaded = false, bpLoaded = false, measLoaded = false;
    const checkDone = () => {
      if (weightLoaded && heightLoaded && botoxLoaded && bpLoaded && measLoaded) setLoading(false);
    };

    const unsubWeight = onSnapshot(
      query(collection(db, "weightTracker", uid, "entries"), orderBy("date")),
      (snap) => {
        setEntries(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WeightEntry, "id">) })));
        weightLoaded = true; checkDone();
      },
      () => { weightLoaded = true; checkDone(); }
    );

    const unsubHeight = onSnapshot(
      query(collection(db, "weightTracker", uid, "height"), orderBy("date")),
      (snap) => {
        setHeightEntries(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<HeightEntry, "id">) })));
        heightLoaded = true; checkDone();
      },
      () => { heightLoaded = true; checkDone(); }
    );

    const unsubBotox = onSnapshot(
      query(collection(db, "weightTracker", uid, "botox"), orderBy("date", "desc")),
      (snap) => {
        setBotoxRecords(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BotoxRecord, "id">) })));
        botoxLoaded = true; checkDone();
      },
      () => { botoxLoaded = true; checkDone(); }
    );

    const unsubBP = onSnapshot(
      query(collection(db, "weightTracker", uid, "bloodPressure"), orderBy("date")),
      (snap) => {
        setBpEntries(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BPEntry, "id">) })));
        bpLoaded = true; checkDone();
      },
      (err) => { console.error("bloodPressure listener error:", err); bpLoaded = true; checkDone(); }
    );

    const unsubMeas = onSnapshot(
      query(collection(db, "weightTracker", uid, "measurements"), orderBy("date")),
      (snap) => {
        setMeasurements(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MeasurementEntry, "id">) })));
        measLoaded = true; checkDone();
      },
      () => { measLoaded = true; checkDone(); }
    );

    return () => { unsubWeight(); unsubHeight(); unsubBotox(); unsubBP(); unsubMeas(); };
  }, [uid]);

  const addEntry = useCallback(
    async (weight: number, date?: string) => {
      if (!uid) return;
      await addDoc(collection(db, "weightTracker", uid, "entries"), {
        date: date ?? new Date().toISOString().split("T")[0],
        weight,
        createdAt: serverTimestamp(),
      });
    },
    [uid]
  );

  const addHeightEntry = useCallback(
    async (height: number) => {
      if (!uid) return;
      await addDoc(collection(db, "weightTracker", uid, "height"), {
        date: new Date().toISOString().split("T")[0],
        height,
        createdAt: serverTimestamp(),
      });
    },
    [uid]
  );

  const addBotoxRecord = useCallback(
    async (record: Omit<BotoxRecord, "id">) => {
      if (!uid) return;
      await addDoc(collection(db, "weightTracker", uid, "botox"), {
        ...record,
        createdAt: serverTimestamp(),
      });
    },
    [uid]
  );

  const addBPEntry = useCallback(
    async (entry: Omit<BPEntry, "id">) => {
      if (!uid) return;
      await addDoc(collection(db, "weightTracker", uid, "bloodPressure"), {
        ...entry,
        createdAt: serverTimestamp(),
      });
    },
    [uid]
  );

  const addMeasurementEntry = useCallback(
    async (entry: Omit<MeasurementEntry, "id">) => {
      if (!uid) return;
      await addDoc(collection(db, "weightTracker", uid, "measurements"), {
        ...entry,
        createdAt: serverTimestamp(),
      });
    },
    [uid]
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      if (!uid) return;
      await deleteDoc(doc(db, "weightTracker", uid, "entries", id));
    },
    [uid]
  );

  const updateEntry = useCallback(
    async (id: string, weight: number, date: string) => {
      if (!uid) return;
      await updateDoc(doc(db, "weightTracker", uid, "entries", id), { weight, date });
    },
    [uid]
  );

  return { entries, heightEntries, botoxRecords, bpEntries, measurements, loading, addEntry, addHeightEntry, addBotoxRecord, addBPEntry, addMeasurementEntry, deleteEntry, updateEntry };
}
