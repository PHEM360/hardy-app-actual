import { useState } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AppUser } from "@/hooks/useAppUsers";
import type { PhotoAlbum, PhotoSharePermission } from "@/types/photos";

export function AlbumShareDialog({
  album,
  people,
  open,
  onOpenChange,
  onShare,
  onUnshare,
  onMakePrivate,
}: {
  album: PhotoAlbum | null;
  people: AppUser[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShare: (uid: string, permission: PhotoSharePermission) => Promise<void>;
  onUnshare: (uid: string) => Promise<void>;
  onMakePrivate: () => Promise<void>;
}) {
  const [targetUid, setTargetUid] = useState("");
  const [permission, setPermission] = useState<PhotoSharePermission>("view");
  const [busy, setBusy] = useState(false);

  if (!album) return null;

  const unused = people.filter((person) => !album.shares.some((share) => share.uid === person.id));

  const add = async () => {
    if (!targetUid) return;
    setBusy(true);
    try {
      await onShare(targetUid, permission);
      setTargetUid("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share {album.name}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Private by default. Pick who can see this album, and whether they can add or tidy photos.
        </p>
        <div className="space-y-2">
          {album.shares.length === 0 && (
            <p className="rounded-xl bg-card px-3 py-2 text-sm text-foreground shadow-card">Only you can see this album.</p>
          )}
          {album.shares.map((share) => {
            const person = people.find((item) => item.id === share.uid);
            return (
              <div key={share.uid} className="flex items-center gap-2 rounded-xl border border-border/50 bg-card px-3 py-2 shadow-card">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{person?.name || "Family member"}</p>
                  <p className="text-[11px] text-muted-foreground">{share.permission === "edit" ? "Can view and edit" : "View only"}</p>
                </div>
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => void onUnshare(share.uid)}
                  aria-label={`Stop sharing with ${person?.name || "this person"}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
        {unused.length > 0 && (
          <div className="space-y-2 rounded-2xl border border-border/40 bg-card p-3 shadow-card">
            <select
              value={targetUid}
              onChange={(event) => setTargetUid(event.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
            >
              <option value="">Choose someone…</option>
              {unused.map((person) => (
                <option key={person.id} value={person.id}>{person.name}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPermission("view")}
                className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold ${
                  permission === "view"
                    ? "bg-gradient-primary text-primary-foreground"
                    : "bg-card text-foreground shadow-card"
                }`}
              >
                <Eye className="h-3.5 w-3.5" /> View only
              </button>
              <button
                type="button"
                onClick={() => setPermission("edit")}
                className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold ${
                  permission === "edit"
                    ? "bg-gradient-primary text-primary-foreground"
                    : "bg-card text-foreground shadow-card"
                }`}
              >
                <Pencil className="h-3.5 w-3.5" /> View and edit
              </button>
            </div>
            <Button className="w-full" disabled={!targetUid || busy} onClick={() => void add()}>
              Share album
            </Button>
          </div>
        )}
        {album.shares.length > 0 && (
          <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => void onMakePrivate()}>
            Make private again
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
