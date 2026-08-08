import { useEffect, useState, useCallback } from "react";
import { collection, doc, onSnapshot, addDoc, deleteDoc, query, orderBy, serverTimestamp } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";

export interface HouseholdPhoto {
  id: string;
  url: string;
  storagePath: string;
  caption: string;
  createdAt: unknown;
}

/** The shared photo-frame library for one household — used by /display's photo frame. */
export function useHouseholdPhotos(householdId: string | null) {
  const [photos, setPhotos] = useState<HouseholdPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!householdId) {
      setPhotos([]);
      setLoading(false);
      return;
    }
    const q = query(collection(db, "household", householdId, "photos"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setPhotos(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              url: data.url,
              storagePath: data.storagePath,
              caption: data.caption || "",
              createdAt: data.createdAt,
            } as HouseholdPhoto;
          })
        );
        setLoading(false);
      },
      () => {
        setPhotos([]);
        setLoading(false);
      }
    );
    return unsub;
  }, [householdId]);

  const addPhotos = useCallback(
    async (files: File[]) => {
      if (!householdId) return;
      for (const file of files) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `household/${householdId}/photoFrame/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const ref = storageRef(storage, path);
        await uploadBytes(ref, file);
        const url = await getDownloadURL(ref);
        await addDoc(collection(db, "household", householdId, "photos"), {
          url,
          storagePath: path,
          caption: "",
          createdAt: serverTimestamp(),
        });
      }
    },
    [householdId]
  );

  const deletePhoto = useCallback(
    async (photo: HouseholdPhoto) => {
      if (!householdId) return;
      await deleteDoc(doc(db, "household", householdId, "photos", photo.id));
      try {
        await deleteObject(storageRef(storage, photo.storagePath));
      } catch {
        // Storage object may already be gone — the Firestore record is the
        // source of truth for what the photo frame shows, so this is fine.
      }
    },
    [householdId]
  );

  return { photos, loading, addPhotos, deletePhoto };
}
