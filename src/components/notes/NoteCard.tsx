import { CheckSquare, GitBranch, Home, Lock, PenLine, Pin } from "lucide-react";
import type { HubNote, NotesListStyle } from "@/types/notes";
import { NOTE_CATEGORIES } from "@/types/notes";
import { DiagramCanvas } from "@/components/notes/NoteDiagram";
import { format, parseISO } from "date-fns";

export function NoteCard({
  note,
  style,
  listStyle,
  onOpen,
  onToggleItem,
  canEdit,
  featured,
}: {
  note: HubNote;
  style?: React.CSSProperties;
  listStyle: NotesListStyle;
  onOpen: () => void;
  onToggleItem?: (itemId: string, done: boolean) => void;
  canEdit?: boolean;
  featured?: boolean;
}) {
  const filled = listStyle === "filled";
  const compact = listStyle === "compact";
  const paper = listStyle === "paper";
  const items = (note.checklist ?? []).filter((i) => i.text.trim());
  const done = items.filter((i) => i.done).length;
  const cat = NOTE_CATEGORIES.find((c) => c.id === note.category);
  const drawing = note.canvas?.blocks.find((block) => block.type === "drawing");
  const image = note.canvas?.blocks.find((block) => block.type === "media" && block.mediaType === "image");

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full text-left border-0 shadow-card transition duration-200 hover:-translate-y-1 hover:shadow-elevated ${
        compact ? "p-2.5 rounded-xl" : "p-4 rounded-[1.35rem]"
      } ${paper ? "rounded-md font-serif" : ""}`}
      style={style}
    >
      <div className={`mb-2 flex items-center gap-1.5 ${filled ? "text-stone-700/70" : "text-foreground/55"}`}>
        {note.pinned && <Pin className="h-3.5 w-3.5 fill-current" />}
        {featured && <Home className="h-3.5 w-3.5" />}
        {note.locked && <Lock className="h-3.5 w-3.5" />}
        {items.length > 0 && <CheckSquare className="h-3.5 w-3.5" />}
        {note.diagram?.nodes?.length ? <GitBranch className="h-3.5 w-3.5" /> : null}
        {note.kind === "drawing" && <PenLine className="h-3.5 w-3.5" />}
        <span className="ml-auto flex items-center gap-1">
          {featured && (
            <span className="rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
              Dashboard
            </span>
          )}
          {cat && (
            <span className="rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
              {cat.label}
            </span>
          )}
        </span>
      </div>
      <p className={`font-display font-bold leading-snug ${compact ? "text-sm" : "text-base"}`}>
        {note.locked ? "Locked note" : note.title || "Untitled"}
      </p>
      {!note.locked && note.body && (
        <p className={`mt-1.5 whitespace-pre-wrap leading-relaxed ${compact ? "line-clamp-3 text-[11px]" : "line-clamp-6 text-[13px]"} ${filled ? "text-stone-800/85" : "text-foreground/75"}`}>
          {note.body}
        </p>
      )}
      {!note.locked && image?.type === "media" && (
        <img src={image.url} alt="" className="mt-3 h-32 w-full rounded-xl object-cover" />
      )}
      {!note.locked && !image && drawing?.type === "drawing" && drawing.paths.length > 0 && (
        <svg viewBox={`0 0 ${drawing.width} ${drawing.height}`} className="mt-3 h-28 w-full rounded-xl bg-white/75">
          {drawing.paths.map((path, index) => (
            <path key={index} d={path} fill="none" stroke={drawing.stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </svg>
      )}
      {!note.locked && items.length > 0 && (
        <div className="mt-3 space-y-1.5" onClick={(e) => e.stopPropagation()}>
          <div className="h-1.5 overflow-hidden rounded-full bg-black/15">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
          </div>
          {items.slice(0, compact ? 3 : 6).map((item) => (
            <label key={item.id} className="flex items-start gap-2 text-[13px]">
              <input
                type="checkbox"
                className="mt-0.5 h-3.5 w-3.5 accent-emerald-600"
                checked={item.done}
                disabled={!canEdit}
                onChange={(e) => onToggleItem?.(item.id, e.target.checked)}
              />
              <span className={item.done ? "line-through opacity-55" : ""}>{item.text}</span>
            </label>
          ))}
          {items.length > (compact ? 3 : 6) && (
            <p className="text-[11px] opacity-60">+{items.length - (compact ? 3 : 6)} more</p>
          )}
        </div>
      )}
      {!note.locked && note.diagram?.nodes?.length ? (
        <div className="mt-3 overflow-hidden rounded-xl bg-black/5">
          <DiagramCanvas diagram={note.diagram} className="h-24 w-full" />
        </div>
      ) : null}
      {note.dueDate && (
        <p className={`mt-3 inline-flex rounded-full bg-black/10 px-2 py-0.5 text-[11px] font-semibold ${filled ? "text-stone-800" : "text-foreground/70"}`}>
          {format(parseISO(`${note.dueDate.slice(0, 10)}T12:00:00`), "d MMM")}
        </p>
      )}
    </button>
  );
}
