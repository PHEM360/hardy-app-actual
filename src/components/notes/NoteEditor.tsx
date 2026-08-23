import { useEffect, useState } from "react";
import {
  CalendarPlus, CheckSquare, ChevronDown, ExternalLink, Lock, PenLine, Share2, Shield, SlidersHorizontal, StickyNote, Trash2, Unlock,
} from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { HubNote, NoteCanvas, NoteFolder, NoteKind, NoteCategory } from "@/types/notes";
import { NOTE_CATEGORIES, NOTE_COLORS } from "@/types/notes";
import { googleCalendarUrl } from "@/lib/noteCalendar";
import { encryptPayload, decryptPayload } from "@/lib/noteCrypto";
import { PaperNoteCanvasEditor } from "@/components/notes/PaperNoteCanvasEditor";
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
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!open) return;
    const initialChecklist = note?.checklist ?? (
      defaultKind === "checklist" || defaultKind === "task"
        ? [{ id: `c${Date.now()}`, text: "", done: false }]
        : []
    );
    const baseCanvas: NoteCanvas = note?.canvas ?? {
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
    const migratedBlocks = [...baseCanvas.blocks];
    const nextBlockY = () => Math.max(28, ...migratedBlocks.map((block) => block.y + block.height + 24));
    if (note?.body && !migratedBlocks.some((block) => block.type === "text")) {
      migratedBlocks.push({
        id: `legacy-body-${note.id}`,
        type: "text",
        x: 28,
        y: nextBlockY(),
        width: 320,
        height: 190,
        text: note.body,
        textStyle: "body",
      });
    }
    if (initialChecklist.length > 0 && !migratedBlocks.some((block) => block.type === "checklist")) {
      migratedBlocks.push({
        id: `legacy-checklist-${note?.id || noteId}`,
        type: "checklist",
        x: 28,
        y: nextBlockY(),
        width: 330,
        height: Math.max(190, initialChecklist.length * 42 + 75),
        items: initialChecklist,
      });
    }
    if (note?.diagram && !migratedBlocks.some((block) => block.type === "diagram")) {
      migratedBlocks.push({
        id: `legacy-diagram-${note.id}`,
        type: "diagram",
        x: 28,
        y: nextBlockY(),
        width: 440,
        height: 430,
        diagram: note.diagram,
      });
    }
    const initialCanvas: NoteCanvas = {
      ...baseCanvas,
      height: Math.max(baseCanvas.height, ...migratedBlocks.map((block) => block.y + block.height + 80)),
      blocks: migratedBlocks,
    };
    setDraft(note
      ? { ...note, canvas: initialCanvas }
      : { ...EMPTY, kind: defaultKind, checklist: initialChecklist, canvas: initialCanvas });
    setShowDetails(false);
    setPassphrase("");
    setUnlockedBody(!note?.locked);
  }, [open, note, defaultKind, noteId]);

  const locked = !!draft.locked && !unlockedBody;
  const selectedColor = NOTE_COLORS.find((color) => color.id === draft.color) ?? NOTE_COLORS[1];
  const editorBackground = `color-mix(in srgb, ${selectedColor.swatch} 18%, hsl(var(--background)))`;
  const canvasChecklist = draft.canvas?.blocks.find((block) => block.type === "checklist");
  const canvasDiagram = draft.canvas?.blocks.find((block) => block.type === "diagram");

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
      const revealedBlocks = [...(revealedCanvas?.blocks ?? [])];
      const nextRevealedY = () => Math.max(28, ...revealedBlocks.map((block) => block.y + block.height + 24));
      if (parsed.checklist?.length && !revealedBlocks.some((block) => block.type === "checklist")) {
        revealedBlocks.push({
          id: `locked-checklist-${note.id}`,
          type: "checklist",
          x: 28,
          y: nextRevealedY(),
          width: 330,
          height: Math.max(190, parsed.checklist.length * 42 + 75),
          items: parsed.checklist,
        });
      }
      if (parsed.diagram && !revealedBlocks.some((block) => block.type === "diagram")) {
        revealedBlocks.push({
          id: `locked-diagram-${note.id}`,
          type: "diagram",
          x: 28,
          y: nextRevealedY(),
          width: 440,
          height: 430,
          diagram: parsed.diagram,
        });
      }
      const migratedCanvas = revealedCanvas || revealedBlocks.length ? {
        version: 1 as const,
        height: Math.max(revealedCanvas?.height ?? 520, ...revealedBlocks.map((block) => block.y + block.height + 80)),
        blocks: revealedBlocks,
      } : undefined;
      setDraft((d) => ({
        ...d,
        title: parsed.title ?? d.title,
        body: parsed.body ?? d.body,
        checklist: parsed.checklist ?? d.checklist,
        diagram: parsed.diagram ?? d.diagram,
        canvas: migratedCanvas ?? d.canvas,
      }));
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
      const checklist = canvas.blocks.find((block) => block.type === "checklist");
      const diagram = canvas.blocks.find((block) => block.type === "diagram");
      await onSave({
        title: draft.title,
        body: searchableBody,
        kind: draft.kind as NoteKind,
        color: draft.color,
        category: (draft.category as NoteCategory) || "personal",
        folderId: draft.folderId ?? null,
        checklist: checklist?.type === "checklist" ? checklist.items : [],
        diagram: diagram?.type === "diagram" ? diagram.diagram : null,
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
          checklist: canvasChecklist?.type === "checklist" ? canvasChecklist.items : draft.checklist,
          diagram: canvasDiagram?.type === "diagram" ? canvasDiagram.diagram : draft.diagram,
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
      <SheetContent side="right" className="flex w-full flex-col overflow-y-auto border-l-border/50 sm:max-w-3xl" style={{ background: editorBackground }}>
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
          <SheetDescription className="sr-only">Write and arrange content on a flexible note canvas.</SheetDescription>
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
              className="h-auto border-0 bg-transparent px-1 py-2 font-display text-2xl font-bold shadow-none focus-visible:ring-0"
              readOnly={!canEdit}
            />

            <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-white/55 bg-white/45 p-2 shadow-sm backdrop-blur">
              <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-foreground/55">Paper</span>
              {NOTE_COLORS.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  title={color.label}
                  aria-label={`${color.label} note colour`}
                  disabled={!canEdit}
                  onClick={() => setDraft((current) => ({ ...current, color: color.id }))}
                  className={`h-6 w-6 rounded-full border-2 shadow-sm transition hover:scale-110 ${draft.color === color.id ? "border-foreground ring-2 ring-background" : "border-white/70"}`}
                  style={{ background: color.id === "default" ? "hsl(var(--muted))" : color.swatch }}
                />
              ))}
            </div>

            <Collapsible open={showDetails} onOpenChange={setShowDetails}>
              <CollapsibleTrigger asChild>
                <button type="button" className="flex w-full items-center gap-2 rounded-2xl border border-foreground/10 bg-white/45 px-4 py-3 text-left shadow-sm transition hover:bg-white/65">
                  <SlidersHorizontal className="h-4 w-4 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">Note details</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {draft.folderId ? folders.find((folder) => folder.id === draft.folderId)?.name || "Folder" : "General notes"}
                      {" · "}{NOTE_CATEGORIES.find((category) => category.id === draft.category)?.label || "Personal"}
                    </span>
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${showDetails ? "rotate-180" : ""}`} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 space-y-3 rounded-2xl border border-foreground/10 bg-white/55 p-4 shadow-card backdrop-blur">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label>Save to tab</Label>
                      <Select value={draft.kind === "drawing" ? "drawing" : draft.kind === "checklist" || draft.kind === "task" ? "checklist" : "note"} onValueChange={(value) => setDraft((current) => ({ ...current, kind: value as NoteKind }))} disabled={!canEdit}>
                        <SelectTrigger className="bg-white/80"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="note">Notes</SelectItem>
                          <SelectItem value="drawing">Drawings & sketches</SelectItem>
                          <SelectItem value="checklist">Checklists</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Save in</Label>
                      <Select value={draft.folderId ?? "inbox"} onValueChange={(value) => setDraft((current) => ({ ...current, folderId: value === "inbox" ? null : value }))} disabled={!canEdit}>
                        <SelectTrigger className="bg-white/80"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="inbox">General notes</SelectItem>
                          {folders.map((folder) => <SelectItem key={folder.id} value={folder.id}>{folder.emoji ? `${folder.emoji} ` : ""}{folder.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Category</Label>
                      <Select value={draft.category || "personal"} onValueChange={(value) => setDraft((current) => ({ ...current, category: value as NoteCategory }))} disabled={!canEdit}>
                        <SelectTrigger className="bg-white/80"><SelectValue /></SelectTrigger>
                        <SelectContent>{NOTE_CATEGORIES.map((category) => <SelectItem key={category.id} value={category.id}>{category.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Date</Label>
                    <Input type="date" value={draft.dueDate?.slice(0, 10) ?? ""} readOnly={!canEdit} onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value || undefined }))} className="bg-white/80" />
                  </div>
                  {draft.dueDate && (
                    <div className="flex items-center justify-between rounded-xl border border-border bg-white/70 px-3 py-2">
                      <div><p className="text-sm font-medium">Show on Hardy Hub calendar</p><p className="text-[11px] text-muted-foreground">Creates or updates a linked event</p></div>
                      <Switch checked={!!draft.addToCalendar} disabled={!canEdit} onCheckedChange={(value) => setDraft((current) => ({ ...current, addToCalendar: value }))} />
                    </div>
                  )}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="flex items-center justify-between rounded-xl border border-border bg-white/70 px-3 py-2"><p className="text-sm font-medium">Pinned</p><Switch checked={!!draft.pinned} disabled={!canEdit} onCheckedChange={(value) => setDraft((current) => ({ ...current, pinned: value }))} /></div>
                    <div className="flex items-center justify-between rounded-xl border border-border bg-white/70 px-3 py-2"><p className="text-sm font-medium">Archived</p><Switch checked={!!draft.archived} disabled={!canEdit} onCheckedChange={(value) => setDraft((current) => ({ ...current, archived: value }))} /></div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <PaperNoteCanvasEditor
              canvas={draft.canvas ?? { version: 1, height: 520, blocks: [] }}
              canEdit={canEdit}
              ownerId={ownerId}
              noteId={noteId}
              onChange={(canvas) => setDraft((current) => ({ ...current, canvas }))}
            />

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
                    checklist: canvasChecklist?.type === "checklist" ? canvasChecklist.items : draft.checklist,
                    diagram: canvasDiagram?.type === "diagram" ? canvasDiagram.diagram : draft.diagram,
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
