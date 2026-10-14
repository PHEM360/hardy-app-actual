import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameDay, isToday, isSameMonth, parseISO, isBefore, addDays, startOfDay,
} from "date-fns";
import {
  StickyNote, Plus, Search, LayoutGrid, List, Columns2, CalendarDays, ListChecks,
  Shield, Settings2, FolderPlus, Download, Smartphone, Pin, SlidersHorizontal, X,
  CheckSquare, PenLine, GitBranch,
} from "lucide-react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useSharedScope } from "@/hooks/useSharedScope";
import { useNotes } from "@/hooks/useNotes";
import { useNoteVault } from "@/hooks/useNoteVault";
import { useCalendar } from "@/hooks/useCalendar";
import { useTasks } from "@/hooks/useTasks";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import { NoteEditor } from "@/components/notes/NoteEditor";
import { ShareNoteDialog } from "@/components/notes/ShareNoteDialog";
import { VaultGate } from "@/components/notes/VaultGate";
import { NoteCard, noteDueTone } from "@/components/notes/NoteCard";
import { NoteStartDialog } from "@/components/notes/NoteStartDialog";
import { NoteCategorySettings } from "@/components/notes/NoteCategorySettings";
import { noteHasDiagram } from "@/lib/noteDiagram";
import { noteHasChecklist, noteChecklistItems, patchNoteChecklist } from "@/lib/noteChecklist";
import type { HubNote, NoteDiagram, NoteFolder, NoteKind, NotesColorMode, NotesListStyle, NotesView } from "@/types/notes";
import { noteCategoryOptions } from "@/types/notes";
import { buildIcsCalendar, downloadIcs } from "@/lib/noteCalendar";
import { COLOR_MODE_OPTIONS, LIST_STYLE_OPTIONS, noteAccent, noteCardStyle, noteSwatch } from "@/lib/noteStyle";
import { JEWEL, JEWEL_CYCLE, jewelGradient } from "@/lib/brandPalette";
import { toast } from "sonner";

type FilterId = "all" | "pinned" | "tasks" | "drawings" | "diagrams" | "inbox" | "secure" | "shared" | "archived" | `folder:${string}` | `category:${string}`;

const BOARD_TONES = [JEWEL.bronze, JEWEL.oxblood, JEWEL.forest, JEWEL.cobalt, JEWEL.aubergine];

function listTitle(note: HubNote) {
  if (note.locked) return "Locked note";
  const firstLine = (note.body || "").trim().split("\n")[0] || "";
  return note.title.trim() || (firstLine.length <= 60 ? firstLine : "") || "Untitled";
}

function previewText(note: HubNote) {
  if (note.locked) return "Unlock to read";
  if (note.kind === "drawing") return "Sketch";
  if (noteHasDiagram(note)) return "Diagram";
  const items = noteChecklistItems(note).filter((i) => i.text.trim());
  if (items.length) {
    const done = items.filter((i) => i.done).length;
    return `${done} of ${items.length} ticked`;
  }
  const body = (note.body || "").trim();
  const title = listTitle(note);
  const rest = body.startsWith(title) ? body.slice(title.length).trim() : body;
  return rest.slice(0, 140) || (noteHasChecklist(note) ? "Empty list" : "No more text");
}

const START_TILES: { label: string; kind: NoteKind; icon: typeof StickyNote; tone: string; diagram?: boolean }[] = [
  { label: "Note", kind: "note", icon: StickyNote, tone: JEWEL.petrol },
  { label: "List", kind: "checklist", icon: CheckSquare, tone: JEWEL.forest },
  { label: "Sketch", kind: "drawing", icon: PenLine, tone: JEWEL.burgundy },
  { label: "Diagram", kind: "note", icon: GitBranch, tone: JEWEL.aubergine, diagram: true },
];

const VIEWS: { id: NotesView; label: string; icon: typeof LayoutGrid }[] = [
  { id: "grid", label: "Cards", icon: LayoutGrid },
  { id: "list", label: "List", icon: List },
  { id: "board", label: "Board", icon: Columns2 },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "agenda", label: "Dated", icon: ListChecks },
];

/** Sample data for the signed out /dev/notes-preview route. Nothing is saved. */
export type NotesPreview = { notes: HubNote[]; folders: NoteFolder[] };

