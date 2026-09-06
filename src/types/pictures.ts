/** Picture albums synced with Google Drive, with per-user sharing. */

export type PictureSharePermission = "view" | "edit";

export interface PictureAlbumShare {
  uid: string;
  permission: PictureSharePermission;
}

export interface PictureAlbum {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  /** private = owner only; shared = listed shares */
  visibility: "private" | "shared";
  shares: PictureAlbumShare[];
  /** Google Drive folder id for this album (under Hardy Hub root). */
  driveFolderId?: string | null;
  coverPhotoId?: string | null;
  coverUrl?: string | null;
  photoCount: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PicturePhoto {
  id: string;
  albumId: string;
  ownerId: string;
  name: string;
  mimeType: string;
  sizeBytes?: number;
  /** Google Drive file id when synced. */
  driveFileId?: string | null;
  /** Firebase Storage path used as a display cache. */
  storagePath?: string | null;
  /** Direct HTTPS URL for display (Drive or Storage). */
  url: string;
  thumbnailUrl?: string | null;
  uploadedBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  pendingDelete?: boolean;
}

export interface GoogleDriveConnection {
  connected: boolean;
  email?: string | null;
  rootFolderId?: string | null;
  lastSyncAt?: unknown;
  updatedAt?: unknown;
}
