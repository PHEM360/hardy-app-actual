import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Eye, EyeOff, Pencil, RotateCcw } from "lucide-react";
import { GreetingWidget } from "@/components/widgets/GreetingWidget";
import { QuickLinksWidget } from "@/components/widgets/QuickLinksWidget";
import { NotesWidget } from "@/components/widgets/NotesWidget";
import { useHomeTilesLayout } from "@/hooks/useHomeTilesLayout";
import { useNotes } from "@/hooks/useNotes";
import { useEffectiveRole } from "@/auth/useEffectiveRole";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useIncomingPageShares } from "@/hooks/usePageShares";
import { canAccessRoute } from "@/lib/features";
import { HOME_TILE_BY_ID, packHomeTiles, type HomeTileDef } from "@/lib/homeLayout";

const COL_CLASS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};

function PageTile({
  tile,
  cols,
  editMode,
  onOpen,
  onMove,
  onHide,
}: {
  tile: HomeTileDef;
  cols: number;
  editMode: boolean;
  onOpen: () => void;
  onMove: (delta: number) => void;
  onHide: () => void;
}) {
  const Icon = tile.icon;
  const compact = cols >= 3;
  return (
    <div
      className="relative min-w-0 overflow-hidden rounded-2xl border border-border/40 shadow-card"
      style={{
        background: `color-mix(in srgb, ${tile.accent} 16%, hsl(var(--card)))`,
        borderLeftWidth: 4,
        borderLeftColor: tile.accent,
      }}
    >
      {editMode && (
        <div className="absolute right-1.5 top-1.5 z-10 flex gap-0.5">
          <button type="button" className="rounded-md bg-card/90 p-1 shadow-sm" onClick={() => onMove(-1)} aria-label={`Move ${tile.label} earlier`}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button type="button" className="rounded-md bg-card/90 p-1 shadow-sm" onClick={() => onMove(1)} aria-label={`Move ${tile.label} later`}>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button type="button" className="rounded-md bg-card/90 p-1 shadow-sm" onClick={onHide} aria-label={`Hide ${tile.label}`}>
            <EyeOff className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={onOpen}
        disabled={editMode}
        className={`flex h-full w-full min-w-0 items-center gap-3 text-left ${compact ? "flex-col justify-center px-2 py-3" : "px-3 py-3.5"} ${editMode ? "pointer-events-none" : ""}`}
      >
        <span
          className={`flex shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${compact ? "h-9 w-9" : "h-11 w-11"}`}
          style={{ background: tile.gradient }}
        >
          <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} />
        </span>
        <span className={`min-w-0 font-display font-bold leading-tight ${compact ? "text-center text-[11px]" : "text-sm"}`}>
          {tile.label}
        </span>
      </button>
    </div>
  );
}

export default function HomeTiles() {
  const navigate = useNavigate();
  const [editMode, setEditMode] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const { layout, setRowSize, addRowSize, removeRowSize, moveTile, hideTile, showTile, resetLayout } = useHomeTilesLayout();
  const { prefs } = useNotes();
  const { role, loading: roleLoading } = useEffectiveRole();
  const { profile, loading: profileLoading } = useUserProfile();
  const { pages: sharedPages, loading: sharesLoading } = useIncomingPageShares();
  const loading = roleLoading || profileLoading || sharesLoading;

  const accessibleIds = useMemo(() => {
    const features = profile?.enabledFeatures ?? [];
    return Object.values(HOME_TILE_BY_ID)
      .filter((tile) => {
        if (tile.id === "quick_links") return true;
        if (!tile.route) return false;
        if (loading) return tile.id === "quick_links";
        return canAccessRoute(role, features, tile.route, sharedPages);
      })
      .map((tile) => tile.id);
  }, [loading, profile?.enabledFeatures, role, sharedPages]);

  const rows = useMemo(() => packHomeTiles(layout, accessibleIds), [accessibleIds, layout]);
  const hiddenTiles = layout.hidden
    .map((id) => HOME_TILE_BY_ID[id])
    .filter((tile) => tile && accessibleIds.includes(tile.id));

  return (
    <div className="mx-auto w-full max-w-6xl overflow-x-hidden pb-6">
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border/30 bg-background/95 px-3 py-3 backdrop-blur-sm">
        <p className="text-sm font-semibold text-foreground">Home</p>
        <div className="flex items-center gap-2">
          {editMode && hiddenTiles.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHidden((value) => !value)}
              className="flex items-center gap-1 rounded-xl border border-border px-2.5 py-1.5 text-xs text-muted-foreground"
            >
              <EyeOff className="h-3.5 w-3.5" />
              {hiddenTiles.length} hidden
            </button>
          )}
          {editMode && (
            <button
              type="button"
              onClick={() => void resetLayout()}
              className="flex items-center gap-1 rounded-xl border border-border px-2.5 py-1.5 text-xs text-muted-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          )}
          <button
            type="button"
            onClick={() => { setEditMode((value) => !value); setShowHidden(false); }}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              editMode ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {editMode ? <><Check className="h-3.5 w-3.5" /> Done</> : <><Pencil className="h-3.5 w-3.5" /> Edit</>}
          </button>
        </div>
      </div>

      <div className="space-y-3 px-3 pt-3 sm:px-4">
        <div className="h-[100px] overflow-hidden rounded-2xl shadow-card">
          <GreetingWidget />
        </div>

        {prefs.dashboardNoteId ? (
          <div className="h-[240px] overflow-hidden rounded-2xl border border-border/40 bg-card shadow-card">
            <NotesWidget />
          </div>
        ) : null}

        <AnimatePresence>
          {editMode && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 px-3 py-2.5"
            >
              <p className="text-xs text-primary/80">
                Change how many tiles sit in each row, then shuffle the order. Quick Links can sit full-width on its own row.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {editMode && showHidden && hiddenTiles.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-3 shadow-card">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Hidden tiles</p>
            <div className="flex flex-wrap gap-2">
              {hiddenTiles.map((tile) => (
                <button
                  key={tile.id}
                  type="button"
                  onClick={() => void showTile(tile.id)}
                  className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium"
                >
                  <tile.icon className="h-3.5 w-3.5" />
                  {tile.label}
                  <Eye className="h-3 w-3 text-primary" />
                </button>
              ))}
            </div>
          </div>
        )}

        {rows.map((row, rowIndex) => (
          <div key={`row-${rowIndex}`} className="space-y-1.5">
            {editMode && (
              <div className="flex items-center gap-1.5 px-0.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Row {rowIndex + 1}</span>
                {([1, 2, 3, 4] as const).map((cols) => (
                  <button
                    key={cols}
                    type="button"
                    onClick={() => void setRowSize(rowIndex, cols)}
                    className={`h-7 min-w-7 rounded-lg px-2 text-xs font-bold ${
                      row.cols === cols
                        ? "bg-gradient-primary text-primary-foreground"
                        : "border border-border bg-card text-foreground"
                    }`}
                  >
                    {cols}
                  </button>
                ))}
                {layout.rowSizes.length > 1 && rowIndex < layout.rowSizes.length && (
                  <button
                    type="button"
                    onClick={() => void removeRowSize(rowIndex)}
                    className="ml-auto text-[11px] font-semibold text-muted-foreground"
                  >
                    Remove
                  </button>
                )}
              </div>
            )}
            <div className={`grid gap-2.5 ${COL_CLASS[row.cols]}`}>
              {row.tiles.map((tile) => {
                if (tile.id === "quick_links") {
                  return (
                    <div key={tile.id} className="relative min-h-[220px] overflow-hidden rounded-2xl border border-border/40 bg-card shadow-card">
                      {editMode && (
                        <div className="absolute right-1.5 top-1.5 z-10 flex gap-0.5">
                          <button type="button" className="rounded-md bg-card/90 p-1 shadow-sm" onClick={() => void moveTile(tile.id, -1)} aria-label="Move Quick Links earlier">
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" className="rounded-md bg-card/90 p-1 shadow-sm" onClick={() => void moveTile(tile.id, 1)} aria-label="Move Quick Links later">
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" className="rounded-md bg-card/90 p-1 shadow-sm" onClick={() => void hideTile(tile.id)} aria-label="Hide Quick Links">
                            <EyeOff className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                      <QuickLinksWidget />
                    </div>
                  );
                }
                return (
                  <PageTile
                    key={tile.id}
                    tile={tile}
                    cols={row.cols}
                    editMode={editMode}
                    onOpen={() => tile.route && navigate(tile.route)}
                    onMove={(delta) => void moveTile(tile.id, delta)}
                    onHide={() => void hideTile(tile.id)}
                  />
                );
              })}
            </div>
          </div>
        ))}

        {editMode && (
          <button
            type="button"
            onClick={() => void addRowSize()}
            className="w-full rounded-2xl border border-dashed border-border bg-card px-3 py-2.5 text-sm font-semibold text-foreground"
          >
            Add another row width
          </button>
        )}
      </div>
    </div>
  );
}
