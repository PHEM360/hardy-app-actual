import { useMemo, useState } from "react";
import {
  FileDown,
  Loader2,
  Mail,
  Pin,
  Plus,
  Printer,
  StickyNote,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useHouseholdNotes, useHouseholdSettings } from "@/hooks/useHousehold";
import { useActiveHousehold } from "@/hooks/useActiveHousehold";
import { DEFAULT_NOTE_TYPES, type HouseholdNote } from "@/types/app";
import {
  buildHouseholdNotesPdf,
  downloadBlob,
  printNotesPdf,
  shareOrDownloadNotesPdf,
} from "@/lib/householdNotesPdf";

const ACCENT = "hsl(30,60%,50%)";

function previewText(body: string) {
  const cleaned = body.replace(/\s+/g, " ").trim();
  if (!cleaned) return "Empty note";
  return cleaned.length > 120 ? `${cleaned.slice(0, 117)}…` : cleaned;
}

function formatUpdated(note: HouseholdNote) {
  const value = note.updatedAt || note.createdAt;
  if (!value) return "";
  const ms =
    typeof value?.toMillis === "function"
      ? value.toMillis()
      : typeof value?.seconds === "number"
        ? value.seconds * 1000
        : NaN;
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export default function NotesSection() {
  const { notes, loading, addNote, updateNote, deleteNote } = useHouseholdNotes();
  const { settings } = useHouseholdSettings();
  const { activeHouseholdId, availableHouseholds } = useActiveHousehold();
  const householdName =
    availableHouseholds.find((h) => h.id === activeHouseholdId)?.name || "Household";

  const noteTypes = settings.noteTypes?.length ? settings.noteTypes : DEFAULT_NOTE_TYPES;
  const [filter, setFilter] = useState<string>("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<HouseholdNote | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [noteType, setNoteType] = useState("");
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HouseholdNote | null>(null);
  const [summaryBusy, setSummaryBusy] = useState(false);

  const filtered = useMemo(() => {
    if (filter === "all") return notes;
    if (filter === "untyped") return notes.filter((n) => !n.noteType?.trim());
    return notes.filter((n) => n.noteType === filter);
  }, [notes, filter]);

  const openNew = () => {
    setEditing(null);
    setTitle("");
    setBody("");
    setNoteType(noteTypes[0] || "");
    setPinned(false);
    setEditorOpen(true);
  };

  const openEdit = (note: HouseholdNote) => {
    setEditing(note);
    setTitle(note.title || "");
    setBody(note.body || "");
    setNoteType(note.noteType || "");
    setPinned(Boolean(note.pinned));
    setEditorOpen(true);
  };

  const save = async () => {
    const nextTitle = title.trim() || "Untitled note";
    setSaving(true);
    try {
      if (editing?.id) {
        await updateNote(editing.id, {
          title: nextTitle,
          body,
          noteType,
          pinned,
        });
        toast.success("Note saved");
      } else {
        await addNote({ title: nextTitle, body, noteType, pinned });
        toast.success("Note added");
      }
      setEditorOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save note");
    } finally {
      setSaving(false);
    }
  };

  const runSummary = async (mode: "download" | "print" | "share") => {
    if (!notes.length) {
      toast.message("Add a few notes first");
      return;
    }
    setSummaryBusy(true);
    try {
      const blob = buildHouseholdNotesPdf(notes, { householdName, noteTypes });
      const filename = `${householdName.replace(/[^\w\- ]+/g, "").trim() || "household"}-notes.pdf`;
      if (mode === "print") {
        printNotesPdf(blob);
        toast.success("Opening print preview");
      } else if (mode === "share") {
        const result = await shareOrDownloadNotesPdf(blob, filename, { householdName });
        toast.success(result === "shared" ? "Ready to send" : "PDF downloaded — attach it to the email");
      } else {
        downloadBlob(blob, filename);
        toast.success("PDF downloaded");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not build the PDF");
    } finally {
      setSummaryBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" className="rounded-full bg-gradient-primary" onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> New note
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            disabled={summaryBusy || !notes.length}
            onClick={() => void runSummary("download")}
          >
            {summaryBusy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <FileDown className="mr-1 h-3.5 w-3.5" />}
            Summary PDF
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full"
            disabled={summaryBusy || !notes.length}
            onClick={() => void runSummary("print")}
            title="Print summary"
          >
            <Printer className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full"
            disabled={summaryBusy || !notes.length}
            onClick={() => void runSummary("share")}
            title="Email or share summary"
          >
            <Mail className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        className="rounded-2xl border border-border/40 p-2 shadow-card"
        style={{ background: `color-mix(in srgb, ${ACCENT} 12%, hsl(var(--card)))` }}
      >
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: "all", label: "All" },
            ...noteTypes.map((t) => ({ id: t, label: t })),
            { id: "untyped", label: "Untyped" },
          ].map((chip) => {
            const active = filter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setFilter(chip.id)}
                className={`rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? "border-primary/40 bg-gradient-primary text-primary-foreground shadow-sm"
                    : "border-border/50 bg-card text-foreground hover:bg-card/80"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 px-1 text-[11px] text-muted-foreground">
          Tag types are managed in Household Settings.
        </p>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading notes…
        </p>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-2xl border border-border/40 p-8 text-center shadow-card"
          style={{ background: `color-mix(in srgb, ${ACCENT} 10%, hsl(var(--card)))`, borderLeftWidth: 4, borderLeftColor: ACCENT }}
        >
          <StickyNote className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-3 font-display text-lg font-bold">
            {notes.length === 0 ? "No household notes yet" : "Nothing in this type"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {notes.length === 0
              ? "Capture boiler codes, bin days, neighbour names — anything a future owner might need."
              : "Try another tag, or add a note with this type."}
          </p>
          {notes.length === 0 && (
            <Button className="mt-4 rounded-full bg-gradient-primary" onClick={openNew}>
              <Plus className="mr-1 h-4 w-4" /> Write first note
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((note) => (
            <button
              key={note.id}
              type="button"
              onClick={() => openEdit(note)}
              className="group rounded-2xl border border-border/40 bg-card p-4 text-left shadow-card transition-shadow hover:shadow-elevated"
              style={{ borderLeftWidth: 4, borderLeftColor: ACCENT }}
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {note.pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-primary" />}
                    <p className="truncate font-semibold">{note.title || "Untitled note"}</p>
                  </div>
                  <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{previewText(note.body)}</p>
                </div>
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-muted-foreground opacity-70 transition-colors hover:bg-destructive/10 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(note);
                  }}
                  aria-label="Delete note"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                {note.noteType ? (
                  <span
                    className="truncate rounded-lg border border-border/50 px-2 py-0.5 text-[11px] font-semibold"
                    style={{ background: `color-mix(in srgb, ${ACCENT} 14%, hsl(var(--card)))` }}
                  >
                    {note.noteType}
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">Untyped</span>
                )}
                <span className="shrink-0 text-[11px] text-muted-foreground">{formatUpdated(note)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <Sheet open={editorOpen} onOpenChange={(o) => !o && setEditorOpen(false)}>
        <SheetContent side="bottom" className="safe-bottom max-h-[92dvh] overflow-y-auto rounded-t-2xl">
          <SheetHeader className="pb-2">
            <SheetTitle>{editing ? "Edit note" : "New note"}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 pb-6 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="hh-note-title">Title</Label>
              <Input
                id="hh-note-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Bin day & recycling"
                className="rounded-xl"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={noteType || "__none__"} onValueChange={(v) => setNoteType(v === "__none__" ? "" : v)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Choose a type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No type</SelectItem>
                  {noteTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hh-note-body">Note</Label>
              <Textarea
                id="hh-note-body"
                rows={10}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write anything useful for the household…"
                className="rounded-xl"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
              Pin to top
            </label>
            <div className="flex gap-2">
              <Button className="flex-1 rounded-xl bg-gradient-primary" disabled={saving} onClick={() => void save()}>
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
              <Button variant="outline" className="rounded-xl" onClick={() => setEditorOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.title || "Untitled note"}” will be removed for everyone in this household.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteTarget?.id) return;
                try {
                  await deleteNote(deleteTarget.id);
                  toast.success("Note deleted");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not delete");
                } finally {
                  setDeleteTarget(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
