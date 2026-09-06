import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { db, functions, storage } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";
import type {
  GoogleDriveConnection,
  PictureAlbum,
  PictureAlbumShare,
  PicturePhoto,
  PictureSharePermission,
} from "@/types/pictures";

function mapAlbum(id: string, data: Record<string, unknown>): PictureAlbum {
  const sharesRaw = Array.isArray(data.shares) ? data.shares : [];
  return {
    id,
    ownerId: String(data.ownerId || ""),
    name: String(data.name || "Album"),
    description: data.description ? String(data.description) : "",
    visibility: data.visibility === "shared" ? "shared" : "private",
    shares: sharesRaw
      .map((s: any) => ({
        uid: String(s?.uid || ""),
        permission: (s?.permission === "edit" ? "edit" : "view") as PictureSharePermission,
      }))
      .filter((s: PictureAlbumShare) => !!s.uid),
    driveFolderId: data.driveFolderId ? String(data.driveFolderId) : null,
    coverPhotoId: data.coverPhotoId ? String(data.coverPhotoId) : null,
    coverUrl: data.coverUrl ? String(data.coverUrl) : null,
    photoCount: Number(data.photoCount) || 0,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function mapPhoto(id: string, data: Record<string, unknown>): PicturePhoto {
  return {
    id,
    albumId: String(data.albumId || ""),
    ownerId: String(data.ownerId || ""),
    name: String(data.name || "Photo"),
    mimeType: String(data.mimeType || "image/jpeg"),
    sizeBytes: typeof data.sizeBytes === "number" ? data.sizeBytes : undefined,
    driveFileId: data.driveFileId ? String(data.driveFileId) : null,
    storagePath: data.storagePath ? String(data.storagePath) : null,
    url: String(data.url || ""),
    thumbnailUrl: data.thumbnailUrl ? String(data.thumbnailUrl) : null,
    uploadedBy: String(data.uploadedBy || ""),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    pendingDelete: data.pendingDelete === true,
  };
}

export function useGoogleDriveConnection() {
  const { dataUid } = useAuth();
  const [connection, setConnection] = useState<GoogleDriveConnection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dataUid) {
      setConnection(null);
      setLoading(false);
      return;
    }
    return onSnapshot(
      doc(db, "users", dataUid, "integrations", "googleDrive"),
      (snap) => {
        if (!snap.exists()) {
          setConnection({ connected: false });
        } else {
          const d = snap.data() as Record<string, unknown>;
          setConnection({
            connected: d.connected === true,
            email: d.email ? String(d.email) : null,
            rootFolderId: d.rootFolderId ? String(d.rootFolderId) : null,
            lastSyncAt: d.lastSyncAt,
            updatedAt: d.updatedAt,
          });
        }
        setLoading(false);
      },
      () => {
        setConnection({ connected: false });
        setLoading(false);
      },
    );
  }, [dataUid]);

  const startConnect = useCallback(async () => {
    const fn = httpsCallable(functions, "startGoogleDriveConnect");
    const res = await fn({});
    const url = (res.data as { url?: string })?.url;
    if (!url) throw new Error("Could not start Google Drive connect");
    window.location.href = url;
  }, []);

  const disconnect = useCallback(async () => {
    await httpsCallable(functions, "disconnectGoogleDrive")({});
  }, []);

  const syncNow = useCallback(async (albumId?: string) => {
    await httpsCallable(functions, "syncGoogleDrivePictures")({ albumId: albumId || null });
  }, []);

  return { connection, loading, startConnect, disconnect, syncNow };
}

