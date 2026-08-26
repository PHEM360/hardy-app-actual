import { useNavigate } from "react-router-dom";
import { StickyNote, ChevronRight, Pin, CheckSquare } from "lucide-react";
import { useNotes } from "@/hooks/useNotes";
import { WIDGET_ACCENT, accentGradient } from "@/lib/widgetAccents";
import { NOTE_COLORS } from "@/types/notes";
import type { HubNote } from "@/types/notes";

function featuredNote(notes: HubNote[], dashboardNoteId: string | null): HubNote | null {
  if (!dashboardNoteId) return null;
  const note = notes.find((n) => n.id === dashboardNoteId);
  if (!note || note.archived || note.locked || note.vault) return null;
  return note;
}

function notePaper(note: HubNote): string {
  const found = NOTE_COLORS.find((c) => c.id === note.color);
  const swatch = found && note.color !== "default" ? found.swatch : "#fde68a";
  return `color-mix(in srgb, ${swatch} 22%, hsl(var(--card)))`;
}

function noteAccent(note: HubNote): string {
  const found = NOTE_COLORS.find((c) => c.id === note.color);
  return found && note.color !== "default" ? found.swatch : WIDGET_ACCENT.notes;
}

export function NotesWidget() {
  const navigate = useNavigate();
  const { notes, loading, prefs } = useNotes();
  const accent = WIDGET_ACCENT.notes;
  const featured = featuredNote(notes, prefs.dashboardNoteId);
  const open = notes.filter((n) => !n.archived);
  const pinned = open.filter((n) => n.pinned);
  const top = (pinned.length ? pinned : open).slice(0, 4);

  if (featured) {
    const items = (featured.checklist ?? []).filter((item) => item.text.trim());
    const paper = notePaper(featured);
    const bar = noteAccent(featured);
    return (
      <button
        type="button"
        data-testid="dashboard-note"
        className="group flex h-full w-full flex-col overflow-hidden text-left"
        style={{
          background: paper,
          borderLeft: `4px solid ${bar}`,
        }}
        onClick={() => navigate(`/notes?note=${encodeURIComponent(featured.id)}`)}
      >
        <div className="flex flex-shrink-0 items-center gap-2 px-3 py-2">
          <span
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-white"
            style={{ background: bar }}
          >
            <StickyNote className="h-3.5 w-3.5" />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/70">Dashboard note</span>
          <ChevronRight className="ml-auto h-3 w-3 text-foreground/35 transition-all group-hover:translate-x-0.5 group-hover:text-foreground/70" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          <p className="font-display text-base font-bold leading-snug">{featured.title || "Untitled"}</p>
          {featured.body ? (
            <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/80">
              {featured.body}
            </p>
          ) : null}
          {items.length > 0 && (
            <ul className="mt-2 space-y-1">
              {items.slice(0, 8).map((item) => (
                <li key={item.id} className="flex items-start gap-2 text-[13px]">
                  <CheckSquare className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${item.done ? "text-emerald-600" : "text-foreground/45"}`} />
                  <span className={item.done ? "line-through opacity-55" : ""}>{item.text}</span>
                </li>
              ))}
              {items.length > 8 && (
                <li className="text-[11px] opacity-60">+{items.length - 8} more</li>
              )}
            </ul>
          )}
        </div>
      </button>
    );
  }

  return (
    <button
      className="group flex h-full w-full flex-col overflow-y-auto p-3 pb-3.5 text-left"
      onClick={() => navigate("/notes")}
    >
      <div
        className="-mx-3 -mt-3 mb-2.5 flex flex-shrink-0 items-center gap-2 px-3 py-2.5"
        style={{ background: accentGradient(accent) }}
      >
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-white/20 text-white">
          <StickyNote className="h-3.5 w-3.5" />
        </span>
        <span className="text-[11px] font-bold uppercase tracking-wider text-white">Notes</span>
        <ChevronRight className="ml-auto h-3 w-3 text-white/50 transition-all group-hover:translate-x-0.5 group-hover:text-white/80" />
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : top.length === 0 ? (
        <p className="text-xs text-muted-foreground">No notes yet — tap to add one.</p>
      ) : (
        <ul className="space-y-1.5">
          {top.map((n) => (
            <li key={n.id} className="flex items-start gap-1.5 text-xs">
              {n.pinned && <Pin className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />}
              <span className="line-clamp-2 font-medium">{n.locked ? "Locked note" : n.title || "Untitled"}</span>
            </li>
          ))}
        </ul>
      )}
    </button>
  );
}