export default function Notes({ preview }: { preview?: NotesPreview } = {}) {
  const [params, setParams] = useSearchParams();
  const { scopeUserId, pageTitle, isOwnScope, permission } = useSharedScope("notes");
  const liveNotesApi = useNotes(scopeUserId ?? undefined);
  const [previewNotes, setPreviewNotes] = useState<HubNote[]>(preview?.notes ?? []);
  const notesApi = useMemo(() => {
    if (!preview) return liveNotesApi;
    return {
      ...liveNotesApi,
      notes: previewNotes,
      folders: preview.folders,
      loading: false,
      canEdit: true,
      uid: "preview",
      updateNote: async (note: HubNote, patch: Partial<HubNote>) => {
        setPreviewNotes((list) => list.map((n) => (n.id === note.id ? { ...n, ...patch } : n)));
      },
      addNote: async (patch: Partial<HubNote> & { vault?: boolean }) => {
        const id = patch.id || crypto.randomUUID();
        const blank: HubNote = {
          id, ownerId: "preview", folderId: null, kind: "note", title: "", body: "", color: "default", category: "personal",
          pinned: false, archived: false, tags: [], checklist: [], locked: false, vault: false, sharedWith: [],
        };
        setPreviewNotes((list) => [...list, { ...blank, ...patch, id, vault: false }]);
        return id;
      },
      deleteNote: async (note: HubNote) => {
        setPreviewNotes((list) => list.filter((n) => n.id !== note.id));
      },
      savePrefs: async () => {},
    } as typeof liveNotesApi;
  }, [liveNotesApi, preview, previewNotes]);
  const vault = useNoteVault();
  const { events, addEvent, updateEvent } = useCalendar(scopeUserId ?? undefined);
  const { tasks } = useTasks(scopeUserId ?? undefined);
  const { pinNotesFirst, unpinNotes } = useDashboardLayout();
  const canEdit = preview ? true : permission === "edit" && notesApi.canEdit;

  const [filter, setFilter] = useState<FilterId>("all");
  const [view, setView] = useState<NotesView>(notesApi.prefs.defaultView);
  const [query, setQuery] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [active, setActive] = useState<HubNote | null>(null);
  const [creatingKind, setCreatingKind] = useState<NoteKind>("note");
  const [creatingId, setCreatingId] = useState(() => crypto.randomUUID());
  const [creatingDiagram, setCreatingDiagram] = useState<NoteDiagram | null>(null);
  const [creatingTitle, setCreatingTitle] = useState("");
  const [startOpen, setStartOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<{ type: "note" | "folder"; note?: HubNote; folder?: NoteFolder } | null>(null);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newFolder, setNewFolder] = useState("");
  const [calMonth, setCalMonth] = useState(new Date());
  const [quick, setQuick] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [startAt, setStartAt] = useState<"kind" | "diagram">("kind");
  const colorMode = notesApi.prefs.colorMode ?? "note";
  const listStyle = notesApi.prefs.listStyle ?? "keep";
  const shadeHue = notesApi.prefs.shadeHue ?? "#f59e0b";

  useEffect(() => {
    setView(notesApi.prefs.defaultView);
  }, [notesApi.prefs.defaultView]);

  useEffect(() => {
    if (!vault.unlocked) {
      notesApi.unsubscribeVault();
      return;
    }
    return notesApi.subscribeVault();
  }, [vault.unlocked, notesApi.subscribeVault, notesApi.unsubscribeVault]);

  useEffect(() => {
    if (params.get("new") === "1" || params.get("new") === "note") {
      setCreatingKind("note");
      setCreatingDiagram(null);
      setCreatingId(crypto.randomUUID());
      setActive(null);
      setEditorOpen(true);
      const next = new URLSearchParams(params);
      next.delete("new");
      setParams(next, { replace: true });
    }
    if (params.get("new") === "checklist") {
      setCreatingKind("checklist");
      setCreatingDiagram(null);
      setCreatingId(crypto.randomUUID());
      setActive(null);
      setEditorOpen(true);
      const next = new URLSearchParams(params);
      next.delete("new");
      setParams(next, { replace: true });
    }
    if (params.get("new") === "diagram") {
      setCreatingKind("note");
      setCreatingDiagram(null);
      setCreatingId(crypto.randomUUID());
      setActive(null);
      setStartAt("diagram");
      setStartOpen(true);
      const next = new URLSearchParams(params);
      next.delete("new");
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  useEffect(() => {
    const noteId = params.get("note");
    if (!noteId || notesApi.loading) return;
    const found =
      notesApi.notes.find((n) => n.id === noteId) ??
      notesApi.sharedNotes.find((n) => n.id === noteId);
    if (found) {
      setCreatingKind(found.kind);
      setActive(found);
      setEditorOpen(true);
    }
    const next = new URLSearchParams(params);
    next.delete("note");
    setParams(next, { replace: true });
  }, [params, setParams, notesApi.loading, notesApi.notes, notesApi.sharedNotes]);

  const openSecure = () => {
    setFilter("secure");
    if (!vault.unlocked) setVaultOpen(true);
  };

  const visibleNotes = useMemo(() => {
    let list: HubNote[] = [];
    if (filter === "secure") list = vault.unlocked ? notesApi.vaultNotes : [];
    else if (filter === "shared") list = notesApi.sharedNotes;
    else list = notesApi.notes;

    list = list.filter((n) => {
      if (filter === "archived") return n.archived;
      if (n.archived && filter !== "archived") return false;
      if (filter === "pinned") return n.pinned;
      if (filter === "tasks") return noteHasChecklist(n);
      if (filter === "drawings") return n.kind === "drawing";
      if (filter === "diagrams") return noteHasDiagram(n);
      if (filter === "inbox") return !n.folderId;
      if (filter.startsWith("folder:")) return n.folderId === filter.slice(7);
      if (filter.startsWith("category:")) return n.category === filter.slice(9);
      return true;
    });

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((n) =>
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        n.checklist.some((i) => i.text.toLowerCase().includes(q)) ||
        n.canvas?.blocks.some((block) =>
          (block.type === "text" && block.text.toLowerCase().includes(q)) ||
          (block.type === "shape" && block.label.toLowerCase().includes(q)) ||
          (block.type === "location" && block.label.toLowerCase().includes(q)) ||
          (block.type === "checklist" && block.items.some((item) => item.text.toLowerCase().includes(q))) ||
          (block.type === "diagram" && block.diagram?.nodes.some((node) => node.label.toLowerCase().includes(q)))
        )
      );
    }

    return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || (a.title || "").localeCompare(b.title || ""));
  }, [filter, notesApi.notes, notesApi.vaultNotes, notesApi.sharedNotes, vault.unlocked, query]);

  const openNote = (note: HubNote | null, kind: NoteKind = "note", diagram: NoteDiagram | null = null, title = "") => {
    setCreatingKind(kind);
    setCreatingDiagram(note ? null : diagram);
    setCreatingTitle(note ? "" : title);
    if (!note) setCreatingId(crypto.randomUUID());
    setActive(note);
    setEditorOpen(true);
  };

  const saveNote = async (
    patch: Partial<HubNote>,
    options?: { encryptWith?: string; decrypt?: boolean; showOnDashboard?: boolean },
  ) => {
    let noteId = active?.id;
    if (active) {
      await notesApi.updateNote(active, patch);
      if (patch.addToCalendar && (patch.dueDate || active.dueDate)) {
        await syncCalendar({ ...active, ...patch } as HubNote);
      }
    } else {
      noteId = await notesApi.addNote({
        ...patch,
        id: creatingId,
        kind: patch.kind ?? creatingKind,
        vault: filter === "secure",
      });
      if (patch.addToCalendar && patch.dueDate) {
        await syncCalendar({ id: noteId, ownerId: notesApi.uid || "", ...patch } as HubNote);
      }
    }
    if (typeof options?.showOnDashboard === "boolean" && noteId && isOwnScope) {
      await syncDashboardNote(noteId, options.showOnDashboard);
    }
  };

  const syncDashboardNote = async (noteId: string, on: boolean) => {
    const current = notesApi.prefs.dashboardNoteId;
    if (on) {
      if (current !== noteId) await notesApi.savePrefs({ dashboardNoteId: noteId });
      pinNotesFirst();
      return;
    }
    if (current === noteId) {
      await notesApi.savePrefs({ dashboardNoteId: null });
      unpinNotes();
    }
  };

  const clearDashboardNote = async (noteId: string) => {
    if (notesApi.prefs.dashboardNoteId !== noteId) return;
    await notesApi.savePrefs({ dashboardNoteId: null });
    unpinNotes();
  };

  const syncCalendar = async (note: HubNote) => {
    if (!note.dueDate) return;
    const payload = {
      title: note.title || "Note",
      description: note.body || "From Notes",
      category: "personal" as const,
      startDate: `${note.dueDate}T09:00:00`,
      endDate: `${note.dueDate}T10:00:00`,
      allDay: true,
    };
    if (note.calendarEventId) {
      await updateEvent(note.calendarEventId, payload);
    } else {
      const eventId = await addEvent(payload);
      if (eventId && note.id) {
        await notesApi.updateNote(note, { calendarEventId: eventId, addToCalendar: true, dueDate: note.dueDate });
      }
    }
  };

  const boardColumns = useMemo(() => {
    const today = startOfDay(new Date());
    const weekEnd = addDays(today, 7);
    const cols = [
      { id: "inbox", title: "No date", notes: [] as HubNote[] },
      { id: "overdue", title: "Overdue", notes: [] as HubNote[] },
      { id: "week", title: "This week", notes: [] as HubNote[] },
      { id: "later", title: "Later", notes: [] as HubNote[] },
      { id: "done", title: "Done", notes: [] as HubNote[] },
    ];
    for (const n of visibleNotes) {
      const done = n.kind !== "note" && n.checklist.length > 0 && n.checklist.every((i) => i.done);
      if (done) cols[4].notes.push(n);
      else if (!n.dueDate) cols[0].notes.push(n);
      else {
        const due = startOfDay(parseISO(n.dueDate.length === 10 ? `${n.dueDate}T12:00:00` : n.dueDate));
        if (isBefore(due, today)) cols[1].notes.push(n);
        else if (due <= weekEnd) cols[2].notes.push(n);
        else cols[3].notes.push(n);
      }
    }
    return cols;
  }, [visibleNotes]);

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(calMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(calMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [calMonth]);

  const itemsForDay = (day: Date) => {
    const notes = visibleNotes.filter((n) => n.dueDate && isSameDay(parseISO(n.dueDate.length === 10 ? `${n.dueDate}T12:00:00` : n.dueDate), day));
    const hubEvents = notesApi.prefs.showCalendarEvents
      ? events.filter((e) => isSameDay(new Date(e.startDate), day))
      : [];
    const taskItems = notesApi.prefs.showTasksPageItems
      ? tasks.filter((t) => t.dueDate && t.status !== "done" && isSameDay(parseISO(t.dueDate), day))
      : [];
    return { notes, hubEvents, taskItems };
  };

  const exportIcs = () => {
    const dated = notesApi.notes.filter((n) => n.dueDate);
    downloadIcs(
      "hardy-hub-notes.ics",
      buildIcsCalendar(dated.map((n) => ({ title: n.title || "Note", date: n.dueDate!, description: n.body, id: n.id })))
    );
    toast.success("Calendar file downloaded — import it in Google Calendar or Apple Calendar");
  };

  const accentFor = (n: HubNote, i: number, total = visibleNotes.length) =>
    noteAccent(noteSwatch(n, i, total, colorMode, notesApi.folders, shadeHue), i);
  const styleFor = (n: HubNote, i: number, total = visibleNotes.length) =>
    noteCardStyle(noteSwatch(n, i, total, colorMode, notesApi.folders, shadeHue), listStyle, i);

  const liveNotes = notesApi.notes.filter((n) => !n.archived);
  const primaryFilters: { id: FilterId; label: string; count: number | null; icon?: typeof Pin }[] = [
    { id: "all", label: "All", count: liveNotes.length },
    { id: "tasks", label: "Lists", count: liveNotes.filter((n) => noteHasChecklist(n)).length },
    { id: "pinned", label: "Pinned", count: liveNotes.filter((n) => n.pinned).length },
    { id: "secure", label: "Secure", count: null, icon: Shield },
  ];
  const moreFilterGroups: { title: string; items: { id: FilterId; label: string }[] }[] = [
    {
      title: "Type",
      items: [
        { id: "diagrams", label: "Diagrams" },
        { id: "drawings", label: "Sketches" },
      ],
    },
    {
      title: "Kept in",
      items: [
        { id: "inbox", label: "No folder" },
        { id: "shared", label: "Shared with me" },
        { id: "archived", label: "Archive" },
        ...notesApi.folders.map((folder) => ({ id: `folder:${folder.id}` as FilterId, label: folder.emoji ? `${folder.emoji} ${folder.name}` : folder.name })),
      ],
    },
    {
      title: "Category",
      items: noteCategoryOptions(notesApi.prefs).map((category) => ({ id: `category:${category.id}` as FilterId, label: category.label })),
    },
  ];
  const extraFilter = moreFilterGroups.flatMap((group) => group.items).find((item) => item.id === filter);
  const showSections = view === "grid" && filter === "all" && !query.trim();
  const pinnedNotes = showSections ? visibleNotes.filter((n) => n.pinned) : [];
  const otherNotes = showSections ? visibleNotes.filter((n) => !n.pinned) : visibleNotes;

  const quickAdd = async () => {
    const text = quick.trim();
    if (!text || !canEdit) return;
    const id = crypto.randomUUID();
    const lines = text.split("\n");
    await notesApi.addNote({
      id,
      kind: "note",
      title: lines[0].slice(0, 80),
      body: text,
      canvas: {
        version: 1,
        height: 560,
        blocks: [{ id: `paper-text-${id}`, type: "text", x: 24, y: 28, width: 320, height: Math.max(56, lines.length * 28 + 28), text, textStyle: "body", boxed: false }],
      },
      vault: filter === "secure",
    });
    setQuick("");
    toast.success("Note saved");
  };

  const renderCards = (list: HubNote[]) => (
    <div className={listStyle === "compact" ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" : "notes-masonry"}>
      {list.map((n) => {
        const i = visibleNotes.indexOf(n);
        return (
          <NoteCard
            key={`${n.ownerId}-${n.id}`}
            note={n}
            index={i}
            listStyle={listStyle}
            style={styleFor(n, i)}
            accent={accentFor(n, i)}
            canEdit={canEdit && !n.locked}
            featured={notesApi.prefs.dashboardNoteId === n.id}
            prefs={notesApi.prefs}
            onOpen={() => openNote(n)}
            onToggleItem={(itemId, done) => {
              notesApi.updateNote(n, patchNoteChecklist(n, itemId, done));
            }}
          />
        );
      })}
    </div>
  );

  const lockedSecure = filter === "secure" && !vault.unlocked;

  useEffect(() => {
    const nextFilter = params.get("filter");
    if (nextFilter === "pinned") setFilter("pinned");
    if (params.get("new") === "1" && canEdit) setStartOpen(true);
    if (!nextFilter && params.get("new") !== "1") return;
    const next = new URLSearchParams(params);
    next.delete("filter");
    next.delete("new");
    setParams(next, { replace: true });
  }, [params, setParams, canEdit]);

  return (
    <FeaturePageShell
      title={pageTitle}
      subtitle="Lists, sketches and the things worth keeping"
      icon={<StickyNote className="w-5 h-5" />}
      sharePage="notes"
      action={
        <Button size="sm" variant="outline" className="h-10" onClick={() => setSettingsOpen(true)}>
          <Settings2 /> Settings
        </Button>
      }
    >
      <div className="space-y-4" style={{ "--sec": JEWEL.petrol } as CSSProperties}>
        {canEdit && (
          <section className="overflow-hidden rounded-xl border border-foreground/20 bg-card shadow-card">
            <form
              className="flex items-center gap-2 p-2"
              onSubmit={(event) => {
                event.preventDefault();
                void quickAdd();
              }}
            >
              <Input
                value={quick}
                onChange={(event) => setQuick(event.target.value)}
                placeholder="Jot something down"
                aria-label="Quick note"
                className="h-11 flex-1 border-0 bg-transparent text-base shadow-none focus-visible:ring-0"
              />
              <Button type="submit" className="h-11" disabled={!quick.trim()}>
                <Plus /> Save
              </Button>
            </form>
            <div className="grid grid-cols-4 gap-2 border-t border-foreground/15 bg-background p-2">
              {START_TILES.map((tile) => (
                <button
                  key={tile.label}
                  type="button"
                  onClick={() => {
                    if (tile.diagram) {
                      setStartAt("diagram");
                      setStartOpen(true);
                    } else {
                      openNote(null, tile.kind);
                    }
                  }}
                  className="btn-edge flex min-h-[4.25rem] flex-col items-center justify-center gap-1.5 rounded-lg px-1 text-white"
                  style={{ background: jewelGradient(tile.tone) }}
                >
                  <tile.icon className="h-5 w-5" />
                  <span className="text-xs font-bold">{tile.label}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/60" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes" aria-label="Search notes" className="h-11 border border-foreground/30 bg-card pl-10 pr-10 text-base" />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-foreground/70">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-5 gap-2">
            {primaryFilters.map((item) => {
              const on = filter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => (item.id === "secure" ? openSecure() : setFilter(item.id))}
                  className={`flex min-h-[3.5rem] flex-col items-center justify-center rounded-lg border px-1 transition-colors duration-150 ${
                    on ? "btn-edge border-[var(--sec)] bg-[var(--sec)] text-white" : "border-foreground/20 bg-card text-foreground"
                  }`}
                >
                  {item.icon ? <item.icon className="h-5 w-5" /> : <span className="font-display text-lg font-semibold leading-none tabular-nums">{item.count}</span>}
                  <span className={`mt-1 text-[10px] font-bold uppercase tracking-[0.12em] ${on ? "text-white/85" : "text-foreground/70"}`}>{item.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((value) => !value)}
              className={`flex min-h-[3.5rem] flex-col items-center justify-center rounded-lg border px-1 transition-colors duration-150 ${
                moreOpen || extraFilter ? "btn-edge border-[#4A2A52] bg-[#4A2A52] text-white" : "border-foreground/20 bg-card text-foreground"
              }`}
            >
              <SlidersHorizontal className="h-5 w-5" />
              <span className={`mt-1 text-[10px] font-bold uppercase tracking-[0.12em] ${moreOpen || extraFilter ? "text-white/85" : "text-foreground/70"}`}>Filter</span>
            </button>
          </div>

          {extraFilter && !moreOpen && (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-[#4A2A52] py-1 pl-3 pr-1 text-white">
              <p className="min-w-0 truncate text-sm font-semibold">Showing {extraFilter.label}</p>
              <button type="button" onClick={() => setFilter("all")} className="flex h-10 shrink-0 items-center gap-1 rounded-md bg-white/15 px-3 text-xs font-bold">
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            </div>
          )}

          <AnimatePresence initial={false}>
            {moreOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 rounded-xl border border-foreground/20 bg-card p-3 shadow-card" style={{ "--sec": JEWEL.aubergine } as CSSProperties}>
                  {moreFilterGroups.filter((group) => group.items.length > 0).map((group) => (
                    <div key={group.title}>
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/70">{group.title}</p>
                      <div className="flex flex-wrap gap-2">
                        {group.items.map((item) => {
                          const on = filter === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              aria-pressed={on}
                              onClick={() => {
                                setFilter(on ? "all" : item.id);
                                setMoreOpen(false);
                              }}
                              className={`min-h-10 rounded-md border px-3 text-xs font-bold transition-colors duration-150 ${
                                on ? "btn-edge border-[var(--sec)] bg-[var(--sec)] text-white" : "border-foreground/20 bg-background text-foreground"
                              }`}
                            >
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-end justify-between gap-3 border-b border-foreground/20 pb-2">
          <p className="font-display text-xl font-semibold leading-none">
            {lockedSecure ? "Secure notes" : `${visibleNotes.length} ${visibleNotes.length === 1 ? "note" : "notes"}`}
          </p>
          <div className="flex gap-1 rounded-lg border border-foreground/20 bg-card p-1" role="group" aria-label="Layout">
            {VIEWS.map((item) => {
              const on = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={on}
                  aria-label={`${item.label} layout`}
                  title={item.label}
                  onClick={() => { setView(item.id); notesApi.savePrefs({ defaultView: item.id }); }}
                  className={`flex h-10 items-center justify-center gap-1.5 rounded-md text-xs font-bold transition-colors duration-150 ${
                    on ? "btn-edge bg-[var(--sec)] px-2.5 text-white" : "w-10 text-foreground/75"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {on && item.label}
                </button>
              );
            })}
          </div>
        </div>

      {lockedSecure && (
        <div className="overflow-hidden rounded-xl border border-foreground/20 bg-card shadow-card">
          <div className="band px-4 py-3 text-white" style={{ background: jewelGradient(JEWEL.ink) }}>
            <p className="font-display text-lg font-semibold">Secure notes are locked</p>
          </div>
          <div className="p-5">
            <p className="text-sm text-foreground/80">Unlock with Face ID or your passcode to see this folder.</p>
            <Button className="mt-4" onClick={() => setVaultOpen(true)}><Shield /> Unlock</Button>
          </div>
        </div>
      )}

      {!lockedSecure && visibleNotes.length === 0 && view !== "calendar" && (
        <div className="overflow-hidden rounded-xl border border-foreground/20 bg-card shadow-card">
          <div className="band px-4 py-3 text-white" style={{ background: jewelGradient(JEWEL.petrol) }}>
            <p className="font-display text-lg font-semibold">
              {query.trim() ? "Nothing matches that search" : filter === "diagrams" ? "No diagrams yet" : filter === "tasks" ? "No lists yet" : "Nothing here yet"}
            </p>
          </div>
          <div className="p-5">
            <p className="text-sm text-foreground/80">
              {query.trim()
                ? "Try a shorter word, or clear the search to see everything."
                : filter === "diagrams"
                  ? "Start from a home network, a flowchart, or a blank board."
                  : "Write a note, tick a list, sketch, or drop in a diagram."}
            </p>
            {query.trim() ? (
              <Button className="mt-4" variant="outline" onClick={() => setQuery("")}><X /> Clear search</Button>
            ) : canEdit ? (
              <Button className="mt-4" onClick={() => { setStartAt("kind"); setStartOpen(true); }}>
                <Plus /> New note
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {view === "grid" && !lockedSecure && visibleNotes.length > 0 && (
        <div className="space-y-4">
          {pinnedNotes.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/70">
                <Pin className="h-3.5 w-3.5 fill-current text-[#C6A15B]" /> Pinned
              </p>
              {renderCards(pinnedNotes)}
            </div>
          )}
          {otherNotes.length > 0 && (
            <div>
              {pinnedNotes.length > 0 && (
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/70">Everything else</p>
              )}
              {renderCards(otherNotes)}
            </div>
          )}
        </div>
      )}

          {view === "list" && !lockedSecure && (
            <div className="space-y-2">
              {visibleNotes.map((n, i) => {
                const items = noteChecklistItems(n).filter((item) => item.text.trim());
                const due = n.dueDate ? noteDueTone(n.dueDate, items.length > 0 && items.every((item) => item.done)) : null;
                return (
                  <button
                    key={`${n.ownerId}-${n.id}`}
                    type="button"
                    onClick={() => openNote(n)}
                    className="flex min-h-14 w-full items-stretch overflow-hidden rounded-xl border border-foreground/20 bg-card text-left shadow-card transition-transform duration-150 active:translate-y-px"
                  >
                    <span className="w-1.5 shrink-0" style={{ background: accentFor(n, i) }} />
                    <div className="min-w-0 flex-1 px-3 py-2.5">
                      <p className="flex items-center gap-1.5 font-display font-semibold">
                        {n.pinned && <Pin className="h-3.5 w-3.5 shrink-0 fill-current text-[#C6A15B]" aria-label="Pinned" />}
                        <span className="truncate">{listTitle(n)}</span>
                      </p>
                      <p className="truncate text-sm text-foreground/75">{previewText(n)}</p>
                    </div>
                    {due && (
                      <span className="mr-3 shrink-0 self-center rounded-md px-2 py-1 text-[11px] font-bold" style={{ background: due.background, color: due.color }}>
                        {format(parseISO(`${n.dueDate!.slice(0, 10)}T12:00:00`), "d MMM")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {view === "board" && !lockedSecure && visibleNotes.length > 0 && (
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {boardColumns.map((col, ci) => (
                <div
                  key={col.id}
                  className="min-w-0 overflow-hidden rounded-xl border border-foreground/20 bg-card shadow-card"
                >
                  <div className="band px-3 py-2 text-white" style={{ background: jewelGradient(BOARD_TONES[ci]) }}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em]">
                      {col.title} · {col.notes.length}
                    </p>
                  </div>
                  <div className="space-y-2 p-2.5">
                    {col.notes.map((n, i) => (
                      <NoteCard
                        key={n.id}
                        note={n}
                        index={i}
                        listStyle={listStyle}
                        style={styleFor(n, i, col.notes.length)}
                        accent={accentFor(n, i, col.notes.length)}
                        canEdit={canEdit && !n.locked}
                        featured={notesApi.prefs.dashboardNoteId === n.id}
                        prefs={notesApi.prefs}
                        onOpen={() => openNote(n)}
                        onToggleItem={(itemId, done) => {
                          notesApi.updateNote(n, patchNoteChecklist(n, itemId, done));
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {view === "calendar" && !lockedSecure && (
            <div className="min-w-0 overflow-hidden rounded-xl border border-foreground/20 bg-card shadow-card">
              <div className="band flex items-center justify-between px-3 py-2 text-white" style={{ background: jewelGradient(JEWEL.cobalt) }}>
                <button type="button" className="rounded-md bg-white/15 px-2.5 py-1.5 text-xs font-semibold" onClick={() => setCalMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>Prev</button>
                <p className="font-display text-lg font-semibold">{format(calMonth, "MMMM yyyy")}</p>
                <button type="button" className="rounded-md bg-white/15 px-2.5 py-1.5 text-xs font-semibold" onClick={() => setCalMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>Next</button>
              </div>
              <div className="p-3">
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/70">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d}>{d}</div>)}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1.5">
                {monthDays.map((day) => {
                  const items = itemsForDay(day);
                  const count = items.notes.length + items.hubEvents.length + items.taskItems.length;
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => {
                        if (canEdit) {
                          setActive(null);
                          setCreatingKind("note");
                          setCreatingId(crypto.randomUUID());
                          setEditorOpen(true);
                        }
                      }}
                      className={`min-h-[52px] min-w-0 overflow-hidden rounded-lg border p-1 text-left sm:min-h-[72px] ${
                        isSameMonth(day, calMonth) ? "border-foreground/15 bg-card" : "border-transparent opacity-40"
                      } ${isToday(day) ? "border-[#C6A15B] bg-[#17475C] text-white" : ""}`}
                    >
                      <span className="text-[11px] font-bold">{format(day, "d")}</span>
                      {count > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {items.notes.slice(0, 2).map((n) => (
                            <div key={n.id} className="truncate rounded-md bg-[#6E1F2F] px-1 text-[9px] font-semibold text-white" onClick={(e) => { e.stopPropagation(); openNote(n); }}>{n.title || "Note"}</div>
                          ))}
                          {items.hubEvents.slice(0, 1).map((e) => (
                            <div key={e.id} className="truncate rounded-md bg-[#1C4A6E] px-1 text-[9px] font-semibold text-white">{e.title}</div>
                          ))}
                          {items.taskItems.slice(0, 1).map((t) => (
                            <div key={t.id} className="truncate rounded-md bg-[#3A2A5E] px-1 text-[9px] font-semibold text-white">{t.title}</div>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              </div>
            </div>
          )}

          {view === "agenda" && !lockedSecure && (
            <div className="space-y-2">
              {visibleNotes.filter((n) => n.dueDate).sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || "")).map((n, i) => (
                <button key={n.id} type="button" onClick={() => openNote(n)} className="flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-xl border border-foreground/20 bg-card text-left shadow-card">
                  <span className="flex h-full min-h-12 w-16 items-center justify-center text-xs font-bold text-white" style={{ background: jewelGradient(JEWEL_CYCLE[i % JEWEL_CYCLE.length]) }}>
                    {format(parseISO(`${n.dueDate!.slice(0, 10)}T12:00:00`), "d MMM")}
                  </span>
                  <span className="min-w-0 truncate py-3 pr-3 font-display font-semibold">{n.title || "Untitled"}</span>
                </button>
              ))}
              {notesApi.prefs.showTasksPageItems && tasks.filter((t) => t.dueDate && t.status !== "done").map((t) => (
                <div key={t.id} className="flex items-center gap-3 overflow-hidden rounded-xl border border-foreground/20 bg-card text-sm shadow-card">
                  <span className="flex min-h-12 w-16 items-center justify-center text-xs font-bold text-white" style={{ background: jewelGradient(JEWEL.indigo) }}>
                    {t.dueDate ? format(parseISO(t.dueDate), "d MMM") : ""}
                  </span>
                  <span className="py-3 pr-3">Task · {t.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      <NoteEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        note={active}
        folders={notesApi.folders}
        canEdit={canEdit}
        isOwn={isOwnScope}
        defaultKind={creatingKind}
        initialDiagram={creatingDiagram}
        initialTitle={creatingTitle}
        ownerId={active?.ownerId || notesApi.uid || ""}
        noteId={active?.id || creatingId}
        prefs={notesApi.prefs}
        showOnDashboard={!!active && notesApi.prefs.dashboardNoteId === active.id}
        onSave={saveNote}
        onDelete={async () => {
          if (active) {
            await clearDashboardNote(active.id);
            await notesApi.deleteNote(active);
          }
          setEditorOpen(false);
        }}
        onShare={() => active && setShareTarget({ type: "note", note: active })}
        onMoveVault={async () => {
          if (!active) return;
          if (!vault.unlocked) {
            setVaultOpen(true);
            toast.message("Unlock Secure Notes first, then move this note");
            return;
          }
          await clearDashboardNote(active.id);
          await notesApi.moveNoteToVault(active);
          setEditorOpen(false);
          toast.success("Moved to Secure Notes");
        }}
        onLeaveVault={async () => {
          if (active) await notesApi.moveNoteFromVault(active);
          setEditorOpen(false);
        }}
        onAddToHubCalendar={async () => {
          if (active) await syncCalendar(active);
          else toast.message("Save the note first, then add it to the calendar");
        }}
      />

      <NoteStartDialog
        open={startOpen}
        onOpenChange={setStartOpen}
        startAt={startAt}
        onPick={(choice) => openNote(null, choice.kind, choice.diagram ?? null, choice.title ?? "")}
      />

      <ShareNoteDialog
        open={!!shareTarget}
        onOpenChange={(o) => !o && setShareTarget(null)}
        title={shareTarget?.type === "folder" ? shareTarget.folder?.name || "folder" : shareTarget?.note?.title || "note"}
        sharedWith={shareTarget?.type === "folder" ? shareTarget.folder?.sharedWith ?? [] : shareTarget?.note?.sharedWith ?? []}
        onShare={async (email, perm) => {
          if (shareTarget?.type === "folder" && shareTarget.folder) await notesApi.shareFolder(shareTarget.folder, email, perm);
          if (shareTarget?.type === "note" && shareTarget.note) await notesApi.shareNote(shareTarget.note, email, perm);
        }}
        onUnshare={async (uid) => {
          if (shareTarget?.type === "folder" && shareTarget.folder) await notesApi.unshareFolder(shareTarget.folder, uid);
          if (shareTarget?.type === "note" && shareTarget.note) await notesApi.unshareNote(shareTarget.note, uid);
        }}
      />

      <VaultGate
        open={vaultOpen}
        onOpenChange={setVaultOpen}
        settings={notesApi.vaultSettings}
        onSaveSettings={notesApi.saveVaultSettings}
        onUnlocked={(pin) => vault.markUnlocked(pin)}
      />

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Notes & home screen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="rounded-xl border border-foreground/20 p-3">
              <p className="font-medium">Colour notes by</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {COLOR_MODE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => notesApi.savePrefs({ colorMode: opt.id as NotesColorMode })}
                    className={`btn-edge min-h-10 rounded-md px-2.5 text-xs font-semibold ${
                      colorMode === opt.id ? "text-white" : "border border-foreground/20 bg-card"
                    }`}
                    style={colorMode === opt.id ? { background: jewelGradient(JEWEL.petrol) } : undefined}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {colorMode === "shades" && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {["#8A6424", "#17475C", "#1F4D3A", "#4A2A52", "#6B2248", "#7A2E2A"].map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      className={`h-7 w-7 rounded-md border ${shadeHue === hex ? "border-foreground" : "border-transparent"}`}
                      style={{ background: hex }}
                      onClick={() => notesApi.savePrefs({ shadeHue: hex })}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-foreground/20 p-3">
              <p className="font-medium">Card style</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {LIST_STYLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => notesApi.savePrefs({ listStyle: opt.id as NotesListStyle })}
                    className={`btn-edge min-h-10 rounded-md px-2.5 text-xs font-semibold ${
                      listStyle === opt.id ? "text-white" : "border border-foreground/20 bg-card"
                    }`}
                    style={listStyle === opt.id ? { background: jewelGradient(JEWEL.aubergine) } : undefined}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
              <div>
                <p className="font-medium">Show Hardy Hub calendar</p>
                <p className="text-[11px] text-muted-foreground">Overlay events in Calendar view</p>
              </div>
              <Switch
                checked={notesApi.prefs.showCalendarEvents}
                onCheckedChange={(v) => notesApi.savePrefs({ showCalendarEvents: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
              <div>
                <p className="font-medium">Show Tasks page items</p>
                <p className="text-[11px] text-muted-foreground">The existing Tasks list, not these notes</p>
              </div>
              <Switch
                checked={notesApi.prefs.showTasksPageItems}
                onCheckedChange={(v) => notesApi.savePrefs({ showTasksPageItems: v })}
              />
            </div>

            <div className="rounded-xl border border-border p-3">
              <NoteCategorySettings
                prefs={notesApi.prefs}
                onChange={(next) => notesApi.savePrefs(next)}
              />
            </div>

            {canEdit && (
              <form
                className="space-y-2 rounded-xl border border-border p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newFolder.trim()) return;
                  notesApi.addFolder(newFolder.trim());
                  setNewFolder("");
                }}
              >
                <p className="font-medium">Folders</p>
                <div className="flex gap-2">
                  <Input value={newFolder} onChange={(e) => setNewFolder(e.target.value)} placeholder="New folder" className="h-10" />
                  <Button type="submit" variant="outline"><FolderPlus /> Add</Button>
                </div>
              </form>
            )}

            <div className="rounded-xl border border-border p-3 space-y-2">
              <p className="font-medium flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> External calendars</p>
              <p className="text-xs text-muted-foreground">
                Dated notes can be added to Google Calendar one at a time, or exported as an .ics file you import into Gmail / Apple Calendar. Live two-way Gmail sync needs a Google Cloud app, which this hub does not connect yet.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={exportIcs}><Download className="mr-1 h-3.5 w-3.5" /> Download .ics</Button>
                <Button size="sm" variant="outline" asChild>
                  <a href="https://calendar.google.com/calendar/u/0/r/settings/export" target="_blank" rel="noreferrer">Open Google Calendar</a>
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-border p-3 space-y-2">
              <p className="font-medium flex items-center gap-1.5"><Smartphone className="h-4 w-4" /> Phone home screen</p>
              <p className="text-xs text-muted-foreground">
                This is for the icon on your phone’s home screen — not the Hardy Hub dashboard. Install Hardy Hub first (Chrome: menu → Install app / Add to Home screen. iPhone: Safari Share → Add to Home Screen).
              </p>
              <div className="rounded-lg bg-muted/40 p-2.5 text-xs space-y-1.5">
                <p className="font-medium">Android</p>
                <p className="text-muted-foreground">
                  Long-press the Hardy Hub icon. You should see <strong>Add note</strong>, which opens Notes with a new note ready. Also Notes, Calendar and Tasks.
                </p>
              </div>
              <div className="rounded-lg bg-muted/40 p-2.5 text-xs space-y-1.5">
                <p className="font-medium">iPhone</p>
                <p className="text-muted-foreground">
                  Apple does not let web apps add real home-screen widgets or a long-press shortcut menu. What you can do: open one of the links below, then Share → Add to Home Screen. That creates a second icon that jumps straight into Notes, a new note, or a glance view.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" asChild><a href="/notes?new=1">Add note shortcut</a></Button>
                <Button size="sm" variant="outline" asChild><a href="/notes">Notes icon</a></Button>
                <Button size="sm" variant="outline" asChild><a href="/widget">Edit widget look</a></Button>
              </div>
            </div>

            {isOwnScope && notesApi.vaultSettings?.method && (
              <Button variant="outline" className="w-full" onClick={vault.lock}>Lock Secure Notes now</Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </FeaturePageShell>
  );
}
