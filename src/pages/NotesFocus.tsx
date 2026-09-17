import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  Archive,
  CheckSquare,
  ChevronRight,
  Folder,
  FolderPlus,
  Inbox,
  Lock,
  Pin,
  Plus,
  Search,
  Share2,
  Shield,
  StickyNote,
  Tag,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { NoteEditor } from "@/components/notes/NoteEditor";
import { NoteStartDialog } from "@/components/notes/NoteStartDialog";
import { ShareNoteDialog } from "@/components/notes/ShareNoteDialog";
import { VaultGate } from "@/components/notes/VaultGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCalendar } from "@/hooks/useCalendar";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import { useNotes } from "@/hooks/useNotes";
import { useNoteVault } from "@/hooks/useNoteVault";
import { useSharedScope } from "@/hooks/useSharedScope";
import { noteHasDiagram } from "@/lib/noteDiagram";
import { noteSwatch } from "@/lib/noteStyle";
import type { HubNote, NoteDiagram, NoteFolder, NoteKind } from "@/types/notes";
import { noteCategoryOptions } from "@/types/notes";

type FilterId = "all" | "pinned" | "tasks" | "inbox" | "secure" | "shared" | "archived" | `folder:${string}` | `category:${string}`;

function hasChecklist(note: HubNote) {
  return note.kind === "checklist" || note.kind === "task" || (note.checklist ?? []).some((item) => item.text.trim());
}

function preview(note: HubNote) {
  if (note.locked) return "Locked note";
  if (note.kind === "drawing") return "Drawing";
  if (noteHasDiagram(note)) return "Diagram";
  if (note.checklist?.length) {
    const complete = note.checklist.filter((item) => item.done).length;
    const firstOpen = note.checklist.find((item) => !item.done)?.text;
    return firstOpen ? `${complete}/${note.checklist.length} complete · ${firstOpen}` : `${complete}/${note.checklist.length} complete`;
  }
  return note.body?.replace(/\s+/g, " ").trim().slice(0, 180) || "Empty note";
}

