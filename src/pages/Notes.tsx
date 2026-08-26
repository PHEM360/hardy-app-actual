import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameDay, isToday, isSameMonth, parseISO, isBefore, addDays, startOfDay,
} from "date-fns";
import {
  StickyNote, Plus, Search, LayoutGrid, List, Columns2, CalendarDays, ListChecks,
  FolderPlus, Shield, Share2, Pin, Archive, CheckSquare, Settings2,
  Download, Lock, CheckCircle2, Circle, Smartphone, Palette, Layers, Inbox, Folder, PenLine,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSharedScope } from "@/hooks/useSharedScope";
import { useNotes } from "@/hooks/useNotes";
import { useNoteVault } from "@/hooks/useNoteVault";
import { useCalendar } from "@/hooks/useCalendar";
import { useTasks } from "@/hooks/useTasks";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import { NoteEditor } from "@/components/notes/NoteEditor";
import { ShareNoteDialog } from "@/components/notes/ShareNoteDialog";
import { VaultGate } from "@/components/notes/VaultGate";
import { NoteCard } from "@/components/notes/NoteCard";
import type { HubNote, NoteFolder, NoteKind, NotesColorMode, NotesListStyle, NotesView } from "@/types/notes";
import { buildIcsCalendar, downloadIcs } from "@/lib/noteCalendar";
import { COLOR_MODE_OPTIONS, LIST_STYLE_OPTIONS, noteCardStyle, noteSwatch } from "@/lib/noteStyle";
import { toast } from "sonner";

type FilterId = "all" | "pinned" | "tasks" | "drawings" | "inbox" | "secure" | "shared" | "archived" | `folder:${string}`;

const FOLDER_ACCENT: Record<string, string> = {
  yellow: "hsl(42, 85%, 48%)",
  orange: "hsl(28, 80%, 52%)",
  red: "hsl(0, 65%, 52%)",
  pink: "hsl(330, 70%, 58%)",
  purple: "hsl(270, 55%, 55%)",
  blue: "hsl(210, 55%, 50%)",
  teal: "hsl(178, 55%, 36%)",
  green: "hsl(152, 50%, 40%)",
  gray: "hsl(215, 14%, 46%)",
  default: "hsl(270, 55%, 55%)",
};

const BOARD_TONES = [
  { mix: "hsl(42, 85%, 48%)", label: "text-foreground" },
  { mix: "hsl(0, 65%, 52%)", label: "text-foreground" },
  { mix: "hsl(152, 50%, 40%)", label: "text-foreground" },
  { mix: "hsl(210, 55%, 50%)", label: "text-foreground" },
  { mix: "hsl(270, 55%, 55%)", label: "text-foreground" },
];

function hasChecklist(note: HubNote) {
  return (note.checklist ?? []).some((i) => i.text.trim()) || note.kind === "checklist" || note.kind === "task";
}

function previewText(note: HubNote) {
  if (note.locked) return "Locked note";
  if (note.kind === "drawing") return `${note.canvas?.blocks.length || 0} canvas item${note.canvas?.blocks.length === 1 ? "" : "s"}`;
  if (note.checklist?.length) {
    const done = note.checklist.filter((i) => i.done).length;
    return `${done}/${note.checklist.length} checked`;
  }
  return note.body?.slice(0, 140) || "Empty note";
}

const VIEWS: { id: NotesView; label: string; icon: typeof LayoutGrid }[] = [
  { id: "grid", label: "Grid", icon: LayoutGrid },
  { id: "list", label: "List", icon: List },
  { id: "board", label: "Board", icon: Columns2 },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "agenda", label: "Agenda", icon: ListChecks },
];

