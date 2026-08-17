import { useMemo, useState } from "react";
import { Share2, X, Check, Eye, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/auth/AuthContext";
import { useAppUsers } from "@/hooks/useAppUsers";
import { usePageShares, type SharePermission } from "@/hooks/usePageShares";

type Step = "manage" | "pick" | "permissions";

export default function ShareAccessButton({ page, label = "Share" }: { page: string; label?: string }) {
  const { dataUid } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("pick");
  const appUsers = useAppUsers();
  const { mine, shareWith, updatePermission, revoke } = usePageShares(page);
  const [selected, setSelected] = useState<string[]>([]);
  const [perms, setPerms] = useState<Record<string, SharePermission>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameFor = (uid: string) => appUsers.find((u) => u.id === uid)?.name || "Unknown user";
  const alreadySharedIds = useMemo(() => new Set(mine.map((s) => s.targetUid)), [mine]);
  const candidates = appUsers.filter((u) => u.id !== dataUid && !alreadySharedIds.has(u.id));
  const selectedUsers = candidates.filter((u) => selected.includes(u.id));

  const sharedNames = mine.map((s) => nameFor(s.targetUid));
  const sharedSummary =
    sharedNames.length === 0
      ? ""
      : sharedNames.length <= 2
        ? sharedNames.join(", ")
        : `${sharedNames.length} users`;

  const openManage = () => {
    setError(null);
    setStep("manage");
    setOpen(true);
  };

  const openPick = () => {
    setError(null);
    setSelected([]);
    setPerms({});
    setStep("pick");
    setOpen(true);
  };

  const toggleUser = (uid: string) => {
    setSelected((prev) => (prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]));
  };

  const goPermissions = () => {
    if (selected.length === 0) return;
    setPerms((prev) => {
      const next = { ...prev };
      for (const id of selected) {
        if (!next[id]) next[id] = "view";
      }
      return next;
    });
    setStep("permissions");
  };

  const confirmShare = async () => {
    if (selected.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await Promise.all(selected.map((uid) => shareWith(uid, perms[uid] ?? "view")));
      setSelected([]);
      setPerms({});
      setStep("manage");
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
            onClick={openManage}
            className="flex items-center gap-1 max-w-[16rem] px-2.5 py-1.5 rounded-full bg-primary/8 text-[11px] font-semibold text-primary hover:bg-primary/12 transition-colors"
            title="Manage who this page is shared with"
          >
            <span className="text-muted-foreground font-medium">Shared with</span>
            <span className="truncate">{sharedSummary}</span>
          </button>
        )}
        <Button size="sm" variant="ghost" className="rounded-full gap-1.5" onClick={openPick}>
          <Share2 className="w-4 h-4" />
          <span className="hidden sm:inline">{label}</span>
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          {step === "manage" && (
            <>
              <DialogHeader>
                <DialogTitle>Shared with</DialogTitle>
                <DialogDescription>
                  {mine.length === 0
                    ? "This page isn’t shared with anyone yet."
                    : mine.length === 1
                      ? `This page is shared with ${sharedNames[0]}.`
                      : `This page is shared with ${sharedNames.join(", ")}.`}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5 pt-1">
                {mine.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 text-sm bg-muted px-3 py-2 rounded-xl">
                    <span className="font-medium truncate">{nameFor(s.targetUid)}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <select
                        value={s.permission}
                        onChange={(e) => updatePermission(s.targetUid, e.target.value as SharePermission)}
                        className="text-xs bg-background border border-border rounded-lg px-1.5 py-1"
                      >
                        <option value="view">View only</option>
                        <option value="edit">Can edit</option>
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
                <Button type="button" className="w-full rounded-xl mt-2" onClick={openPick}>
                  Share with someone else
                </Button>
              </div>
            </>
          )}

          {step === "pick" && (
            <>
              <DialogHeader>
                <DialogTitle>Share this page</DialogTitle>
                <DialogDescription>Choose who to share with. Only people who already have an app account are listed.</DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5 pt-1">
                {candidates.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    {appUsers.filter((u) => u.id !== dataUid).length === 0
                      ? "There are no other app users to share with yet."
                      : "Everyone else already has access."}
                  </p>
                ) : (
                  candidates.map((u) => {
                    const on = selected.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleUser(u.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                          on ? "border-primary/40 bg-primary/8" : "border-border/60 bg-muted/30"
                        }`}
                      >
                        <Checkbox checked={on} className="pointer-events-none" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold truncate">{u.name}</span>
                          {u.email && <span className="block text-[11px] text-muted-foreground truncate">{u.email}</span>}
                        </span>
                      </button>
                    );
                  })
                )}
                {error && <p className="text-[11px] text-destructive">{error}</p>}
                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={() => (mine.length ? setStep("manage") : setOpen(false))}>
                    Cancel
                  </Button>
                  <Button type="button" className="flex-1 rounded-xl" disabled={selected.length === 0} onClick={goPermissions}>
                    Continue
                  </Button>
                </div>
              </div>
            </>
          )}

          {step === "permissions" && (
            <>
              <DialogHeader>
                <DialogTitle>Confirm access</DialogTitle>
                <DialogDescription>
                  Choose whether each person can only view this page, or edit it too.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 pt-1">
                {selectedUsers.map((u) => {
                  const permission = perms[u.id] ?? "view";
                  return (
                    <div key={u.id} className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
                      <p className="text-sm font-semibold truncate">{u.name}</p>
                      <div className="flex gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => setPerms((p) => ({ ...p, [u.id]: "view" }))}
                          className={`flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-semibold border ${
                            permission === "view"
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground"
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" /> View only
                        </button>
                        <button
                          type="button"
                          onClick={() => setPerms((p) => ({ ...p, [u.id]: "edit" }))}
                          className={`flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-semibold border ${
                            permission === "edit"
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground"
                          }`}
                        >
                          <Pencil className="w-3.5 h-3.5" /> Can edit
                        </button>
                      </div>
                    </div>
                  );
                })}
                {error && <p className="text-[11px] text-destructive">{error}</p>}
                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" className="flex-1 rounded-xl" disabled={busy} onClick={() => setStep("pick")}>
                    Back
                  </Button>
                  <Button type="button" className="flex-1 rounded-xl gap-1.5" disabled={busy} onClick={() => void confirmShare()}>
                    <Check className="w-3.5 h-3.5" />
                    {busy ? "Sharing…" : `Share with ${selected.length}`}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
