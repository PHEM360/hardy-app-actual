import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { fitQuickLinkGrid, QUICK_LINK_GAP } from "@/lib/quickLinkGrid";
import { JEWEL_CYCLE } from "@/lib/brandPalette";

export interface FitTile {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Optional fixed colour. Left out, the tile takes the next jewel tone in turn. */
  background?: string;
}

/**
 * A grid of shortcut tiles that always shows every tile with no scrolling.
 * It measures the space it has been given and sizes each tile in explicit
 * pixels (see fitQuickLinkGrid): tiles shrink, then labels go to one line,
 * then to icon only, as more are added or the box gets smaller. The tiles
 * are absolutely positioned inside the measured box so their size can never
 * feed back into the box's own height. See AGENTS.md "Fit, do not scroll".
 */
export function FitTileGrid({ tiles, onRun, className = "" }: { tiles: FitTile[]; onRun: (id: string) => void; className?: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setBox({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const layout = fitQuickLinkGrid(box.width, box.height, tiles.length);
  const ready = box.width > 0 && box.height > 0;
  const iconBox = layout.mode === "stack" ? 28 : layout.mode === "stack-sm" ? 22 : Math.max(14, Math.min(22, layout.tileHeight - 8));
  const iconSize = Math.round(iconBox * 0.52);
  const inline = layout.mode === "row";

  return (
    <div ref={boxRef} className={`relative min-h-0 flex-1 ${className}`} data-testid="quick-link-grid">
      {ready && (
        <div
          className="absolute inset-0 grid content-start"
          style={{
            gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
            gridAutoRows: `${layout.tileHeight}px`,
            gap: QUICK_LINK_GAP,
          }}
        >
          {tiles.map((tile, index) => {
            const Icon = tile.icon;
            const style: CSSProperties = { height: layout.tileHeight, backgroundColor: tile.background ?? JEWEL_CYCLE[index % JEWEL_CYCLE.length] };
            return (
              <button
                key={tile.id}
                type="button"
                onClick={() => onRun(tile.id)}
                title={tile.label}
                aria-label={tile.label}
                style={style}
                className={`btn-edge flex min-w-0 items-center justify-center overflow-hidden rounded-lg px-1 text-center text-white transition-[filter,transform] hover:brightness-110 active:scale-[0.96] ${
                  inline ? "flex-row gap-1.5" : "flex-col gap-1"
                }`}
              >
                <span className="flex flex-shrink-0 items-center justify-center rounded-md bg-white/15 ring-1 ring-inset ring-white/20" style={{ width: iconBox, height: iconBox }}>
                  <Icon style={{ width: iconSize, height: iconSize }} />
                </span>
                {layout.mode !== "icon" && (
                  <span
                    className={`min-w-0 font-bold leading-tight text-white ${
                      layout.mode === "stack" ? "line-clamp-2 text-[10px]" : "truncate text-[9px]"
                    } ${inline ? "text-left" : "max-w-full"}`}
                  >
                    {tile.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
