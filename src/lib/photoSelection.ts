export interface PhotoPickItem {
  id: string;
  albumId?: string;
  ownerId?: string;
  url?: string;
  caption?: string;
}

export interface PhotoPickRef {
  id: string;
  url: string;
  caption?: string;
}

export interface DisplayPhotoPick {
  photoAlbumIds?: string[];
  photoIds?: string[];
  photoRefs?: PhotoPickRef[];
}

export function photoLibraryKey(photo: Pick<PhotoPickItem, "id" | "ownerId" | "albumId">): string {
  return photo.ownerId ? `${photo.ownerId}:${photo.id}` : photo.id;
}

export function albumLibraryKey(album: { id: string; ownerId?: string }): string {
  return album.ownerId ? `${album.ownerId}:${album.id}` : album.id;
}

/**
 * Album/photo-id picks are resolved live against the current `photos` list
 * every time, so a screen always reflects what is actually in the album now
 * (new additions appear, deletions disappear) instead of freezing at
 * whatever was picked. `photoRefs` is only a fallback for photos pasted in
 * as plain links, which have no album/id to look up live — it is never
 * allowed to shadow a live album/photo selection, or a deleted photo would
 * keep "working" from a stale cached url long after it stopped existing.
 */
export function resolveDisplayPhotos<T extends PhotoPickItem>(photos: T[], pick: DisplayPhotoPick): T[] {
  const albumIds = new Set(pick.photoAlbumIds || []);
  const photoIds = new Set(pick.photoIds || []);

  if (albumIds.size || photoIds.size) {
    let pool = photos;
    if (albumIds.size) {
      pool = pool.filter((photo) =>
        albumIds.has(photo.albumId || "") ||
        albumIds.has(photo.ownerId && photo.albumId ? `${photo.ownerId}:${photo.albumId}` : ""),
      );
    }
    if (photoIds.size) {
      pool = pool.filter((photo) => photoIds.has(photo.id) || photoIds.has(photoLibraryKey(photo)));
    }
    return pool.filter((photo) => typeof photo.url === "string" && photo.url.trim().length > 0);
  }

  if (pick.photoRefs?.length) {
    const byId = new Map(photos.map((photo) => [photo.id, photo]));
    const byKey = new Map(photos.map((photo) => [photoLibraryKey(photo), photo]));
    return pick.photoRefs
      .map((ref) => {
        const match = byKey.get(ref.id) || byId.get(ref.id);
        if (match) return { ...match, url: match.url || ref.url, caption: match.caption || ref.caption };
        return { id: ref.id, url: ref.url, caption: ref.caption || "" } as T;
      })
      .filter((photo) => typeof photo.url === "string" && photo.url.trim().length > 0);
  }

  // Nothing picked yet — show nothing rather than every photo in the
  // account, so it is always obvious what a screen will show before it goes
  // on the wall.
  return [];
}

export function snapshotPhotoRefs(photos: PhotoPickItem[]): PhotoPickRef[] {
  return photos
    .filter((photo) => photo.url)
    .map((photo) => ({
      id: photoLibraryKey(photo),
      url: photo.url!,
      caption: photo.caption || "",
    }));
}
