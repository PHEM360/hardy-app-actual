import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameDay, isToday, isSameMonth, parseISO, isBefore, addDays, startOfDay,
} from "date-fns";
import {
  StickyNote, Plus, Search, LayoutGrid, List, Columns2, CalendarDays, ListChecks,
  FolderPlus, Folder, Shield, Share2, Pin, Archive, CheckSquare, Settings2,
  Download, Home, Lock, CheckCircle2, Circle, Smartphone,
} from "lucide-react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSharedScope } from "@/hooks/useSharedScope";
import { useNotes } from "@/hooks/useNotes";
import { useNoteVault } from "@/hooks/useNoteVault";
import { useCalendar } from "@/hooks/useCalendar";
import { useTasks } from "@/hooks/useTasks";
import { NoteEditor } from "@/components/notes/NoteEditor";
import { ShareNoteDialog } from "@/components/notes/ShareNoteDialog";
import { VaultGate } from "@/components/notes/VaultGate";
import type { HubNote, NoteFolder, NotesView } from "@/types/notes";
import { NOTE_COLORS } from "@/types/notes";
import { buildIcsCalendar, downloadIcs } from "@/lib/noteCalendar";
import { toast } from "sonner";

type FilterId = "all" | "pinned" | "tasks" | "inbox" | "secure" | "shared" | "archived" | `folder:${string}`;

function colorStyle(color?: string): React.CSSProperties | undefined {
  const found = NOTE_COLORS.find((c) => c.id === color);
  if (!found || !color || color === "default") return undefined;
  return { backgroundColor: `color-mix(in srgb, ${found.swatch} 70%, hsl(var(--card)))` };
}

