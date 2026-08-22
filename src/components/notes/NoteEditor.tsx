import { useEffect, useMemo, useState } from "react";
import {
  CalendarPlus, CheckSquare, Lock, Plus, Share2, Shield, StickyNote, Trash2, Unlock, ExternalLink,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { HubNote, NoteFolder, NoteKind, NoteCategory } from "@/types/notes";
import { NOTE_CATEGORIES, NOTE_COLORS } from "@/types/notes";
import { googleCalendarUrl } from "@/lib/noteCalendar";
import { encryptPayload, decryptPayload } from "@/lib/noteCrypto";
import { NoteDiagramEditor } from "@/components/notes/NoteDiagram";
import { toast } from "sonner";

interface NoteEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: HubNote | null;
  folders: NoteFolder[];
  canEdit: boolean;
  isOwn: boolean;
  lockSecret?: string;
  onSave: (patch: Partial<HubNote>, options?: { encryptWith?: string; decrypt?: boolean }) => Promise<void>;
  onDelete: () => Promise<void>;
  onShare: () => void;
  onMoveVault: () => Promise<void>;
  onLeaveVault: () => Promise<void>;
  onAddToHubCalendar: () => Promise<void>;
  defaultKind?: NoteKind;
}

const EMPTY: Partial<HubNote> = {
  title: "",
  body: "",
  kind: "note",
  color: "yellow",
  category: "personal",
  folderId: null,
  checklist: [],
  diagram: null,
  pinned: false,
  tags: [],
};

