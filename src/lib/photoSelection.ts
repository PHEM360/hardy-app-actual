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

export function resolveDisplayPhotos<T extends PhotoPickItem>(photos: T[], pick: DisplayPhotoPick): T[] {
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

  const albumIds = new Set(pick.photoAlbumIds || []);
  const photoIds = new Set(pick.photoIds || []);
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

export function snapshotPhotoRefs(photos: PhotoPickItem[]): PhotoPickRef[] {
  return photos
    .filter((photo) => photo.url)
    .map((photo) => ({
      id: photoLibraryKey(photo),
      url: photo.url!,
      caption: photo.caption || "",
    }));
}