function previewText(note: HubNote) {
  if (note.locked) return "Locked note";
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
  const canEdit = permission === "edit" && notesApi.canEdit;

  const [filter, setFilter] = useState<FilterId>("all");
  const [view, setView] = useState<NotesView>(notesApi.prefs.defaultView);
  const [query, setQuery] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [active, setActive] = useState<HubNote | null>(null);
  const [creatingKind, setCreatingKind] = useState<"note" | "checklist">("note");
  const [shareTarget, setShareTarget] = useState<{ type: "note" | "folder"; note?: HubNote; folder?: NoteFolder } | null>(null);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newFolder, setNewFolder] = useState("");
  const [calMonth, setCalMonth] = useState(new Date());

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
    if (params.get("new") === "1") {
      setCreatingKind("note");
      setActive(null);
      setEditorOpen(true);
      const next = new URLSearchParams(params);
      next.delete("new");
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

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
      if (filter === "tasks") return n.kind !== "note";
      if (filter === "inbox") return !n.folderId;
      if (filter.startsWith("folder:")) return n.folderId === filter.slice(7);
      return true;
    });

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((n) =>
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        n.checklist.some((i) => i.text.toLowerCase().includes(q))
      );
    }

    return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || (a.title || "").localeCompare(b.title || ""));
  }, [filter, notesApi.notes, notesApi.vaultNotes, notesApi.sharedNotes, vault.unlocked, query]);

  const openNote = (note: HubNote | null, kind: "note" | "checklist" = "note") => {
    setCreatingKind(kind);
    setActive(note);
    setEditorOpen(true);
  };

  const saveNote = async (patch: Partial<HubNote>) => {
    if (active) {
      await notesApi.updateNote(active, patch);
      if (patch.addToCalendar && (patch.dueDate || active.dueDate)) {
        await syncCalendar({ ...active, ...patch } as HubNote);
      }
      return;
    }
    const id = await notesApi.addNote({
      ...patch,
      kind: patch.kind ?? creatingKind,
      vault: filter === "secure",
    });
    if (patch.addToCalendar && patch.dueDate) {
      await syncCalendar({ id, ownerId: notesApi.uid || "", ...patch } as HubNote);
    }
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

  const sidebarItem = (id: FilterId, label: string, icon: React.ReactNode, extra?: React.ReactNode) => (
    <button
      type="button"
      onClick={() => (id === "secure" ? openSecure() : setFilter(id))}
      className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm ${
        filter === id ? "bg-primary/10 text-foreground font-medium" : "text-muted-foreground hover:bg-muted/50"
      }`}
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {extra}
    </button>
  );

  return (
    <FeaturePageShell
      title={pageTitle}
      subtitle="Notes, checklists and dated work in one place — alongside the Tasks page"
      icon={<StickyNote className="h-5 w-5" />}
      sharePage="notes"
      action={
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => setSettingsOpen(true)} aria-label="Notes settings">
            <Settings2 className="h-4 w-4" />
          </Button>
          {canEdit && (
            <Button size="sm" onClick={() => openNote(null)}>
              <Plus className="mr-1 h-4 w-4" /> Note
            </Button>
          )}
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        <aside className="space-y-1 rounded-2xl border border-border bg-card/60 p-2">
          {sidebarItem("all", "All notes", <StickyNote className="h-4 w-4" />)}
          {sidebarItem("pinned", "Pinned", <Pin className="h-4 w-4" />)}
          {sidebarItem("tasks", "Checklists & tasks", <CheckSquare className="h-4 w-4" />)}
          {sidebarItem("inbox", "Inbox", <Folder className="h-4 w-4" />)}
          <div className="px-2.5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Folders</div>
          {notesApi.folders.map((f) => (
            <div key={f.id} className="flex items-center">
              <div className="flex-1">
                {sidebarItem(`folder:${f.id}`, `${f.emoji ? `${f.emoji} ` : ""}${f.name}`, <Folder className="h-4 w-4" />)}
              </div>
              {isOwnScope && (
                <button type="button" className="px-1 text-muted-foreground hover:text-foreground" onClick={() => setShareTarget({ type: "folder", folder: f })}>
                  <Share2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          {canEdit && (
            <form
              className="flex gap-1 px-1 pt-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newFolder.trim()) return;
                notesApi.addFolder(newFolder.trim());
                setNewFolder("");
              }}
            >
              <Input value={newFolder} onChange={(e) => setNewFolder(e.target.value)} placeholder="New folder" className="h-8 text-xs" />
              <Button type="submit" size="icon" variant="ghost" className="h-8 w-8" aria-label="Add folder">
                <FolderPlus className="h-4 w-4" />
              </Button>
            </form>
          )}
          <div className="px-2.5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Private</div>
          {sidebarItem("secure", "Secure notes", <Shield className="h-4 w-4" />, vault.unlocked ? <Lock className="h-3 w-3 opacity-50" /> : <Lock className="h-3 w-3" />)}
          {sidebarItem("shared", "Shared with me", <Share2 className="h-4 w-4" />)}
          {sidebarItem("archived", "Archived", <Archive className="h-4 w-4" />)}
        </aside>

        <section className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes" className="pl-8" />
            </div>
            <div className="flex rounded-xl border border-border bg-card p-0.5">
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  title={v.label}
                  onClick={() => { setView(v.id); notesApi.savePrefs({ defaultView: v.id }); }}
                  className={`rounded-lg p-2 ${view === v.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <v.icon className="h-4 w-4" />
                </button>
              ))}
            </div>
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => openNote(null, "checklist")}>
                <CheckSquare className="mr-1 h-4 w-4" /> Checklist
              </Button>
            )}
          </div>

          {filter === "secure" && !vault.unlocked && (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center">
              <Shield className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Unlock Secure Notes to see this folder.</p>
              <Button className="mt-3" onClick={() => setVaultOpen(true)}>Unlock</Button>
            </div>
          )}

          {view === "grid" && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {visibleNotes.map((n) => (
                <button
                  key={`${n.ownerId}-${n.id}`}
                  type="button"
                  onClick={() => openNote(n)}
                  className="rounded-2xl border border-border p-3 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-elevated"
                  style={colorStyle(n.color)}
                >
                  <div className="mb-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    {n.pinned && <Pin className="h-3 w-3" />}
                    {n.locked && <Lock className="h-3 w-3" />}
                    {n.kind !== "note" && <CheckSquare className="h-3 w-3" />}
                  </div>
                  <p className="line-clamp-2 text-sm font-semibold">{n.locked ? "Locked note" : n.title || "Untitled"}</p>
                  <p className="mt-1 line-clamp-4 text-xs text-muted-foreground">{previewText(n)}</p>
                  {n.dueDate && <p className="mt-2 text-[11px] text-muted-foreground">{format(parseISO(`${n.dueDate.slice(0, 10)}T12:00:00`), "d MMM")}</p>}
                </button>
              ))}
              {visibleNotes.length === 0 && filter !== "secure" && (
                <p className="col-span-full py-10 text-center text-sm text-muted-foreground">No notes here yet.</p>
              )}
            </div>
          )}

          {view === "list" && (
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {visibleNotes.map((n) => (
                <button key={`${n.ownerId}-${n.id}`} type="button" onClick={() => openNote(n)} className="flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-muted/40">
                  {n.kind === "note" ? <StickyNote className="mt-0.5 h-4 w-4 text-muted-foreground" /> : n.checklist.every((i) => i.done) && n.checklist.length ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" /> : <Circle className="mt-0.5 h-4 w-4 text-muted-foreground" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{n.locked ? "Locked note" : n.title || "Untitled"}</p>
                    <p className="truncate text-xs text-muted-foreground">{previewText(n)}</p>
                  </div>
                  {n.dueDate && <span className="text-[11px] text-muted-foreground">{format(parseISO(`${n.dueDate.slice(0, 10)}T12:00:00`), "d MMM")}</span>}
                </button>
              ))}
            </div>
          )}

          {view === "board" && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {boardColumns.map((col) => (
                <div key={col.id} className="w-[240px] shrink-0 rounded-2xl border border-border bg-muted/20 p-2">
                  <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {col.title} · {col.notes.length}
                  </p>
                  <div className="space-y-2">
                    {col.notes.map((n) => (
                      <button key={n.id} type="button" onClick={() => openNote(n)} className="w-full rounded-xl border border-border bg-card p-2.5 text-left" style={colorStyle(n.color)}>
                        <p className="text-sm font-medium">{n.title || "Untitled"}</p>
                        <p className="line-clamp-3 text-xs text-muted-foreground">{previewText(n)}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {view === "calendar" && (
            <div className="rounded-2xl border border-border bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={() => setCalMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>Prev</Button>
                <p className="text-sm font-semibold">{format(calMonth, "MMMM yyyy")}</p>
                <Button variant="ghost" size="sm" onClick={() => setCalMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>Next</Button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-muted-foreground">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d}>{d}</div>)}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
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
                          setEditorOpen(true);
                        }
                      }}
                      className={`min-h-[72px] rounded-lg border p-1 text-left ${isSameMonth(day, calMonth) ? "border-border bg-background" : "border-transparent bg-muted/20 text-muted-foreground"} ${isToday(day) ? "ring-1 ring-primary" : ""}`}
                    >
                      <span className="text-[11px] font-medium">{format(day, "d")}</span>
                      {count > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {items.notes.slice(0, 2).map((n) => (
                            <div key={n.id} className="truncate rounded bg-amber-500/20 px-1 text-[9px]" onClick={(e) => { e.stopPropagation(); openNote(n); }}>{n.title || "Note"}</div>
                          ))}
                          {items.hubEvents.slice(0, 1).map((e) => (
                            <div key={e.id} className="truncate rounded bg-blue-500/20 px-1 text-[9px]">{e.title}</div>
                          ))}
                          {items.taskItems.slice(0, 1).map((t) => (
                            <div key={t.id} className="truncate rounded bg-violet-500/20 px-1 text-[9px]">{t.title}</div>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Notes with dates, plus Hardy Hub calendar events and Tasks-page due dates when those overlays are on.
              </p>
            </div>
          )}

          {view === "agenda" && (
            <div className="space-y-2">
              {visibleNotes.filter((n) => n.dueDate).sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || "")).map((n) => (
                <button key={n.id} type="button" onClick={() => openNote(n)} className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left">
                  <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">
                    {format(parseISO(`${n.dueDate!.slice(0, 10)}T12:00:00`), "d MMM")}
                  </span>
                  <span className="text-sm">{n.title || "Untitled"}</span>
                </button>
              ))}
              {notesApi.prefs.showTasksPageItems && tasks.filter((t) => t.dueDate && t.status !== "done").map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-xl border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground">
                  <span className="w-16 text-xs">{t.dueDate ? format(parseISO(t.dueDate), "d MMM") : ""}</span>
                  Task: {t.title}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <NoteEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        note={active}
        folders={notesApi.folders}
        canEdit={canEdit}
        isOwn={isOwnScope}
        onSave={saveNote}
        onDelete={async () => {
          if (active) await notesApi.deleteNote(active);
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
              <p className="font-medium flex items-center gap-1.5"><Smartphone className="h-4 w-4" /> Quick add from the home screen</p>
              <p className="text-xs text-muted-foreground">
                On Android, long-press the Hardy Hub icon after installing the app — you should see <strong>Add note</strong>. On iPhone, add Hardy Hub to the Home Screen from Safari; shortcuts are limited there, so you can also add a dedicated “Add note” icon from the page below.
              </p>
              <Button size="sm" variant="outline" asChild>
                <a href="/notes/quick"><Home className="mr-1 h-3.5 w-3.5" /> Open quick note</a>
              </Button>
            </div>

            <div className="rounded-xl border border-border p-3 space-y-2">
              <p className="font-medium">Widget-style home screen</p>
              <p className="text-xs text-muted-foreground">
                Browsers cannot place true iOS/Android widgets for a web app the way native Notes or Calendar can. These pages are made to look like widgets — add each one to your home screen if you want a calendar, tasks, or notes glance.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" asChild><a href="/widget/calendar">Calendar widget</a></Button>
                <Button size="sm" variant="outline" asChild><a href="/widget/tasks">Tasks widget</a></Button>
                <Button size="sm" variant="outline" asChild><a href="/widget/notes">Notes widget</a></Button>
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
