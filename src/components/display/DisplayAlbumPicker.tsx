import { useMemo } from "react";
import { Check, ImageOff } from "lucide-react";
import { PhotoThumb } from "@/components/photos/PhotoThumb";
import { albumLibraryKey, photoLibraryKey, resolveDisplayPhotos, type PhotoPickItem } from "@/lib/photoSelection";
import type { PhotoAlbum } from "@/types/photos";
import type { DisplayWidgetLayout } from "@/lib/displayPages";

export function DisplayAlbumPicker<T extends PhotoPickItem>({
  albums,
  photos,
  widget,
  onChange,
}: {
  albums: PhotoAlbum[];
  // Deliberately broader than the Photos page's own PhotoItem — this also
  // has to cover photos added directly in Remote Displays' Quick library,
  // which have no album, so they can be picked individually too.
  photos: T[];
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
  const selectedCount = useMemo(
    () => resolveDisplayPhotos(photos, { photoAlbumIds: widget.photoAlbumIds, photoIds: widget.photoIds }).length,
    [photos, widget.photoAlbumIds, widget.photoIds],
  );

  // Live album/photo ids only — never a frozen snapshot of urls, so a photo
  // added to a picked album shows up here without reopening this panel, and
  // one removed here stops appearing on the screen instead of turning into
  // a dead black tile.
  const commit = (albumIds: string[], photoIds: string[]) => {
    onChange({ photoAlbumIds: albumIds, photoIds, photoRefs: [] });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold">Albums</p>
        {selectedCount > 0 ? (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
            {selectedCount} photo{selectedCount === 1 ? "" : "s"} selected
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-800">
            <ImageOff className="h-2.5 w-2.5" /> Nothing selected yet
          </span>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">Pick one or more albums below, then optionally tap individual pictures to narrow it down further.</p>
      {albums.length === 0 ? (
        <p className="text-xs text-muted-foreground">Create albums on the Photos page first.</p>
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
                  active ? "bg-gradient-primary text-primary-foreground" : "border border-border bg-background"
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
              <PhotoThumb
                url={photo.url}
                storagePath={photo.storagePath}
                alt={photo.caption || ""}
                className="h-16 w-full bg-white/5 object-cover"
              />
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
