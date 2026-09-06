import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRemoteDisplayPhotos, type RemoteDisplayPhoto } from "@/hooks/useRemoteDisplayPhotos";
import type { PhotoItem } from "@/types/photos";

function toDisplayPhoto(photo: PhotoItem): RemoteDisplayPhoto {
  return {
    id: `${photo.ownerId}:${photo.id}`,
    url: photo.url,
    storagePath: photo.storagePath,
    caption: photo.caption,
    source: photo.source === "upload" ? "upload" : "link",
    createdAt: photo.createdAt,
  };
}

export function useDisplayOwnerPhotos(uid: string | null | undefined) {
  const legacy = useRemoteDisplayPhotos(uid);
  const [albumIds, setAlbumIds] = useState<string[]>([]);
  const [byAlbum, setByAlbum] = useState<Record<string, RemoteDisplayPhoto[]>>({});

  useEffect(() => {
    if (!uid) {
      setAlbumIds([]);
      setByAlbum({});
      return;
    }
    return onSnapshot(collection(db, "photos", uid, "albums"), (snap) => {
      setAlbumIds(snap.docs.map((item) => item.id));
    }, () => {
      setAlbumIds([]);
      setByAlbum({});
    });
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const unsubs = albumIds.map((albumId) =>
      onSnapshot(collection(db, "photos", uid, "albums", albumId, "items"), (snap) => {
        const next = snap.docs.map((d) => {
          const data = d.data();
          return toDisplayPhoto({
            id: d.id,
            ownerId: uid,
            albumId,
            url: String(data.url || ""),
            storagePath: String(data.storagePath || ""),
            caption: String(data.caption || ""),
            source: (data.source as PhotoItem["source"]) || "upload",
            createdAt: data.createdAt,
          });
        });
        setByAlbum((current) => ({ ...current, [albumId]: next }));
      }),
    );
    return () => unsubs.forEach((unsub) => unsub());
  }, [uid, albumIds]);

  const photos = useMemo(() => {
    const seen = new Set<string>();
    const merged: RemoteDisplayPhoto[] = [];
    for (const photo of [...Object.values(byAlbum).flat(), ...legacy.photos]) {
      if (!photo.url || seen.has(photo.id)) continue;
      seen.add(photo.id);
      merged.push(photo);
    }
    return merged;
  }, [byAlbum, legacy.photos]);

  return { ...legacy, photos, loading: legacy.loading };
}
