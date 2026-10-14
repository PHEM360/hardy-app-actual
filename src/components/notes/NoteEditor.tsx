import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  CalendarPlus, Check, CheckSquare, ChevronDown, ExternalLink, GitBranch, Lock, PenLine, Pencil, Pin, Settings2, Share2, Shield, StickyNote, Trash2, Unlock, X,
} from "lucide-react";
import { noteAccent } from "@/lib/noteStyle";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { HubNote, NoteCanvas, NoteDiagram, NoteFolder, NoteKind, NotesPrefs } from "@/types/notes";
import { NOTE_COLORS, noteCategoryOptions } from "@/types/notes";
import { googleCalendarUrl } from "@/lib/noteCalendar";
import { encryptPayload, decryptPayload } from "@/lib/noteCrypto";
import { deriveNoteTitle } from "@/lib/noteTitle";
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
  onSave: (patch: Partial<HubNote>, options?: { encryptWith?: string; decrypt?: boolean; showOnDashboard?: boolean }) => Promise<void>;
  showOnDashboard?: boolean;
  onDelete: () => Promise<void>;
  onShare: () => void;
  onMoveVault: () => Promise<void>;
  onLeaveVault: () => Promise<void>;
  onAddToHubCalendar: () => Promise<void>;
  defaultKind?: NoteKind;
  initialDiagram?: NoteDiagram | null;
  initialTitle?: string;
  ownerId: string;
  noteId: string;
  prefs?: Pick<NotesPrefs, "customCategories" | "hiddenCategoryIds">;
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
  initialDiagram = null,
  initialTitle = "",
  ownerId,
  noteId,
  showOnDashboard = false,
  prefs,
}: NoteEditorProps) {
  const [draft, setDraft] = useState<Partial<HubNote>>(EMPTY);
  const [passphrase, setPassphrase] = useState("");
  const [unlockedBody, setUnlockedBody] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showExtras, setShowExtras] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [onDashboard, setOnDashboard] = useState(false);
  const viewSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The draft as it was when the sheet opened, used to tell whether anything changed. */
  const snapshot = useRef("");
  const categories = noteCategoryOptions(prefs);

  useEffect(() => {
    if (!open) return;
    const initialChecklist = note?.checklist ?? (
      defaultKind === "checklist" || defaultKind === "task"
        ? [{ id: `c${Date.now()}`, text: "", done: false }]
        : []
    );
    const starterDiagram = !note && initialDiagram !== undefined ? initialDiagram : null;
    const named = (note?.title || initialTitle || "").trim();
    const baseCanvas: NoteCanvas = note?.canvas ?? {
      version: 1,
      height: starterDiagram ? 620 : 560,
      blocks: note?.body ? [{
        id: `legacy-body-${note.id}`,
        type: "text",
        x: 18,
        y: 18,
        width: 300,
        height: 180,
        text: note.body,
        textStyle: "body",
      }] : starterDiagram !== null && starterDiagram !== undefined ? [{
        id: `start-diagram-${noteId}`,
        type: "diagram",
        x: 16,
        y: 16,
        width: 520,
        height: 540,
        diagram: starterDiagram,
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
        title: named || "Checklist",
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
    const normalizedBlocks = migratedBlocks.map((block) => {
      if (block.type !== "text" || block.boxed !== undefined) return block;
      const paperLike = block.id.startsWith("start-text-") || (block.x <= 24 && block.y <= 24 && block.width >= 400);
      return { ...block, boxed: !paperLike };
    });
    const initialCanvas: NoteCanvas = {
      ...baseCanvas,
      height: Math.max(baseCanvas.height, ...normalizedBlocks.map((block) => block.y + block.height + 80)),
      blocks: normalizedBlocks,
    };
    const initialDraft: Partial<HubNote> = note
      ? { ...note, canvas: initialCanvas }
      : { ...EMPTY, kind: defaultKind, title: named, checklist: initialChecklist, canvas: initialCanvas };
    setDraft(initialDraft);
    snapshot.current = JSON.stringify({ draft: initialDraft, onDashboard: !!showOnDashboard });
    setIsEditing(!note);
    setShowExtras(false);
    setShowDetails(false);
    setPassphrase("");
    setUnlockedBody(!note?.locked);
    setOnDashboard(!!showOnDashboard);
  }, [open, note, defaultKind, noteId, showOnDashboard, initialDiagram, initialTitle]);

  const locked = !!draft.locked && !unlockedBody;
  const selectedColor = NOTE_COLORS.find((color) => color.id === draft.color) ?? NOTE_COLORS[1];
  const editorBackground = `color-mix(in srgb, ${selectedColor.swatch} 18%, hsl(var(--background)))`;
  const canvasChecklist = draft.canvas?.blocks.find((block) => block.type === "checklist");
  const canvasDiagram = draft.canvas?.blocks.find((block) => block.type === "diagram");
  const paperEditable = canEdit && isEditing;
  const extrasOpen = paperEditable && showExtras;
  const heading = deriveNoteTitle(draft);
  const isDiagramNote = !!canvasDiagram;
  const isChecklistNote = !!canvasChecklist || draft.kind === "checklist" || draft.kind === "task";
  const sheetHeading = note
    ? (isEditing ? "Edit note" : isChecklistNote ? "Checklist" : isDiagramNote ? "Diagram" : "Note")
    : isDiagramNote
      ? "New diagram"
      : defaultKind === "checklist" || defaultKind === "task"
        ? "New checklist"
        : defaultKind === "drawing"
          ? "New sketch"
          : "New note";

  const searchableFromCanvas = (canvas: NoteCanvas) => canvas.blocks
    .flatMap((block) => {
      if (block.type === "text") return [block.text];
      if (block.type === "table") return block.cells.flat();
      return [];
    })
    .join("\n\n")
    .trim();

  const persistViewCanvas = (canvas: NoteCanvas) => {
    setDraft((current) => ({ ...current, canvas }));
    if (!note || !canEdit || isEditing) return;
    if (viewSaveTimer.current) clearTimeout(viewSaveTimer.current);
    viewSaveTimer.current = setTimeout(() => {
      const checklist = canvas.blocks.find((block) => block.type === "checklist");
      const diagram = canvas.blocks.find((block) => block.type === "diagram");
      void onSave({
        title: deriveNoteTitle({ ...draft, canvas }),
        body: searchableFromCanvas(canvas),
        canvas,
        checklist: checklist?.type === "checklist" ? checklist.items : [],
        diagram: diagram?.type === "diagram" ? diagram.diagram : null,
      });
    }, 280);
  };

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
          title: parsed.title || "Checklist",
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
    setBusy(true);
    try {
      const canvas = draft.canvas ?? { version: 1 as const, height: 520, blocks: [] };
      const searchableBody = searchableFromCanvas(canvas);
      const checklist = canvas.blocks.find((block) => block.type === "checklist");
      const diagram = canvas.blocks.find((block) => block.type === "diagram");
      await onSave({
        title: deriveNoteTitle({ ...draft, canvas }),
        body: searchableBody,
        kind: draft.kind as NoteKind,
        color: draft.color,
        category: draft.category || "personal",
        folderId: draft.folderId ?? null,
        checklist: checklist?.type === "checklist" ? checklist.items : [],
        diagram: diagram?.type === "diagram" ? diagram.diagram : null,
        canvas,
        dueDate: draft.dueDate || undefined,
        pinned: !!draft.pinned,
        archived: !!draft.archived,
        tags: draft.tags,
        addToCalendar: !!draft.addToCalendar,
      }, { showOnDashboard: onDashboard });
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
          title: deriveNoteTitle(draft),
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

  const hasContent = (candidate: Partial<HubNote>) =>
    !!candidate.title?.trim() ||
    (candidate.canvas?.blocks ?? []).some((block) => {
      if (block.type === "text") return !!block.text.trim();
      if (block.type === "checklist") return block.items.some((item) => item.text.trim());
      if (block.type === "drawing") return block.paths.length > 0;
      return true;
    });

  // Closing the sheet keeps what was written. Leaving without saving is a
  // deliberate choice, made with "Close without saving" under Options.
  const requestClose = (nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    const changed = JSON.stringify({ draft, onDashboard }) !== snapshot.current;
    if (paperEditable && !locked && !busy && changed && (note || hasContent(draft))) {
      void save();
      return;
    }
    onOpenChange(false);
  };

  const togglePin = async () => {
    const pinned = !draft.pinned;
    setDraft((current) => ({ ...current, pinned }));
    await onSave({ pinned });
    toast.success(pinned ? "Pinned to the top" : "Unpinned");
  };

  const accent = noteAccent(selectedColor.id === "default" ? null : selectedColor.swatch, 0);
  const KindIcon = isDiagramNote ? GitBranch : draft.kind === "drawing" ? PenLine : isChecklistNote ? CheckSquare : StickyNote;
  const folderName = draft.folderId ? folders.find((folder) => folder.id === draft.folderId)?.name || "Folder" : "No folder";
  const ROW = "flex min-h-12 items-center justify-between gap-3 rounded-lg border border-foreground/20 bg-card px-3 py-2";
  const LABEL = "text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/70";

  return (
    <Sheet open={open} onOpenChange={requestClose}>
      <SheetContent
        side="right"
        className={`flex w-full flex-col gap-0 overflow-hidden border-l-foreground/20 p-0 pt-0 [&>.overlay-close]:text-white ${isDiagramNote ? "sm:max-w-5xl" : "sm:max-w-3xl"}`}
        style={{ background: editorBackground, "--sec": accent } as CSSProperties}
      >
        <SheetHeader className="band shrink-0 space-y-0 bg-[var(--sec)] px-4 pb-3 pr-14 pt-[max(0.875rem,env(safe-area-inset-top,0px))] text-left text-white">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-black/25">
              <KindIcon className="h-4 w-4" />
            </span>
            <SheetTitle className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/85">{sheetHeading}</SheetTitle>
            {draft.pinned && <Pin className="h-3.5 w-3.5 fill-current text-[#E4C77F]" aria-label="Pinned" />}
          </div>
          <SheetDescription className="sr-only">Write and arrange content on a flexible note canvas.</SheetDescription>
          {!locked && paperEditable ? (
            <input
              value={draft.title ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder={isChecklistNote ? "Name this list" : isDiagramNote ? "Name this diagram" : "Title"}
              aria-label="Title"
              className="mt-2 w-full border-0 border-b border-white/40 bg-transparent pb-1 font-display text-2xl font-semibold text-white outline-none placeholder:text-white/55 focus:border-white"
            />
          ) : (
            <p className="mt-2 font-display text-2xl font-semibold leading-tight">{locked ? "Locked note" : heading}</p>
          )}
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
          {locked ? (
            <div className="overflow-hidden rounded-xl border border-foreground/20 bg-card shadow-card">
              <div className="space-y-3 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><Lock className="h-4 w-4" /> This note is password protected.</p>
                <Input
                  type="password"
                  placeholder="Note password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && reveal()}
                  className="h-11 border-foreground/30 bg-background text-base"
                />
                <Button className="w-full" onClick={reveal}><Unlock /> Unlock note</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pb-4">
              {extrasOpen && (
                <div className="space-y-4 rounded-xl border border-foreground/20 bg-card p-3 shadow-card">
                  <div className="space-y-1.5">
                    <p className={LABEL}>Colour</p>
                    <div className="flex flex-wrap gap-2">
                      {NOTE_COLORS.map((color) => {
                        const on = (draft.color ?? "default") === color.id;
                        return (
                          <button
                            key={color.id}
                            type="button"
                            title={color.label}
                            aria-label={`${color.label} note colour`}
                            aria-pressed={on}
                            onClick={() => setDraft((current) => ({ ...current, color: color.id }))}
                            className={`btn-edge flex h-10 w-10 items-center justify-center rounded-md text-white transition-shadow duration-150 ${on ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : ""}`}
                            style={{ background: noteAccent(color.id === "default" ? null : color.swatch, 0) }}
                          >
                            {on && <Check className="h-4 w-4" strokeWidth={3} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <p className={LABEL}>Category</p>
                    <div className="flex flex-wrap gap-2">
                      {categories.map((category) => {
                        const on = draft.category === category.id;
                        return (
                          <button
                            key={category.id}
                            type="button"
                            aria-pressed={on}
                            onClick={() => setDraft((current) => ({ ...current, category: category.id }))}
                            className={`min-h-10 rounded-md border px-3 text-xs font-bold transition-colors duration-150 ${
                              on ? "btn-edge border-[var(--sec)] bg-[var(--sec)] text-white" : "border-foreground/20 bg-background text-foreground"
                            }`}
                          >
                            {category.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className={LABEL}>Folder</Label>
                      <Select value={draft.folderId ?? "inbox"} onValueChange={(value) => setDraft((current) => ({ ...current, folderId: value === "inbox" ? null : value }))}>
                        <SelectTrigger className="h-11 border-foreground/30 bg-background"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="inbox">No folder</SelectItem>
                          {folders.map((folder) => <SelectItem key={folder.id} value={folder.id}>{folder.emoji ? `${folder.emoji} ` : ""}{folder.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className={LABEL}>Date</Label>
                      <Input type="date" value={draft.dueDate?.slice(0, 10) ?? ""} onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value || undefined }))} className="h-11 border-foreground/30 bg-background" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className={ROW}>
                      <p className="text-sm font-semibold">Pin to the top</p>
                      <Switch checked={!!draft.pinned} onCheckedChange={(value) => setDraft((current) => ({ ...current, pinned: value }))} aria-label="Pin to the top" />
                    </div>
                    {isOwn && !note?.vault && !draft.locked && (
                      <div className={ROW}>
                        <div>
                          <p className="text-sm font-semibold">Show on the home screen</p>
                          <p className="text-xs text-foreground/75">Puts this note first on your dashboard</p>
                        </div>
                        <Switch checked={onDashboard} onCheckedChange={setOnDashboard} aria-label="Show on dashboard" />
                      </div>
                    )}
                    {draft.dueDate && (
                      <div className={ROW}>
                        <div>
                          <p className="text-sm font-semibold">Show on the Hardy Hub calendar</p>
                          <p className="text-xs text-foreground/75">Creates or updates a linked event</p>
                        </div>
                        <Switch checked={!!draft.addToCalendar} onCheckedChange={(value) => setDraft((current) => ({ ...current, addToCalendar: value }))} aria-label="Show on the Hardy Hub calendar" />
                      </div>
                    )}
                  </div>

                  <Collapsible open={showDetails} onOpenChange={setShowDetails}>
                    <CollapsibleTrigger asChild>
                      <button type="button" className={`${ROW} w-full text-left`}>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">More</span>
                          <span className="block truncate text-xs text-foreground/75">Tags, sharing, locking, archive and delete</span>
                        </span>
                        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-150 ${showDetails ? "rotate-180" : ""}`} />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 space-y-3">
                      <div className="space-y-1.5">
                        <Label className={LABEL}>Tags</Label>
                        <Input
                          value={(draft.tags ?? []).join(", ")}
                          onChange={(event) => setDraft((current) => ({
                            ...current,
                            tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean),
                          }))}
                          placeholder="Tags, comma separated"
                          className="h-11 border-foreground/30 bg-background"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className={LABEL}>Listed under</Label>
                        <Select value={draft.kind === "drawing" ? "drawing" : draft.kind === "checklist" || draft.kind === "task" ? "checklist" : "note"} onValueChange={(value) => setDraft((current) => ({ ...current, kind: value as NoteKind }))}>
                          <SelectTrigger className="h-11 border-foreground/30 bg-background"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="note">Notes</SelectItem>
                            <SelectItem value="drawing">Sketches</SelectItem>
                            <SelectItem value="checklist">Lists</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className={ROW}>
                        <p className="text-sm font-semibold">Archived</p>
                        <Switch checked={!!draft.archived} onCheckedChange={(value) => setDraft((current) => ({ ...current, archived: value }))} aria-label="Archived" />
                      </div>
                      {isOwn && note && (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {draft.dueDate && (
                            <>
                              <Button type="button" variant="outline" onClick={onAddToHubCalendar}>
                                <CalendarPlus /> Add to Hub calendar
                              </Button>
                              <Button type="button" variant="outline" asChild>
                                <a href={googleCalendarUrl(draft.title || "Note", draft.dueDate, draft.body)} target="_blank" rel="noreferrer">
                                  <ExternalLink className="h-4 w-4" /> Add to Google Calendar
                                </a>
                              </Button>
                            </>
                          )}
                          {!note.vault && (
                            <Button type="button" variant="outline" onClick={onShare}>
                              <Share2 /> Share
                            </Button>
                          )}
                          {!note.vault && (
                            <Button type="button" variant="outline" onClick={onMoveVault}>
                              <Shield /> Move to Secure Notes
                            </Button>
                          )}
                          {note.vault && (
                            <Button type="button" variant="outline" onClick={onLeaveVault}>
                              <Shield /> Move out of Secure Notes
                            </Button>
                          )}
                          {note.locked && (
                            <Button type="button" variant="outline" onClick={() => onSave({
                              locked: false,
                              cipher: null,
                              title: draft.title,
                              body: draft.body,
                              checklist: canvasChecklist?.type === "checklist" ? canvasChecklist.items : draft.checklist,
                              diagram: canvasDiagram?.type === "diagram" ? canvasDiagram.diagram : draft.diagram,
                              canvas: draft.canvas,
                            }, { decrypt: true })}>
                              <Unlock /> Remove password
                            </Button>
                          )}
                        </div>
                      )}
                      {isOwn && note && !note.vault && !note.locked && (
                        <div className="space-y-2 rounded-lg border border-foreground/20 bg-background p-3">
                          <p className="flex items-center gap-1.5 text-sm font-semibold"><Lock className="h-4 w-4" /> Password protect</p>
                          <Input type="password" placeholder="Note password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} className="h-11 border-foreground/30 bg-card" />
                          <Button type="button" variant="secondary" className="w-full" onClick={lockNote}><Lock /> Lock this note</Button>
                        </div>
                      )}
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                          <X /> Close without saving
                        </Button>
                        {isOwn && note && (
                          <Button type="button" variant="destructive" onClick={onDelete}>
                            <Trash2 /> Delete note
                          </Button>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )}

              {!paperEditable && canEdit && note && (
                <p className="text-xs font-medium text-foreground/75">
                  {isChecklistNote ? "Tap a box to tick it off. Tap Edit to change the list." : "Tap Edit to change this note."}
                </p>
              )}

              <PaperNoteCanvasEditor
                canvas={draft.canvas ?? { version: 1, height: 520, blocks: [] }}
                canEdit={paperEditable}
                canInteract={canEdit && !locked}
                showTools={paperEditable}
                ownerId={ownerId}
                noteId={noteId}
                onChange={(canvas) => persistViewCanvas(canvas)}
              />
            </div>
          )}
        </div>

        {!locked && canEdit && (
          <div className="flex shrink-0 items-center gap-2 border-t border-foreground/20 bg-card px-3 pb-[max(0.625rem,env(safe-area-inset-bottom,0px))] pt-2.5 sm:px-5">
            {paperEditable ? (
              <>
                <Button className="flex-1" onClick={save} disabled={busy}>
                  <Check /> {busy ? "Saving…" : "Save"}
                </Button>
                <Button
                  type="button"
                  variant={showExtras ? "secondary" : "outline"}
                  aria-expanded={showExtras}
                  onClick={() => setShowExtras((openExtras) => !openExtras)}
                >
                  <Settings2 /> {showExtras ? "Hide options" : "Options"}
                </Button>
              </>
            ) : note ? (
              <>
                <Button className="flex-1" onClick={() => setIsEditing(true)}>
                  <Pencil /> Edit
                </Button>
                <Button type="button" variant="outline" aria-pressed={!!draft.pinned} onClick={() => void togglePin()}>
                  <Pin /> {draft.pinned ? "Unpin" : "Pin"}
                </Button>
                {isOwn && !note.vault && (
                  <Button type="button" variant="outline" size="icon" aria-label="Share this note" onClick={onShare}>
                    <Share2 />
                  </Button>
                )}
              </>
            ) : null}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
