export type DisplayPhotoSource = "upload" | "link" | "local" | "album";

const DRIVE_FILE = /\/file\/d\/([a-zA-Z0-9_-]+)/;
const DRIVE_ID = /[?&]id=([a-zA-Z0-9_-]+)/;
const DRIVE_FOLDER = /drive\.google\.com\/(?:drive\/)?(?:u\/\d+\/)?folders\//;

export function isGoogleDriveFolderUrl(value: string): boolean {
  return DRIVE_FOLDER.test(value);
}

export function googleDriveFileId(value: string): string | null {
  const fromPath = value.match(DRIVE_FILE);
  if (fromPath) return fromPath[1];
  const fromQuery = value.match(DRIVE_ID);
  if (fromQuery && /drive\.google\.com|docs\.google\.com/.test(value)) return fromQuery[1];
  return null;
}

/** Turn a pasted Drive share link or image URL into something an <img> can load. */
export function displayPhotoSrcFromLink(raw: string): string | null {
  const value = raw.trim();
  if (!value || isGoogleDriveFolderUrl(value)) return null;
  const driveId = googleDriveFileId(value);
  if (driveId) return `https://drive.google.com/uc?export=view&id=${driveId}`;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || host === "127.0.0.1") return null;
    return value;
  } catch {
    return null;
  }
}

export function parseDisplayPhotoLinks(text: string): {
  urls: string[];
  folderCount: number;
  skippedCount: number;
} {
  const tokens = text.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean);
  const urls: string[] = [];
  let folderCount = 0;
  let skippedCount = 0;
  for (const token of tokens) {
    if (isGoogleDriveFolderUrl(token)) {
      folderCount += 1;
      continue;
    }
    const src = displayPhotoSrcFromLink(token);
    if (src) urls.push(src);
    else skippedCount += 1;
  }
  return { urls: [...new Set(urls)], folderCount, skippedCount };
}

export function visibleDisplayPhotos<T extends { url?: string }>(photos: T[]): T[] {
  return photos.filter((photo) => typeof photo.url === "string" && photo.url.trim().length > 0);
}

/** Pick library and/or album photos for a photos widget. */
export function photosForDisplayWidget<T extends { id: string; albumId?: string }>(
  photos: T[],
  widget: { photoIds?: string[]; albumIds?: string[] },
): T[] {
  const albumIds = widget.albumIds || [];
  const photoIds = widget.photoIds || [];
  if (!albumIds.length && !photoIds.length) {
    return photos.filter((photo) => !photo.albumId);
  }
  return photos.filter((photo) => {
    if (albumIds.length && photo.albumId && albumIds.includes(photo.albumId)) return true;
    if (photoIds.length && photoIds.includes(photo.id)) return true;
    return false;
  });
}
