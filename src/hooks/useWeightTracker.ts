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

export function useWeightTracker() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [heightEntries, setHeightEntries] = useState<HeightEntry[]>([]);
  const [botoxRecords, setBotoxRecords] = useState<BotoxRecord[]>([]);
  const [bpEntries, setBpEntries] = useState<BPEntry[]>([]);
  const [measurements, setMeasurements] = useState<MeasurementEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
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

    const unsubBP = onSnapshot(
      query(collection(db, "weightTracker", user.uid, "bloodPressure"), orderBy("date")),
      (snap) => {
        setBpEntries(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BPEntry, "id">) })));
        bpLoaded = true; checkDone();
      },
      (err) => { console.error("bloodPressure listener error:", err); bpLoaded = true; checkDone(); }
    );

    const unsubMeas = onSnapshot(
      query(collection(db, "weightTracker", user.uid, "measurements"), orderBy("date")),
      (snap) => {
        setMeasurements(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MeasurementEntry, "id">) })));
        measLoaded = true; checkDone();
      },
      () => { measLoaded = true; checkDone(); }
    );

    return () => { unsubWeight(); unsubHeight(); unsubBotox(); unsubBP(); unsubMeas(); };
  }, [user?.uid]);

  const addEntry = useCallback(
    async (weight: number, date?: string) => {
      if (!user) return;
      await addDoc(collection(db, "weightTracker", user.uid, "entries"), {
        date: date ?? new Date().toISOString().split("T")[0],
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

  const addBPEntry = useCallback(
    async (entry: Omit<BPEntry, "id">) => {
      if (!user) return;
      await addDoc(collection(db, "weightTracker", user.uid, "bloodPressure"), {
        ...entry,
        createdAt: serverTimestamp(),
      });
    },
    [user]
  );

  const addMeasurementEntry = useCallback(
    async (entry: Omit<MeasurementEntry, "id">) => {
      if (!user) return;
      await addDoc(collection(db, "weightTracker", user.uid, "measurements"), {
        ...entry,
        createdAt: serverTimestamp(),
      });
    },
    [user]
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      if (!user) return;
      await deleteDoc(doc(db, "weightTracker", user.uid, "entries", id));
    },
    [user]
  );

  const updateEntry = useCallback(
    async (id: string, weight: number, date: string) => {
      if (!user) return;
      await updateDoc(doc(db, "weightTracker", user.uid, "entries", id), { weight, date });
    },
    [user]
  );

  return { entries, heightEntries, botoxRecords, bpEntries, measurements, loading, addEntry, addHeightEntry, addBotoxRecord, addBPEntry, addMeasurementEntry, deleteEntry, updateEntry };
}
