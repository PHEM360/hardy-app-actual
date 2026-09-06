import { useMemo } from "react";
import { Check } from "lucide-react";
import { albumLibraryKey, photoLibraryKey, resolveDisplayPhotos, snapshotPhotoRefs } from "@/lib/photoSelection";
import type { PhotoAlbum, PhotoItem } from "@/types/photos";
import type { DisplayWidgetLayout } from "@/lib/displayPages";

export function DisplayAlbumPicker({
  albums,
  photos,
  widget,
  onChange,
}: {
  albums: PhotoAlbum[];
  photos: PhotoItem[];
  widget: DisplayWidgetLayout;
  onChange: (patch: Partial<DisplayWidgetLayout>) => void;
}) {
  const selectedAlbumIds = new Set(widget.photoAlbumIds || []);
  const selectedPhotoIds = new Set(widget.photoIds || []);
  const visible = useMemo(
    () => resolveDisplayPhotos(photos, { photoAlbumIds: widget.photoAlbumIds, photoIds: [] }),
    [photos, widget.photoAlbumIds],
  );
  const grid = selectedAlbumIds.size ? visible : photos;

  const commit = (albumIds: string[], photoIds: string[]) => {
    const next = resolveDisplayPhotos(photos, { photoAlbumIds: albumIds, photoIds });
    onChange({
      photoAlbumIds: albumIds,
      photoIds,
      photoRefs: snapshotPhotoRefs(next),
    });
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-white/80">Albums</p>
      <p className="text-[10px] text-white/40">Pick albums, then optionally pick pictures inside them. Select none to use everything you can see.</p>
      {albums.length === 0 ? (
        <p className="text-xs text-white/50">Create albums on the Photos page first.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {albums.map((album) => {
            const key = albumLibraryKey(album);
            const active = selectedAlbumIds.has(key) || selectedAlbumIds.has(album.id);
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  const next = new Set(selectedAlbumIds);
                  if (active) {
                    next.delete(key);
                    next.delete(album.id);
                  } else {
                    next.add(key);
                  }
                  commit([...next], widget.photoIds || []);
                }}
                className={`rounded-xl px-2.5 py-1 text-[11px] font-semibold ${
                  active ? "bg-primary text-primary-foreground" : "bg-white/10 text-white"
                }`}
              >
                {album.name}
              </button>
            );
          })}
        </div>
      )}
      <div className="grid max-h-56 grid-cols-3 gap-1.5 overflow-y-auto">
        {grid.map((photo) => {
          const key = photoLibraryKey(photo);
          const active = selectedPhotoIds.has(key) || selectedPhotoIds.has(photo.id);
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                const next = new Set(selectedPhotoIds);
                if (active) {
                  next.delete(key);
                  next.delete(photo.id);
                } else {
                  next.add(key);
                }
                commit(widget.photoAlbumIds || [], [...next]);
              }}
              className={`relative overflow-hidden rounded-lg border-2 ${active ? "border-primary" : "border-transparent"}`}
            >
              <img src={photo.url} alt={photo.caption} className="h-16 w-full object-cover" />
              {active && (
                <span className="absolute right-0.5 top-0.5 rounded-md bg-primary p-0.5 text-primary-foreground">
                  <Check className="h-2.5 w-2.5" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
