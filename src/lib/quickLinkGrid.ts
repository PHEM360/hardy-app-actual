/**
 * Fits N quick link tiles into a box of a known pixel size, so every tile is
 * always visible with no scrolling. Tiles shrink (and drop their label last)
 * as more are added or the box gets smaller.
 *
 * Sizes are explicit pixels on purpose: flexible `fr` rows nested inside the
 * dashboard's flex chain previously resolved to overlapping tiles.
 */
export type QuickLinkTileMode = "stack" | "stack-sm" | "row" | "icon";

export interface QuickLinkGridLayout {
  cols: number;
  rows: number;
  tileWidth: number;
  tileHeight: number;
  mode: QuickLinkTileMode;
}

export const QUICK_LINK_GAP = 6;
const MAX_COLS = 8;
/** A tile taller than this just wastes space; the grid is top aligned instead. */
const MAX_TILE_HEIGHT = 84;

function tileMode(width: number, height: number): QuickLinkTileMode {
  if (height >= 58 && width >= 56) return "stack";
  if (height >= 42 && width >= 48) return "stack-sm";
  if (width >= 84 && height >= 22) return "row";
  return "icon";
}

export function fitQuickLinkGrid(width: number, height: number, count: number, gap = QUICK_LINK_GAP): QuickLinkGridLayout {
  const n = Math.max(1, count);
  let best: QuickLinkGridLayout | null = null;
  let bestScore = -Infinity;
  for (let cols = 1; cols <= Math.min(n, MAX_COLS); cols++) {
    const rows = Math.ceil(n / cols);
    const tileWidth = (width - gap * (cols - 1)) / cols;
    const tileHeight = Math.min(MAX_TILE_HEIGHT, (height - gap * (rows - 1)) / rows);
    const mode = tileMode(tileWidth, tileHeight);
    // Keeping a readable label is worth more than a bigger tile, then tile
    // height (capped, and by width so tiles never become slivers), then width.
    const labelBonus = mode === "stack" ? 30 : mode === "stack-sm" ? 20 : mode === "row" ? 10 : 0;
    const score = labelBonus + Math.min(tileHeight, 72, tileWidth * 1.3) + 0.2 * Math.min(tileWidth, 120);
    if (score > bestScore + 0.01) {
      bestScore = score;
      best = { cols, rows, tileWidth, tileHeight, mode };
    }
  }
  const layout = best!;
  return { ...layout, tileWidth: Math.max(0, Math.floor(layout.tileWidth)), tileHeight: Math.max(0, Math.floor(layout.tileHeight)) };
}
