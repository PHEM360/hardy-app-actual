import { useState } from "react";
import { Share2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppUsers } from "@/hooks/useAppUsers";
import type { NoteSharePermission } from "@/types/notes";
import { toast } from "sonner";

interface ShareNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  sharedWith: string[];
  onShare: (email: string, permission: NoteSharePermission) => Promise<void>;
  onUnshare: (uid: string) => Promise<void>;
}

export function ShareNoteDialog({
  open,
  onOpenChange,
  title,
  sharedWith,
  onShare,
  onUnshare,
}: ShareNoteDialogProps) {
  const appUsers = useAppUsers();
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<NoteSharePermission>("view");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await onShare(email.trim(), permission);
      setEmail("");
      toast.success("Shared");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not share");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            Share {title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            They must already have a Hardy Hub account. This is separate from sharing the whole Notes page.
          </p>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@email.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Permission</Label>
            <Select value={permission} onValueChange={(v) => setPermission(v as NoteSharePermission)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="view">Can view</SelectItem>
                <SelectItem value="edit">Can edit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full" disabled={busy || !email.trim()} onClick={submit}>
            Share
          </Button>
          {sharedWith.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <Label>People with access</Label>
              {sharedWith.map((uid) => {
                const u = appUsers.find((x) => x.id === uid);
                return (
                  <div key={uid} className="flex items-center justify-between rounded-lg border border-border px-2.5 py-1.5 text-sm">
                    <span className="truncate">{u?.name || u?.email || uid}</span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => onUnshare(uid)}
                      aria-label="Remove access"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
