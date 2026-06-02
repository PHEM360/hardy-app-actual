import { useEffect, useState, useCallback } from "react";
import {
  collection, doc, onSnapshot,
  addDoc, updateDoc, deleteDoc, serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "@/lib/firebase";

export type StreamType = "mjpeg" | "hls" | "snapshot" | "webrtc";

export interface Camera {
  id?: string;
  name: string;
  location?: string;
  streamUrl: string;
  streamType: StreamType;
  snapshotRefreshSecs?: number; // for snapshot type, default 5
  username?: string;
  password?: string;
  notes?: string;
  createdAt?: string;
}

export function useCameras() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setUid(user?.uid ?? null));
    return unsub;
  }, []);

  useEffect(() => {
    if (!uid) return;
    const col = collection(db, "cameras", uid, "list");
    const unsub = onSnapshot(col, (snap) => {
      setCameras(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Camera) }))
          .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
      );
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  const addCamera = useCallback(async (cam: Omit<Camera, "id">) => {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;
    await addDoc(collection(db, "cameras", currentUid, "list"), {
      ...cam,
      createdAt: new Date().toISOString(),
    });
  }, []);

  const updateCamera = useCallback(async (id: string, cam: Partial<Camera>) => {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;
    await updateDoc(doc(db, "cameras", currentUid, "list", id), cam);
  }, []);

  const deleteCamera = useCallback(async (id: string) => {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;
    await deleteDoc(doc(db, "cameras", currentUid, "list", id));
  }, []);

  return { cameras, loading, addCamera, updateCamera, deleteCamera };
}