export function usePictureAlbums() {
  const { dataUid, user } = useAuth();
  const [owned, setOwned] = useState<PictureAlbum[]>([]);
  const [shared, setShared] = useState<PictureAlbum[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dataUid) {
      setOwned([]);
      setShared([]);
      setLoading(false);
      return;
    }

    let ownedReady = false;
    let sharedReady = false;
    const maybeDone = () => {
      if (ownedReady && sharedReady) setLoading(false);
    };

    const unsubOwned = onSnapshot(
      query(collection(db, "pictureAlbums"), where("ownerId", "==", dataUid), orderBy("updatedAt", "desc")),
      (snap) => {
        setOwned(snap.docs.map((d) => mapAlbum(d.id, d.data() as Record<string, unknown>)));
        ownedReady = true; maybeDone();
      },
      () => {
        setOwned([]);
        ownedReady = true; maybeDone();
      },
    );

    const unsubShared = onSnapshot(
      query(
        collection(db, "pictureAlbums"),
        where("shareUids", "array-contains", dataUid),
        orderBy("updatedAt", "desc"),
      ),
      (snap) => {
        setShared(
          snap.docs
            .map((d) => mapAlbum(d.id, d.data() as Record<string, unknown>))
            .filter((a) => a.ownerId !== dataUid),
        );
        sharedReady = true; maybeDone();
      },
      () => {
        setShared([]);
        sharedReady = true; maybeDone();
      },
    );

    return () => {
      unsubOwned();
      unsubShared();
    };
  }, [dataUid]);

  const albums = useMemo(() => {
    const map = new Map<string, PictureAlbum>();
    for (const a of [...owned, ...shared]) map.set(a.id, a);
    return [...map.values()];
  }, [owned, shared]);

  const createAlbum = useCallback(async (name: string, visibility: "private" | "shared" = "private") => {
    const res = await httpsCallable(functions, "createPictureAlbum")({
      name: name.trim() || "New album",
      visibility,
    });
    return String((res.data as { albumId?: string })?.albumId || "");
  }, []);

  const updateAlbum = useCallback(
    async (
      albumId: string,
      patch: Partial<Pick<PictureAlbum, "name" | "description" | "visibility" | "shares">>,
    ) => {
      await httpsCallable(functions, "updatePictureAlbum")({
        albumId,
        ...patch,
        shareUids: patch.shares?.map((s) => s.uid) ?? undefined,
      });
    },
    [],
  );

  const deleteAlbum = useCallback(async (albumId: string) => {
    await httpsCallable(functions, "deletePictureAlbum")({ albumId });
  }, []);

  const canEdit = useCallback(
    (album: PictureAlbum) => {
      if (!dataUid) return false;
      if (album.ownerId === dataUid) return true;
      return album.shares.some((s) => s.uid === dataUid && s.permission === "edit");
    },
    [dataUid],
  );

  return {
    albums,
    owned,
    shared,
    loading,
    createAlbum,
    updateAlbum,
    deleteAlbum,
    canEdit,
    uid: dataUid,
    email: user?.email || "",
  };
}

export function useAlbumPhotos(albumId: string | null) {
  const { dataUid } = useAuth();
  const [photos, setPhotos] = useState<PicturePhoto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!albumId) {
      setPhotos([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    return onSnapshot(
      query(collection(db, "pictureAlbums", albumId, "photos"), orderBy("createdAt", "desc")),
      async (snap) => {
        const rows = snap.docs
          .map((d) => mapPhoto(d.id, d.data() as Record<string, unknown>))
          .filter((p) => !p.pendingDelete);
        const hydrated = await Promise.all(
          rows.map(async (p) => {
            if (p.url) return p;
            if (!p.storagePath) return p;
            try {
              return { ...p, url: await getDownloadURL(ref(storage, p.storagePath)) };
            } catch {
              return p;
            }
          }),
        );
        setPhotos(hydrated);
        setLoading(false);
      },
      () => {
        setPhotos([]);
        setLoading(false);
      },
    );
  }, [albumId]);

  const uploadPhotos = useCallback(
    async (files: File[]) => {
      if (!albumId || !dataUid) return;
      const register = httpsCallable(functions, "uploadPicturePhotos");
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
        const storagePath = `pictureAlbums/${albumId}/${crypto.randomUUID()}-${safe}`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, file, { contentType: file.type });
        const url = await getDownloadURL(storageRef);
        await register({
          albumId,
          name: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          storagePath,
          url,
        });
      }
    },
    [albumId, dataUid],
  );

  const deletePhoto = useCallback(
    async (photoId: string) => {
      if (!albumId) return;
      await httpsCallable(functions, "deletePicturePhoto")({ albumId, photoId });
    },
    [albumId],
  );

  return { photos, loading, uploadPhotos, deletePhoto };
}

/** Flatten photos from selected albums for remote displays. */
export function useAlbumPhotoUrls(albumIds: string[]) {
  const [photos, setPhotos] = useState<PicturePhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const key = [...albumIds].sort().join(",");

  useEffect(() => {
    if (!albumIds.length) {
      setPhotos([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubs: Unsubscribe[] = [];
    const byAlbum = new Map<string, PicturePhoto[]>();
    const publish = () => {
      setPhotos(albumIds.flatMap((id) => byAlbum.get(id) || []));
      setLoading(false);
    };
    for (const albumId of albumIds) {
      const unsub = onSnapshot(
        query(collection(db, "pictureAlbums", albumId, "photos"), orderBy("createdAt", "desc")),
        (snap) => {
          byAlbum.set(
            albumId,
            snap.docs
              .map((d) => mapPhoto(d.id, d.data() as Record<string, unknown>))
              .filter((p) => !p.pendingDelete && !!p.url),
          );
          publish();
        },
        () => {
          byAlbum.set(albumId, []);
          publish();
        },
      );
      unsubs.push(unsub);
    }
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { photos, loading };
}
