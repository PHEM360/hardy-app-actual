import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FolderPlus, ImagePlus, Images, Link2, Lock, RefreshCw, Share2, Trash2, Upload, Users } from "lucide-react";
import { toast } from "sonner";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { AlbumShareDialog } from "@/components/photos/AlbumShareDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSharedScope } from "@/hooks/useSharedScope";
import { usePhotos } from "@/hooks/usePhotos";
import { disconnectGoogleDrive, listGoogleDriveFolders, startGoogleDriveConnect, syncGoogleDriveAlbum } from "@/lib/googleDriveApi";
import {
  disconnectGooglePhotos,
  pollGooglePhotosPicker,
  startGooglePhotosConnect,
  startGooglePhotosPicker,
  syncGooglePhotosAlbum,
} from "@/lib/googlePhotosApi";
import { isGooglePhotosShareUrl } from "@/lib/googlePhotosAlbum";
import { albumLibraryKey } from "@/lib/photoSelection";
import type { DriveFolderOption, PhotoAlbum } from "@/types/photos";

type RailId = "all" | "shared" | string;

function railClass(active: boolean) {
  return `flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold transition-colors ${
    active
      ? "bg-gradient-primary text-primary-foreground shadow-sm"
      : "text-foreground hover:bg-card"
  }`;
}

