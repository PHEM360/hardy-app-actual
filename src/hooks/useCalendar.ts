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
import { pushCalendarEvent } from "@/lib/googleCalendarApi";
import { calendarWriteData } from "@/lib/calendarWrite";
import type { CalendarEvent, CalendarSettings } from "@/types/app";

const DEFAULT_SETTINGS: CalendarSettings = { defaultView: "month" };

export function useCalendar(scopeUserId?: string) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [settings, setSettings] = useState<CalendarSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const { dataUid } = useAuth();
  const uid = scopeUserId ?? dataUid;

  useEffect(() => {
    if (!uid) return;
    const col = collection(db, "calendar", uid, "events");
    const unsub = onSnapshot(
      col,
      (snap) => {
        setEvents(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as CalendarEvent) })),
        );
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const ref = doc(db, "calendar", uid, "meta", "settings");
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setSettings(snap.data() as CalendarSettings);
    });
    return unsub;
  }, [uid]);

  const addEvent = useCallback(async (event: Omit<CalendarEvent, "id">) => {
    if (!uid) throw new Error("You need to be signed in to add an event.");
    const ref = await addDoc(collection(db, "calendar", uid, "events"), calendarWriteData({
      ...event,
      source: event.source || "local",
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
    if (settings.google?.connected) {
      try {
        await pushCalendarEvent(ref.id, uid);
      } catch {
        /* Local save already succeeded; Google can catch up on the next sync. */
      }
    }
    return ref.id;
  }, [settings.google?.connected, uid]);

  const updateEvent = useCallback(async (id: string, data: Partial<CalendarEvent>) => {
    if (!uid) throw new Error("You need to be signed in to change an event.");
    await updateDoc(doc(db, "calendar", uid, "events", id), calendarWriteData({
      ...data,
      updatedAt: serverTimestamp(),
    }));
    if (settings.google?.connected) {
      try {
        await pushCalendarEvent(id, uid);
      } catch {
        /* Local save already succeeded. */
      }
    }
  }, [settings.google?.connected, uid]);

  const deleteEvent = useCallback(async (id: string) => {
    if (!uid) throw new Error("You need to be signed in to delete an event.");
    await deleteDoc(doc(db, "calendar", uid, "events", id));
  }, [uid]);

  const saveSettings = useCallback(async (data: Partial<CalendarSettings>) => {
    if (!uid) return;
    const merged = { ...settings, ...data, updatedAt: serverTimestamp() };
    await setDoc(
      doc(db, "calendar", uid, "meta", "settings"),
      calendarWriteData(merged as Record<string, unknown>),
      { merge: true },
    );
    setSettings((s) => ({ ...s, ...data }));
  }, [settings, uid]);

  return { events, settings, loading, addEvent, updateEvent, deleteEvent, saveSettings };
}
