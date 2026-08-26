import { useState } from "react";
import { FolderOpen, ImagePlus, Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { RemoteDisplayPhoto } from "@/hooks/useRemoteDisplayPhotos";

export function DisplayPhotoLibrary({
  photos,
  loading,
  hasPhotoPage,
  onUpload,
  onAddLinks,
  onDelete,
  onAddPhotoPage,
}: {
  photos: RemoteDisplayPhoto[];
  loading: boolean;
  hasPhotoPage: boolean;
  onUpload: (files: File[]) => Promise<void>;
  onAddLinks: (text: string) => Promise<{ added: number; folderCount: number; skippedCount: number }>;
  onDelete: (photo: RemoteDisplayPhoto) => Promise<void>;
  onAddPhotoPage: () => void;
}) {
  const [linkText, setLinkText] = useState("");
  const [busy, setBusy] = useState(false);

  const upload = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    try {
      await onUpload(files);
      toast.success(files.length === 1 ? "Photo added to the library." : `${files.length} photos added.`);
      if (!hasPhotoPage) toast.message("Add a Digital photo frame page so this screen shows them.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add those photos.");
    } finally {
      setBusy(false);
    }
  };

  const addLinks = async () => {
    if (!linkText.trim()) return;
    setBusy(true);
    try {
      const result = await onAddLinks(linkText);
      if (result.folderCount) {
        toast.error("Google Drive folders cannot be listed from here. Open the folder, then paste each photo's share link.");
      }
      if (result.added) {
        toast.success(result.added === 1 ? "Linked photo added." : `${result.added} linked photos added.`);
        setLinkText("");
        if (!hasPhotoPage) toast.message("Add a Digital photo frame page so this screen shows them.");
      } else if (!result.folderCount) {
        toast.error("Paste https image links, or Google Drive file share links.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add those links.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
      <div className="mb-3 flex items-start gap-2">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
          <ImagePlus className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold">Photo library</h2>
          <p className="text-[11px] text-muted-foreground">
            Uploads sit in Hardy Hub. Linked Drive or web photos stay where they are — only the address is saved.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-primary px-3 text-xs font-semibold text-primary-foreground">
          <ImagePlus className="h-3.5 w-3.5" /> Upload
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            aria-label="Upload photos"
            onChange={(event) => {
              if (event.target.files?.length) void upload(Array.from(event.target.files));
              event.target.value = "";
            }}
          />
        </label>
        {!hasPhotoPage && photos.length > 0 && (
          <button
            type="button"
            onClick={onAddPhotoPage}
            className="h-9 rounded-xl border border-border px-3 text-xs font-semibold"
          >
            Add a photo frame page
          </button>
        )}
      </div>

      <label className="mt-3 block text-xs font-semibold">
        Link from Google Drive or the web
        <textarea
          aria-label="Photo links"
          value={linkText}
          onChange={(event) => setLinkText(event.target.value)}
          rows={3}
          placeholder={"https://drive.google.com/file/d/…/view\nhttps://example.com/photo.jpg"}
          className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2 text-sm"
        />
      </label>
      <button
        type="button"
        disabled={busy || !linkText.trim()}
        onClick={() => void addLinks()}
        className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-semibold disabled:opacity-50"
      >
        <Link2 className="h-3.5 w-3.5" /> Add links
      </button>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Google Photos albums and a folder on another laptop cannot be watched live. Share Drive <span className="font-semibold">files</span> (not a folder), or on the display itself pick a folder on that computer.
      </p>

      {loading ? (
        <p className="mt-3 text-xs text-muted-foreground">Loading photos…</p>
      ) : photos.length === 0 ? (
        <div className="mt-3 rounded-xl bg-muted/35 p-4 text-center">
          <FolderOpen className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-2 text-xs font-semibold">No photos yet</p>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((photo) => (
            <div key={photo.id} className="relative overflow-hidden rounded-xl border border-border/60 bg-muted/30">
              {photo.url ? (
                <img src={photo.url} alt={photo.caption || "Display photo"} className="h-20 w-full object-cover" />
              ) : (
                <div className="flex h-20 items-center justify-center px-1 text-center text-[10px] text-muted-foreground">Could not load</div>
              )}
              <button
                type="button"
                aria-label={`Delete ${photo.caption || "photo"}`}
                onClick={() => void onDelete(photo)}
                className="absolute right-1 top-1 rounded-md bg-black/55 p-1 text-white/80 hover:bg-red-600"
              >
                <Trash2 className="h-3 w-3" />
              </button>
              {photo.source === "link" && (
                <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1 text-[9px] font-semibold uppercase tracking-wide text-white/80">Link</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
