import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRemoteDisplayPhotos, type RemoteDisplayPhoto } from "@/hooks/useRemoteDisplayPhotos";
import { albumFromDoc, itemFromDoc } from "@/lib/photoDocs";
import { photoLibraryKey } from "@/lib/photoSelection";
import { resolveStoredPhotoUrl } from "@/lib/photoUrl";
import type { PhotoAlbum, PhotoGrant, PhotoItem } from "@/types/photos";

async function toDisplayPhoto(photo: PhotoItem): Promise<RemoteDisplayPhoto> {
  return {
    id: photo.ownerId ? `${photo.ownerId}:${photo.id}` : photo.id,
    ownerId: photo.ownerId,
    albumId: photo.albumId,
    url: await resolveStoredPhotoUrl(photo),
    storagePath: photo.storagePath,
    caption: photo.caption,
    source: photo.source === "drive" || photo.source === "gphotos" || photo.source === "upload"
      ? photo.source
      : "link",
    createdAt: photo.createdAt,
  };
}

function listenAlbumItems(
  ownerId: string,
  albumId: string,
  onItems: (photos: RemoteDisplayPhoto[]) => void,
) {
  return onSnapshot(collection(db, "photos", ownerId, "albums", albumId, "items"), async (snap) => {
    const next = await Promise.all(
      snap.docs.map((item) => toDisplayPhoto(itemFromDoc(item.id, ownerId, albumId, item.data() as Record<string, unknown>))),
    );
    onItems(next);
  }, () => onItems([]));
}

export function useDisplayOwnerPhotos(uid: string | null | undefined) {
  const legacy = useRemoteDisplayPhotos(uid);
  const [ownAlbums, setOwnAlbums] = useState<PhotoAlbum[]>([]);
  const [ownByAlbum, setOwnByAlbum] = useState<Record<string, RemoteDisplayPhoto[]>>({});
  const [incomingGrants, setIncomingGrants] = useState<PhotoGrant[]>([]);
  const [sharedAlbums, setSharedAlbums] = useState<PhotoAlbum[]>([]);
  const [sharedByAlbum, setSharedByAlbum] = useState<Record<string, RemoteDisplayPhoto[]>>({});
  const [ownReady, setOwnReady] = useState(!uid);
  const [grantsReady, setGrantsReady] = useState(!uid);
  const [sharedReady, setSharedReady] = useState(true);

  useEffect(() => {
    if (!uid) {
      setOwnAlbums([]);
      setOwnByAlbum({});
      setOwnReady(true);
      return;
    }
    setOwnReady(false);
    return onSnapshot(collection(db, "photos", uid, "albums"), (snap) => {
      setOwnAlbums(snap.docs.map((item) => albumFromDoc(item.id, uid, item.data() as Record<string, unknown>)));
      setOwnReady(true);
    }, () => {
      setOwnAlbums([]);
      setOwnByAlbum({});
      setOwnReady(true);
    });
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const unsubs = ownAlbums.map((album) =>
      listenAlbumItems(uid, album.id, (photos) => {
        setOwnByAlbum((current) => ({ ...current, [album.id]: photos }));
      }),
    );
    return () => unsubs.forEach((unsub) => unsub());
  }, [uid, ownAlbums]);

  useEffect(() => {
    if (!uid) {
      setIncomingGrants([]);
      setGrantsReady(true);
      return;
    }
    setGrantsReady(false);
    const incoming = query(collection(db, "photoGrants"), where("targetUid", "==", uid));
    return onSnapshot(incoming, (snap) => {
      setIncomingGrants(snap.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<PhotoGrant, "id">) })));
      setGrantsReady(true);
    }, () => {
      setIncomingGrants([]);
      setGrantsReady(true);
    });
  }, [uid]);

  useEffect(() => {
    if (!incomingGrants.length) {
      setSharedAlbums([]);
      setSharedByAlbum({});
      setSharedReady(true);
      return;
    }
    setSharedReady(false);
    let pending = incomingGrants.length;
    const markReady = () => {
      pending -= 1;
      if (pending <= 0) setSharedReady(true);
    };
    const unsubs = incomingGrants.flatMap((grant) => {
      const key = `${grant.ownerId}:${grant.albumId}`;
      return [
        onSnapshot(doc(db, "photos", grant.ownerId, "albums", grant.albumId), (snap) => {
          markReady();
          if (!snap.exists()) {
            setSharedAlbums((current) => current.filter((album) => !(album.ownerId === grant.ownerId && album.id === grant.albumId)));
            return;
          }
          const album = albumFromDoc(snap.id, grant.ownerId, snap.data() as Record<string, unknown>);
          setSharedAlbums((current) => {
            const others = current.filter((item) => !(item.ownerId === album.ownerId && item.id === album.id));
            return [...others, album];
          });
        }, () => {
          markReady();
          setSharedAlbums((current) => current.filter((album) => !(album.ownerId === grant.ownerId && album.id === grant.albumId)));
        }),
        listenAlbumItems(grant.ownerId, grant.albumId, (photos) => {
          setSharedByAlbum((current) => ({ ...current, [key]: photos }));
        }),
      ];
    });
    return () => unsubs.forEach((unsub) => unsub());
  }, [incomingGrants]);

  const albums = useMemo(() => [...ownAlbums, ...sharedAlbums], [ownAlbums, sharedAlbums]);

  const photos = useMemo(() => {
    const seen = new Set<string>();
    const merged: RemoteDisplayPhoto[] = [];
    for (const photo of [...Object.values(ownByAlbum).flat(), ...Object.values(sharedByAlbum).flat(), ...legacy.photos]) {
      if (!photo.url || seen.has(photoLibraryKey(photo))) continue;
      seen.add(photoLibraryKey(photo));
      merged.push(photo);
    }
    return merged;
  }, [ownByAlbum, sharedByAlbum, legacy.photos]);

  const waitingForOwnItems = ownReady && ownAlbums.length > 0 && ownAlbums.some((album) => ownByAlbum[album.id] === undefined);
  const waitingForSharedItems = incomingGrants.length > 0 && incomingGrants.some((grant) => sharedByAlbum[`${grant.ownerId}:${grant.albumId}`] === undefined);

  return {
    ...legacy,
    albums,
    photos,
    loading: legacy.loading || !ownReady || !grantsReady || !sharedReady || waitingForOwnItems || waitingForSharedItems,
  };
}
