import { useEffect, useMemo, useState } from "react";
import { Share2, X, Check, Eye, Pencil, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/auth/AuthContext";
import { useAppUsers } from "@/hooks/useAppUsers";
import { usePageShares, type SharePermission } from "@/hooks/usePageShares";
import type { Pet } from "@/hooks/usePets";

type Step = "manage" | "what" | "pets" | "pick" | "permissions";
type Scope = "page" | "pets";

export function PetsShareButton({
  pets,
  sharePet,
  unsharePet,
  focusPetId,
  onFocusHandled,
}: {
  pets: Pet[];
  sharePet: (petId: string, targetUid: string) => Promise<void>;
  unsharePet: (petId: string, targetUid: string) => Promise<void>;
  focusPetId?: string | null;
  onFocusHandled?: () => void;
}) {
  const { dataUid } = useAuth();
  const appUsers = useAppUsers();
  const { mine, shareWith, updatePermission, revoke } = usePageShares("pets");
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("what");
  const [scope, setScope] = useState<Scope>("page");
  const [petIds, setPetIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [perms, setPerms] = useState<Record<string, SharePermission>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ownedPets = pets.filter((pet) => pet.ownerId === dataUid);
  const nameFor = (uid: string) => appUsers.find((user) => user.id === uid)?.name || "Unknown user";
  const alreadyPageShareIds = useMemo(() => new Set(mine.map((share) => share.targetUid)), [mine]);
  const candidates = appUsers.filter((user) => user.id !== dataUid);
  const selectedUsers = candidates.filter((user) => selected.includes(user.id));

  useEffect(() => {
    if (!focusPetId) return;
    setScope("pets");
    setPetIds([focusPetId]);
    setSelected([]);
    setPerms({});
    setError(null);
    setStep("pick");
    setOpen(true);
    onFocusHandled?.();
  }, [focusPetId, onFocusHandled]);

  const openManage = () => {
    setError(null);
    setStep("manage");
    setOpen(true);
  };

  const openWhat = () => {
    setError(null);
    setScope("page");
    setPetIds([]);
    setSelected([]);
    setPerms({});
    setStep("what");
    setOpen(true);
  };

  const toggleUser = (uid: string) => {
    setSelected((prev) => (prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]));
  };

  const togglePet = (id: string) => {
    setPetIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const confirm = async () => {
    if (selected.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      if (scope === "page") {
        await Promise.all(selected.map((uid) => shareWith(uid, perms[uid] ?? "view")));
      } else {
        await Promise.all(selected.flatMap((uid) => petIds.map((petId) => sharePet(petId, uid))));
      }
      setSelected([]);
      setPerms({});
      setStep("manage");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not share access.");
    } finally {
      setBusy(false);
    }
  };

  const sharedNames = mine.map((share) => nameFor(share.targetUid));
  const petShareCount = ownedPets.reduce((sum, pet) => sum + pet.sharedWith.length, 0);
  const sharedSummary = sharedNames.length + petShareCount === 0
    ? ""
    : sharedNames.length + petShareCount <= 2
      ? [...sharedNames, ...ownedPets.flatMap((pet) => pet.sharedWith.map((uid) => nameFor(uid)))].filter((name, index, list) => list.indexOf(name) === index).slice(0, 2).join(", ")
      : `${sharedNames.length + petShareCount} shares`;

  return (
    <>
      <div className="flex items-center gap-1.5">
        {(mine.length > 0 || petShareCount > 0) && (
          <button
            type="button"
            onClick={openManage}
            className="flex items-center gap-1 max-w-[16rem] px-2.5 py-1.5 rounded-full bg-primary/8 text-[11px] font-semibold text-primary hover:bg-primary/12 transition-colors"
            title="Manage who pets are shared with"
          >
            <span className="text-muted-foreground font-medium">Shared with</span>
            <span className="truncate">{sharedSummary}</span>
          </button>
        )}
        <Button size="sm" variant="ghost" className="rounded-full gap-1.5" onClick={openWhat}>
          <Share2 className="w-4 h-4" />
          <span className="hidden sm:inline">Share</span>
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          {step === "what" && (
            <>
              <DialogHeader>
                <DialogTitle>Share pets</DialogTitle>
                <DialogDescription>Share the whole Pets page, or only the animals you pick.</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setScope("page"); setStep("pick"); }}
                  className="w-full rounded-2xl border border-border/50 bg-card p-3 text-left shadow-card"
                  style={{ borderLeft: "3px solid hsl(0, 65%, 50%)" }}
                >
                  <p className="text-sm font-semibold">Whole Pets page</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">They see every pet, tags and records.</p>
                </button>
                <button
                  type="button"
                  onClick={() => { setScope("pets"); setStep(ownedPets.length === 1 ? "pick" : "pets"); setPetIds(ownedPets.length === 1 ? [ownedPets[0].id] : petIds); }}
                  className="w-full rounded-2xl border border-border/50 bg-card p-3 text-left shadow-card"
                  style={{ borderLeft: "3px solid hsl(32, 92%, 50%)" }}
                >
                  <p className="text-sm font-semibold">Specific pets</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Pick who can see Billy, Luna, or both.</p>
                </button>
              </div>
            </>
          )}

          {step === "pets" && (
            <>
              <DialogHeader>
                <DialogTitle>Which pets?</DialogTitle>
                <DialogDescription>Only the pets you tick will be shared.</DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5 pt-1">
                {ownedPets.map((pet) => {
                  const on = petIds.includes(pet.id);
                  return (
                    <button
                      key={pet.id}
                      type="button"
                      onClick={() => togglePet(pet.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left ${
                        on ? "border-primary/40 bg-primary/8" : "border-border/60 bg-card"
                      }`}
                    >
                      <Checkbox checked={on} className="pointer-events-none" />
                      <span className="text-lg">{pet.avatar}</span>
                      <span className="text-sm font-semibold">{pet.name}</span>
                    </button>
                  );
                })}
                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={() => setStep("what")}>Back</Button>
                  <Button type="button" className="flex-1 rounded-xl" disabled={petIds.length === 0} onClick={() => setStep("pick")}>Continue</Button>
                </div>
              </div>
            </>
          )}

          {step === "pick" && (
            <>
              <DialogHeader>
                <DialogTitle>Who should get access?</DialogTitle>
                <DialogDescription>
                  {scope === "page"
                    ? "They will see the whole Pets page."
                    : `They will see ${ownedPets.filter((pet) => petIds.includes(pet.id)).map((pet) => pet.name).join(", ") || "the selected pets"}.`}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5 pt-1">
                {candidates.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">There are no other app users to share with yet.</p>
                ) : (
                  candidates.map((user) => {
                    const on = selected.includes(user.id);
                    const hasPage = alreadyPageShareIds.has(user.id);
                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => toggleUser(user.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left ${
                          on ? "border-primary/40 bg-primary/8" : "border-border/60 bg-card"
                        }`}
                      >
                        <Checkbox checked={on} className="pointer-events-none" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold truncate">{user.name}</span>
                          {hasPage && <span className="block text-[11px] text-muted-foreground">Already has the whole page</span>}
                        </span>
                      </button>
                    );
                  })
                )}
                {error && <p className="text-[11px] text-destructive">{error}</p>}
                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={() => setStep(scope === "pets" && ownedPets.length > 1 ? "pets" : "what")}>Back</Button>
                  <Button
                    type="button"
                    className="flex-1 rounded-xl"
                    disabled={selected.length === 0}
                    onClick={() => {
                      if (scope === "page") {
                        setPerms((prev) => {
                          const next = { ...prev };
                          selected.forEach((id) => { if (!next[id]) next[id] = "view"; });
                          return next;
                        });
                        setStep("permissions");
                      } else {
                        void confirm();
                      }
                    }}
                  >
                    {scope === "pets" ? (busy ? "Sharing…" : "Share access") : "Continue"}
                  </Button>
                </div>
              </div>
            </>
          )}

          {step === "permissions" && (
            <>
              <DialogHeader>
                <DialogTitle>Confirm access</DialogTitle>
                <DialogDescription>Choose whether they can only view Pets, or edit too.</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 pt-1">
                {selectedUsers.map((user) => {
                  const permission = perms[user.id] ?? "view";
                  return (
                    <div key={user.id} className="rounded-xl border border-border/60 bg-card px-3 py-2.5">
                      <p className="text-sm font-semibold truncate">{user.name}</p>
                      <div className="flex gap-2 mt-2">
                        <button type="button" onClick={() => setPerms((p) => ({ ...p, [user.id]: "view" }))} className={`flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-semibold border ${permission === "view" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                          <Eye className="w-3.5 h-3.5" /> View only
                        </button>
                        <button type="button" onClick={() => setPerms((p) => ({ ...p, [user.id]: "edit" }))} className={`flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-semibold border ${permission === "edit" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                          <Pencil className="w-3.5 h-3.5" /> Can edit
                        </button>
                      </div>
                    </div>
                  );
                })}
                {error && <p className="text-[11px] text-destructive">{error}</p>}
                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" className="flex-1 rounded-xl" disabled={busy} onClick={() => setStep("pick")}>Back</Button>
                  <Button type="button" className="flex-1 rounded-xl gap-1.5" disabled={busy} onClick={() => void confirm()}>
                    <Check className="w-3.5 h-3.5" />
                    {busy ? "Sharing…" : `Share with ${selected.length}`}
                  </Button>
                </div>
              </div>
            </>
          )}

          {step === "manage" && (
            <>
              <DialogHeader>
                <DialogTitle>Shared with</DialogTitle>
                <DialogDescription>Whole-page access and individual pets.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 pt-1">
                {mine.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Whole page</p>
                    {mine.map((share) => (
                      <div key={share.id} className="flex items-center justify-between gap-2 text-sm bg-card border border-border/50 px-3 py-2 rounded-xl mb-1.5">
                        <span className="font-medium truncate">{nameFor(share.targetUid)}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <select value={share.permission} onChange={(event) => updatePermission(share.targetUid, event.target.value as SharePermission)} className="text-xs bg-background border border-border rounded-lg px-1.5 py-1">
                            <option value="view">View only</option>
                            <option value="edit">Can edit</option>
                          </select>
                          <button type="button" onClick={() => revoke(share.targetUid)} className="text-muted-foreground hover:text-destructive" title={`Revoke ${nameFor(share.targetUid)}'s access`}>
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {ownedPets.map((pet) => (
                  <div key={pet.id}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                      {pet.avatar} {pet.name}
                    </p>
                    {pet.sharedWith.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-1">Not shared individually.</p>
                    ) : pet.sharedWith.map((uid) => (
                      <div key={uid} className="flex items-center justify-between gap-2 text-sm bg-card border border-border/50 px-3 py-2 rounded-xl mb-1.5">
                        <span className="font-medium truncate">{nameFor(uid)}</span>
                        <button type="button" onClick={() => void unsharePet(pet.id, uid)} className="text-muted-foreground hover:text-destructive" title={`Stop sharing ${pet.name}`}>
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
                <Button type="button" className="w-full rounded-xl mt-1" onClick={openWhat}>
                  <Heart className="w-3.5 h-3.5 mr-1.5" /> Share with someone else
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
