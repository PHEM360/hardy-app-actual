import type { PhotoAlbum, PhotoAlbumShare, PhotoItem, PhotoSharePermission, PhotoSource } from "@/types/photos";

function parseShares(data: Record<string, unknown>): PhotoAlbumShare[] {
  if (Array.isArray(data.shares)) {
    return (data.shares as PhotoAlbumShare[]).filter((share) => share?.uid && share.permission);
  }
  const sharedWith = Array.isArray(data.sharedWith) ? (data.sharedWith as string[]) : [];
  const fallback = data.sharePermission === "edit" ? "edit" : "view";
  return sharedWith.map((uid) => ({ uid, permission: fallback as PhotoSharePermission }));
}

export function albumFromDoc(id: string, ownerId: string, data: Record<string, unknown>): PhotoAlbum {
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

export function itemFromDoc(id: string, ownerId: string, albumId: string, data: Record<string, unknown>): PhotoItem {
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
