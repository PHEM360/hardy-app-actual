import { useCallback, useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { parseDisplayPhotoLinks, type DisplayPhotoSource } from "@/lib/displayPhotos";

export interface RemoteDisplayPhoto {
  id: string;
  url: string;
  storagePath: string;
  caption: string;
  source: DisplayPhotoSource;
  createdAt: unknown;
  ownerId?: string;
  albumId?: string;
}

async function resolvePhotoUrl(photo: Omit<RemoteDisplayPhoto, "url"> & { url?: string }): Promise<string> {
  if (photo.source === "link" && photo.url) return photo.url;
  if (photo.url?.startsWith("http")) return photo.url;
  if (!photo.storagePath) return photo.url || "";
  try {
    return await getDownloadURL(ref(storage, photo.storagePath));
  } catch (error) {
    console.warn("Display photo could not be loaded", photo.storagePath, error);
    return "";
  }
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
    const unsubscribe = onSnapshot(photosQuery, async (snapshot) => {
      const records = snapshot.docs.map((photo) => {
        const data = photo.data();
        return {
          id: photo.id,
          storagePath: String(data.storagePath || ""),
          caption: String(data.caption || ""),
          source: data.source === "link" ? "link" : "upload",
          createdAt: data.createdAt,
          url: String(data.url || ""),
        } as Omit<RemoteDisplayPhoto, "url"> & { url?: string };
      });
      const hydrated = await Promise.all(records.map(async (photo) => ({
        ...photo,
        url: await resolvePhotoUrl(photo),
      })));
      if (!active) return;
      setPhotos(hydrated);
      setLoading(false);
    }, () => {
      setPhotos([]);
      setLoading(false);
    });
    return () => {
      active = false;
      unsubscribe();
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
      const url = await getDownloadURL(target);
      await addDoc(collection(db, "displayPhotos", uid, "items"), {
        storagePath,
        url,
        source: "upload",
        caption: "",
        createdAt: serverTimestamp(),
      });
    }
  }, [uid]);

  const addLinkedPhotos = useCallback(async (text: string) => {
    if (!uid) return { added: 0, folderCount: 0, photosAlbumCount: 0, skippedCount: 0 };
    const parsed = parseDisplayPhotoLinks(text);
    for (const url of parsed.urls) {
      await addDoc(collection(db, "displayPhotos", uid, "items"), {
        storagePath: "",
        url,
        source: "link",
        caption: "",
        createdAt: serverTimestamp(),
      });
    }
    return { added: parsed.urls.length, folderCount: parsed.folderCount, photosAlbumCount: parsed.photosAlbumCount, skippedCount: parsed.skippedCount };
  }, [uid]);

  const updateCaption = useCallback(async (photoId: string, caption: string) => {
    if (!uid) return;
    await updateDoc(doc(db, "displayPhotos", uid, "items", photoId), { caption });
  }, [uid]);

  const deletePhoto = useCallback(async (photo: RemoteDisplayPhoto) => {
    if (!uid) return;
    await deleteDoc(doc(db, "displayPhotos", uid, "items", photo.id));
    if (photo.storagePath) await deleteObject(ref(storage, photo.storagePath)).catch(() => {});
  }, [uid]);

  return { photos, loading, addPhotos, addLinkedPhotos, updateCaption, deletePhoto };
}
