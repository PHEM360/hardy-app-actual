import { useNavigate } from "react-router-dom";
import { StickyNote, ChevronRight, Pin } from "lucide-react";
import { useNotes } from "@/hooks/useNotes";
import { WIDGET_ACCENT, accentGradient } from "@/lib/widgetAccents";

export function NotesWidget() {
  const navigate = useNavigate();
  const { notes, loading } = useNotes();
  const accent = WIDGET_ACCENT.notes;
  const open = notes.filter((n) => !n.archived);
  const pinned = open.filter((n) => n.pinned);
  const top = (pinned.length ? pinned : open).slice(0, 4);

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
