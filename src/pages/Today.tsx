import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Pencil, Check, RotateCcw, Eye, EyeOff } from "lucide-react";
import { format } from "date-fns";
import { Rnd } from "react-rnd";

import { useTodayLayout, TODAY_WIDGET_LABELS, TODAY_WIDGET_ICONS } from "@/hooks/useTodayLayout";
import type { TodayWidgetItem, TodayWidgetType } from "@/hooks/useTodayLayout";

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

// ─── Widget content ────────────────────────────────────────────────────────────

function WidgetContent({ type }: { type: TodayWidgetType }) {
  switch (type) {
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
    default:           return null;
  }
}

// ─── Widget shell (inline — mirrors WidgetShell but typed for Today) ──────────

const SNAP_COLS   = 2;
const SNAP_ROW_PX = 20;
const MIN_H       = 100;
const MIN_W_FRAC  = 0.5;
const GAP         = 8;
const PADDING     = 12;

function TodayWidgetShell({
  item,
  containerWidth,
  editMode,
  onUpdate,
  children,
}: {
  item: TodayWidgetItem;
  containerWidth: number;
  editMode: boolean;
  onUpdate: (id: string, patch: Partial<TodayWidgetItem>) => void;
  children: React.ReactNode;
}) {
  const colW = containerWidth / SNAP_COLS;
  const x = item.xFrac * containerWidth;
  const w = item.wFrac * containerWidth;

  return (
    <Rnd
      position={{ x, y: item.y }}
      size={{ width: w, height: item.h }}
      dragHandleClassName="td-drag-handle"
      disableDragging={!editMode}
      enableResizing={editMode ? { bottom: true, bottomRight: true, right: true, bottomLeft: true, left: false, top: false, topRight: false, topLeft: false } : false}
      bounds="parent"
      dragGrid={[colW, SNAP_ROW_PX]}
      resizeGrid={[colW, SNAP_ROW_PX]}
      minWidth={colW}
      minHeight={MIN_H}
      onDragStop={(_e, d) => {
        const snapped = Math.round((d.x / containerWidth) * SNAP_COLS) / SNAP_COLS;
        const clamped = Math.max(0, Math.min(1 - item.wFrac, snapped));
        onUpdate(item.id, { xFrac: clamped, y: Math.max(0, d.y) });
      }}
      onResizeStop={(_e, _dir, ref, _delta, pos) => {
        const newW = parseFloat(ref.style.width);
        const newH = parseFloat(ref.style.height);
        const wFrac = Math.max(MIN_W_FRAC, Math.min(1, Math.round((newW / containerWidth) * SNAP_COLS) / SNAP_COLS));
        const xFrac = Math.max(0, Math.min(1 - wFrac, Math.round((pos.x / containerWidth) * SNAP_COLS) / SNAP_COLS));
        onUpdate(item.id, { xFrac, y: Math.max(0, pos.y), wFrac, h: Math.max(MIN_H, newH) });
      }}
      style={{ zIndex: editMode ? 10 : 1 }}
    >
      <div
        className={`w-full h-full rounded-2xl overflow-hidden flex flex-col bg-card border shadow-soft transition-shadow ${
          editMode ? "border-amber-400/40 ring-2 ring-amber-300/20 shadow-md" : "border-border/50"
        }`}
      >
        {/* Edit drag handle bar */}
        {editMode && (
          <div className="td-drag-handle flex items-center justify-between px-3 py-1.5 bg-amber-50 border-b border-amber-100 cursor-grab active:cursor-grabbing select-none flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">{TODAY_WIDGET_ICONS[item.type]}</span>
              <span className="text-[10px] font-semibold text-amber-700">{TODAY_WIDGET_LABELS[item.type]}</span>
            </div>
            <button
              className="p-1 rounded-md hover:bg-amber-100 transition-colors"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onUpdate(item.id, { visible: !item.visible }); }}
              title={item.visible ? "Hide widget" : "Show widget"}
            >
              {item.visible
                ? <Eye className="w-3.5 h-3.5 text-amber-600" />
                : <EyeOff className="w-3.5 h-3.5 text-amber-400" />
              }
            </button>
          </div>
        )}

        {/* Widget content */}
        <div className={`flex-1 min-h-0 overflow-hidden ${!item.visible && editMode ? "opacity-30 pointer-events-none" : ""}`}>
          {children}
        </div>
      </div>
    </Rnd>
  );
}

// ─── Today page ───────────────────────────────────────────────────────────────

const Today = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [showHiddenPanel, setShowHiddenPanel] = useState(false);

  const { layout, updateWidget, resetLayout } = useTodayLayout();

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
  const hiddenWidgets = layout.filter((w) => !w.visible);

  const handleUpdate = useCallback((id: string, patch: Partial<TodayWidgetItem>) => {
    updateWidget(id, patch);
  }, [updateWidget]);

  const today = new Date();

  return (
    <div className="pb-28">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-3 sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/30">
        <div>
          <div className="flex items-center gap-2">
            <Sun className="w-4 h-4 text-amber-500" />
            <p className="text-sm font-semibold text-foreground">Today</p>
          </div>
          <p className="text-[11px] text-muted-foreground ml-6">
            {format(today, "EEEE d MMMM")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {editMode && hiddenWidgets.length > 0 && (
            <button
              onClick={() => setShowHiddenPanel((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground border border-border rounded-xl px-2.5 py-1.5"
            >
              <EyeOff className="w-3.5 h-3.5" />
              {hiddenWidgets.length} hidden
            </button>
          )}
          {editMode && (
            <button
              onClick={resetLayout}
              className="flex items-center gap-1 text-xs text-muted-foreground border border-border rounded-xl px-2.5 py-1.5"
              title="Reset layout"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => { setEditMode((v) => !v); setShowHiddenPanel(false); }}
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

      {/* Edit mode banner */}
      <AnimatePresence>
        {editMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-3 mt-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700"
          >
            🖐️ Drag widgets to reposition · Drag corner to resize · Tap 👁️ to hide/show
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden widgets panel */}
      <AnimatePresence>
        {editMode && showHiddenPanel && hiddenWidgets.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mx-3 mt-2 p-3 rounded-xl bg-muted/40 border border-border"
          >
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Hidden widgets — tap to restore
            </p>
            <div className="flex flex-wrap gap-2">
              {hiddenWidgets.map((w) => (
                <button
                  key={w.id}
                  onClick={() => updateWidget(w.id, { visible: true })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
                >
                  <span>{TODAY_WIDGET_ICONS[w.type]}</span>
                  {TODAY_WIDGET_LABELS[w.type]}
                  <Eye className="w-3 h-3 text-amber-500 ml-0.5" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
          if (!item.visible && !editMode) return null;
          const availWidth = containerWidth - PADDING * 2;

          return (
            <TodayWidgetShell
              key={item.id}
              item={item}
              containerWidth={availWidth}
              editMode={editMode}
              onUpdate={handleUpdate}
            >
              <WidgetContent type={item.type} />
            </TodayWidgetShell>
          );
        })}
      </div>
    </div>
  );
};

export default Today;
