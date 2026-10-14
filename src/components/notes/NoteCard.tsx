import { CalendarDays, Check, CheckSquare, GitBranch, Home, Lock, PenLine, Pin, StickyNote } from "lucide-react";
import type { HubNote, NotesListStyle } from "@/types/notes";
import { NOTE_CATEGORIES, noteCategoryOptions, type NotesPrefs } from "@/types/notes";
import { DiagramCanvas } from "@/components/notes/NoteDiagram";
import { noteChecklistItems } from "@/lib/noteChecklist";
import { noteAccent } from "@/lib/noteStyle";
import { BRASS, STATUS_COLOR } from "@/lib/brandPalette";
import { format, parseISO } from "date-fns";

/** How a dated note stands today. Finished lists are never shown as late. */
export function noteDueTone(dueDate: string, finished: boolean): { background: string; color: string; label: string } {
  const due = parseISO(`${dueDate.slice(0, 10)}T12:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  const label = format(due, "EEE d MMM");
  if (finished) return { background: STATUS_COLOR.good, color: "#fff", label };
  if (days < 0) return { background: STATUS_COLOR.bad, color: "#fff", label: `${label}, overdue` };
  if (days <= 3) return { background: STATUS_COLOR.warn, color: STATUS_COLOR.warnText, label };
  return { background: "#3B4759", color: "#fff", label };
}

/** The note text without its first line when that line is already shown as the title. */
function cardText(note: HubNote) {
  const body = (note.body || "").trim();
  const firstLine = body.split("\n")[0] || "";
  const title = (note.title || "").trim() || (firstLine.length <= 60 ? firstLine : "");
  if (!title || !body.startsWith(title)) return { title, body };
  return { title, body: body.slice(title.length).trim() };
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
  accent: accentProp,
}: {
  note: HubNote;
  /** The deep tone for the spine and icon chip. Worked out from `style` when not given. */
  accent?: string;
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
  const finished = items.length > 0 && done === items.length;
  const cat = noteCategoryOptions(prefs).find((c) => c.id === note.category) ?? NOTE_CATEGORIES.find((c) => c.id === note.category);
  const drawing = note.canvas?.blocks.find((block) => block.type === "drawing");
  const image = note.canvas?.blocks.find((block) => block.type === "media" && block.mediaType === "image");
  const diagram = note.diagram?.nodes?.length
    ? note.diagram
    : note.canvas?.blocks.find((block) => block.type === "diagram" && (block.diagram?.nodes.length ?? 0) > 0)?.diagram;
  const swatch = typeof style?.backgroundColor === "string" ? style.backgroundColor : undefined;
  const accent = accentProp ?? noteAccent(swatch, index);
  const KindIcon = note.locked ? Lock : diagram?.nodes?.length ? GitBranch : note.kind === "drawing" ? PenLine : items.length > 0 ? CheckSquare : StickyNote;
  const kindLabel = note.locked ? "Locked" : diagram?.nodes?.length ? "Diagram" : note.kind === "drawing" ? "Sketch" : items.length > 0 ? "List" : "Note";
  const shown = compact ? 3 : 5;
  const { title, body } = cardText(note);
  const due = note.dueDate ? noteDueTone(note.dueDate, finished) : null;
  const soft = filled ? "text-white/80" : "text-foreground/70";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      aria-label={`Open ${note.locked ? "locked note" : title || "untitled note"}`}
      className={`relative w-full cursor-pointer overflow-hidden rounded-xl border border-foreground/20 text-left shadow-card outline-none transition-transform duration-150 focus-visible:ring-4 focus-visible:ring-ring/30 active:translate-y-px active:brightness-95 ${
        filled ? "btn-edge text-white" : "bg-card text-foreground"
      }`}
      style={filled ? { background: accent } : undefined}
    >
      {!filled && <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: accent }} aria-hidden />}
      <div className={`${filled ? "" : "pl-1.5"}`}>
        <div className={`flex items-start gap-2.5 ${compact ? "p-2.5" : "p-3"}`}>
          <span
            className={`btn-edge flex shrink-0 items-center justify-center rounded-md text-white ${compact ? "h-8 w-8" : "h-9 w-9"}`}
            style={{ background: filled ? "rgb(0 0 0 / 0.28)" : accent }}
          >
            <KindIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className={`line-clamp-2 font-display font-semibold leading-snug ${compact ? "text-sm" : "text-[15px]"}`}>
              {note.locked ? "Locked note" : title || "Untitled"}
            </p>
            <p className={`mt-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] ${soft}`}>
              {note.pinned && <Pin className="h-3 w-3 shrink-0 fill-current" style={{ color: filled ? "#fff" : BRASS }} aria-label="Pinned" />}
              <span className="truncate">{cat ? cat.label : kindLabel}</span>
            </p>
          </div>
        </div>

        {!note.locked && (body || image || drawing || items.length > 0 || diagram?.nodes?.length) ? (
          <div className={`space-y-2.5 ${compact ? "px-2.5 pb-2.5" : "px-3 pb-3"}`}>
            {body && items.length === 0 && (
              <p className={`whitespace-pre-wrap leading-relaxed ${filled ? "text-white/90" : "text-foreground/85"} ${compact ? "line-clamp-3 text-xs" : "line-clamp-5 text-[13px]"}`}>
                {body}
              </p>
            )}
            {image?.type === "media" && (
              <img src={image.url} alt="" className="h-32 w-full rounded-lg object-cover" />
            )}
            {!image && drawing?.type === "drawing" && drawing.paths.length > 0 && (
              <svg viewBox={`0 0 ${drawing.width} ${drawing.height}`} className="h-28 w-full rounded-lg border border-foreground/15 bg-[#fffdf8]">
                {drawing.paths.map((path, pathIndex) => (
                  <path key={pathIndex} d={path} fill="none" stroke={drawing.stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                ))}
              </svg>
            )}
            {items.length > 0 && (
              <div>
                <div className="mb-1.5 flex items-center gap-2">
                  <div className={`h-1.5 flex-1 overflow-hidden rounded-full ${filled ? "bg-white/25" : "bg-foreground/15"}`}>
                    <div
                      className="h-full rounded-full transition-[width] duration-200"
                      style={{ width: `${(done / items.length) * 100}%`, background: filled ? "#fff" : STATUS_COLOR.good }}
                    />
                  </div>
                  <span className={`text-[11px] font-bold tabular-nums ${soft}`}>{done} of {items.length}</span>
                </div>
                {items.slice(0, shown).map((item) => (
                  <div key={item.id} className="flex min-h-9 items-center gap-1 text-[13px]">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={item.done}
                      aria-label={`Tick ${item.text}`}
                      disabled={!canEdit}
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleItem?.(item.id, !item.done);
                      }}
                      className="-ml-2 flex h-9 w-9 shrink-0 items-center justify-center disabled:cursor-default"
                    >
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition-colors duration-150 ${
                          item.done ? "border-transparent text-white" : filled ? "border-white/70" : "border-foreground/45 bg-card"
                        }`}
                        style={item.done ? { background: filled ? "rgb(0 0 0 / 0.35)" : STATUS_COLOR.good } : undefined}
                      >
                        {item.done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                      </span>
                    </button>
                    <span className={`min-w-0 flex-1 leading-snug ${item.done ? `line-through ${filled ? "text-white/60" : "text-foreground/55"}` : ""}`}>{item.text}</span>
                  </div>
                ))}
                {items.length > shown && (
                  <p className={`mt-1 text-[11px] font-semibold ${soft}`}>and {items.length - shown} more</p>
                )}
              </div>
            )}
            {diagram?.nodes?.length ? (
              <div className="overflow-hidden rounded-lg border border-foreground/15 bg-[#fffdf8]">
                <DiagramCanvas diagram={diagram} className="h-24 w-full" />
              </div>
            ) : null}
          </div>
        ) : null}

        {(due || featured) && (
          <div className={`flex flex-wrap items-center gap-1.5 ${compact ? "px-2.5 pb-2.5" : "px-3 pb-3"}`}>
            {due && (
              <span className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold" style={{ background: due.background, color: due.color }}>
                <CalendarDays className="h-3 w-3" /> {due.label}
              </span>
            )}
            {featured && (
              <span className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold ${filled ? "border-white/50" : "border-foreground/25"}`}>
                <Home className="h-3 w-3" /> On home
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
