import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Pencil, Check, RotateCcw, Trash2, Palette, Plus, X } from "lucide-react";
import { format } from "date-fns";
import { Rnd } from "react-rnd";

import {
  useTodayLayout,
  TODAY_WIDGET_LABELS,
  TODAY_WIDGET_ICONS,
  TODAY_TINT_PRESETS,
  PAGE_TINT_PRESETS,
  REPEATABLE_WIDGET_TYPES,
} from "@/hooks/useTodayLayout";
import type { TodayWidgetItem, TodayWidgetType } from "@/hooks/useTodayLayout";
import { HEADER_COLOR_PRESETS } from "@/lib/chromeScenes";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { TdAiWidget }          from "@/components/widgets/today/TdAiWidget";
import { TdFocusWidget }       from "@/components/widgets/today/TdFocusWidget";
import { TdTasksWidget }       from "@/components/widgets/today/TdTasksWidget";
import { TdIntentionsWidget }  from "@/components/widgets/today/TdIntentionsWidget";
import { TdHabitsWidget }      from "@/components/widgets/today/TdHabitsWidget";
import { TdWaterWidget }       from "@/components/widgets/today/TdWaterWidget";
import { TdMoodWidget }        from "@/components/widgets/today/TdMoodWidget";
import { TdNoteWidget }        from "@/components/widgets/today/TdNoteWidget";
import { TdChecklistWidget }   from "@/components/widgets/today/TdChecklistWidget";
import { TdReflectionWidget }  from "@/components/widgets/today/TdReflectionWidget";
import { TdCalendarWidget }    from "@/components/widgets/today/TdCalendarWidget";
import { TdBirthdaysWidget }   from "@/components/widgets/today/TdBirthdaysWidget";
import { TdTomorrowWidget }    from "@/components/widgets/today/TdTomorrowWidget";
import { TdOverdueWidget }     from "@/components/widgets/today/TdOverdueWidget";
import { TdQuickAddWidget }    from "@/components/widgets/today/TdQuickAddWidget";
import { TdRemindersWidget }   from "@/components/widgets/today/TdRemindersWidget";
import { TdPhotosWidget }      from "@/components/widgets/today/TdPhotosWidget";
import { TdWeatherWidget }     from "@/components/widgets/today/TdWeatherWidget";
import { TdBillsWidget }       from "@/components/widgets/today/TdBillsWidget";
import { TdFunFactWidget }     from "@/components/widgets/today/TdFunFactWidget";
import { TdPetsCareWidget }    from "@/components/widgets/today/TdPetsCareWidget";
import { TdWeekWidget }        from "@/components/widgets/today/TdWeekWidget";
import { TdQuickLinksWidget }  from "@/components/widgets/today/TdQuickLinksWidget";
import { TdClockWidget }       from "@/components/widgets/today/TdClockWidget";
import { FamilyMessageBoardWidget } from "@/components/widgets/FamilyMessageBoardWidget";

// ─── Widget content ────────────────────────────────────────────────────────────

function WidgetContent({
  item,
  onUpdate,
}: {
  item: TodayWidgetItem;
  onUpdate: (patch: Partial<TodayWidgetItem>) => void;
}) {
  switch (item.type) {
    case "ai":         return <TdAiWidget />;
    case "focus":      return <TdFocusWidget />;
    case "tasks":      return <TdTasksWidget />;
    case "intentions": return <TdIntentionsWidget />;
    case "habits":     return <TdHabitsWidget />;
    case "water":      return <TdWaterWidget />;
    case "mood":       return <TdMoodWidget />;
    case "note":       return <TdNoteWidget />;
    case "checklist":  return <TdChecklistWidget />;
    case "reflection": return <TdReflectionWidget />;
    case "calendar":   return <TdCalendarWidget />;
    case "birthdays":  return <TdBirthdaysWidget />;
    case "tomorrow":   return <TdTomorrowWidget />;
    case "overdue":    return <TdOverdueWidget />;
    case "quick_add":  return <TdQuickAddWidget />;
    case "reminders":  return <TdRemindersWidget />;
    case "messages":   return <FamilyMessageBoardWidget />;
    case "photos":     return <TdPhotosWidget />;
    case "weather":    return <TdWeatherWidget />;
    case "bills":      return <TdBillsWidget />;
    case "fun_fact":   return <TdFunFactWidget />;
    case "pets_care":  return <TdPetsCareWidget />;
    case "week":       return <TdWeekWidget />;
    case "quicklinks": return <TdQuickLinksWidget config={item.config} onConfigChange={(config: Record<string, unknown>) => onUpdate({ config })} />;
    case "clock":      return <TdClockWidget config={item.config} onConfigChange={(config: Record<string, unknown>) => onUpdate({ config })} />;
    default:           return null;
  }
}