export default function NotesFocus() {
  const [params, setParams] = useSearchParams();
  const { scopeUserId, pageTitle, isOwnScope, permission } = useSharedScope("notes");
  const notesApi = useNotes(scopeUserId ?? undefined);
  const vault = useNoteVault();
  const { addEvent, updateEvent } = useCalendar(scopeUserId ?? undefined);
  const { pinNotesFirst, unpinNotes } = useDashboardLayout();
  const canEdit = permission === "edit" && notesApi.canEdit;

  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [active, setActive] = useState<HubNote | null>(null);
  const [creatingKind, setCreatingKind] = useState<NoteKind>("note");
  const [creatingId, setCreatingId] = useState(() => crypto.randomUUID());
  const [creatingDiagram, setCreatingDiagram] = useState<NoteDiagram | null>(null);
  const [creatingTitle, setCreatingTitle] = useState("");
  const [shareTarget, setShareTarget] = useState<{ type: "note" | "folder"; note?: HubNote; folder?: NoteFolder } | null>(null);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [newFolder, setNewFolder] = useState("");

  useEffect(() => {
    if (!vault.unlocked) {
      notesApi.unsubscribeVault();
      return;
    }
    return notesApi.subscribeVault();
  }, [vault.unlocked, notesApi.subscribeVault, notesApi.unsubscribeVault]);

  const openNote = (note: HubNote | null, kind: NoteKind = "note", diagram: NoteDiagram | null = null, title = "") => {
    setCreatingKind(kind);
    setCreatingDiagram(note ? null : diagram);
    setCreatingTitle(note ? "" : title);
    if (!note) setCreatingId(crypto.randomUUID());
    setActive(note);
    setEditorOpen(true);
  };

  useEffect(() => {
    const mode = params.get("new");
    if (!mode) return;
    if (mode === "1" || mode === "note") openNote(null, "note");
    else if (mode === "checklist") openNote(null, "checklist");
    else if (mode === "diagram") setStartOpen(true);
    const next = new URLSearchParams(params);
    next.delete("new");
    setParams(next, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const noteId = params.get("note");
    if (!noteId || notesApi.loading) return;
    const found = notesApi.notes.find((note) => note.id === noteId) ?? notesApi.sharedNotes.find((note) => note.id === noteId);
    if (found) openNote(found, found.kind);
    const next = new URLSearchParams(params);
    next.delete("note");
    setParams(next, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notesApi.loading, notesApi.notes, notesApi.sharedNotes]);

  const visibleNotes = useMemo(() => {
    let list: HubNote[];
    if (filter === "secure") list = vault.unlocked ? notesApi.vaultNotes : [];
    else if (filter === "shared") list = notesApi.sharedNotes;
    else list = notesApi.notes;

    list = list.filter((note) => {
      if (filter === "archived") return note.archived;
      if (note.archived) return false;
      if (filter === "pinned") return note.pinned;
      if (filter === "tasks") return hasChecklist(note);
      if (filter === "inbox") return !note.folderId;
      if (filter.startsWith("folder:")) return note.folderId === filter.slice(7);
      if (filter.startsWith("category:")) return note.category === filter.slice(9);
      return true;
    });

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((note) =>
        note.title.toLowerCase().includes(q) ||
        note.body.toLowerCase().includes(q) ||
        (note.checklist ?? []).some((item) => item.text.toLowerCase().includes(q))
      );
    }

    return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || (a.title || "").localeCompare(b.title || ""));
  }, [filter, notesApi.notes, notesApi.sharedNotes, notesApi.vaultNotes, query, vault.unlocked]);

  const clearDashboardNote = async (noteId: string) => {
    if (notesApi.prefs.dashboardNoteId !== noteId) return;
    await notesApi.savePrefs({ dashboardNoteId: null });
    unpinNotes();
  };

  const syncDashboardNote = async (noteId: string, enabled: boolean) => {
    if (enabled) {
      if (notesApi.prefs.dashboardNoteId !== noteId) await notesApi.savePrefs({ dashboardNoteId: noteId });
      pinNotesFirst();
      return;
    }
    await clearDashboardNote(noteId);
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
    if (note.calendarEventId) await updateEvent(note.calendarEventId, payload);
    else {
      const eventId = await addEvent(payload);
      if (eventId && note.id) await notesApi.updateNote(note, { calendarEventId: eventId, addToCalendar: true, dueDate: note.dueDate });
    }
  };

  const saveNote = async (
    patch: Partial<HubNote>,
    options?: { encryptWith?: string; decrypt?: boolean; showOnDashboard?: boolean },
  ) => {
    let noteId = active?.id;
    if (active) {
      await notesApi.updateNote(active, patch);
      if (patch.addToCalendar && (patch.dueDate || active.dueDate)) await syncCalendar({ ...active, ...patch } as HubNote);
    } else {
      noteId = await notesApi.addNote({
        ...patch,
        id: creatingId,
        kind: patch.kind ?? creatingKind,
        vault: filter === "secure",
      });
      if (patch.addToCalendar && patch.dueDate) await syncCalendar({ id: noteId, ownerId: notesApi.uid || "", ...patch } as HubNote);
    }
    if (typeof options?.showOnDashboard === "boolean" && noteId && isOwnScope) await syncDashboardNote(noteId, options.showOnDashboard);
  };

  const openSecure = () => {
    setFilter("secure");
    if (!vault.unlocked) setVaultOpen(true);
  };

  const filters: Array<{ id: FilterId; label: string; icon: typeof StickyNote }> = [
    { id: "all", label: "All notes", icon: StickyNote },
    { id: "pinned", label: "Pinned", icon: Pin },
    { id: "tasks", label: "Checklists", icon: CheckSquare },
    { id: "inbox", label: "Inbox", icon: Inbox },
    { id: "shared", label: "Shared", icon: Share2 },
    { id: "secure", label: "Secure", icon: Shield },
    { id: "archived", label: "Archive", icon: Archive },
  ];

  const currentLabel = filter === "all"
    ? "All notes"
    : filter.startsWith("folder:")
      ? notesApi.folders.find((folder) => folder.id === filter.slice(7))?.name || "Folder"
      : filter.startsWith("category:")
        ? noteCategoryOptions(notesApi.prefs).find((category) => category.id === filter.slice(9))?.label || "Category"
        : filters.find((item) => item.id === filter)?.label || "Notes";

  return (
    <FeaturePageShell
      title={pageTitle}
      subtitle="A focused notes workspace"
      icon={<StickyNote className="h-5 w-5" />}
      sharePage="notes"
      action={canEdit ? (
        <Button size="sm" className="rounded-xl bg-gradient-primary" onClick={() => setStartOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> New
        </Button>
      ) : undefined}
    >
      <div className="grid min-w-0 gap-3 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-3 rounded-2xl border border-border/50 bg-card p-2 shadow-card">
            <p className="px-2 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Library</p>
            <div className="space-y-0.5">
              {filters.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => id === "secure" ? openSecure() : setFilter(id)}
                  className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm font-medium transition ${filter === id ? "bg-primary/10 text-primary" : "text-foreground/80 hover:bg-muted/60 hover:text-foreground"}`}
                >
                  <Icon className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 truncate">{label}</span>
                </button>
              ))}
            </div>

            {!!noteCategoryOptions(notesApi.prefs).length && (
              <>
                <p className="px-2 pb-1.5 pt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Categories</p>
                <div className="space-y-0.5">
                  {noteCategoryOptions(notesApi.prefs).map((category) => (
                    <button key={category.id} type="button" onClick={() => setFilter(`category:${category.id}`)} className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition ${filter === `category:${category.id}` ? "bg-primary/10 text-primary" : "text-foreground/75 hover:bg-muted/60"}`}>
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: category.swatch }} /><span className="truncate">{category.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            <p className="px-2 pb-1.5 pt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Folders</p>
            <div className="space-y-0.5">
              {notesApi.folders.map((folder) => (
                <button key={folder.id} type="button" onClick={() => setFilter(`folder:${folder.id}`)} className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition ${filter === `folder:${folder.id}` ? "bg-primary/10 text-primary" : "text-foreground/75 hover:bg-muted/60"}`}>
                  <Folder className="h-4 w-4 shrink-0" /><span className="truncate">{folder.emoji ? `${folder.emoji} ` : ""}{folder.name}</span>
                </button>
              ))}
            </div>
            {canEdit && (
              <form className="mt-2 flex gap-1" onSubmit={(event) => { event.preventDefault(); if (!newFolder.trim()) return; notesApi.addFolder(newFolder.trim()); setNewFolder(""); }}>
                <Input value={newFolder} onChange={(event) => setNewFolder(event.target.value)} placeholder="New folder" className="h-8 min-w-0 rounded-lg px-2 text-xs" />
                <Button type="submit" size="icon" variant="ghost" className="h-8 w-8 shrink-0 rounded-lg"><FolderPlus className="h-4 w-4" /></Button>
              </form>
            )}
          </div>
        </aside>

        <main className="min-w-0">
          <div className="sticky top-[3.35rem] z-20 -mx-1 mb-3 space-y-2 rounded-2xl border border-border/45 bg-background/90 p-2 shadow-soft backdrop-blur-xl sm:static sm:mx-0">
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notes" className="h-10 rounded-xl border-border/60 bg-card pl-9 shadow-none" />
              </div>
              {canEdit && <Button size="icon" className="h-10 w-10 shrink-0 rounded-xl bg-gradient-primary lg:hidden" onClick={() => setStartOpen(true)}><Plus className="h-4 w-4" /></Button>}
            </div>
            <div className="flex gap-1 overflow-x-auto pb-0.5 lg:hidden">
              {filters.slice(0, 6).map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" onClick={() => id === "secure" ? openSecure() : setFilter(id)} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${filter === id ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}>
                  <Icon className="h-3.5 w-3.5" />{label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-2 flex items-end justify-between gap-2 px-1">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{currentLabel}</p>
              <h2 className="font-display text-xl font-bold">{visibleNotes.length} {visibleNotes.length === 1 ? "note" : "notes"}</h2>
            </div>
            {filter.startsWith("folder:") && isOwnScope && (
              <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => { const folder = notesApi.folders.find((item) => item.id === filter.slice(7)); if (folder) setShareTarget({ type: "folder", folder }); }}>
                <Share2 className="mr-1 h-4 w-4" /> Share
              </Button>
            )}
          </div>

          {filter === "secure" && !vault.unlocked ? (
            <div className="rounded-2xl border border-border/50 bg-card px-6 py-12 text-center shadow-card">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Lock className="h-5 w-5" /></div>
              <h3 className="font-display text-lg font-bold">Secure notes are locked</h3>
              <p className="mt-1 text-sm text-muted-foreground">Unlock them to continue.</p>
              <Button className="mt-4 rounded-xl bg-gradient-primary" onClick={() => setVaultOpen(true)}>Unlock</Button>
            </div>
          ) : visibleNotes.length === 0 ? (
            <button type="button" onClick={() => canEdit && setStartOpen(true)} className="w-full rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center shadow-soft transition hover:border-primary/40">
              <StickyNote className="mx-auto mb-3 h-6 w-6 text-primary" />
              <span className="block font-display text-lg font-bold">Nothing here yet</span>
              <span className="mt-1 block text-sm text-muted-foreground">Create a note, list, drawing or diagram.</span>
            </button>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-card">
              {visibleNotes.map((note, index) => {
                const swatch = noteSwatch(note, index, visibleNotes.length, notesApi.prefs.colorMode ?? "note", notesApi.folders, notesApi.prefs.shadeHue ?? "#f59e0b");
                const category = noteCategoryOptions(notesApi.prefs).find((item) => item.id === note.category);
                return (
                  <button
                    key={`${note.ownerId}-${note.id}`}
                    type="button"
                    onClick={() => openNote(note, note.kind)}
                    className="group relative flex w-full min-w-0 items-start gap-3 border-b border-border/35 px-3 py-3.5 text-left transition last:border-b-0 hover:bg-muted/35 sm:px-4"
                  >
                    <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full" style={{ background: swatch }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        {note.pinned && <Pin className="h-3.5 w-3.5 shrink-0 fill-current text-primary" />}
                        <h3 className="min-w-0 truncate font-display text-sm font-bold sm:text-base">{note.title || "Untitled"}</h3>
                        {note.locked && <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">{preview(note)}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                        {note.dueDate && <span className="rounded-md bg-muted px-1.5 py-0.5">Due {format(parseISO(`${note.dueDate.slice(0, 10)}T12:00:00`), "d MMM")}</span>}
                        {category && <span className="flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5"><Tag className="h-2.5 w-2.5" />{category.label}</span>}
                        {note.folderId && <span className="rounded-md bg-muted px-1.5 py-0.5">{notesApi.folders.find((folder) => folder.id === note.folderId)?.name || "Folder"}</span>}
                      </div>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/45 transition group-hover:translate-x-0.5" />
                  </button>
                );
              })}
            </div>
          )}
        </main>
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

      <NoteStartDialog open={startOpen} onOpenChange={setStartOpen} onPick={(choice) => openNote(null, choice.kind, choice.diagram ?? null, choice.title ?? "")} />

      <ShareNoteDialog
        open={!!shareTarget}
        onOpenChange={(open) => !open && setShareTarget(null)}
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
    </FeaturePageShell>
  );
}