export default function Notes() {
  const [params, setParams] = useSearchParams();
  const { scopeUserId, pageTitle, isOwnScope, permission } = useSharedScope("notes");
  const notesApi = useNotes(scopeUserId ?? undefined);
  const vault = useNoteVault();
  const { events, addEvent, updateEvent } = useCalendar(scopeUserId ?? undefined);
  const { tasks } = useTasks(scopeUserId ?? undefined);
  const { pinNotesFirst, unpinNotes } = useDashboardLayout();
  const canEdit = permission === "edit" && notesApi.canEdit;

  const [filter, setFilter] = useState<FilterId>("all");
  const [view, setView] = useState<NotesView>(notesApi.prefs.defaultView);
  const [query, setQuery] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [active, setActive] = useState<HubNote | null>(null);
  const [creatingKind, setCreatingKind] = useState<NoteKind>("note");
  const [creatingId, setCreatingId] = useState(() => crypto.randomUUID());
  const [shareTarget, setShareTarget] = useState<{ type: "note" | "folder"; note?: HubNote; folder?: NoteFolder } | null>(null);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newFolder, setNewFolder] = useState("");
  const [calMonth, setCalMonth] = useState(new Date());
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
      setCreatingId(crypto.randomUUID());
      setActive(null);
      setEditorOpen(true);
      const next = new URLSearchParams(params);
      next.delete("new");
      setParams(next, { replace: true });
    }
    if (params.get("new") === "checklist") {
      setCreatingKind("checklist");
      setCreatingId(crypto.randomUUID());
      setActive(null);
      setEditorOpen(true);
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
      if (filter === "tasks") return hasChecklist(n);
      if (filter === "drawings") return n.kind === "drawing";
      if (filter === "inbox") return !n.folderId;
      if (filter.startsWith("folder:")) return n.folderId === filter.slice(7);
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

  const openNote = (note: HubNote | null, kind: NoteKind = "note") => {
    setCreatingKind(kind);
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

  const styleFor = (n: HubNote, i: number, total = visibleNotes.length) =>
    noteCardStyle(noteSwatch(n, i, total, colorMode, notesApi.folders, shadeHue), listStyle, i);

  const railItem = (id: FilterId, label: string, Icon: LucideIcon, accent?: string) => {
    const on = filter === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => (id === "secure" ? openSecure() : setFilter(id))}
        className={`relative flex w-full flex-col items-center gap-1 rounded-xl px-1.5 py-2 text-center transition sm:flex-row sm:gap-2 sm:px-2.5 sm:text-left ${
          on
            ? "bg-gradient-primary text-primary-foreground shadow-soft"
            : "border border-border/50 bg-card text-foreground hover:border-primary/30"
        }`}
      >
        {!on && accent && (
          <span className="absolute left-0 top-1.5 bottom-1.5 hidden w-1 rounded-full sm:block" style={{ background: accent }} />
        )}
        <Icon className="h-4 w-4 shrink-0" />
        <span className="w-full truncate text-[10px] font-semibold leading-tight sm:text-sm">{label}</span>
      </button>
    );
  };

  return (
    <FeaturePageShell
      title={pageTitle}
      subtitle="Notes, checklists and sketches"
      icon={<StickyNote className="w-5 h-5" />}
      sharePage="notes"
      action={
        <div className="flex items-center gap-1.5">
          {canEdit && (
            <Button size="sm" className="rounded-xl bg-gradient-primary" onClick={() => openNote(null)}>
              <Plus className="mr-1 h-4 w-4" /> New note
            </Button>
          )}
          <Button size="icon" variant="ghost" onClick={() => setSettingsOpen(true)} aria-label="Notes settings">
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
      }
    >
      <div className="flex min-w-0 gap-3">
        <aside className="w-[4.5rem] shrink-0 sm:w-[10.75rem]">
          <div className="sticky top-2 space-y-1">
            {railItem("all", "All", StickyNote)}
            {railItem("pinned", "Pinned", Pin)}
            {railItem("tasks", "Checklists", CheckSquare)}
            {railItem("drawings", "Drawings", PenLine, FOLDER_ACCENT.purple)}
            {railItem("inbox", "Inbox", Inbox)}
            {notesApi.folders.map((f) =>
              railItem(`folder:${f.id}`, `${f.emoji ? `${f.emoji} ` : ""}${f.name}`, Folder, FOLDER_ACCENT[f.color] || FOLDER_ACCENT.default)
            )}
            {railItem("secure", "Secure", Shield)}
            {railItem("shared", "Shared", Share2)}
            {railItem("archived", "Archive", Archive)}
            {canEdit && (
              <form
                className="pt-2 space-y-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newFolder.trim()) return;
                  notesApi.addFolder(newFolder.trim());
                  setNewFolder("");
                }}
              >
                <Input value={newFolder} onChange={(e) => setNewFolder(e.target.value)} placeholder="Folder" className="h-8 rounded-xl border-2 bg-card px-2 text-xs" />
                <Button type="submit" size="sm" variant="outline" className="h-8 w-full rounded-xl text-[11px]">
                  <FolderPlus className="mr-1 h-3.5 w-3.5" /> Add
                </Button>
                {filter.startsWith("folder:") && isOwnScope && (
                  <Button type="button" size="sm" variant="ghost" className="h-8 w-full rounded-xl text-[11px]" onClick={() => {
                    const f = notesApi.folders.find((x) => x.id === filter.slice(7));
                    if (f) setShareTarget({ type: "folder", folder: f });
                  }}>
                    <Share2 className="mr-1 h-3.5 w-3.5" /> Share
                  </Button>
                )}
              </form>
            )}
          </div>
        </aside>

        <div className="min-w-0 flex-1 overflow-x-hidden">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="h-10 rounded-xl border-2 bg-card pl-9 shadow-soft" />
        </div>
        <div className="flex items-center gap-1 rounded-2xl border-2 border-border bg-card p-1 shadow-soft">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              title={v.label}
              onClick={() => { setView(v.id); notesApi.savePrefs({ defaultView: v.id }); }}
              className={`relative z-10 rounded-xl p-2 ${view === v.id ? "text-primary-foreground" : "text-foreground/70 hover:text-foreground"}`}
            >
              {view === v.id && (
                <motion.span layoutId="notes-view-tab" className="absolute inset-0 -z-10 rounded-xl bg-gradient-primary shadow-sm" transition={{ type: "spring", stiffness: 500, damping: 35 }} />
              )}
              <v.icon className="h-4 w-4" />
            </button>
          ))}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="rounded-xl border-2">
              <Palette className="mr-1 h-3.5 w-3.5" /> Colour
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Colour notes by</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={colorMode}
              onValueChange={(v) => notesApi.savePrefs({ colorMode: v as NotesColorMode })}
            >
              {COLOR_MODE_OPTIONS.map((opt) => (
                <DropdownMenuRadioItem key={opt.id} value={opt.id}>
                  <span>
                    <span className="block">{opt.label}</span>
                    <span className="text-[10px] text-muted-foreground">{opt.hint}</span>
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            {colorMode === "shades" && (
              <>
                <DropdownMenuSeparator />
                <div className="flex flex-wrap gap-1.5 px-2 py-1.5">
                  {["#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#ef4444"].map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      className={`h-5 w-5 rounded-full border ${shadeHue === hex ? "border-foreground" : "border-transparent"}`}
                      style={{ background: hex }}
                      onClick={() => notesApi.savePrefs({ shadeHue: hex })}
                    />
                  ))}
                </div>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="rounded-xl border-2">
              <Layers className="mr-1 h-3.5 w-3.5" /> Style
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>List design</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={listStyle}
              onValueChange={(v) => notesApi.savePrefs({ listStyle: v as NotesListStyle })}
            >
              {LIST_STYLE_OPTIONS.map((opt) => (
                <DropdownMenuRadioItem key={opt.id} value={opt.id}>{opt.label}</DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {filter === "secure" && !vault.unlocked && (
        <div className="rounded-2xl border border-border/40 bg-card p-10 text-center shadow-card">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
            <Shield className="h-6 w-6" />
          </div>
          <p className="font-display text-lg font-bold">Secure notes</p>
          <p className="mt-1 text-sm text-muted-foreground">Unlock with Face ID or your passcode to see this folder.</p>
          <Button className="mt-4 rounded-xl bg-gradient-primary" onClick={() => setVaultOpen(true)}>Unlock</Button>
        </div>
      )}

      {view === "grid" && !(filter === "secure" && !vault.unlocked) && (
        visibleNotes.length === 0 ? (
          <div className="rounded-2xl border border-border/40 bg-card px-6 py-14 text-center shadow-card">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
              <StickyNote className="h-6 w-6" />
            </div>
            <p className="font-display text-xl font-bold">Nothing here yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Tap the button to add a note or a checklist.</p>
            {canEdit && (
              <Button className="mt-4 rounded-xl bg-gradient-primary" onClick={() => openNote(null, filter === "drawings" ? "drawing" : "note")}>
                <Plus className="mr-1 h-4 w-4" /> New note
              </Button>
            )}
          </div>
        ) : (
          <div className={listStyle === "compact" ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" : "notes-masonry"}>
            {visibleNotes.map((n, i) => (
              <NoteCard
                key={`${n.ownerId}-${n.id}`}
                note={n}
                listStyle={listStyle}
                style={styleFor(n, i)}
                canEdit={canEdit && !n.locked}
                featured={notesApi.prefs.dashboardNoteId === n.id}
                onOpen={() => openNote(n)}
                onToggleItem={(itemId, done) => {
                  notesApi.updateNote(n, {
                    checklist: n.checklist.map((item) => item.id === itemId ? { ...item, done } : item),
                  });
                }}
              />
            ))}
          </div>
        )
      )}

          {view === "list" && (
            <div className="space-y-2">
              {visibleNotes.map((n, i) => (
                <button
                  key={`${n.ownerId}-${n.id}`}
                  type="button"
                  onClick={() => openNote(n)}
                  className="flex w-full items-start gap-3 rounded-2xl px-4 py-3.5 text-left shadow-card"
                  style={styleFor(n, i)}
                >
                  {hasChecklist(n) ? (n.checklist.every((item) => item.done) && n.checklist.length ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" /> : <Circle className="mt-0.5 h-5 w-5" />) : <StickyNote className="mt-0.5 h-5 w-5" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display font-bold">{n.locked ? "Locked note" : n.title || "Untitled"}</p>
                    <p className="truncate text-sm opacity-70">{previewText(n)}</p>
                  </div>
                  {n.dueDate && <span className="rounded-full bg-black/10 px-2 py-0.5 text-[11px] font-semibold">{format(parseISO(`${n.dueDate.slice(0, 10)}T12:00:00`), "d MMM")}</span>}
                </button>
              ))}
            </div>
          )}

          {view === "board" && (
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {boardColumns.map((col, ci) => (
                <div
                  key={col.id}
                  className="min-w-0 overflow-hidden rounded-2xl border border-border/40 p-2.5 shadow-card"
                  style={{
                    background: `color-mix(in srgb, ${BOARD_TONES[ci].mix} 14%, hsl(var(--card)))`,
                    borderLeftWidth: 4,
                    borderLeftColor: BOARD_TONES[ci].mix,
                  }}
                >
                  <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {col.title} · {col.notes.length}
                  </p>
                  <div className="space-y-2">
                    {col.notes.map((n, i) => (
                      <NoteCard
                        key={n.id}
                        note={n}
                        listStyle={listStyle}
                        style={styleFor(n, i, col.notes.length)}
                        canEdit={canEdit && !n.locked}
                        featured={notesApi.prefs.dashboardNoteId === n.id}
                        onOpen={() => openNote(n)}
                        onToggleItem={(itemId, done) => {
                          notesApi.updateNote(n, {
                            checklist: n.checklist.map((item) => item.id === itemId ? { ...item, done } : item),
                          });
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {view === "calendar" && (
            <div className="min-w-0 overflow-hidden rounded-2xl border border-border/40 bg-card p-3 shadow-card">
              <div className="mb-3 flex items-center justify-between">
                <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setCalMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>Prev</Button>
                <p className="font-display text-lg font-bold">{format(calMonth, "MMMM yyyy")}</p>
                <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setCalMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>Next</Button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-foreground/50">
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
                      className={`min-h-[52px] min-w-0 overflow-hidden rounded-xl p-1 text-left sm:min-h-[72px] ${isSameMonth(day, calMonth) ? "bg-muted/40" : "opacity-40"} ${isToday(day) ? "ring-2 ring-primary" : ""}`}
                    >
                      <span className="text-[11px] font-bold">{format(day, "d")}</span>
                      {count > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {items.notes.slice(0, 2).map((n) => (
                            <div key={n.id} className="truncate rounded-md bg-primary/15 px-1 text-[9px] font-semibold text-foreground" onClick={(e) => { e.stopPropagation(); openNote(n); }}>{n.title || "Note"}</div>
                          ))}
                          {items.hubEvents.slice(0, 1).map((e) => (
                            <div key={e.id} className="truncate rounded-md bg-sky-300 px-1 text-[9px] font-semibold text-sky-950">{e.title}</div>
                          ))}
                          {items.taskItems.slice(0, 1).map((t) => (
                            <div key={t.id} className="truncate rounded-md bg-violet-300 px-1 text-[9px] font-semibold text-violet-950">{t.title}</div>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {view === "agenda" && (
            <div className="space-y-2">
              {visibleNotes.filter((n) => n.dueDate).sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || "")).map((n, i) => (
                <button key={n.id} type="button" onClick={() => openNote(n)} className="flex w-full min-w-0 items-center gap-3 rounded-2xl px-4 py-3 text-left shadow-card" style={styleFor(n, i)}>
                  <span className="w-14 shrink-0 text-xs font-bold">
                    {format(parseISO(`${n.dueDate!.slice(0, 10)}T12:00:00`), "d MMM")}
                  </span>
                  <span className="min-w-0 truncate font-display font-semibold">{n.title || "Untitled"}</span>
                </button>
              ))}
              {notesApi.prefs.showTasksPageItems && tasks.filter((t) => t.dueDate && t.status !== "done").map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-2xl bg-violet-200/70 px-4 py-3 text-sm dark:bg-violet-500/20">
                  <span className="w-16 text-xs font-bold">{t.dueDate ? format(parseISO(t.dueDate), "d MMM") : ""}</span>
                  Task · {t.title}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <NoteEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        note={active}
        folders={notesApi.folders}
        canEdit={canEdit}
        isOwn={isOwnScope}
        defaultKind={creatingKind}
        ownerId={active?.ownerId || notesApi.uid || ""}
        noteId={active?.id || creatingId}
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
