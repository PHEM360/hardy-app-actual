import { useState } from "react";
import { Share2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAppUsers } from "@/hooks/useAppUsers";
import { usePageShares, type SharePermission } from "@/hooks/usePageShares";

export default function ShareAccessButton({ page, label = "Share" }: { page: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const appUsers = useAppUsers();
  const { mine, share, updatePermission, revoke } = usePageShares(page);
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<SharePermission>("view");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameFor = (uid: string) => appUsers.find((u) => u.id === uid)?.name || "Unknown user";
  const sharedNames = mine.map((s) => nameFor(s.targetUid));
  const sharedSummary = sharedNames.length === 0
    ? ""
    : sharedNames.length === 1
      ? sharedNames[0]
      : sharedNames.length === 2
        ? `${sharedNames[0]}, ${sharedNames[1]}`
        : `${sharedNames[0]} +${sharedNames.length - 1}`;

  const handleShare = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await share(email, permission);
      setEmail("");
    } catch (err: any) {
      setError(err.message || "Could not share access.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1.5">
        {mine.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-1 max-w-[9rem] sm:max-w-[12rem] px-2.5 py-1.5 rounded-full bg-primary/8 text-[11px] font-semibold text-primary hover:bg-primary/12 transition-colors"
            title="Manage who this page is shared with"
          >
            <span className="text-muted-foreground font-medium">Shared with:</span>
            <span className="truncate">{sharedSummary}</span>
          </button>
        )}
        <Button size="sm" variant="ghost" className="rounded-full gap-1.5" onClick={() => setOpen(true)}>
          <Share2 className="w-4 h-4" />
          <span className="hidden sm:inline">{label}</span>
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Share access</DialogTitle>
            <DialogDescription>Choose who else can view or edit this page.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {mine.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Shared with</p>
                {mine.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 text-sm bg-muted px-3 py-2 rounded-xl">
                    <span className="font-medium truncate">{nameFor(s.targetUid)}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <select
                        value={s.permission}
                        onChange={(e) => updatePermission(s.targetUid, e.target.value as SharePermission)}
                        className="text-xs bg-background border border-border rounded-lg px-1.5 py-1"
                      >
                        <option value="view">View</option>
                        <option value="edit">Edit</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => revoke(s.targetUid)}
                        className="text-muted-foreground hover:text-destructive"
                        title={`Revoke ${nameFor(s.targetUid)}'s access`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Invite by email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="h-9 rounded-xl text-sm"
                autoCapitalize="none"
                autoCorrect="off"
              />
              <div className="flex items-center gap-4 text-xs text-foreground">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" checked={permission === "view"} onChange={() => setPermission("view")} />
                  View only
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" checked={permission === "edit"} onChange={() => setPermission("edit")} />
                  Can edit
                </label>
              </div>
              <Button
                type="button"
                size="sm"
                className="w-full rounded-xl gap-1.5"
                onClick={handleShare}
                disabled={!email.trim() || busy}
              >
                <UserPlus className="w-3.5 h-3.5" /> Share
              </Button>
              {error && <p className="text-[11px] text-destructive">{error}</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
