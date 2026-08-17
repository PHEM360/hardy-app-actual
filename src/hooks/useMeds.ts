import { useEffect, useState, useCallback } from "react";
import {
  collection, addDoc, onSnapshot, query, orderBy,
  doc, updateDoc, deleteDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";

export type MedUnit = "mg" | "ml" | "tablet" | "capsule" | "drop" | "puff" | "patch" | "g" | "other";
export const MED_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899",
];

export interface Medication {
  id: string;
  name: string;
  dose: string;
  unit: MedUnit;
  times: string[]; // HH:mm list
  color: string;
  notes?: string;
  active: boolean;
  startDate: string; // yyyy-MM-dd
}

export interface MedLog {
  id: string;
  medId: string;
  scheduledTime: string; // HH:mm
  takenAt: string;       // HH:mm actual
  date: string;          // yyyy-MM-dd
  skipped?: boolean;
}

export function useMeds(scopeUserId?: string) {
  const { dataUid } = useAuth();
  const uid = scopeUserId ?? dataUid;
  const [medications, setMedications] = useState<Medication[]>([]);
  const [logs, setLogs] = useState<MedLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setMedications([]); setLogs([]); setLoading(false); return; }

    let medsLoaded = false, logsLoaded = false;
    const checkDone = () => { if (medsLoaded && logsLoaded) setLoading(false); };

    const unsubMeds = onSnapshot(
      query(collection(db, "medications", uid, "meds"), orderBy("name")),
      (snap) => {
        setMedications(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Medication, "id">) })));
        medsLoaded = true; checkDone();
      },
      () => { medsLoaded = true; checkDone(); }
    );

    const unsubLogs = onSnapshot(
      query(collection(db, "medications", uid, "logs"), orderBy("date", "desc")),
      (snap) => {
        setLogs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MedLog, "id">) })));
        logsLoaded = true; checkDone();
      },
      () => { logsLoaded = true; checkDone(); }
    );

    return () => { unsubMeds(); unsubLogs(); };
  }, [uid]);

  const addMedication = useCallback(async (med: Omit<Medication, "id">) => {
    if (!uid) return;
    await addDoc(collection(db, "medications", uid, "meds"), {
      ...med, createdAt: serverTimestamp(),
    });
  }, [uid]);

  const updateMedication = useCallback(async (id: string, updates: Partial<Omit<Medication, "id">>) => {
    if (!uid) return;
    await updateDoc(doc(db, "medications", uid, "meds", id), updates as any);
  }, [uid]);

  const deleteMedication = useCallback(async (id: string) => {
    if (!uid) return;
    await deleteDoc(doc(db, "medications", uid, "meds", id));
  }, [uid]);

  const logDose = useCallback(async (
    medId: string, scheduledTime: string, date: string, skipped = false,
  ) => {
    if (!uid) return;
    const now = new Date();
    const takenAt = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    await addDoc(collection(db, "medications", uid, "logs"), {
      medId, scheduledTime, takenAt, date, skipped, createdAt: serverTimestamp(),
    });
  }, [uid]);

  const isLogged = useCallback((medId: string, scheduledTime: string, date: string) => {
    return logs.some((l) => l.medId === medId && l.scheduledTime === scheduledTime && l.date === date);
  }, [logs]);

  const getLogForDose = useCallback((medId: string, scheduledTime: string, date: string) => {
    return logs.find((l) => l.medId === medId && l.scheduledTime === scheduledTime && l.date === date) ?? null;
  }, [logs]);

  /** Schedule browser notifications for today's meds (fires on-page when app is open). */
  const scheduleTodayNotifications = useCallback((meds: Medication[]) => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const today = new Date().toISOString().split("T")[0];
    const now = Date.now();

    for (const med of meds.filter((m) => m.active)) {
      for (const time of med.times) {
        const [h, m] = time.split(":").map(Number);
        const fireAt = new Date();
        fireAt.setHours(h, m, 0, 0);
        const delay = fireAt.getTime() - now;
        if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
          setTimeout(() => {
            new Notification(`💊 Time for ${med.name}`, {
              body: `${med.dose} ${med.unit} — ${time}`,
              icon: "/favicon.ico",
              tag: `med-${med.id}-${today}-${time}`,
            });
          }, delay);
        }
      }
    }
  }, []);

  return {
    medications, logs, loading,
    addMedication, updateMedication, deleteMedication,
    logDose, isLogged, getLogForDose, scheduleTodayNotifications,
  };
}
