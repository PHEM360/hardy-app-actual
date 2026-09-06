import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";
import { useAppUsers } from "@/hooks/useAppUsers";
import { usePageShares } from "@/hooks/usePageShares";
import { displayPhotoSrcFromLink, parseDisplayPhotoLinks } from "@/lib/displayPhotos";
import type {
  DriveConnectionStatus,
  PhotoAlbum,
  PhotoAlbumShare,
  PhotoGrant,
  PhotoItem,
  PhotoSharePermission,
  PhotosConnectionStatus,
  PhotoSource,
} from "@/types/photos";

function parseShares(data: Record<string, unknown>): PhotoAlbumShare[] {
  if (Array.isArray(data.shares)) {
    return (data.shares as PhotoAlbumShare[]).filter((share) => share?.uid && share.permission);
  }
  const sharedWith = Array.isArray(data.sharedWith) ? (data.sharedWith as string[]) : [];
  const fallback = data.sharePermission === "edit" ? "edit" : "view";
  return sharedWith.map((uid) => ({ uid, permission: fallback as PhotoSharePermission }));
}

function albumFromDoc(id: string, ownerId: string, data: Record<string, unknown>): PhotoAlbum {
  const shares = parseShares(data);
  return {
    id,
    ownerId,
    name: String(data.name || "Album"),
    coverPhotoId: (data.coverPhotoId as string | null) ?? null,
    shares,
    sharedWith: shares.map((share) => share.uid),
    driveFolderId: (data.driveFolderId as string | null) ?? null,
    driveFolderName: (data.driveFolderName as string | null) ?? null,
    googlePhotosShareUrl: (data.googlePhotosShareUrl as string | null) ?? null,
    googlePhotosAlbumName: (data.googlePhotosAlbumName as string | null) ?? null,
    googlePhotosLinked: Boolean(data.googlePhotosLinked),
    lastSyncedAt: data.lastSyncedAt,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function itemFromDoc(id: string, ownerId: string, albumId: string, data: Record<string, unknown>): PhotoItem {
  return {
    id,
    ownerId,
    albumId,
    url: String(data.url || ""),
    storagePath: String(data.storagePath || ""),
    caption: String(data.caption || ""),
    source: (data.source as PhotoSource) || "upload",
    driveFileId: (data.driveFileId as string | null) ?? null,
    googlePhotosId: (data.googlePhotosId as string | null) ?? null,
    createdAt: data.createdAt,
  };
}

export function usePhotos(scopeUserId?: string | null) {
  const { dataUid } = useAuth();
  const uid = scopeUserId || dataUid || null;
  const appUsers = useAppUsers();
  const { sharedWithMe } = usePageShares("photos");
  const [albums, setAlbums] = useState<PhotoAlbum[]>([]);
  const [items, setItems] = useState<PhotoItem[]>([]);
  const [incomingGrants, setIncomingGrants] = useState<PhotoGrant[]>([]);
  const [outgoingGrants, setOutgoingGrants] = useState<PhotoGrant[]>([]);
  const [sharedAlbums, setSharedAlbums] = useState<PhotoAlbum[]>([]);
  const [sharedItems, setSharedItems] = useState<PhotoItem[]>([]);
  const [drive, setDrive] = useState<DriveConnectionStatus>({ connected: false });
  const [gphotos, setGphotos] = useState<PhotosConnectionStatus>({ connected: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setAlbums([]);
      setItems([]);
      setDrive({ connected: false });
      setGphotos({ connected: false });
      setLoading(false);
      return;
    }
    const unsubAlbums = onSnapshot(collection(db, "photos", uid, "albums"), (snap) => {
      setAlbums(snap.docs.map((d) => albumFromDoc(d.id, uid, d.data() as Record<string, unknown>)));
      setLoading(false);
    }, () => {
      setAlbums([]);
      setLoading(false);
    });
    const unsubDrive = onSnapshot(doc(db, "photos", uid, "settings", "drive"), (snap) => {
      const data = snap.data();
      setDrive({
        connected: Boolean(data?.connected),
        email: data?.email ? String(data.email) : undefined,
        lastError: data?.lastError ? String(data.lastError) : null,
      });
    }, () => setDrive({ connected: false }));
    const unsubPhotos = onSnapshot(doc(db, "photos", uid, "settings", "photos"), (snap) => {
      const data = snap.data();
      setGphotos({
        connected: Boolean(data?.connected),
        email: data?.email ? String(data.email) : undefined,
        lastError: data?.lastError ? String(data.lastError) : null,
      });
    }, () => setGphotos({ connected: false }));
    return () => {
      unsubAlbums();
      unsubDrive();
      unsubPhotos();
    };
  }, [uid]);

  useEffect(() => {
    if (!uid || albums.length === 0) {
      setItems([]);
      return;
    }
    const unsubs = albums.map((album) =>
      onSnapshot(collection(db, "photos", uid, "albums", album.id, "items"), (snap) => {
        setItems((current) => {
          const others = current.filter((item) => !(item.ownerId === uid && item.albumId === album.id));
          const next = snap.docs.map((d) => itemFromDoc(d.id, uid, album.id, d.data() as Record<string, unknown>));
          return [...others, ...next];
        });
      }),
    );
    return () => unsubs.forEach((unsub) => unsub());
  }, [uid, albums]);

  useEffect(() => {
    if (!dataUid) {
      setIncomingGrants([]);
      setOutgoingGrants([]);
      return;
    }
    const incoming = query(collection(db, "photoGrants"), where("targetUid", "==", dataUid));
    const outgoing = query(collection(db, "photoGrants"), where("ownerId", "==", dataUid));
    const unsubIn = onSnapshot(incoming, (snap) => {
      setIncomingGrants(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PhotoGrant, "id">) })));
    }, () => setIncomingGrants([]));
    const unsubOut = onSnapshot(outgoing, (snap) => {
      setOutgoingGrants(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PhotoGrant, "id">) })));
    }, () => setOutgoingGrants([]));
    return () => {
      unsubIn();
      unsubOut();
    };
  }, [dataUid]);

  useEffect(() => {
    if (!incomingGrants.length) {
      setSharedAlbums([]);
      setSharedItems([]);
      return;
    }
    const unsubs = incomingGrants.flatMap((grant) => [
      onSnapshot(doc(db, "photos", grant.ownerId, "albums", grant.albumId), (snap) => {
        if (!snap.exists()) {
          setSharedAlbums((current) => current.filter((album) => !(album.ownerId === grant.ownerId && album.id === grant.albumId)));
          return;
        }
        const album = albumFromDoc(snap.id, grant.ownerId, snap.data() as Record<string, unknown>);
        setSharedAlbums((current) => {
          const others = current.filter((item) => !(item.ownerId === album.ownerId && item.id === album.id));
          return [...others, album];
        });
      }),
      onSnapshot(collection(db, "photos", grant.ownerId, "albums", grant.albumId, "items"), (snap) => {
        setSharedItems((current) => {
          const others = current.filter((item) => !(item.ownerId === grant.ownerId && item.albumId === grant.albumId));
          const next = snap.docs.map((d) => itemFromDoc(d.id, grant.ownerId, grant.albumId, d.data() as Record<string, unknown>));
          return [...others, ...next];
        });
      }),
    ]);
    return () => unsubs.forEach((unsub) => unsub());
  }, [incomingGrants]);

  const canEditPage = uid === dataUid || sharedWithMe.some((share) => share.ownerId === uid && share.permission === "edit");

  const createAlbum = useCallback(async (name: string) => {
    if (!uid) throw new Error("Sign in first.");
    const ref = await addDoc(collection(db, "photos", uid, "albums"), {
      ownerId: uid,
      name: name.trim() || "Album",
      coverPhotoId: null,
      shares: [],
      sharedWith: [],
      editors: [],
      driveFolderId: null,
      driveFolderName: null,
      googlePhotosShareUrl: null,
      googlePhotosAlbumName: null,
      googlePhotosLinked: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  }, [uid]);

  const renameAlbum = useCallback(async (albumId: string, name: string) => {
    if (!uid) return;
    await updateDoc(doc(db, "photos", uid, "albums", albumId), {
      name: name.trim() || "Album",
      updatedAt: serverTimestamp(),
    });
  }, [uid]);

  const removePhotoDoc = useCallback(async (photo: PhotoItem) => {
    await deleteDoc(doc(db, "photos", photo.ownerId, "albums", photo.albumId, "items", photo.id));
    if (photo.storagePath) {
      await deleteObject(storageRef(storage, photo.storagePath)).catch(() => {});
    }
  }, []);

  const deleteAlbum = useCallback(async (album: PhotoAlbum) => {
    if (!uid || album.ownerId !== uid) return;
    const albumItems = items.filter((item) => item.albumId === album.id && item.ownerId === uid);
    await Promise.all(albumItems.map((item) => removePhotoDoc(item)));
    const grants = outgoingGrants.filter((grant) => grant.albumId === album.id);
    await Promise.all(grants.map((grant) => deleteDoc(doc(db, "photoGrants", grant.id))));
    await deleteDoc(doc(db, "photos", uid, "albums", album.id));
  }, [uid, items, outgoingGrants, removePhotoDoc]);

  const addFiles = useCallback(async (
    albumId: string,
    files: File[],
    onProgress?: (done: number, total: number, fileName: string) => void,
  ) => {
    if (!uid) throw new Error("Sign in first.");
    const total = files.length;
    let done = 0;
    for (const file of files) {
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `photos/${uid}/${albumId}/${crypto.randomUUID()}-${safeName}`;
      const ref = storageRef(storage, path);
      await uploadBytes(ref, file);
      const url = await getDownloadURL(ref);
      await addDoc(collection(db, "photos", uid, "albums", albumId, "items"), {
        ownerId: uid,
        albumId,
        url,
        storagePath: path,
        caption: "",
        source: "upload",
        createdAt: serverTimestamp(),
      });
      done += 1;
      onProgress?.(done, total, file.name);
    }
  }, [uid]);

  const addLinks = useCallback(async (albumId: string, text: string) => {
    if (!uid) throw new Error("Sign in first.");
    const parsed = parseDisplayPhotoLinks(text);
    for (const url of parsed.urls) {
      await addDoc(collection(db, "photos", uid, "albums", albumId, "items"), {
        ownerId: uid,
        albumId,
        url,
        storagePath: "",
        caption: "",
        source: "link",
        createdAt: serverTimestamp(),
      });
    }
    return parsed;
  }, [uid]);

  const updateCaption = useCallback(async (photo: PhotoItem, caption: string) => {
    await updateDoc(doc(db, "photos", photo.ownerId, "albums", photo.albumId, "items", photo.id), { caption });
  }, []);

  const deletePhoto = removePhotoDoc;

  const shareAlbum = useCallback(async (album: PhotoAlbum, targetUid: string, permission: PhotoSharePermission) => {
    if (!uid || album.ownerId !== uid) throw new Error("Only the owner can share this album.");
    if (targetUid === uid) throw new Error("That's you.");
    const shares = [
      ...album.shares.filter((share) => share.uid !== targetUid),
      { uid: targetUid, permission },
    ];
    await updateDoc(doc(db, "photos", uid, "albums", album.id), {
      shares,
      sharedWith: shares.map((share) => share.uid),
      editors: shares.filter((share) => share.permission === "edit").map((share) => share.uid),
      updatedAt: serverTimestamp(),
    });
    const existing = outgoingGrants.find((grant) => grant.albumId === album.id && grant.targetUid === targetUid);
    if (existing) {
      await updateDoc(doc(db, "photoGrants", existing.id), { permission, title: album.name });
    } else {
      await addDoc(collection(db, "photoGrants"), {
        ownerId: uid,
        targetUid,
        permission,
        albumId: album.id,
        title: album.name,
      });
    }
  }, [uid, outgoingGrants]);

  const unshareAlbum = useCallback(async (album: PhotoAlbum, targetUid: string) => {
    if (!uid || album.ownerId !== uid) return;
    const shares = album.shares.filter((share) => share.uid !== targetUid);
    await updateDoc(doc(db, "photos", uid, "albums", album.id), {
      shares,
      sharedWith: shares.map((share) => share.uid),
      editors: shares.filter((share) => share.permission === "edit").map((share) => share.uid),
      updatedAt: serverTimestamp(),
    });
    const match = outgoingGrants.find((grant) => grant.albumId === album.id && grant.targetUid === targetUid);
    if (match) await deleteDoc(doc(db, "photoGrants", match.id));
  }, [uid, outgoingGrants]);

  const setAlbumPrivate = useCallback(async (album: PhotoAlbum) => {
    if (!uid || album.ownerId !== uid) return;
    await updateDoc(doc(db, "photos", uid, "albums", album.id), {
      shares: [],
      sharedWith: [],
      editors: [],
      updatedAt: serverTimestamp(),
    });
    const grants = outgoingGrants.filter((grant) => grant.albumId === album.id);
    await Promise.all(grants.map((grant) => deleteDoc(doc(db, "photoGrants", grant.id))));
  }, [uid, outgoingGrants]);

  const canEditAlbum = useCallback((album: PhotoAlbum) => {
    if (!dataUid) return false;
    if (album.ownerId === dataUid) return true;
    if (album.ownerId === uid && canEditPage) return true;
    return album.shares.some((share) => share.uid === dataUid && share.permission === "edit");
  }, [dataUid, uid, canEditPage]);

  const people = useMemo(() => appUsers.filter((user) => user.id !== dataUid), [appUsers, dataUid]);

  return {
    albums,
    items,
    sharedAlbums,
    sharedItems,
    incomingGrants,
    drive,
    gphotos,
    loading,
    canEditPage,
    canEditAlbum,
    people,
    createAlbum,
    renameAlbum,
    deleteAlbum,
    addFiles,
    addLinks,
    updateCaption,
    deletePhoto,
    shareAlbum,
    unshareAlbum,
    setAlbumPrivate,
  };
}

export function useOwnPhotoLibrary() {
  const { dataUid } = useAuth();
  const scoped = usePhotos(dataUid);
  const photos = useMemo(
    () => [...scoped.items, ...scoped.sharedItems],
    [scoped.items, scoped.sharedItems],
  );
  const albums = useMemo(
    () => [...scoped.albums, ...scoped.sharedAlbums],
    [scoped.albums, scoped.sharedAlbums],
  );
  return { ...scoped, photos, albums, ownerId: dataUid };
}

export function driveLinkSrc(raw: string) {
  return displayPhotoSrcFromLink(raw);
}

export async function writeDriveConnectionPlaceholder(uid: string, patch: Partial<DriveConnectionStatus>) {
  await setDoc(doc(db, "photos", uid, "settings", "drive"), {
    ...patch,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}
