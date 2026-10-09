import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, Check, RotateCcw, Trash2, Palette, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HomeViewToggle } from "@/components/home/HomeViewToggle";
import type { HomeLayoutMode } from "@/lib/homeLayout";
import { Rnd } from "react-rnd";

import {
  useTodayLayout,
  TODAY_WIDGET_LABELS,
  TODAY_WIDGET_ICONS,
  TODAY_WIDGET_COLORS,
  TODAY_TINT_PRESETS,
  PAGE_TINT_PRESETS,
  REPEATABLE_WIDGET_TYPES,
} from "@/hooks/useTodayLayout";
import type { TodayWidgetItem, TodayWidgetType } from "@/hooks/useTodayLayout";
import { HEADER_COLOR_PRESETS } from "@/lib/chromeScenes";
import { useDueEventMessages } from "@/hooks/useDueEventMessages";
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
import { TdLightsWidget }      from "@/components/widgets/today/TdLightsWidget";
import { TdUnallocatedWidget } from "@/components/widgets/today/TdUnallocatedWidget";
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
    case "lights":     return <TdLightsWidget />;
    case "unallocated": return <TdUnallocatedWidget />;
    default:           return null;
  }
}

// ─── Widget shell — fully freeform position/size, no grid snap — but two
// widgets are never allowed to overlap: a drag/resize that would overlap
// another widget is rejected and the tile springs back to its last valid spot.

const MIN_H      = 100;
const MIN_W_FRAC = 0.18;
const GAP        = 18;
const PADDING    = 0;

interface Rect { x: number; y: number; w: number; h: number }

function rectsOverlap(a: Rect, b: Rect, epsilon = 0): boolean {
  return (
    a.x < b.x + b.w - epsilon &&
    a.x + a.w > b.x + epsilon &&
    a.y < b.y + b.h - epsilon &&
    a.y + a.h > b.y + epsilon
  );
}

