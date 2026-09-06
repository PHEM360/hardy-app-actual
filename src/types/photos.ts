export type PhotoSharePermission = "view" | "edit";
export type PhotoSource = "upload" | "link" | "drive" | "gphotos";

export interface PhotoAlbumShare {
  uid: string;
  permission: PhotoSharePermission;
}

export interface PhotoAlbum {
  id: string;
  ownerId: string;
  name: string;
  coverPhotoId?: string | null;
  /** Private albums have an empty shares list. */
  shares: PhotoAlbumShare[];
  sharedWith: string[];
  driveFolderId?: string | null;
  driveFolderName?: string | null;
  googlePhotosShareUrl?: string | null;
  googlePhotosAlbumName?: string | null;
  googlePhotosLinked?: boolean;
  lastSyncedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PhotoItem {
  id: string;
  ownerId: string;
  albumId: string;
  url: string;
  storagePath: string;
  caption: string;
  source: PhotoSource;
  driveFileId?: string | null;
  googlePhotosId?: string | null;
  createdAt?: unknown;
}

export interface PhotoGrant {
  id: string;
  ownerId: string;
  targetUid: string;
  permission: PhotoSharePermission;
  albumId: string;
  title?: string;
}

export interface DriveFolderOption {
  id: string;
  name: string;
}

export interface DriveConnectionStatus {
  connected: boolean;
  email?: string;
  lastError?: string | null;
}

export type PhotosConnectionStatus = DriveConnectionStatus;

export const PHOTO_ACCENT = "hsl(330,55%,48%)";
export const PHOTO_GRADIENT = "linear-gradient(135deg,hsl(330,58%,52%),hsl(345,52%,44%))";
