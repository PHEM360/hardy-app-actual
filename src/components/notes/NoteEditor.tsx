import { useEffect, useState } from "react";
import {
  CalendarPlus, CheckSquare, ExternalLink, Lock, PenLine, Plus, Share2, Shield, StickyNote, Trash2, Unlock, X,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { HubNote, NoteCanvas, NoteFolder, NoteKind, NoteCategory } from "@/types/notes";
import { NOTE_CATEGORIES, NOTE_COLORS } from "@/types/notes";
import { googleCalendarUrl } from "@/lib/noteCalendar";
import { encryptPayload, decryptPayload } from "@/lib/noteCrypto";
import { NoteDiagramEditor } from "@/components/notes/NoteDiagram";
import { NoteCanvasEditor } from "@/components/notes/NoteCanvasEditor";
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
  ownerId: string;
  noteId: string;
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
  canvas: { version: 1, height: 520, blocks: [] },
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
  ownerId,
  noteId,
}: NoteEditorProps) {
  const [draft, setDraft] = useState<Partial<HubNote>>(EMPTY);
  const [passphrase, setPassphrase] = useState("");
  const [unlockedBody, setUnlockedBody] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [showDiagram, setShowDiagram] = useState(false);

  useEffect(() => {
    if (!open) return;
    const initialChecklist = note?.checklist ?? (
      defaultKind === "checklist" || defaultKind === "task"
        ? [{ id: `c${Date.now()}`, text: "", done: false }]
        : []
    );
    const initialCanvas: NoteCanvas = note?.canvas ?? {
      version: 1,
      height: 520,
      blocks: note?.body ? [{
        id: `legacy-body-${note.id}`,
        type: "text",
        x: 18,
        y: 18,
        width: 300,
        height: 180,
        text: note.body,
        textStyle: "body",
      }] : [],
    };
    setDraft(note
      ? { ...note, canvas: initialCanvas }
      : { ...EMPTY, kind: defaultKind, checklist: initialChecklist, canvas: initialCanvas });
    setShowChecklist(initialChecklist.length > 0 || defaultKind === "checklist" || defaultKind === "task");
    setShowDiagram(!!note?.diagram);
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
      const parsed = JSON.parse(json) as {
        title?: string;
        body?: string;
        checklist?: HubNote["checklist"];
        diagram?: HubNote["diagram"];
        canvas?: HubNote["canvas"];
      };
      const revealedCanvas = parsed.canvas ?? (parsed.body ? {
        version: 1 as const,
        height: 520,
        blocks: [{
          id: `legacy-locked-body-${note.id}`,
          type: "text" as const,
          x: 18,
          y: 18,
          width: 300,
          height: 180,
          text: parsed.body,
          textStyle: "body" as const,
        }],
      } : undefined);
      setDraft((d) => ({
        ...d,
        title: parsed.title ?? d.title,
        body: parsed.body ?? d.body,
        checklist: parsed.checklist ?? d.checklist,
        diagram: parsed.diagram ?? d.diagram,
        canvas: revealedCanvas ?? d.canvas,
      }));
      setShowChecklist(!!parsed.checklist?.length);
      setShowDiagram(!!parsed.diagram);
      setUnlockedBody(true);
    } catch {
      toast.error("Wrong password");
    }
  };

  const save = async () => {
    if (!canEdit) return;
    if (!draft.title?.trim()) {
      toast.error("Give this note a name");
      return;
    }
    setBusy(true);
    try {
      const canvas = draft.canvas ?? { version: 1 as const, height: 520, blocks: [] };
      const searchableBody = canvas.blocks
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n\n")
        .trim();
      await onSave({
        title: draft.title,
        body: searchableBody,
        kind: draft.kind as NoteKind,
        color: draft.color,
        category: (draft.category as NoteCategory) || "personal",
        folderId: draft.folderId ?? null,
        checklist: draft.checklist,
        diagram: draft.diagram ?? null,
        canvas,
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
        JSON.stringify({
          title: draft.title,
          body: draft.body,
          checklist: draft.checklist,
          diagram: draft.diagram,
          canvas: draft.canvas,
        })
      );
      await onSave(
        {
          title: draft.title,
          body: "",
          checklist: [],
          diagram: null,
          canvas: null,
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {draft.kind === "drawing" ? (
              <PenLine className="h-4 w-4" />
            ) : draft.kind === "checklist" || draft.kind === "task" ? (
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

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="space-y-1">
                <Label>Save to tab</Label>
                <Select
                  value={draft.kind === "drawing" ? "drawing" : draft.kind === "checklist" || draft.kind === "task" ? "checklist" : "note"}
                  onValueChange={(value) => {
                    const kind = value as NoteKind;
                    setDraft((current) => ({ ...current, kind }));
                    if (kind === "checklist") {
                      setShowChecklist(true);
                      setDraft((current) => ({
                        ...current,
                        checklist: current.checklist?.length ? current.checklist : [{ id: `c${Date.now()}`, text: "", done: false }],
                      }));
                    }
                  }}
                  disabled={!canEdit}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="note">Notes</SelectItem>
                    <SelectItem value="drawing">Drawings & sketches</SelectItem>
                    <SelectItem value="checklist">Checklists</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Save in</Label>
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

            <NoteCanvasEditor
              canvas={draft.canvas ?? { version: 1, height: 520, blocks: [] }}
              canEdit={canEdit}
              ownerId={ownerId}
              noteId={noteId}
              onChange={(canvas) => setDraft((current) => ({ ...current, canvas }))}
              onAddChecklist={() => {
                setShowChecklist(true);
                setDraft((current) => ({
                  ...current,
                  checklist: current.checklist?.length ? current.checklist : [{ id: `c${Date.now()}`, text: "", done: false }],
                }));
              }}
              onAddDiagram={() => setShowDiagram(true)}
            />

            {showChecklist && (
              <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <p className="flex flex-1 items-center gap-1.5 text-sm font-semibold">
                    <CheckSquare className="h-4 w-4" /> Checklist
                  </p>
                  {canEdit && (
                    <button type="button" onClick={() => {
                      setShowChecklist(false);
                      setDraft((current) => ({ ...current, checklist: [], kind: current.kind === "checklist" ? "note" : current.kind }));
                    }} className="rounded-lg p-1 text-muted-foreground hover:bg-muted" aria-label="Remove checklist">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {(draft.checklist ?? []).map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.done}
                      disabled={!canEdit}
                      onChange={(event) => {
                        const next = [...(draft.checklist ?? [])];
                        next[idx] = { ...item, done: event.target.checked };
                        setDraft((current) => ({ ...current, checklist: next }));
                      }}
                    />
                    <Input
                      value={item.text}
                      readOnly={!canEdit}
                      placeholder="Checklist item"
                      onChange={(event) => {
                        const next = [...(draft.checklist ?? [])];
                        next[idx] = { ...item, text: event.target.value };
                        setDraft((current) => ({ ...current, checklist: next }));
                      }}
                    />
                    {canEdit && (
                      <button type="button" onClick={() => setDraft((current) => ({ ...current, checklist: current.checklist?.filter((entry) => entry.id !== item.id) }))} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {canEdit && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setDraft((current) => ({
                    ...current,
                    checklist: [...(current.checklist ?? []), { id: `c${Date.now()}`, text: "", done: false }],
                  }))}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add item
                  </Button>
                )}
              </div>
            )}

            {showDiagram && (
              <div className="relative">
                {canEdit && (
                  <button type="button" onClick={() => {
                    setShowDiagram(false);
                    setDraft((current) => ({ ...current, diagram: null }));
                  }} className="absolute right-2 top-2 z-20 rounded-lg bg-card p-1 text-muted-foreground shadow-sm hover:text-destructive" aria-label="Remove flowchart">
                    <X className="h-4 w-4" />
                  </button>
                )}
                <NoteDiagramEditor
                  diagram={draft.diagram}
                  canEdit={canEdit}
                  onChange={(diagram) => setDraft((current) => ({ ...current, diagram }))}
                />
              </div>
            )}

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
                <Button onClick={save} disabled={busy || !draft.title?.trim()}>{busy ? "Saving…" : "Save"}</Button>
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
                  <Button type="button" variant="outline" onClick={() => onSave({
                    locked: false,
                    cipher: null,
                    title: draft.title,
                    body: draft.body,
                    checklist: draft.checklist,
                    diagram: draft.diagram,
                    canvas: draft.canvas,
                  }, { decrypt: true })}>
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
