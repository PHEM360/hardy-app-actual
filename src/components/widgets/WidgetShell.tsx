import { useRef } from "react";
import { Rnd } from "react-rnd";
import { GripHorizontal, Eye, EyeOff } from "lucide-react";
import type { WidgetLayoutItem } from "@/hooks/useDashboardLayout";

interface WidgetShellProps {
  item: WidgetLayoutItem;
  containerWidth: number;
  editMode: boolean;
  onUpdate: (id: string, patch: Partial<WidgetLayoutItem>) => void;
  children: React.ReactNode;
}

const SNAP_COLS = 2;           // horizontal snap divisions
const SNAP_ROW_PX = 20;        // vertical snap in pixels
const MIN_H = 100;
const MIN_W_FRAC = 0.5;        // minimum 50% width

export function WidgetShell({ item, containerWidth, editMode, onUpdate, children }: WidgetShellProps) {
  const colW = containerWidth / SNAP_COLS;
  const x = item.xFrac * containerWidth;
  const w = item.wFrac * containerWidth;

  return (
    <Rnd
      position={{ x, y: item.y }}
      size={{ width: w, height: item.h }}
      dragHandleClassName="widget-drag-handle"
      disableDragging={!editMode}
      enableResizing={editMode ? {
        bottom: true,
        bottomRight: true,
        right: true,
        bottomLeft: true,
        left: false,
        top: false,
        topRight: false,
        topLeft: false,
      } : false}
      bounds="parent"
      dragGrid={[colW, SNAP_ROW_PX]}
      resizeGrid={[colW, SNAP_ROW_PX]}
      minWidth={colW}
      minHeight={MIN_H}
      onDragStop={(_e, d) => {
        // Snap xFrac to nearest column
        const rawFrac = d.x / containerWidth;
        const snappedFrac = Math.round(rawFrac * SNAP_COLS) / SNAP_COLS;
        const clampedFrac = Math.max(0, Math.min(1 - item.wFrac, snappedFrac));
        onUpdate(item.id, { xFrac: clampedFrac, y: Math.max(0, d.y) });
      }}
      onResizeStop={(_e, _dir, ref, _delta, pos) => {
        const newW = parseFloat(ref.style.width);
        const newH = parseFloat(ref.style.height);
        const rawWFrac = newW / containerWidth;
        const snappedWFrac = Math.round(rawWFrac * SNAP_COLS) / SNAP_COLS;
        const clampedWFrac = Math.max(MIN_W_FRAC, Math.min(1, snappedWFrac));
        const rawXFrac = pos.x / containerWidth;
        const snappedXFrac = Math.round(rawXFrac * SNAP_COLS) / SNAP_COLS;
        const clampedXFrac = Math.max(0, Math.min(1 - clampedWFrac, snappedXFrac));
        onUpdate(item.id, {
          xFrac: clampedXFrac,
          y: Math.max(0, pos.y),
          wFrac: clampedWFrac,
          h: Math.max(MIN_H, newH),
        });
      }}
      style={{ zIndex: editMode ? 10 : 1 }}
    >
      {/* Inner card */}
      <div
        className={`w-full h-full rounded-2xl overflow-hidden flex flex-col bg-card border shadow-soft transition-shadow ${
          editMode ? "border-primary/40 ring-2 ring-primary/20 shadow-md cursor-default" : "border-border/50"
        }`}
        style={{ padding: 0 }}
      >
        {/* Edit mode header bar */}
        {editMode && (
          <div className="widget-drag-handle flex items-center justify-between px-3 py-1.5 bg-primary/5 border-b border-primary/10 cursor-grab active:cursor-grabbing select-none flex-shrink-0">
            <GripHorizontal className="w-4 h-4 text-primary/50" />
            <button
              className="p-1 rounded-md hover:bg-primary/10 transition-colors"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onUpdate(item.id, { visible: !item.visible });
              }}
              title={item.visible ? "Hide widget" : "Show widget"}
            >
              {item.visible ? (
                <Eye className="w-3.5 h-3.5 text-primary/60" />
              ) : (
                <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </button>
          </div>
        )}

        {/* Widget content */}
        <div className={`flex-1 min-h-0 overflow-hidden ${!item.visible && editMode ? "opacity-40 pointer-events-none" : ""}`}>
          {children}
        </div>
      </div>
    </Rnd>
  );
}
