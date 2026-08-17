import { useEffect, useState, useCallback } from "react";
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";
import type { CalendarEvent, CalendarSettings } from "@/types/app";

const DEFAULT_SETTINGS: CalendarSettings = { defaultView: "month" };

export function useCalendar(scopeUserId?: string) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [settings, setSettings] = useState<CalendarSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const { dataUid } = useAuth();
  const uid = scopeUserId ?? dataUid;

  // Subscribe to events
  useEffect(() => {
    if (!uid) return;
    const col = collection(db, "calendar", uid, "events");
    const unsub = onSnapshot(col, (snap) => {
      setEvents(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as CalendarEvent) }))
      );
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  // Subscribe to settings
  useEffect(() => {
    if (!uid) return;
    const ref = doc(db, "calendar", uid, "meta", "settings");
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setSettings(snap.data() as CalendarSettings);
    });
    return unsub;
  }, [uid]);

  const addEvent = useCallback(async (event: Omit<CalendarEvent, "id">) => {
    if (!uid) return;
    await addDoc(collection(db, "calendar", uid, "events"), {
      ...event,
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }, [uid]);

  const updateEvent = useCallback(async (id: string, data: Partial<CalendarEvent>) => {
    if (!uid) return;
    await updateDoc(doc(db, "calendar", uid, "events", id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  }, [uid]);

  const deleteEvent = useCallback(async (id: string) => {
    if (!uid) return;
    await deleteDoc(doc(db, "calendar", uid, "events", id));
  }, [uid]);

  const saveSettings = useCallback(async (data: Partial<CalendarSettings>) => {
    if (!uid) return;
    const merged = { ...settings, ...data, updatedAt: serverTimestamp() };
    await setDoc(
      doc(db, "calendar", uid, "meta", "settings"),
      merged,
      { merge: true }
    );
    setSettings((s) => ({ ...s, ...data }));
  }, [settings, uid]);

  return { events, settings, loading, addEvent, updateEvent, deleteEvent, saveSettings };
}
