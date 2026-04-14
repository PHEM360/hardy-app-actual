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
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Task } from "@/types/app";

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, "tasks", uid, "items"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setTasks(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task))
      );
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  const addTask = useCallback(async (task: Omit<Task, "id" | "createdAt" | "updatedAt">) => {
    if (!uid) return;
    await addDoc(collection(db, "tasks", uid, "items"), {
      ...task,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }, [uid]);

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    if (!uid) return;
    await updateDoc(doc(db, "tasks", uid, "items", id), {
      ...updates,
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
