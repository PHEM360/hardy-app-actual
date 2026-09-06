import { useEffect, useMemo, useRef, useState } from "react";
import {
  Cloud,
  CloudOff,
  Image as ImageIcon,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Share2,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppUsers } from "@/hooks/useAppUsers";
import {
  useAlbumPhotos,
  useGoogleDriveConnection,
  usePictureAlbums,
} from "@/hooks/usePictures";
import type { PictureAlbumShare, PictureSharePermission } from "@/types/pictures";

export default function Pictures() {
  const { connection, loading: driveLoading, startConnect, disconnect, syncNow } =
    useGoogleDriveConnection();
  const { albums, loading, createAlbum, updateAlbum, deleteAlbum, canEdit, uid } =
    usePictureAlbums();
  const users = useAppUsers();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const selected = albums.find((a) => a.id === selectedId) || null;
  const { photos, loading: photosLoading, uploadPhotos, deletePhoto } = useAlbumPhotos(selectedId);
  const editable = selected ? canEdit(selected) : false;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const drive = params.get("drive");
    if (drive === "connected") toast.success("Google Drive connected");
    if (drive === "error") toast.error("Google Drive connect failed");
    if (drive) window.history.replaceState({}, "", "/pictures");
  }, []);

  useEffect(() => {
    if (!selectedId && albums[0]) setSelectedId(albums[0].id);
  }, [albums, selectedId]);

  const otherUsers = useMemo(() => users.filter((u) => u.id !== uid), [users, uid]);

  const onCreate = async () => {
    setBusy("create");
    try {
      const id = await createAlbum(newName || "New album", "private");
      setNewName("");
      setSelectedId(id);
      toast.success("Album created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create album");
    } finally {
      setBusy(null);
    }
  };

  const onUpload = async (files: FileList | null) => {
    if (!files?.length || !editable) return;
    setBusy("upload");
    try {
      await uploadPhotos(Array.from(files));
      toast.success("Photos uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const toggleShareUser = async (
    targetUid: string,
    enabled: boolean,
    permission: PictureSharePermission,
  ) => {
    if (!selected || selected.ownerId !== uid) return;
    let shares: PictureAlbumShare[] = selected.shares.filter((s) => s.uid !== targetUid);
    if (enabled) shares = [...shares, { uid: targetUid, permission }];
    setBusy("share");
    try {
      await updateAlbum(selected.id, {
        shares,
        visibility: shares.length ? "shared" : "private",
      });
      toast.success("Sharing updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update sharing");
    } finally {
      setBusy(null);
    }
  };

  return (
    <FeaturePageShell
      title="Pictures"
      subtitle="Albums synced with Google Drive — private or shared"
      icon={<ImageIcon className="h-5 w-5" />}
      sharePage="pictures"
    >
      <div className="mb-4 flex min-w-0 flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-display text-sm font-bold text-foreground">Google Drive</p>
          <p className="text-xs text-muted-foreground">
            {driveLoading
              ? "Checking connection…"
              : connection?.connected
                ? `Connected as ${connection.email || "Google account"} — deletes sync both ways.`
                : "Connect Drive so albums stay in sync. Uploads and deletes update Drive; scheduled sync pulls Drive changes."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {connection?.connected ? (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-9 rounded-xl"
                disabled={!!busy}
                onClick={() => {
                  setBusy("sync");
                  void syncNow(selectedId || undefined)
                    .then(() => toast.success("Synced with Drive"))
                    .catch((err) => toast.error(err instanceof Error ? err.message : "Sync failed"))
                    .finally(() => setBusy(null));
                }}
              >
                {busy === "sync" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                <span className="ml-1.5">Sync now</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-9 rounded-xl"
                onClick={() => {
                  void disconnect()
                    .then(() => toast.success("Drive disconnected"))
                    .catch((err) =>
                      toast.error(err instanceof Error ? err.message : "Disconnect failed"),
                    );
                }}
              >
                <CloudOff className="mr-1.5 h-3.5 w-3.5" />
                Disconnect
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              className="h-9 rounded-xl bg-gradient-primary"
              disabled={!!busy}
              onClick={() => {
                setBusy("connect");
                void startConnect().catch((err) => {
                  toast.error(err instanceof Error ? err.message : "Could not start Drive connect");
                  setBusy(null);
                });
              }}
            >
              {busy === "connect" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Cloud className="h-3.5 w-3.5" />
              )}
              <span className="ml-1.5">Connect Google Drive</span>
            </Button>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-4 lg:flex-row">
        <aside className="min-w-0 space-y-2 lg:w-56 lg:shrink-0">
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New album name"
              className="h-9 rounded-xl"
            />
            <Button
              size="icon"
              className="h-9 w-9 shrink-0 rounded-xl bg-gradient-primary"
              disabled={busy === "create"}
              onClick={() => void onCreate()}
            >
              {busy === "create" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="rounded-2xl border border-border/50 bg-card p-1.5 shadow-card">
            {loading && <p className="p-3 text-xs text-muted-foreground">Loading albums…</p>}
            {!loading && albums.length === 0 && (
              <p className="p-3 text-xs text-muted-foreground">No albums yet — create one above.</p>
            )}
            {albums.map((album) => {
              const active = selectedId === album.id;
              return (
                <button
                  key={album.id}
                  type="button"
                  onClick={() => setSelectedId(album.id)}
                  className={`mb-1 flex w-full items-center gap-2 rounded-xl border px-2 py-2 text-left transition last:mb-0 ${
                    active
                      ? "border-primary/45 bg-primary/10 text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg ${
                      active ? "bg-gradient-primary text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    {album.coverUrl ? (
                      <img src={album.coverUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">{album.name}</span>
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      {album.visibility === "private" ? (
                        <Lock className="h-2.5 w-2.5" />
                      ) : (
                        <Users className="h-2.5 w-2.5" />
                      )}
                      {album.photoCount} photos
                      {album.ownerId !== uid ? " · shared with you" : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-3">
          {!selected ? (
            <div className="rounded-2xl border border-border/50 bg-card p-8 text-center shadow-card">
              <p className="text-sm text-muted-foreground">Select or create an album.</p>
            </div>
          ) : (
            <>
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/50 bg-card px-4 py-3 shadow-card">
                <div className="min-w-0">
                  <h2 className="truncate font-display text-base font-bold text-foreground">
                    {selected.name}
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    {selected.visibility === "private"
                      ? "Private to you"
                      : `Shared with ${selected.shares.length}`}
                    {selected.driveFolderId ? " · Drive folder linked" : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {editable && (
                    <>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => void onUpload(e.target.files)}
                      />
                      <Button
                        size="sm"
                        className="h-9 rounded-xl bg-gradient-primary"
                        disabled={busy === "upload"}
                        onClick={() => fileRef.current?.click()}
                      >
                        {busy === "upload" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                        <span className="ml-1.5">Add photos</span>
                      </Button>
                    </>
                  )}
                  {selected.ownerId === uid && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 rounded-xl"
                      onClick={() => setShareOpen(true)}
                    >
                      <Share2 className="mr-1.5 h-3.5 w-3.5" />
                      Share
                    </Button>
                  )}
                  {selected.ownerId === uid && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 rounded-xl text-destructive"
                      onClick={() => {
                        if (!confirm(`Delete album “${selected.name}” and its Drive folder?`)) return;
                        void deleteAlbum(selected.id)
                          .then(() => {
                            setSelectedId(null);
                            toast.success("Album deleted");
                          })
                          .catch((err) =>
                            toast.error(err instanceof Error ? err.message : "Could not delete"),
                          );
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {photosLoading ? (
                <p className="text-sm text-muted-foreground">Loading photos…</p>
              ) : photos.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/60 bg-card/80 p-10 text-center">
                  <ImageIcon className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No photos in this album yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="group relative aspect-square overflow-hidden rounded-2xl border border-border/40 bg-muted shadow-soft"
                    >
                      {photo.url ? (
                        <img src={photo.url} alt={photo.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                          No preview
                        </div>
                      )}
                      {editable && (
                        <button
                          type="button"
                          className="absolute right-2 top-2 rounded-lg bg-black/55 p-1.5 text-white opacity-0 transition group-hover:opacity-100"
                          onClick={() => {
                            if (!confirm("Delete this photo from the album and Google Drive?")) return;
                            void deletePhoto(photo.id)
                              .then(() => toast.success("Photo deleted"))
                              .catch((err) =>
                                toast.error(err instanceof Error ? err.message : "Delete failed"),
                              );
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Share album</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Private albums are only for you. Shared albums let you pick who can view or edit.
          </p>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {otherUsers.length === 0 && (
              <p className="text-sm text-muted-foreground">No other users found.</p>
            )}
            {otherUsers.map((u) => {
              const existing = selected?.shares.find((s) => s.uid === u.id);
              return (
                <div
                  key={u.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-card px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{u.name}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
                      disabled={!existing || busy === "share"}
                      value={existing?.permission || "view"}
                      onChange={(e) =>
                        void toggleShareUser(u.id, true, e.target.value as PictureSharePermission)
                      }
                    >
                      <option value="view">View</option>
                      <option value="edit">View & edit</option>
                    </select>
                    <Switch
                      checked={!!existing}
                      disabled={busy === "share"}
                      onCheckedChange={(on) =>
                        void toggleShareUser(u.id, on, existing?.permission || "view")
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </FeaturePageShell>
  );
}
