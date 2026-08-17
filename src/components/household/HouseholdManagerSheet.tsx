import { useState } from "react";
import { Users, UserPlus, X, Trash2, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/auth/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAppUsers } from "@/hooks/useAppUsers";
import { useMyHouseholds, useHouseholds } from "@/hooks/useHouseholds";
import { useActiveHousehold } from "@/hooks/useActiveHousehold";

export default function HouseholdManagerSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const isSuperAdmin = profile?.role === "superadmin" || profile?.role === "admin";
  const appUsers = useAppUsers();
  const { households } = useMyHouseholds();
  const { createHousehold, renameHousehold, addHouseholdMember, addHouseholdMemberById, removeHouseholdMember, deleteHousehold } = useHouseholds();
  const { activeHouseholdId, setActiveHouseholdId } = useActiveHousehold();

  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [inviteEmail, setInviteEmail] = useState<Record<string, string>>({});
  const [inviteError, setInviteError] = useState<Record<string, string>>({});
  const [inviteBusy, setInviteBusy] = useState<Record<string, boolean>>({});
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const nameFor = (uid: string) => appUsers.find((u) => u.id === uid)?.name || uid;

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const id = await createHousehold(newName.trim());
      setNewName("");
      if (id) setActiveHouseholdId(id);
    } finally {
      setCreating(false);
    }
  };

  const handleInvite = async (householdId: string) => {
    const email = (inviteEmail[householdId] || "").trim();
    if (!email) return;
    setInviteBusy((p) => ({ ...p, [householdId]: true }));
    setInviteError((p) => ({ ...p, [householdId]: "" }));
    try {
      const match = appUsers.find((u) => u.email.trim().toLowerCase() === email.toLowerCase());
      if (match) {
        await addHouseholdMemberById(householdId, match.id);
      } else {
        await addHouseholdMember(householdId, email);
      }
      setInviteEmail((p) => ({ ...p, [householdId]: "" }));
    } catch (err: any) {
      setInviteError((p) => ({ ...p, [householdId]: err.message || "Could not add that user." }));
    } finally {
      setInviteBusy((p) => ({ ...p, [householdId]: false }));
    }
  };

  const commitRename = async (householdId: string) => {
    if (renameValue.trim()) await renameHousehold(householdId, renameValue.trim());
    setRenamingId(null);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Users className="w-4 h-4" /> Share household
          </SheetTitle>
          <p className="text-xs text-muted-foreground text-left">
            Invite someone with an account to this household. They’ll be able to view and edit household pages, including household finance.
          </p>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          {households.map((h) => {
            const canManage = h.createdBy === user?.uid || isSuperAdmin;
            return (
              <div key={h.id} className="rounded-2xl border border-border p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  {renamingId === h.id ? (
                    <div className="flex items-center gap-1.5 flex-1">
                      <Input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="h-8 text-sm"
                        autoFocus
                      />
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => commitRename(h.id)}>
                        <Check className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      className="flex-1 flex items-center gap-2 text-left"
                      onClick={() => setActiveHouseholdId(h.id)}
                    >
                      <span className={`font-semibold text-sm ${h.id === activeHouseholdId ? "text-primary" : "text-foreground"}`}>
                        {h.name}
                      </span>
                      {h.id === activeHouseholdId && (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                          Active
                        </span>
                      )}
                    </button>
                  )}
                  {canManage && renamingId !== h.id && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => { setRenamingId(h.id); setRenameValue(h.name); }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {canManage && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => deleteHousehold(h.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {h.memberIds.map((uid) => (
                    <span key={uid} className="flex items-center gap-1 text-[11px] font-medium bg-muted px-2 py-1 rounded-full text-foreground">
                      {nameFor(uid)}
                      {(canManage || uid === user?.uid) && h.memberIds.length > 1 && (
                        <button
                          onClick={() => removeHouseholdMember(h.id, uid)}
                          className="text-muted-foreground hover:text-destructive"
                          title={uid === user?.uid ? "Leave household" : "Remove member"}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Input
                    type="email"
                    value={inviteEmail[h.id] || ""}
                    onChange={(e) => setInviteEmail((p) => ({ ...p, [h.id]: e.target.value }))}
                    placeholder="name@example.com"
                    className="h-9 rounded-xl text-sm flex-1"
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleInvite(h.id)}
                    disabled={!inviteEmail[h.id]?.trim() || inviteBusy[h.id]}
                    className="h-9 rounded-xl gap-1 flex-shrink-0"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> Add
                  </Button>
                </div>
                {inviteError[h.id] && <p className="text-[11px] text-destructive">{inviteError[h.id]}</p>}
                <p className="text-[11px] text-muted-foreground">
                  Add someone who already has an account. They’ll share this household’s page, documents, and household finances.
                </p>
              </div>
            );
          })}

          <div className="rounded-2xl border border-dashed border-border p-4 space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Create a household</Label>
            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Hardy Family"
                className="h-9 rounded-xl text-sm flex-1"
              />
              <Button
                type="button"
                size="sm"
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
                className="h-9 rounded-xl flex-shrink-0"
              >
                Create
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