/** Keep a visual gap without snapping to a grid — nudge the moved tile just enough. */
function nudgeClear(rect: Rect, others: Rect[], gap: number, maxX: number): Rect {
  let next = { ...rect };
  for (let pass = 0; pass < 10; pass++) {
    let hit = false;
    for (const other of others) {
      const padded: Rect = { x: other.x - gap, y: other.y - gap, w: other.w + gap * 2, h: other.h + gap * 2 };
      if (!rectsOverlap(next, padded)) continue;
      hit = true;
      const right = padded.x + padded.w - next.x;
      const left = next.x + next.w - padded.x;
      const down = padded.y + padded.h - next.y;
      const up = next.y + next.h - padded.y;
      const min = Math.min(right, left, down, up);
      if (min === right) next = { ...next, x: next.x + right };
      else if (min === left) next = { ...next, x: next.x - left };
      else if (min === down) next = { ...next, y: next.y + down };
      else next = { ...next, y: next.y - up };
    }
    if (!hit) break;
  }
  return {
    ...next,
    x: Math.max(0, Math.min(Math.max(0, maxX - next.w), next.x)),
    y: Math.max(0, next.y),
  };
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

  return (
    <Rnd
      position={{ x, y: item.y }}
      size={{ width: w, height: item.h }}
      dragHandleClassName="td-drag-handle"
      disableDragging={!editMode}
      enableResizing={editMode ? { bottom: true, bottomRight: true, right: true, bottomLeft: true, left: false, top: false, topRight: false, topLeft: false } : false}
      bounds="parent"
      dragGrid={[1, 1]}
      resizeGrid={[1, 1]}
      minWidth={Math.max(120, containerWidth * MIN_W_FRAC)}
      minHeight={MIN_H}
      onDragStop={(_e, d) => {
        const cleared = nudgeClear(
          { x: d.x, y: d.y, w, h: item.h },
          otherRects,
          GAP,
          containerWidth,
        );
        onUpdate(item.id, { xFrac: cleared.x / containerWidth, y: cleared.y });
      }}
      onResizeStop={(_e, _dir, ref, _delta, pos) => {
        const newW = parseFloat(ref.style.width);
        const newH = Math.max(MIN_H, parseFloat(ref.style.height));
        const cleared = nudgeClear(
          { x: pos.x, y: pos.y, w: newW, h: newH },
          otherRects,
          GAP,
          containerWidth,
        );
        onUpdate(item.id, {
          xFrac: Math.max(0, Math.min(1, cleared.x / containerWidth)),
          y: cleared.y,
          wFrac: Math.max(MIN_W_FRAC, Math.min(1, cleared.w / containerWidth)),
          h: cleared.h,
        });
      }}
      style={{ zIndex: editMode ? 10 : 1 }}
    >
      <div
        className={`w-full h-full rounded-xl overflow-hidden flex flex-col border-2 shadow-card transition-shadow duration-200 ${
          editMode ? "border-[#B7791F] ring-2 ring-amber-400/40" : "border-foreground/15"
        } ${!item.tintColor ? "bg-card" : ""}`}
        style={{ ["--td-accent" as string]: TODAY_WIDGET_COLORS[item.type], ...(item.tintColor ? { backgroundColor: item.tintColor } : {}) }}
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
  "lights",
  "unallocated",
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

const Today = ({
  homeSwitch,
}: {
  homeSwitch?: { mode: HomeLayoutMode; onChange: (mode: HomeLayoutMode) => void };
} = {}) => {
  useDueEventMessages();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const { layout, loaded, pageStyle, updateWidget, addWidget, removeWidget, resetLayout, setPageStyle } = useTodayLayout();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setContainerWidth(el.clientWidth);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  const canvasHeight = layout.reduce((max, w) => Math.max(max, w.y + w.h + GAP), 100);
  const addedTypes = new Set(layout.map((w) => w.type));

  const handleUpdate = useCallback((id: string, patch: Partial<TodayWidgetItem>) => {
    updateWidget(id, patch);
  }, [updateWidget]);

  return (
    <div className="page-gutter-x min-w-0 overflow-x-hidden pb-6" style={pageStyle.canvasTint ? { backgroundColor: pageStyle.canvasTint } : undefined}>
      <div className="sticky top-0 z-20">
        <div
          className="band px-3 py-2"
          style={{ background: pageStyle.headerColor || "var(--gradient-primary)" }}
        >
          <p className="font-display text-lg font-bold text-white">Today</p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {homeSwitch && <HomeViewToggle mode={homeSwitch.mode} onChange={homeSwitch.onChange} />}
        <Button type="button" size="sm" onClick={() => setAddOpen(true)}>
          <Plus /> Add widget
        </Button>
        <Button type="button" size="sm" variant={editMode ? "gold" : "outline"} onClick={() => setEditMode((value) => !value)}>
          {editMode ? <Check /> : <Pencil />} {editMode ? "Done" : "Edit"}
        </Button>
        {editMode && (
          <Button type="button" size="sm" variant="outline" onClick={resetLayout}>
            <RotateCcw /> Reset
          </Button>
        )}
      </div>

      <AnimatePresence>
        {editMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 overflow-hidden rounded-lg border border-foreground/20 bg-card p-3 shadow-card"
          >
            <p className="text-xs font-bold text-foreground">Drag a widget to move it. Pull a corner to resize.</p>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/70">Header colour</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {HEADER_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  title={preset.label}
                  onClick={() => setPageStyle({ headerColor: preset.value })}
                  className="h-8 min-w-8 rounded-md border border-white/20 px-1.5 text-[9px] font-semibold text-white"
                  style={{ background: preset.value || "var(--gradient-primary)" }}
                >
                  {preset.id === "theme" ? "Theme" : ""}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/70">Page colour</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {PAGE_TINT_PRESETS.map((preset) => {
                const active = (pageStyle.canvasTint || "") === preset.value;
                return preset.value ? (
                  <button
                    key={preset.label}
                    type="button"
                    title={preset.label}
                    onClick={() => setPageStyle({ canvasTint: preset.value })}
                    className="h-8 w-8 rounded-md border-2"
                    style={{ backgroundColor: preset.value, borderColor: active ? "#C6A15B" : "transparent" }}
                  />
                ) : (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setPageStyle({ canvasTint: "" })}
                    className="flex h-8 items-center rounded-md border-2 bg-card px-2 text-[10px] font-bold"
                    style={{ borderColor: active ? "#C6A15B" : "hsl(var(--border))" }}
                  >
                    Theme
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {loaded && layout.length === 0 && (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-foreground/20 bg-card px-4 py-10 text-center shadow-card">
          <p className="font-display text-lg font-bold text-foreground">Nothing here yet</p>
          <p className="max-w-xs text-sm font-medium text-foreground/70">
            Tap "Add widget" to start building your page — tasks, calendar, quick links, a clock and more.
          </p>
          <button
            onClick={() => setAddOpen(true)}
            className="btn-edge flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground transition-[filter] hover:brightness-110"
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