// ─── Widget shell — fully freeform position/size, no grid snap — but two
// widgets are never allowed to overlap: a drag/resize that would overlap
// another widget is rejected and the tile springs back to its last valid spot.

const MIN_H      = 100;
const MIN_W_FRAC = 0.28;
const GAP        = 18;
const PADDING    = 16;

interface Rect { x: number; y: number; w: number; h: number }

/** A small overlap tolerance so tiles sharing an edge don't count as colliding. */
function rectsOverlap(a: Rect, b: Rect, epsilon = 2): boolean {
  return (
    a.x < b.x + b.w - epsilon &&
    a.x + a.w > b.x + epsilon &&
    a.y < b.y + b.h - epsilon &&
    a.y + a.h > b.y + epsilon
  );
}

function overlapsAny(rect: Rect, others: Rect[]): boolean {
  return others.some((o) => rectsOverlap(rect, o));
}

function TodayWidgetShell({
  item,
  containerWidth,
  editMode,
  onUpdate,
  onRemove,
  otherRects,
  children,
}: {
  item: TodayWidgetItem;
  containerWidth: number;
  editMode: boolean;
  onUpdate: (id: string, patch: Partial<TodayWidgetItem>) => void;
  onRemove: (id: string) => void;
  otherRects: Rect[];
  children: React.ReactNode;
}) {
  const x = item.xFrac * containerWidth;
  const w = item.wFrac * containerWidth;
  const [showPalette, setShowPalette] = useState(false);
  // react-rnd mutates the tile's DOM size/position directly during a live drag or
  // resize. If we reject the result (would overlap) without ever changing props,
  // there's nothing to make it re-derive from position/size — so it visually stays
  // wherever the gesture left it. Bumping this key forces a clean remount, which
  // re-renders the tile from item's real (rejected) position/size, snapping it back.
  const [resetNonce, setResetNonce] = useState(0);

  return (
    <Rnd
      key={resetNonce}
      position={{ x, y: item.y }}
      size={{ width: w, height: item.h }}
      dragHandleClassName="td-drag-handle"
      disableDragging={!editMode}
      enableResizing={editMode ? { bottom: true, bottomRight: true, right: true, bottomLeft: true, left: false, top: false, topRight: false, topLeft: false } : false}
      bounds="parent"
      minWidth={Math.max(120, containerWidth * MIN_W_FRAC)}
      minHeight={MIN_H}
      onDragStop={(_e, d) => {
        const nextX = Math.max(0, Math.min(containerWidth - w, d.x));
        const nextY = Math.max(0, d.y);
        if (overlapsAny({ x: nextX, y: nextY, w, h: item.h }, otherRects)) {
          setResetNonce((n) => n + 1);
          return;
        }
        onUpdate(item.id, { xFrac: nextX / containerWidth, y: nextY });
      }}
      onResizeStop={(_e, _dir, ref, _delta, pos) => {
        const newW = parseFloat(ref.style.width);
        const newH = Math.max(MIN_H, parseFloat(ref.style.height));
        const nextX = Math.max(0, pos.x);
        const nextY = Math.max(0, pos.y);
        if (overlapsAny({ x: nextX, y: nextY, w: newW, h: newH }, otherRects)) {
          setResetNonce((n) => n + 1);
          return;
        }
        onUpdate(item.id, {
          xFrac: Math.max(0, Math.min(1, nextX / containerWidth)),
          y: nextY,
          wFrac: Math.max(MIN_W_FRAC, Math.min(1, newW / containerWidth)),
          h: newH,
        });
      }}
      style={{ zIndex: editMode ? 10 : 1 }}
    >
      <div
        className={`w-full h-full rounded-2xl overflow-hidden flex flex-col border shadow-card transition-all duration-200 ${
          editMode
            ? "border-amber-400/40 ring-2 ring-amber-300/20 shadow-md"
            : "border-border hover:shadow-elevated cursor-pointer"
        } ${!item.tintColor ? "bg-card" : ""}`}
        style={item.tintColor ? { backgroundColor: item.tintColor } : undefined}
      >
        {/* Edit drag handle bar */}
        {editMode && (
          <div className="td-drag-handle flex items-center justify-between px-3 py-1.5 bg-amber-50 border-b border-amber-100 cursor-grab active:cursor-grabbing select-none flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">{TODAY_WIDGET_ICONS[item.type]}</span>
              <span className="text-[10px] font-semibold text-amber-700">{TODAY_WIDGET_LABELS[item.type]}</span>
            </div>
            <div className="flex items-center gap-0.5">
              <div className="relative">
                <button
                  className="p-1 rounded-md hover:bg-amber-100 transition-colors"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); setShowPalette((v) => !v); }}
                  title="Tile colour"
                >
                  <Palette className="w-3.5 h-3.5 text-amber-600" />
                </button>
                {showPalette && (
                  <div
                    className="absolute top-7 right-0 z-50 bg-popover border border-border rounded-xl shadow-lg p-2 flex flex-wrap gap-1.5 w-[148px]"
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    {TODAY_TINT_PRESETS.map((p) => (
                      <button
                        key={p.value}
                        title={p.label}
                        onClick={(e) => { e.stopPropagation(); onUpdate(item.id, { tintColor: p.value }); setShowPalette(false); }}
                        className="w-7 h-7 rounded-lg border-2"
                        style={{ backgroundColor: p.value, borderColor: item.tintColor === p.value ? "hsl(178,62%,30%)" : "transparent" }}
                      />
                    ))}
                    <button
                      title="Default"
                      onClick={(e) => { e.stopPropagation(); onUpdate(item.id, { tintColor: undefined }); setShowPalette(false); }}
                      className="w-7 h-7 rounded-lg border-2 border-dashed border-border/60 flex items-center justify-center"
                    >
                      <X className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </div>
                )}
              </div>
              <button
                className="p-1 rounded-md hover:bg-red-100 transition-colors"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
                title="Remove widget"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </button>
            </div>
          </div>
        )}

        {/* Widget content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {children}
        </div>
      </div>
    </Rnd>
  );
}

// ─── Add widget picker ─────────────────────────────────────────────────────────

const WIDGET_CATALOG: TodayWidgetType[] = [
  "quicklinks", "clock", "tasks", "calendar", "birthdays", "weather", "note", "checklist",
  "reminders", "bills", "messages", "photos", "ai", "focus", "intentions", "habits",
  "water", "mood", "reflection", "tomorrow", "overdue", "quick_add", "fun_fact", "pets_care", "week",
];

function AddWidgetDialog({
  open,
  onOpenChange,
  addedTypes,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addedTypes: Set<TodayWidgetType>;
  onAdd: (type: TodayWidgetType) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-4 max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Add a widget</DialogTitle>
        </DialogHeader>
        <div className="grid max-h-[60vh] grid-cols-2 gap-2 overflow-y-auto pt-1">
          {WIDGET_CATALOG.map((type) => {
            const already = addedTypes.has(type) && !REPEATABLE_WIDGET_TYPES.includes(type);
            return (
              <button
                key={type}
                type="button"
                disabled={already}
                onClick={() => { onAdd(type); onOpenChange(false); }}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition ${
                  already
                    ? "cursor-not-allowed border-border/40 bg-muted/40 text-muted-foreground/60"
                    : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/5"
                }`}
              >
                <span className="text-base">{TODAY_WIDGET_ICONS[type]}</span>
                <span className="min-w-0 truncate">{TODAY_WIDGET_LABELS[type]}</span>
                {already && <span className="ml-auto text-[10px]">Added</span>}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Today page ───────────────────────────────────────────────────────────────

const Today = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const { layout, loaded, pageStyle, updateWidget, addWidget, removeWidget, resetLayout, setPageStyle } = useTodayLayout();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setContainerWidth(entries[0]?.contentRect.width ?? 0);
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const canvasHeight = layout.reduce((max, w) => Math.max(max, w.y + w.h + GAP), 100);
  const addedTypes = new Set(layout.map((w) => w.type));

  const handleUpdate = useCallback((id: string, patch: Partial<TodayWidgetItem>) => {
    updateWidget(id, patch);
  }, [updateWidget]);

  const today = new Date();

  return (
    <div className="pb-28" style={pageStyle.canvasTint ? { backgroundColor: pageStyle.canvasTint } : undefined}>
      {/* Toolbar */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/30">
        <div
          className="px-3 py-2 flex items-center justify-between"
          style={{ background: pageStyle.headerColor || "var(--gradient-primary)" }}
        >
          <div className="flex items-center gap-2">
            <Sun className="w-4 h-4 text-white/80" />
            <p className="text-sm font-bold text-white">Today</p>
          </div>
          <p className="text-[11px] text-white/70 font-medium">
            {format(today, "EEEE d MMMM")}
          </p>
        </div>
        <div className="flex items-center justify-between px-3 py-2">
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 text-xs font-semibold rounded-xl px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add widget
          </button>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1 text-xs text-muted-foreground border border-border rounded-xl px-2.5 py-1.5">
                  <Palette className="w-3.5 h-3.5" />
                  Look
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-3 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Page header</p>
                <div className="flex flex-wrap gap-1.5">
                  {HEADER_COLOR_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      title={p.label}
                      onClick={() => setPageStyle({ headerColor: p.value })}
                      className="h-7 min-w-7 px-1.5 rounded-lg border text-[9px] font-semibold text-white"
                      style={{ background: p.value || "var(--gradient-primary)" }}
                    >
                      {p.id === "theme" ? "Theme" : ""}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Page colour</p>
                <div className="flex flex-wrap gap-1.5">
                  {PAGE_TINT_PRESETS.map((p) => {
                    const active = (pageStyle.canvasTint || "") === p.value;
                    return p.value ? (
                      <button
                        key={p.label}
                        title={p.label}
                        onClick={() => setPageStyle({ canvasTint: p.value })}
                        className="w-7 h-7 rounded-lg border-2"
                        style={{ backgroundColor: p.value, borderColor: active ? "hsl(178,62%,30%)" : "transparent" }}
                      />
                    ) : (
                      <button
                        key={p.label}
                        title="Use the theme's own background"
                        onClick={() => setPageStyle({ canvasTint: "" })}
                        className="flex h-7 min-w-7 items-center justify-center rounded-lg border-2 bg-background px-1.5 text-[9px] font-semibold text-foreground"
                        style={{ borderColor: active ? "hsl(178,62%,30%)" : "hsl(var(--border))" }}
                      >
                        Theme
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground">In Edit, tint individual widgets too.</p>
              </PopoverContent>
            </Popover>
            {editMode && (
              <button
                onClick={resetLayout}
                className="flex items-center gap-1 text-xs text-muted-foreground border border-border rounded-xl px-2.5 py-1.5"
                title="Reset to starter widgets"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => setEditMode((v) => !v)}
              className={`flex items-center gap-1.5 text-xs font-medium rounded-xl px-3 py-1.5 transition-colors ${
                editMode
                  ? "bg-amber-500 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {editMode ? <><Check className="w-3.5 h-3.5" /> Done</> : <><Pencil className="w-3.5 h-3.5" /> Edit</>}
            </button>
          </div>
        </div>
      </div>

      {/* Edit mode banner */}
      <AnimatePresence>
        {editMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-3 mt-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700"
          >
            🖐️ Drag widgets anywhere · resize from the corner · colour · trash to remove.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {loaded && layout.length === 0 && (
        <div className="mx-3 mt-6 flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border/60 py-12 text-center">
          <p className="text-sm font-semibold text-foreground">Nothing here yet</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Tap "Add widget" to start building your page — tasks, calendar, quick links, a clock and more.
          </p>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 text-xs font-semibold rounded-xl px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add widget
          </button>
        </div>
      )}

      {/* Widget canvas */}
      <div
        ref={containerRef}
        className="relative"
        style={{
          height: `${canvasHeight + 32}px`,
          padding: `${GAP}px ${PADDING}px 0`,
        }}
      >
        {containerWidth > 0 && layout.map((item) => {
          const availWidth = containerWidth - PADDING * 2;
          const otherRects: Rect[] = layout
            .filter((w) => w.id !== item.id)
            .map((w) => ({ x: w.xFrac * availWidth, y: w.y, w: w.wFrac * availWidth, h: w.h }));
          return (
            <TodayWidgetShell
              key={item.id}
              item={item}
              containerWidth={availWidth}
              editMode={editMode}
              onUpdate={handleUpdate}
              onRemove={removeWidget}
              otherRects={otherRects}
            >
              <WidgetContent item={item} onUpdate={(patch) => handleUpdate(item.id, patch)} />
            </TodayWidgetShell>
          );
        })}
      </div>

      <AddWidgetDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        addedTypes={addedTypes}
        onAdd={addWidget}
      />
    </div>
  );
};

export default Today;
