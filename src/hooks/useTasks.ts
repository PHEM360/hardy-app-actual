import { useEffect, useState, useCallback } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  deleteField,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";
import { Task } from "@/types/app";
import { sanitizeTaskWrite, taskTrackingInfo } from "@/lib/tasks";

function withClearedOptionals(updates: Partial<Task>) {
  const payload = sanitizeTaskWrite({ ...updates } as Record<string, unknown>) as Record<string, unknown>;
  if ("dueDate" in updates && !String(updates.dueDate || "").trim()) payload.dueDate = deleteField();
  if ("company" in updates && !String(updates.company || "").trim()) payload.company = deleteField();
  if ("description" in updates && !String(updates.description || "").trim()) payload.description = deleteField();
  if ("notes" in updates && !String(updates.notes || "").trim()) payload.notes = deleteField();
  if ("trackingNote" in updates && !String(updates.trackingNote || "").trim()) payload.trackingNote = deleteField();
  // Choosing "Not set" must remove the stored value, not leave the old one behind.
  if ("tracking" in updates && !taskTrackingInfo(updates.tracking)) {
    payload.tracking = deleteField();
    payload.trackingNote = deleteField();
  }
  return payload;
}

export function useTasks(scopeUserId?: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { dataUid } = useAuth();

  const uid = scopeUserId ?? dataUid;

  useEffect(() => {
    if (!uid) {
      setTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, "tasks", uid, "items"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task)));
        setLoading(false);
      },
      () => {
        setTasks([]);
        setLoading(false);
      },
    );
    return unsub;
  }, [uid]);

  const addTask = useCallback(async (task: Omit<Task, "id" | "createdAt" | "updatedAt">) => {
    if (!uid) return;
    const payload = sanitizeTaskWrite({ ...task } as Record<string, unknown>);
    await addDoc(collection(db, "tasks", uid, "items"), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }, [uid]);

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    if (!uid) return;
    await updateDoc(doc(db, "tasks", uid, "items", id), {
      ...withClearedOptionals(updates),
      updatedAt: serverTimestamp(),
    });
  }, [uid]);

  const deleteTask = useCallback(async (id: string) => {
    if (!uid) return;
    await deleteDoc(doc(db, "tasks", uid, "items", id));
  }, [uid]);

  const toggleToday = useCallback(async (id: string, current: boolean) => {
    if (!uid) return;
    await updateDoc(doc(db, "tasks", uid, "items", id), {
      isToday: !current,
      updatedAt: serverTimestamp(),
    });
  }, [uid]);

  const setStatus = useCallback(async (id: string, status: Task["status"]) => {
    if (!uid) return;
    await updateDoc(doc(db, "tasks", uid, "items", id), {
      status,
      updatedAt: serverTimestamp(),
    });
  }, [uid]);

  return { tasks, loading, addTask, updateTask, deleteTask, toggleToday, setStatus };
}
