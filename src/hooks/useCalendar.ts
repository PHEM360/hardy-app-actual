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
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import type { CalendarEvent, CalendarSettings } from "@/types/app";

const DEFAULT_SETTINGS: CalendarSettings = { defaultView: "month" };

export function useCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [settings, setSettings] = useState<CalendarSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setUid(user?.uid ?? null));
    return unsub;
  }, []);

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
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;
    await addDoc(collection(db, "calendar", currentUid, "events"), {
      ...event,
      createdBy: currentUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }, []);

  const updateEvent = useCallback(async (id: string, data: Partial<CalendarEvent>) => {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;
    await updateDoc(doc(db, "calendar", currentUid, "events", id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  }, []);

  const deleteEvent = useCallback(async (id: string) => {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;
    await deleteDoc(doc(db, "calendar", currentUid, "events", id));
  }, []);

  const saveSettings = useCallback(async (data: Partial<CalendarSettings>) => {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;
    const merged = { ...settings, ...data, updatedAt: serverTimestamp() };
    await setDoc(
      doc(db, "calendar", currentUid, "meta", "settings"),
      merged,
      { merge: true }
    );
    setSettings((s) => ({ ...s, ...data }));
  }, [settings]);

  return { events, settings, loading, addEvent, updateEvent, deleteEvent, saveSettings };
}
