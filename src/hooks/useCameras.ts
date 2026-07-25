import { useEffect, useState, useCallback } from "react";
import {
  collection, doc, onSnapshot,
  addDoc, updateDoc, deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useActiveHousehold } from "@/hooks/useActiveHousehold";

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
  const { activeHouseholdId } = useActiveHousehold();

  useEffect(() => {
    if (!activeHouseholdId) {
      setCameras([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const col = collection(db, "cameras", activeHouseholdId, "list");
    const unsub = onSnapshot(col, (snap) => {
      setCameras(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Camera) }))
          .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
      );
      setLoading(false);
    });
    return unsub;
  }, [activeHouseholdId]);

  const addCamera = useCallback(async (cam: Omit<Camera, "id">) => {
    if (!activeHouseholdId) return;
    await addDoc(collection(db, "cameras", activeHouseholdId, "list"), {
      ...cam,
      createdAt: new Date().toISOString(),
    });
  }, [activeHouseholdId]);

  const updateCamera = useCallback(async (id: string, cam: Partial<Camera>) => {
    if (!activeHouseholdId) return;
    await updateDoc(doc(db, "cameras", activeHouseholdId, "list", id), cam);
  }, [activeHouseholdId]);

  const deleteCamera = useCallback(async (id: string) => {
    if (!activeHouseholdId) return;
    await deleteDoc(doc(db, "cameras", activeHouseholdId, "list", id));
  }, [activeHouseholdId]);

  return { cameras, loading, addCamera, updateCamera, deleteCamera };
}