export default function Photos() {
  const { scopeUserId, permission, pageTitle, isOwnScope } = useSharedScope("photos");
  const photos = usePhotos(scopeUserId);
  const canEdit = permission === "edit";
  const [rail, setRail] = useState<RailId>("all");
  const [newAlbumOpen, setNewAlbumOpen] = useState(false);
  const [albumName, setAlbumName] = useState("");
  const [shareAlbum, setShareAlbum] = useState<PhotoAlbum | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkText, setLinkText] = useState("");
  const [driveOpen, setDriveOpen] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [photosShareUrl, setPhotosShareUrl] = useState("");
  const [pickerSession, setPickerSession] = useState<string | null>(null);
  const [folders, setFolders] = useState<DriveFolderOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [params, setParams] = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (params.get("drive") === "connected") {
      toast.success("Google Drive linked");
      setDriveOpen(true);
    }
    if (params.get("gphotos") === "connected") {
      toast.success("Google Photos linked");
      setPhotosOpen(true);
    }
    if (params.get("drive") === "error") toast.error("Google Drive did not finish linking");
    if (params.get("gphotos") === "error") toast.error("Google Photos did not finish linking");
    if (!params.get("drive") && !params.get("gphotos")) return;
    const next = new URLSearchParams(params);
    next.delete("drive");
    next.delete("reason");
    next.delete("gphotos");
    setParams(next, { replace: true });
  }, [params, setParams]);

  const selectedAlbum = useMemo(() => {
    if (rail === "all" || rail === "shared") return null;
    return [...photos.albums, ...photos.sharedAlbums].find((album) => albumLibraryKey(album) === rail) || null;
  }, [rail, photos.albums, photos.sharedAlbums]);

  const visiblePhotos = useMemo(() => {
    if (rail === "shared") return photos.sharedItems;
    if (selectedAlbum) {
      return [...photos.items, ...photos.sharedItems].filter(
        (item) => item.albumId === selectedAlbum.id && item.ownerId === selectedAlbum.ownerId,
      );
    }
    return isOwnScope ? [...photos.items, ...photos.sharedItems] : photos.items;
  }, [rail, selectedAlbum, photos.items, photos.sharedItems, isOwnScope]);

  const albumCanEdit = selectedAlbum ? photos.canEditAlbum(selectedAlbum) : canEdit;

  const makeAlbum = async () => {
    if (!albumName.trim()) return;
    setBusy(true);
    try {
      const id = await photos.createAlbum(albumName.trim());
      setAlbumName("");
      setNewAlbumOpen(false);
      setRail(`${scopeUserId}:${id}`);
      toast.success("Album created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create album");
    } finally {
      setBusy(false);
    }
  };

  const upload = async (files: File[]) => {
    if (!canEdit) return;
    let albumId = selectedAlbum?.id;
    if (!albumId) {
      albumId = photos.albums[0]?.id || await photos.createAlbum("Family");
      setRail(albumLibraryKey({ id: albumId, ownerId: scopeUserId || undefined }));
    }
    setBusy(true);
    try {
      await photos.addFiles(albumId, files);
      toast.success(files.length === 1 ? "Photo added" : `${files.length} photos added`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add those photos");
    } finally {
      setBusy(false);
    }
  };

  const addLinks = async () => {
    if (!selectedAlbum) {
      toast.error("Open an album first");
      return;
    }
    setBusy(true);
    try {
      const shareLinks = linkText.split(/[\s,]+/).map((item) => item.trim()).filter(isGooglePhotosShareUrl);
      if (shareLinks[0]) {
        const added = await syncGooglePhotosAlbum(selectedAlbum.id, shareLinks[0]);
        toast.success(added.added ? `Synced ${added.added} photo${added.added === 1 ? "" : "s"} from Google Photos` : "Google Photos album is already up to date");
        setLinkText("");
        setLinkOpen(false);
        return;
      }
      const result = await photos.addLinks(selectedAlbum.id, linkText);
      if (result.folderCount) toast.error("Connect Google Drive to sync a whole folder.");
      if (result.photosAlbumCount) toast.error("Paste a shared Google Photos album link, or use the Google Photos card.");
      if (result.urls.length) {
        toast.success(result.urls.length === 1 ? "Linked photo added" : `${result.urls.length} linked photos added`);
        setLinkText("");
        setLinkOpen(false);
      } else if (!result.folderCount && !result.photosAlbumCount) {
        toast.error("No photo links found");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add those links");
    } finally {
      setBusy(false);
    }
  };

  const connectDrive = async () => {
    setBusy(true);
    try {
      window.location.href = await startGoogleDriveConnect();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start Google Drive");
      setBusy(false);
    }
  };

  const loadFolders = async () => {
    setBusy(true);
    try {
      setFolders(await listGoogleDriveFolders());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not list Drive folders");
    } finally {
      setBusy(false);
    }
  };

  const syncFolder = async (folder: DriveFolderOption) => {
    if (!selectedAlbum || selectedAlbum.ownerId !== scopeUserId) {
      toast.error("Open one of your albums, then sync a Drive folder into it.");
      return;
    }
    setBusy(true);
    try {
      const added = await syncGoogleDriveAlbum(selectedAlbum.id, folder.id, folder.name);
      toast.success(added ? `Synced ${added} photo${added === 1 ? "" : "s"} from Drive` : "Drive folder is already up to date");
      setDriveOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sync that folder");
    } finally {
      setBusy(false);
    }
  };

  const resync = async () => {
    if (!selectedAlbum?.driveFolderId) return;
    setBusy(true);
    try {
      const added = await syncGoogleDriveAlbum(selectedAlbum.id, selectedAlbum.driveFolderId, selectedAlbum.driveFolderName || undefined);
      toast.success(added ? `Added ${added} new Drive photo${added === 1 ? "" : "s"}` : "Already up to date");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sync Drive");
    } finally {
      setBusy(false);
    }
  };

  const connectPhotos = async () => {
    setBusy(true);
    try {
      window.location.href = await startGooglePhotosConnect();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start Google Photos");
      setBusy(false);
    }
  };

  const syncPhotosAlbum = async (shareUrl?: string) => {
    if (!selectedAlbum || selectedAlbum.ownerId !== scopeUserId) {
      toast.error("Open one of your albums, then link a Google Photos album into it.");
      return;
    }
    const url = (shareUrl || photosShareUrl || selectedAlbum.googlePhotosShareUrl || "").trim();
    if (!url) {
      toast.error("Paste a shared Google Photos album link.");
      return;
    }
    setBusy(true);
    try {
      const result = await syncGooglePhotosAlbum(selectedAlbum.id, url);
      toast.success(
        result.added
          ? `Synced ${result.added} photo${result.added === 1 ? "" : "s"}${result.title ? ` from ${result.title}` : ""}`
          : "Google Photos album is already up to date",
      );
      setPhotosShareUrl("");
      setPhotosOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sync that album");
    } finally {
      setBusy(false);
    }
  };

  const pickFromPhotos = async () => {
    if (!selectedAlbum || selectedAlbum.ownerId !== scopeUserId) {
      toast.error("Open one of your albums, then pick photos into it.");
      return;
    }
    setBusy(true);
    try {
      const session = await startGooglePhotosPicker(selectedAlbum.id);
      setPickerSession(session.sessionId);
      window.open(session.pickerUri, "hardy-gphotos", "noopener,width=480,height=780");
      toast.message("Pick the album photos in Google, then come back here.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open Google Photos");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!pickerSession || !selectedAlbum) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const result = await pollGooglePhotosPicker(selectedAlbum.id, pickerSession);
        if (cancelled || !result.done) return;
        setPickerSession(null);
        toast.success(result.added ? `Added ${result.added} photo${result.added === 1 ? "" : "s"} from Google Photos` : "No new Photos were picked");
        setPhotosOpen(false);
      } catch (err) {
        if (!cancelled) {
          setPickerSession(null);
          toast.error(err instanceof Error ? err.message : "Could not finish that Google Photos pick");
        }
      }
    };
    const timer = window.setInterval(() => void tick(), 3000);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pickerSession, selectedAlbum]);

  return (
    <FeaturePageShell
      title={pageTitle}
      subtitle="Albums for the family, Drive, Google Photos, and the photo frames"
      icon={<Images className="h-5 w-5" />}
      sharePage="photos"
      action={canEdit ? (
        <Button size="sm" onClick={() => setNewAlbumOpen(true)}>
          <FolderPlus className="mr-1.5 h-3.5 w-3.5" /> New album
        </Button>
      ) : undefined}
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files?.length) void upload(Array.from(event.target.files));
          event.target.value = "";
        }}
      />

      <div className="flex min-w-0 gap-3">
        <aside className="w-[4.5rem] shrink-0 sm:w-[10.75rem]">
          <div
            className="sticky top-2 space-y-1 rounded-2xl border border-border/40 p-1.5 shadow-card"
            style={{ background: "color-mix(in srgb, hsl(330,55%,48%) 12%, hsl(var(--card)))" }}
          >
            <button type="button" className={railClass(rail === "all")} onClick={() => setRail("all")}>
              <Images className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden truncate sm:inline">All</span>
            </button>
            {isOwnScope && (
              <button type="button" className={railClass(rail === "shared")} onClick={() => setRail("shared")}>
                <Users className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden truncate sm:inline">Shared with me</span>
              </button>
            )}
            {photos.albums.map((album) => {
              const key = albumLibraryKey(album);
              return (
                <button key={key} type="button" className={railClass(rail === key)} onClick={() => setRail(key)}>
                  {album.shares.length ? <Users className="h-3.5 w-3.5 shrink-0" /> : <Lock className="h-3.5 w-3.5 shrink-0" />}
                  <span className="hidden truncate sm:inline">{album.name}</span>
                </button>
              );
            })}
            {isOwnScope && photos.sharedAlbums.map((album) => {
              const key = albumLibraryKey(album);
              return (
                <button key={key} type="button" className={railClass(rail === key)} onClick={() => setRail(key)}>
                  <Users className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden truncate sm:inline">{album.name}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-3 overflow-x-hidden">
          {isOwnScope && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div
                className="rounded-2xl border border-border/40 p-4 shadow-card"
                style={{ background: "color-mix(in srgb, hsl(330,55%,48%) 10%, hsl(var(--card)))", borderLeftWidth: 4, borderLeftColor: "hsl(330,55%,48%)" }}
              >
                <p className="font-display text-base font-bold">Google Drive</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {photos.drive.connected
                    ? `Linked as ${photos.drive.email || "Google"}. Sync a folder into the album you have open.`
                    : "Link Drive so a folder of holiday photos stays on Google, then syncs into an album here."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {photos.drive.connected ? (
                    <>
                      <Button size="sm" variant="secondary" disabled={busy} onClick={() => { setDriveOpen(true); void loadFolders(); }}>
                        Choose Drive folder
                      </Button>
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => void disconnectGoogleDrive().then(() => toast.success("Drive disconnected"))}>
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" disabled={busy} onClick={() => void connectDrive()}>Link Google Drive</Button>
                  )}
                </div>
              </div>
              <div
                className="rounded-2xl border border-border/40 p-4 shadow-card"
                style={{ background: "color-mix(in srgb, hsl(210,55%,46%) 12%, hsl(var(--card)))", borderLeftWidth: 4, borderLeftColor: "hsl(210,55%,46%)" }}
              >
                <p className="font-display text-base font-bold">Google Photos</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {photos.gphotos.connected
                    ? `Linked as ${photos.gphotos.email || "Google"}. Open an album, then pick from Photos or paste a shared album link.`
                    : "Paste a shared album link to keep new pictures in sync, or connect Google to pick from Photos."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => {
                    setPhotosShareUrl(selectedAlbum?.googlePhotosShareUrl || "");
                    setPhotosOpen(true);
                  }}>
                    Link album
                  </Button>
                  {photos.gphotos.connected ? (
                    <>
                      <Button size="sm" variant="secondary" disabled={busy || !!pickerSession} onClick={() => void pickFromPhotos()}>
                        Pick from Photos
                      </Button>
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => void disconnectGooglePhotos().then(() => toast.success("Google Photos disconnected"))}>
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" disabled={busy} onClick={() => void connectPhotos()}>Connect Google Photos</Button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <p className="mr-auto font-display text-lg font-bold">
              {rail === "all" ? "All photos" : rail === "shared" ? "Shared with me" : selectedAlbum?.name || "Album"}
            </p>
            {selectedAlbum && albumCanEdit && (
              <>
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
                  <Upload className="mr-1.5 h-3.5 w-3.5" /> Upload
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setLinkOpen(true)}>
                  <Link2 className="mr-1.5 h-3.5 w-3.5" /> Link
                </Button>
                {selectedAlbum.ownerId === scopeUserId && (
                  <Button size="sm" variant="secondary" onClick={() => setShareAlbum(selectedAlbum)}>
                    <Share2 className="mr-1.5 h-3.5 w-3.5" /> Share
                  </Button>
                )}
                {selectedAlbum.driveFolderId && (
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => void resync()}>
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Sync Drive
                  </Button>
                )}
                {selectedAlbum.googlePhotosShareUrl && (
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => void syncPhotosAlbum(selectedAlbum.googlePhotosShareUrl || undefined)}>
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Sync Photos
                  </Button>
                )}
                {photos.gphotos.connected && selectedAlbum.googlePhotosLinked && (
                  <Button size="sm" variant="ghost" disabled={busy || !!pickerSession} onClick={() => void pickFromPhotos()}>
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Pick more
                  </Button>
                )}
                {selectedAlbum.ownerId === scopeUserId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => {
                      if (confirm(`Delete ${selectedAlbum.name}?`)) {
                        void photos.deleteAlbum(selectedAlbum).then(() => setRail("all"));
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </>
            )}
            {rail === "all" && canEdit && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
                <ImagePlus className="mr-1.5 h-3.5 w-3.5" /> Add photos
              </Button>
            )}
          </div>

          {photos.loading ? (
            <p className="text-sm text-muted-foreground">Loading albums…</p>
          ) : visiblePhotos.length === 0 ? (
            <div className="rounded-2xl border border-border/40 bg-card p-8 text-center shadow-card">
              <Images className="mx-auto h-8 w-8 text-primary" />
              <p className="mt-3 font-display text-lg font-bold">No photos here yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {rail === "shared"
                  ? "When someone shares an album with you, it will land here."
                  : "Upload, paste a link, or sync Drive / Google Photos into an album."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {visiblePhotos.map((photo) => (
                <figure
                  key={`${photo.ownerId}:${photo.id}`}
                  className="group relative overflow-hidden rounded-2xl border border-border/40 bg-card shadow-card"
                >
                  <img src={photo.url} alt={photo.caption || "Family photo"} className="aspect-square w-full object-cover" />
                  {(photo.caption || (selectedAlbum && albumCanEdit)) && (
                    <figcaption className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-black/45 px-2 py-1.5">
                      {albumCanEdit ? (
                        <input
                          value={photo.caption}
                          onChange={(event) => void photos.updateCaption(photo, event.target.value)}
                          placeholder="Caption"
                          className="min-w-0 flex-1 bg-transparent text-[11px] text-white placeholder:text-white/60 focus:outline-none"
                        />
                      ) : (
                        <span className="truncate text-[11px] text-white">{photo.caption}</span>
                      )}
                      {albumCanEdit && (
                        <button
                          type="button"
                          className="rounded-md p-1 text-white/70 hover:bg-red-500/30 hover:text-white"
                          onClick={() => void photos.deletePhoto(photo)}
                          aria-label="Delete photo"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={newAlbumOpen} onOpenChange={setNewAlbumOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New album</DialogTitle></DialogHeader>
          <Label htmlFor="album-name">Name</Label>
          <Input id="album-name" value={albumName} onChange={(event) => setAlbumName(event.target.value)} placeholder="Mum’s holiday" />
          <Button disabled={!albumName.trim() || busy} onClick={() => void makeAlbum()}>Create album</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Link photos</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Paste Google Drive file links, a shared Google Photos album link, or any https image URL.</p>
          <textarea
            value={linkText}
            onChange={(event) => setLinkText(event.target.value)}
            rows={4}
            className="w-full rounded-xl border border-border bg-background p-3 text-sm"
            placeholder="https://drive.google.com/file/d/…"
          />
          <Button disabled={!linkText.trim() || busy} onClick={() => void addLinks()}>Add links</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={photosOpen} onOpenChange={(open) => { setPhotosOpen(open); if (!open) setPickerSession(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Google Photos album</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            In Google Photos, open the album, tap Share, and copy the link. Hardy Hub keeps the picture list here and pulls in new ones when you sync — same idea as a Drive folder.
          </p>
          <Label htmlFor="gphotos-url">Shared album link</Label>
          <Input
            id="gphotos-url"
            value={photosShareUrl}
            onChange={(event) => setPhotosShareUrl(event.target.value)}
            placeholder="https://photos.app.goo.gl/…"
          />
          <Button disabled={busy || !photosShareUrl.trim()} onClick={() => void syncPhotosAlbum()}>
            Sync album
          </Button>
          {photos.gphotos.connected && (
            <div className="rounded-xl bg-card p-3 shadow-card">
              <p className="text-sm text-muted-foreground">
                {pickerSession
                  ? "Waiting for you to finish in Google Photos…"
                  : "Or pick photos from an album in your library. Google no longer lets apps watch a private album live, so pick again later to add new ones."}
              </p>
              <Button className="mt-2" size="sm" variant="secondary" disabled={busy || !!pickerSession} onClick={() => void pickFromPhotos()}>
                Pick from Photos
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={driveOpen} onOpenChange={setDriveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Drive folder</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Photos stay on Google Drive. Hardy Hub stores the file list and shows them in this album and on displays.</p>
          {folders.length === 0 ? (
            <Button disabled={busy} onClick={() => void loadFolders()}>Load folders</Button>
          ) : (
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-xl bg-card px-3 py-2 text-left text-sm shadow-card hover:bg-accent/20"
                  onClick={() => void syncFolder(folder)}
                >
                  {folder.name}
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlbumShareDialog
        album={shareAlbum ? photos.albums.find((album) => album.id === shareAlbum.id) || shareAlbum : null}
        people={photos.people}
        open={!!shareAlbum}
        onOpenChange={(open) => { if (!open) setShareAlbum(null); }}
        onShare={async (uid, permission) => {
          if (!shareAlbum) return;
          await photos.shareAlbum(shareAlbum, uid, permission);
          toast.success("Album shared");
        }}
        onUnshare={async (uid) => {
          if (!shareAlbum) return;
          await photos.unshareAlbum(shareAlbum, uid);
        }}
        onMakePrivate={async () => {
          if (!shareAlbum) return;
          await photos.setAlbumPrivate(shareAlbum);
          toast.success("Album is private again");
        }}
      />
    </FeaturePageShell>
  );
}