export function NoteEditor({
  open,
  onOpenChange,
  note,
  folders,
  canEdit,
  isOwn,
  lockSecret,
  onSave,
  onDelete,
  onShare,
  onMoveVault,
  onLeaveVault,
  onAddToHubCalendar,
  defaultKind = "note",
}: NoteEditorProps) {
  const [draft, setDraft] = useState<Partial<HubNote>>(EMPTY);
  const [passphrase, setPassphrase] = useState("");
  const [unlockedBody, setUnlockedBody] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(
      note
        ? { ...note }
        : {
            ...EMPTY,
            kind: defaultKind,
            checklist: defaultKind === "checklist" || defaultKind === "task"
              ? [{ id: `c${Date.now()}`, text: "", done: false }]
              : [],
          }
    );
    setPassphrase("");
    setUnlockedBody(!note?.locked);
  }, [open, note, defaultKind]);

  const locked = !!draft.locked && !unlockedBody;

  const reveal = async () => {
    if (!note?.cipher) {
      toast.error("This note has no encrypted contents");
      return;
    }
    try {
      const secret = passphrase || lockSecret;
      if (!secret) {
        toast.error("Enter the note password");
        return;
      }
      const json = await decryptPayload(secret, note.cipher.salt, note.cipher.iv, note.cipher.data);
      const parsed = JSON.parse(json) as { title?: string; body?: string; checklist?: HubNote["checklist"]; diagram?: HubNote["diagram"] };
      setDraft((d) => ({
        ...d,
        title: parsed.title ?? d.title,
        body: parsed.body ?? d.body,
        checklist: parsed.checklist ?? d.checklist,
        diagram: parsed.diagram ?? d.diagram,
      }));
      setUnlockedBody(true);
    } catch {
      toast.error("Wrong password");
    }
  };

  const save = async () => {
    if (!canEdit) return;
    setBusy(true);
    try {
      await onSave({
        title: draft.title,
        body: draft.body,
        kind: draft.kind as NoteKind,
        color: draft.color,
        category: (draft.category as NoteCategory) || "personal",
        folderId: draft.folderId ?? null,
        checklist: draft.checklist,
        diagram: draft.diagram ?? null,
        dueDate: draft.dueDate || undefined,
        pinned: !!draft.pinned,
        archived: !!draft.archived,
        tags: draft.tags,
        addToCalendar: !!draft.addToCalendar,
      });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const lockNote = async () => {
    if (!passphrase || passphrase.length < 4) {
      toast.error("Choose a password of at least 4 characters");
      return;
    }
    setBusy(true);
    try {
      const cipher = await encryptPayload(
        passphrase,
        JSON.stringify({ title: draft.title, body: draft.body, checklist: draft.checklist, diagram: draft.diagram })
      );
      await onSave(
        {
          title: draft.title,
          body: "",
          checklist: [],
          locked: true,
          cipher,
        },
        { encryptWith: passphrase }
      );
      toast.success("Note locked");
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  const colorSwatch = useMemo(
    () => NOTE_COLORS.find((c) => c.id === (draft.color || "default"))?.swatch,
    [draft.color]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {draft.kind === "checklist" || draft.kind === "task" ? (
              <CheckSquare className="h-4 w-4" />
            ) : (
              <StickyNote className="h-4 w-4" />
            )}
            {note ? "Edit" : "New"} note
          </SheetTitle>
        </SheetHeader>

        {locked ? (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-muted-foreground">This note is password protected.</p>
            <Input
              type="password"
              placeholder="Note password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && reveal()}
            />
            <Button className="w-full" onClick={reveal}>Unlock note</Button>
          </div>
        ) : (
          <div className="mt-4 space-y-4 pb-8">
            <Input
              value={draft.title ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Title"
              className="text-lg font-semibold"
              readOnly={!canEdit}
            />

            <div className="flex gap-1 flex-wrap">
              {NOTE_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  title={c.label}
                  disabled={!canEdit}
                  onClick={() => setDraft((d) => ({ ...d, color: c.id }))}
                  className={`h-6 w-6 rounded-full border-2 ${draft.color === c.id ? "border-foreground" : "border-transparent"}`}
                  style={{ background: c.id === "default" ? "hsl(var(--muted))" : c.swatch }}
                />
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Folder</Label>
                <Select
                  value={draft.folderId ?? "inbox"}
                  onValueChange={(v) => setDraft((d) => ({ ...d, folderId: v === "inbox" ? null : v }))}
                  disabled={!canEdit}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inbox">Inbox</SelectItem>
                    {folders.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.emoji ? `${f.emoji} ` : ""}{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Category</Label>
                <Select
                  value={draft.category || "personal"}
                  onValueChange={(v) => setDraft((d) => ({ ...d, category: v as NoteCategory }))}
                  disabled={!canEdit}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NOTE_CATEGORIES.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Textarea
              value={draft.body ?? ""}
              readOnly={!canEdit}
              onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
              placeholder="Write the note…"
              className="min-h-[140px]"
              style={colorSwatch && draft.color !== "default" ? { backgroundColor: `color-mix(in srgb, ${colorSwatch} 35%, transparent)` } : undefined}
            />

            <div className="space-y-2 rounded-xl border border-border p-3">
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <CheckSquare className="h-4 w-4" /> Checklist
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Optional to-dos on this note. Tick them here, or add a date to see them on the board and calendar. The separate Tasks page is still the full task manager.
                </p>
              </div>
              {(draft.checklist ?? []).map((item, idx) => (
                <div key={item.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={item.done}
                    disabled={!canEdit}
                    onChange={(e) => {
                      const next = [...(draft.checklist ?? [])];
                      next[idx] = { ...item, done: e.target.checked };
                      setDraft((d) => ({ ...d, checklist: next }));
                    }}
                  />
                  <Input
                    value={item.text}
                    readOnly={!canEdit}
                    onChange={(e) => {
                      const next = [...(draft.checklist ?? [])];
                      next[idx] = { ...item, text: e.target.value };
                      setDraft((d) => ({ ...d, checklist: next }));
                    }}
                  />
                </div>
              ))}
              {canEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDraft((d) => ({
                    ...d,
                    kind: d.kind === "note" ? "checklist" : d.kind,
                    checklist: [...(d.checklist ?? []), { id: `c${Date.now()}`, text: "", done: false }],
                  }))}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add item
                </Button>
              )}
            </div>

            <NoteDiagramEditor
              diagram={draft.diagram}
              canEdit={canEdit}
              onChange={(diagram) => setDraft((d) => ({ ...d, diagram }))}
            />

            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={draft.dueDate?.slice(0, 10) ?? ""}
                readOnly={!canEdit}
                onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value || undefined }))}
              />
            </div>

            {draft.dueDate && (
              <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Show on Hardy Hub calendar</p>
                  <p className="text-[11px] text-muted-foreground">Creates or updates a linked event</p>
                </div>
                <Switch
                  checked={!!draft.addToCalendar}
                  disabled={!canEdit}
                  onCheckedChange={(v) => setDraft((d) => ({ ...d, addToCalendar: v }))}
                />
              </div>
            )}

            <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
              <p className="text-sm font-medium">Pinned</p>
              <Switch
                checked={!!draft.pinned}
                disabled={!canEdit}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, pinned: v }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
              <p className="text-sm font-medium">Archived</p>
              <Switch
                checked={!!draft.archived}
                disabled={!canEdit}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, archived: v }))}
              />
            </div>

            {canEdit && (
              <div className="flex flex-col gap-2">
                <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
                {draft.dueDate && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" onClick={onAddToHubCalendar}>
                      <CalendarPlus className="mr-1 h-3.5 w-3.5" /> Hub calendar
                    </Button>
                    <Button type="button" variant="outline" asChild>
                      <a
                        href={googleCalendarUrl(draft.title || "Note", draft.dueDate, draft.body)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="mr-1 h-3.5 w-3.5" /> Google
                      </a>
                    </Button>
                  </div>
                )}
                {isOwn && note && !note.vault && (
                  <Button type="button" variant="outline" onClick={onShare}>
                    <Share2 className="mr-1 h-3.5 w-3.5" /> Share
                  </Button>
                )}
                {isOwn && note && !note.vault && !note.locked && (
                  <div className="space-y-2 rounded-xl border border-border p-3">
                    <p className="text-sm font-medium flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Password protect</p>
                    <Input type="password" placeholder="Note password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
                    <Button type="button" variant="secondary" className="w-full" onClick={lockNote}>Lock this note</Button>
                  </div>
                )}
                {isOwn && note?.locked && (
                  <Button type="button" variant="outline" onClick={() => onSave({ locked: false, cipher: null }, { decrypt: true })}>
                    <Unlock className="mr-1 h-3.5 w-3.5" /> Remove password
                  </Button>
                )}
                {isOwn && note && !note.vault && (
                  <Button type="button" variant="outline" onClick={onMoveVault}>
                    <Shield className="mr-1 h-3.5 w-3.5" /> Move to Secure Notes
                  </Button>
                )}
                {isOwn && note?.vault && (
                  <Button type="button" variant="outline" onClick={onLeaveVault}>
                    Move out of Secure Notes
                  </Button>
                )}
                {isOwn && note && (
                  <Button type="button" variant="destructive" onClick={onDelete}>
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
