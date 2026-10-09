import { CheckSquare, GitBranch, Home, Lock, PenLine, Pin } from "lucide-react";
import type { HubNote, NotesListStyle } from "@/types/notes";
import { NOTE_CATEGORIES, noteCategoryOptions, type NotesPrefs } from "@/types/notes";
import { DiagramCanvas } from "@/components/notes/NoteDiagram";
import { noteChecklistItems } from "@/lib/noteChecklist";
import { JEWEL_CYCLE, jewelGradient } from "@/lib/brandPalette";
import { format, parseISO } from "date-fns";

function headerTone(swatch: string | undefined, index: number) {
  if (!swatch) return jewelGradient(JEWEL_CYCLE[index % JEWEL_CYCLE.length]);
  return `linear-gradient(158deg, color-mix(in srgb, ${swatch} 38%, #1A1814), color-mix(in srgb, ${swatch} 22%, #2A2110))`;
}

export function NoteCard({
  note,
  style,
  listStyle,
  onOpen,
  onToggleItem,
  canEdit,
  featured,
  prefs,
  index = 0,
}: {
  note: HubNote;
  style?: React.CSSProperties;
  listStyle: NotesListStyle;
  onOpen: () => void;
  onToggleItem?: (itemId: string, done: boolean) => void;
  canEdit?: boolean;
  featured?: boolean;
  prefs?: Pick<NotesPrefs, "customCategories" | "hiddenCategoryIds">;
  index?: number;
}) {
  const compact = listStyle === "compact";
  const filled = listStyle === "filled";
  const items = noteChecklistItems(note).filter((i) => i.text.trim());
  const done = items.filter((i) => i.done).length;
  const cat = noteCategoryOptions(prefs).find((c) => c.id === note.category) ?? NOTE_CATEGORIES.find((c) => c.id === note.category);
  const drawing = note.canvas?.blocks.find((block) => block.type === "drawing");
  const image = note.canvas?.blocks.find((block) => block.type === "media" && block.mediaType === "image");
  const diagram = note.diagram?.nodes?.length
    ? note.diagram
    : note.canvas?.blocks.find((block) => block.type === "diagram" && (block.diagram?.nodes.length ?? 0) > 0)?.diagram;
  const swatch = typeof style?.backgroundColor === "string" ? style.backgroundColor : undefined;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full overflow-hidden rounded-xl border border-foreground/20 bg-card text-left shadow-card ${compact ? "" : ""}`}
    >
      <div className="band px-3 py-2 text-white" style={{ background: headerTone(swatch, index) }}>
        <div className="flex items-center gap-1.5">
          {note.pinned && <Pin className="h-3.5 w-3.5 fill-current" />}
          {featured && <Home className="h-3.5 w-3.5" />}
          {note.locked && <Lock className="h-3.5 w-3.5" />}
          {items.length > 0 && <CheckSquare className="h-3.5 w-3.5" />}
          {diagram?.nodes?.length ? <GitBranch className="h-3.5 w-3.5" /> : null}
          {note.kind === "drawing" && <PenLine className="h-3.5 w-3.5" />}
          <p className={`min-w-0 flex-1 truncate font-display font-semibold ${compact ? "text-sm" : "text-base"}`}>
            {note.locked ? "Locked note" : note.title || "Untitled"}
          </p>
          {cat && (
            <span className="rounded-md bg-white/15 px-1.5 py-px text-[10px] font-bold uppercase tracking-[0.12em]">
              {cat.label}
            </span>
          )}
        </div>
      </div>
      <div className={compact ? "p-2.5" : "p-3.5"} style={filled ? { backgroundColor: swatch } : undefined}>
        {!note.locked && note.body && (
          <p className={`whitespace-pre-wrap leading-relaxed text-foreground/80 ${compact ? "line-clamp-3 text-[11px]" : "line-clamp-6 text-[13px]"}`}>
            {note.body}
          </p>
        )}
        {!note.locked && image?.type === "media" && (
          <img src={image.url} alt="" className="mt-3 h-32 w-full rounded-lg object-cover" />
        )}
        {!note.locked && !image && drawing?.type === "drawing" && drawing.paths.length > 0 && (
          <svg viewBox={`0 0 ${drawing.width} ${drawing.height}`} className="mt-3 h-28 w-full rounded-lg bg-card">
            {drawing.paths.map((path, pathIndex) => (
              <path key={pathIndex} d={path} fill="none" stroke={drawing.stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </svg>
        )}
        {!note.locked && items.length > 0 && (
          <div className="mt-3 space-y-1.5" onClick={(e) => e.stopPropagation()}>
            <div className="h-1.5 overflow-hidden rounded-full bg-foreground/15">
              <div className="h-full rounded-full bg-[#1F6B4F]" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
            </div>
            {items.slice(0, compact ? 3 : 6).map((item) => (
              <label key={item.id} className="flex items-start gap-2 text-[13px]">
                <input
                  type="checkbox"
                  className="mt-0.5 h-3.5 w-3.5 accent-[#1F6B4F]"
                  checked={item.done}
                  disabled={!canEdit}
                  onChange={(e) => onToggleItem?.(item.id, e.target.checked)}
                />
                <span className={item.done ? "text-foreground/50 line-through" : ""}>{item.text}</span>
              </label>
            ))}
            {items.length > (compact ? 3 : 6) && (
              <p className="text-[11px] text-foreground/60">+{items.length - (compact ? 3 : 6)} more</p>
            )}
          </div>
        )}
        {!note.locked && diagram?.nodes?.length ? (
          <div className="mt-3 overflow-hidden rounded-lg border border-foreground/15">
            <DiagramCanvas diagram={diagram} className="h-24 w-full" />
          </div>
        ) : null}
        {note.dueDate && (
          <p className="mt-3 inline-flex rounded-md bg-foreground/10 px-2 py-0.5 text-[11px] font-semibold">
            {format(parseISO(`${note.dueDate.slice(0, 10)}T12:00:00`), "d MMM")}
          </p>
        )}
        {featured && (
          <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/60">On the dashboard</p>
        )}
      </div>
    </button>
  );
}
