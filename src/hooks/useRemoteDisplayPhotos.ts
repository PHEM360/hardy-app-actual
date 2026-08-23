import { useCallback, useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { deleteObject, getBlob, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";

export interface RemoteDisplayPhoto {
  id: string;
  url: string;
  storagePath: string;
  caption: string;
  createdAt: unknown;
}

export function useRemoteDisplayPhotos(uid: string | null | undefined) {
  const [photos, setPhotos] = useState<RemoteDisplayPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setPhotos([]);
      setLoading(false);
      return;
    }
    const photosQuery = query(collection(db, "displayPhotos", uid, "items"), orderBy("createdAt", "asc"));
    let active = true;
    let objectUrls: string[] = [];
    const unsubscribe = onSnapshot(photosQuery, async (snapshot) => {
      const nextObjectUrls: string[] = [];
      const records = snapshot.docs.map((photo) => ({ id: photo.id, ...photo.data() } as Omit<RemoteDisplayPhoto, "url">));
      const hydrated = await Promise.all(records.map(async (photo) => {
        try {
          const blob = await getBlob(ref(storage, photo.storagePath), 20 * 1024 * 1024);
          const url = URL.createObjectURL(blob);
          nextObjectUrls.push(url);
          return { ...photo, url };
        } catch {
          return { ...photo, url: "" };
        }
      }));
      if (!active) {
        nextObjectUrls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      objectUrls = nextObjectUrls;
      setPhotos(hydrated);
      setLoading(false);
    }, () => {
      setPhotos([]);
      setLoading(false);
    });
    return () => {
      active = false;
      unsubscribe();
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      objectUrls = [];
    };
  }, [uid]);

  const addPhotos = useCallback(async (files: File[]) => {
    if (!uid) return;
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
      const storagePath = `displayPhotos/${uid}/${crypto.randomUUID()}-${safeName}`;
      const target = ref(storage, storagePath);
      await uploadBytes(target, file, { contentType: file.type });
      await addDoc(collection(db, "displayPhotos", uid, "items"), {
        storagePath,
        caption: "",
        createdAt: serverTimestamp(),
      });
    }
  }, [uid]);

  const updateCaption = useCallback(async (photoId: string, caption: string) => {
    if (!uid) return;
    await updateDoc(doc(db, "displayPhotos", uid, "items", photoId), { caption });
  }, [uid]);

  const deletePhoto = useCallback(async (photo: RemoteDisplayPhoto) => {
    if (!uid) return;
    await deleteDoc(doc(db, "displayPhotos", uid, "items", photo.id));
    await deleteObject(ref(storage, photo.storagePath)).catch(() => {});
  }, [uid]);

  return { photos, loading, addPhotos, updateCaption, deletePhoto };
}
