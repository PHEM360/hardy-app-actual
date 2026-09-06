import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

type TransferState = {
  title: string;
  done: number;
  total: number;
  status: "running" | "done" | "error";
  detail: string;
};

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
  const [photosTarget, setPhotosTarget] = useState("new");
  const [photosAlbumName, setPhotosAlbumName] = useState("");
  const [pickerSession, setPickerSession] = useState<string | null>(null);
  const [pickerAlbumId, setPickerAlbumId] = useState<string | null>(null);
  const [pickerAlbumName, setPickerAlbumName] = useState("");
  const [folders, setFolders] = useState<DriveFolderOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [transfer, setTransfer] = useState<TransferState | null>(null);
  const [params, setParams] = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);
  const transferClear = useRef<number>(0);

  useEffect(() => {
    if (params.get("drive") === "connected") {
      toast.success("Google Drive linked");
      setDriveOpen(true);
    }
    if (params.get("gphotos") === "connected") {
      toast.success("Google Photos linked");
      setPhotosTarget(selectedAlbum?.ownerId === scopeUserId ? selectedAlbum.id : "new");
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

  useEffect(() => () => window.clearTimeout(transferClear.current), []);

  const showTransfer = useCallback((next: TransferState) => {
    window.clearTimeout(transferClear.current);
    setTransfer(next);
    if (next.status !== "running") {
      transferClear.current = window.setTimeout(() => setTransfer(null), 5000);
    }
  }, []);

  const findAlbumByName = (name: string) => {
    const wanted = name.trim().toLowerCase();
    if (!wanted) return undefined;
    return photos.albums.find((album) => album.name.trim().toLowerCase() === wanted);
  };

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
    if (!canEdit || !files.length) return;
    if (transfer?.status === "running") {
      toast.message("Let the current upload finish first.");
      return;
    }
    let albumId = selectedAlbum?.id;
    if (!albumId) {
      albumId = photos.albums[0]?.id || await photos.createAlbum("Family");
      setRail(albumLibraryKey({ id: albumId, ownerId: scopeUserId || undefined }));
    }
    showTransfer({
      title: "Uploading photos",
      done: 0,
      total: files.length,
      status: "running",
      detail: `0 of ${files.length} uploaded`,
    });
    try {
      await photos.addFiles(albumId, files, (done, total, fileName) => {
        showTransfer({
          title: "Uploading photos",
          done,
          total,
          status: "running",
          detail: `${done} of ${total} uploaded${fileName ? ` · ${fileName}` : ""}`,
        });
      });
      showTransfer({
        title: "Upload complete",
        done: files.length,
        total: files.length,
        status: "done",
        detail: files.length === 1 ? "1 photo uploaded" : `${files.length} photos uploaded`,
      });
    } catch (err) {
      showTransfer({
        title: "Upload failed",
        done: 0,
        total: files.length,
        status: "error",
        detail: err instanceof Error ? err.message : "Could not add those photos",
      });
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
    if (transfer?.status === "running") {
      toast.message("Let the current transfer finish first.");
      return;
    }
    const named = findAlbumByName(folder.name);
    const albumId = named?.id || await photos.createAlbum(folder.name);
    setRail(`${scopeUserId}:${albumId}`);
    setDriveOpen(false);
    showTransfer({
      title: folder.name,
      done: 0,
      total: 1,
      status: "running",
      detail: "Importing from Google Drive…",
    });
    try {
      const added = await syncGoogleDriveAlbum(albumId, folder.id, folder.name);
      showTransfer({
        title: folder.name,
        done: 1,
        total: 1,
        status: "done",
        detail: added
          ? `Imported ${added} photo${added === 1 ? "" : "s"} into ${folder.name}`
          : `${folder.name} is already up to date`,
      });
    } catch (err) {
      showTransfer({
        title: folder.name,
        done: 0,
        total: 1,
        status: "error",
        detail: err instanceof Error ? err.message : "Could not sync that folder",
      });
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

  const importDestination = () => {
    if (photosOpen) return photosTarget;
    if (selectedAlbum?.ownerId === scopeUserId) return selectedAlbum.id;
    return "new";
  };

  const ensureOwnAlbum = async (preferredName = ""): Promise<{ id: string; created: boolean }> => {
    const dest = importDestination();
    if (dest !== "new") {
      const album = photos.albums.find((item) => item.id === dest);
      if (album) {
        setRail(albumLibraryKey(album));
        return { id: album.id, created: false };
      }
    }
    const named = findAlbumByName(preferredName);
    if (named) {
      setRail(albumLibraryKey(named));
      return { id: named.id, created: false };
    }
    const id = await photos.createAlbum(preferredName.trim() || "Google Photos");
    setRail(`${scopeUserId}:${id}`);
    return { id, created: true };
  };

  const nameImportedAlbum = async (albumId: string, created: boolean, title?: string) => {
    const name = title?.trim();
    if (!name || !created) return name;
    const existing = findAlbumByName(name);
    if (existing && existing.id !== albumId) return name;
    await photos.renameAlbum(albumId, name);
    return name;
  };

  const openPhotosImport = () => {
    setPhotosTarget(selectedAlbum?.ownerId === scopeUserId ? selectedAlbum.id : "new");
    setPhotosAlbumName(selectedAlbum?.ownerId === scopeUserId ? selectedAlbum.name : "");
    setPhotosShareUrl(selectedAlbum?.googlePhotosShareUrl || "");
    setPhotosOpen(true);
  };

  const syncPhotosAlbum = async (shareUrl?: string) => {
    const url = (shareUrl || photosShareUrl || selectedAlbum?.googlePhotosShareUrl || "").trim();
    if (!url) {
      toast.error("Paste a shared Google Photos album link, or pick photos from your library.");
      return;
    }
    if (transfer?.status === "running") {
      toast.message("Let the current transfer finish first.");
      return;
    }
    const { id, created } = await ensureOwnAlbum(photosAlbumName);
    setPhotosOpen(false);
    showTransfer({
      title: photosAlbumName.trim() || "Google Photos",
      done: 0,
      total: 1,
      status: "running",
      detail: "Importing album…",
    });
    try {
      const result = await syncGooglePhotosAlbum(id, url);
      const albumName = (await nameImportedAlbum(id, created, result.title)) || photosAlbumName.trim() || "Google Photos";
      setRail(`${scopeUserId}:${id}`);
      setPhotosShareUrl("");
      showTransfer({
        title: albumName,
        done: 1,
        total: 1,
        status: "done",
        detail: result.added
          ? `Imported ${result.added} photo${result.added === 1 ? "" : "s"} into ${albumName}`
          : `${albumName} is already up to date`,
      });
    } catch (err) {
      showTransfer({
        title: "Import failed",
        done: 0,
        total: 1,
        status: "error",
        detail: err instanceof Error ? err.message : "Could not sync that album",
      });
    }
  };

  const pickFromPhotos = async () => {
    if (transfer?.status === "running") {
      toast.message("Let the current transfer finish first.");
      return;
    }
    if (importDestination() === "new" && !photosAlbumName.trim()) {
      setPhotosOpen(true);
      toast.message("Name the album first — use the same name as in Google Photos.");
      return;
    }
    try {
      const { id } = await ensureOwnAlbum(photosAlbumName);
      const albumName = photosAlbumName.trim() || photos.albums.find((album) => album.id === id)?.name || "Google Photos";
      const session = await startGooglePhotosPicker(id);
      setPickerAlbumId(id);
      setPickerAlbumName(albumName);
      setRail(`${scopeUserId}:${id}`);
      setPickerSession(session.sessionId);
      setPhotosOpen(false);
      window.open(session.pickerUri, "hardy-gphotos", "noopener,width=1100,height=820");
      showTransfer({
        title: albumName,
        done: 0,
        total: 1,
        status: "running",
        detail: "Choose photos in Google, then we’ll import them.",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open Google Photos");
    }
  };

  useEffect(() => {
    const albumId = pickerAlbumId || selectedAlbum?.id;
    if (!pickerSession || !albumId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const result = await pollGooglePhotosPicker(albumId, pickerSession);
        if (cancelled || !result.done) return;
        setPickerSession(null);
        setPickerAlbumId(null);
        setRail(`${scopeUserId}:${albumId}`);
        setPhotosOpen(false);
        const albumName = pickerAlbumName || "Google Photos";
        showTransfer({
          title: albumName,
          done: 1,
          total: 1,
          status: "done",
          detail: result.added
            ? `Imported ${result.added} photo${result.added === 1 ? "" : "s"} into ${albumName}`
            : `No new photos were added to ${albumName}`,
        });
      } catch (err) {
        if (!cancelled) {
          setPickerSession(null);
          setPickerAlbumId(null);
          showTransfer({
            title: "Import failed",
            done: 0,
            total: 1,
            status: "error",
            detail: err instanceof Error ? err.message : "Could not finish that Google Photos pick",
          });
        }
      }
    };
    const timer = window.setInterval(() => void tick(), 3000);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pickerAlbumId, pickerAlbumName, pickerSession, scopeUserId, showTransfer]);

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
                    ? `Linked as ${photos.drive.email || "Google"}. Pick a folder — we make an album with the same name.`
                    : "Link Drive so a folder of holiday photos stays on Google, then syncs into an album with the same name."}
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
                    ? `Linked as ${photos.gphotos.email || "Google"}. Choose photos or an album from your library — they stay yours until you share the Hardy Hub album.`
                    : "Connect here or in Settings, then sign in with your own Google account and pick albums."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" disabled={busy} onClick={openPhotosImport}>
                    Choose photos
                  </Button>
                  {photos.gphotos.connected ? (
                    <>
                      <Button size="sm" variant="secondary" disabled={busy || !!pickerSession} onClick={() => {
                        if (selectedAlbum?.ownerId === scopeUserId) void pickFromPhotos();
                        else openPhotosImport();
                      }}>
                        Open my Google library
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
                <Button size="sm" variant="secondary" disabled={transfer?.status === "running"} onClick={() => fileRef.current?.click()}>
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
              <Button size="sm" variant="secondary" disabled={transfer?.status === "running"} onClick={() => fileRef.current?.click()}>
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
                  : "Open your Google library, search the album you want, and pick the pictures to bring here."}
              </p>
              {isOwnScope && photos.gphotos.connected && rail !== "shared" && (
                <Button className="mt-4" disabled={busy} onClick={openPhotosImport}>
                  Open my Google library
                </Button>
              )}
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

      <Dialog open={photosOpen} onOpenChange={(open) => setPhotosOpen(open)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Choose from your Google Photos</DialogTitle></DialogHeader>
          <p className="text-sm text-foreground/80">
            Google no longer lets apps list your albums here. It opens your library instead. Search the album name at the top, tap the photos you want (or select all), then Done.
          </p>
          <Label htmlFor="gphotos-target">Save them into</Label>
          <select
            id="gphotos-target"
            value={photosTarget}
            onChange={(event) => setPhotosTarget(event.target.value)}
            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
          >
            <option value="new">New Hardy Hub album</option>
            {photos.albums.map((album) => (
              <option key={album.id} value={album.id}>{album.name}</option>
            ))}
          </select>
          {photosTarget === "new" && (
            <Input
              value={photosAlbumName}
              onChange={(event) => setPhotosAlbumName(event.target.value)}
              placeholder="Same name as the Google album"
            />
          )}
          {photos.gphotos.connected && (
            <div className="rounded-xl border border-border/40 bg-background p-3">
              <p className="text-sm text-foreground/80">
                {pickerSession
                  ? "Waiting for you to finish in Google Photos. Leave this page open."
                  : "Opens your Google library in a new window. Recent photos show first — search the album if you want a whole album."}
              </p>
              <Button className="mt-2" disabled={busy || !!pickerSession} onClick={() => void pickFromPhotos()}>
                Open my Google library
              </Button>
            </div>
          )}
          <details className="rounded-xl border border-border/40 bg-background px-3 py-2">
            <summary className="cursor-pointer text-sm font-semibold">I have a share link instead</summary>
            <div className="mt-2 space-y-2">
              <p className="text-xs text-foreground/80">
                Only works if the album is shared with a link anyone can view. We name the Hardy Hub album after the Google album.
              </p>
              <Input
                id="gphotos-url"
                value={photosShareUrl}
                onChange={(event) => setPhotosShareUrl(event.target.value)}
                placeholder="https://photos.app.goo.gl/…"
              />
              <Button variant="secondary" disabled={busy || !photosShareUrl.trim()} onClick={() => void syncPhotosAlbum()}>
                Import shared link
              </Button>
            </div>
          </details>
        </DialogContent>
      </Dialog>

      <Dialog open={driveOpen} onOpenChange={setDriveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Drive folder</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Photos stay on Google Drive. We create a Hardy Hub album with the folder’s name, or add to one that already matches.</p>
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

      {transfer && createPortal(
        <div
          className="fixed inset-x-0 z-40 mx-auto w-[min(36rem,calc(100%-1.5rem))] rounded-2xl border border-border/40 p-3 shadow-card"
          style={{
            bottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))",
            background:
              transfer.status === "error"
                ? "color-mix(in srgb, hsl(0,70%,46%) 16%, hsl(var(--card)))"
                : "color-mix(in srgb, hsl(330,55%,48%) 14%, hsl(var(--card)))",
            borderLeftWidth: 4,
            borderLeftColor:
              transfer.status === "error"
                ? "hsl(0,70%,46%)"
                : transfer.status === "done"
                  ? "hsl(145,42%,36%)"
                  : "hsl(330,55%,48%)",
          }}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 truncate font-display text-sm font-bold">{transfer.title}</p>
            <p className="shrink-0 text-xs font-semibold tabular-nums">
              {transfer.done} of {transfer.total}
            </p>
          </div>
          <p className="mt-0.5 truncate text-xs text-foreground/80">{transfer.detail}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
            <div
              className="h-full rounded-full bg-gradient-primary transition-[width] duration-300"
              style={{ width: `${transfer.total ? Math.round((transfer.done / transfer.total) * 100) : 0}%` }}
            />
          </div>
        </div>,
        document.body,
      )}

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
