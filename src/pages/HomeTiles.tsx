import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Eye, EyeOff, Pencil, RotateCcw } from "lucide-react";
import { GreetingWidget } from "@/components/widgets/GreetingWidget";
import { QuickLinksWidget } from "@/components/widgets/QuickLinksWidget";
import { UnallocatedInboxWidget } from "@/components/widgets/UnallocatedInboxWidget";
import { NotesWidget } from "@/components/widgets/NotesWidget";
import { useHomeTilesLayout } from "@/hooks/useHomeTilesLayout";
import { useNotes } from "@/hooks/useNotes";
import { useEffectiveRole } from "@/auth/useEffectiveRole";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useIncomingPageShares } from "@/hooks/usePageShares";
import { canAccessRoute } from "@/lib/features";
import { HomeViewToggle } from "@/components/home/HomeViewToggle";
import { HOME_TILE_BY_ID, HOME_TILE_PRESETS, packHomeTiles, visibleHomeTiles, type HomeLayoutMode, type HomeTileDef, type HomeTilesPresetId } from "@/lib/homeLayout";
import { homeTileSkinClass, tileIconWrapClass, tileInkClass, tileMotionClass, tileSurface } from "@/lib/homeTileSkins";

const COL_CLASS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};

function renderHomeTile(
  tile: HomeTileDef,
  cols: number,
  editMode: boolean,
  navigate: (path: string) => void,
  moveTile: (id: string, delta: number) => Promise<void> | void,
  hideTile: (id: string) => Promise<void> | void,
  className = "",
  preset: HomeTilesPresetId = "classic",
  featured = false,
) {
  if (tile.id === "quick_links") {
    const surface = tileSurface(preset, tile.accent, featured);
    return (
      <div
        key={tile.id}
        className={`home-tile relative min-h-[220px] overflow-hidden border border-border/40 shadow-card ${surface.radius} ${tileMotionClass(preset, featured)} ${className}`}
        style={{ ["--tile-accent" as string]: tile.accent, background: surface.background }}
      >
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
  if (tile.id === "unallocated") {
    const surface = tileSurface(preset, tile.accent, featured);
    const compact = cols >= 3 || preset === "compact";
    return (
      <div
        key={tile.id}
        className={`home-tile relative min-h-[108px] overflow-hidden border border-border/40 shadow-card ${surface.radius} ${tileMotionClass(preset, featured)} ${className}`}
        style={{
          ["--tile-accent" as string]: tile.accent,
          background: surface.background,
          borderLeftWidth: surface.borderLeftWidth,
          borderLeftColor: tile.accent,
        }}
      >
        {editMode && (
          <div className="absolute right-1.5 top-1.5 z-10 flex gap-0.5">
            <button type="button" className="rounded-md bg-card/90 p-1 shadow-sm" onClick={() => void moveTile(tile.id, -1)} aria-label="Move Unallocated earlier">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button type="button" className="rounded-md bg-card/90 p-1 shadow-sm" onClick={() => void moveTile(tile.id, 1)} aria-label="Move Unallocated later">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button type="button" className="rounded-md bg-card/90 p-1 shadow-sm" onClick={() => void hideTile(tile.id)} aria-label="Hide Unallocated">
              <EyeOff className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <div className={editMode ? "pointer-events-none" : ""}>
          <UnallocatedInboxWidget compact={compact && !featured} />
        </div>
      </div>
    );
  }
  return (
    <div key={tile.id} className={className}>
      <PageTile
        tile={tile}
        cols={cols}
        editMode={editMode}
        preset={preset}
        featured={featured}
        onOpen={() => tile.route && navigate(tile.route)}
        onMove={(delta) => void moveTile(tile.id, delta)}
        onHide={() => void hideTile(tile.id)}
      />
    </div>
  );
}

function PageTile({
  tile,
  cols,
  editMode,
  preset = "classic",
  featured = false,
  onOpen,
  onMove,
  onHide,
}: {
  tile: HomeTileDef;
  cols: number;
  editMode: boolean;
  preset?: HomeTilesPresetId;
  featured?: boolean;
  onOpen: () => void;
  onMove: (delta: number) => void;
  onHide: () => void;
}) {
  const Icon = tile.icon;
  const compact = cols >= 3 || preset === "compact";
  const surface = tileSurface(preset, tile.accent, featured);
  const ink = tileInkClass(preset, featured);
  const stacked = featured && (preset === "magazine" || preset === "spotlight");
  return (
    <div
      className={`home-tile relative h-full min-w-0 overflow-hidden border shadow-card ${surface.radius} ${
        preset === "compact" ? "border-border/30" : preset === "orbit" ? "border-white/10" : "border-border/40"
      } ${tileMotionClass(preset, featured)}`}
      style={{
        ["--tile-accent" as string]: tile.accent,
        background: surface.background,
        borderLeftWidth: surface.borderLeftWidth,
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
        className={`flex h-full w-full min-w-0 text-left ${
          stacked ? "flex-col justify-end gap-3 px-4 py-4" :
          compact ? "flex-col items-center justify-center gap-2 px-2 py-3" :
          "items-center gap-3 px-3 py-3.5"
        } ${editMode ? "pointer-events-none" : ""}`}
      >
        <span
          className={`flex shrink-0 items-center justify-center text-white shadow-sm ${tileIconWrapClass(preset, featured, compact)}`}
          style={{ background: tile.gradient }}
        >
          <Icon className={featured && (preset === "magazine" || preset === "spotlight") ? "h-6 w-6" : compact ? "h-4 w-4" : "h-5 w-5"} />
        </span>
        <span className={`min-w-0 font-display font-bold leading-tight ${ink} ${
          stacked ? "text-xl sm:text-2xl" :
          compact ? "text-center text-[11px]" :
          preset === "magazine" ? "text-sm tracking-tight" :
          "text-sm"
        }`}>
          {tile.label}
        </span>
      </button>
    </div>
  );
}

export default function HomeTiles({
  homeSwitch,
}: {
  homeSwitch?: { mode: HomeLayoutMode; onChange: (mode: HomeLayoutMode) => void };
} = {}) {
  const navigate = useNavigate();
  const [editMode, setEditMode] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const { layout, setRowSize, addRowSize, removeRowSize, moveTile, hideTile, showTile, resetLayout } = useHomeTilesLayout();
  const preset = layout.preset ?? "classic";
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
  const tiles = useMemo(() => visibleHomeTiles(layout, accessibleIds), [accessibleIds, layout]);
  const hiddenTiles = layout.hidden
    .map((id) => HOME_TILE_BY_ID[id])
    .filter((tile) => tile && accessibleIds.includes(tile.id));

  return (
    <div className="page-gutter-x mx-auto w-full min-w-0 max-w-6xl overflow-x-hidden pb-6">
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border/30 bg-background/95 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div>
            <p className="text-sm font-semibold text-foreground">Home</p>
            <p className="text-[10px] text-muted-foreground">{HOME_TILE_PRESETS.find((item) => item.id === preset)?.label}</p>
          </div>
          {homeSwitch && <HomeViewToggle mode={homeSwitch.mode} onChange={homeSwitch.onChange} />}
        </div>
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

      <div className={`space-y-3 pt-3 ${homeTileSkinClass(preset)}`}>
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

        {preset === "classic" && rows.map((row, rowIndex) => (
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
              {row.tiles.map((tile) => renderHomeTile(tile, row.cols, editMode, navigate, moveTile, hideTile, "", preset))}
            </div>
          </div>
        ))}

        {preset === "compact" && (
          <div className="grid grid-cols-3 gap-2">{tiles.map((tile) => renderHomeTile(tile, 3, editMode, navigate, moveTile, hideTile, "", preset))}</div>
        )}

        {preset === "magazine" && tiles[0] && (
          <div className="space-y-2.5">
            {renderHomeTile(tiles[0], 1, editMode, navigate, moveTile, hideTile, "min-h-[140px]", preset, true)}
            <div className="grid grid-cols-2 gap-2.5">
              {tiles.slice(1).map((tile) => renderHomeTile(tile, 2, editMode, navigate, moveTile, hideTile, "", preset))}
            </div>
          </div>
        )}

        {preset === "bento" && (
          <div className="grid grid-cols-4 auto-rows-[104px] gap-2.5">
            {tiles.map((tile, index) => {
              const span = index === 0 ? "col-span-2 row-span-2 min-h-[216px]" : index < 3 ? "col-span-2" : "";
              return renderHomeTile(tile, index === 0 ? 1 : 2, editMode, navigate, moveTile, hideTile, span, preset, index === 0);
            })}
          </div>
        )}

        {preset === "river" && (
          <div className="columns-2 gap-2.5 sm:columns-3">
            {tiles.map((tile, index) => (
              <div key={tile.id} className={`mb-2.5 break-inside-avoid ${index % 3 === 0 ? "min-h-[150px]" : "min-h-[110px]"}`}>
                {renderHomeTile(tile, 2, editMode, navigate, moveTile, hideTile, "h-full", preset)}
              </div>
            ))}
          </div>
        )}

        {preset === "spotlight" && tiles[0] && (
          <div className="grid gap-2.5 md:grid-cols-[1.4fr_1fr]">
            {renderHomeTile(tiles[0], 1, editMode, navigate, moveTile, hideTile, "min-h-[240px]", preset, true)}
            <div className="grid grid-cols-2 gap-2.5 content-start">
              {tiles.slice(1).map((tile) => renderHomeTile(tile, 2, editMode, navigate, moveTile, hideTile, "", preset))}
            </div>
          </div>
        )}

        {preset === "orbit" && (
          <>
            <div className="relative mx-auto min-h-[360px] max-w-lg">
              <div className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-primary shadow-card">
                <span className="font-display text-sm font-bold text-primary-foreground">Home</span>
              </div>
              {tiles.slice(0, 6).map((tile, index) => {
                const angle = (index / 6) * Math.PI * 2 - Math.PI / 2;
                const radius = 132;
                return (
                  <div
                    key={tile.id}
                    className="absolute w-[40%]"
                    style={{
                      left: `calc(50% + ${Math.cos(angle) * radius}px - 20%)`,
                      top: `calc(50% + ${Math.sin(angle) * radius}px - 44px)`,
                    }}
                  >
                    {renderHomeTile(tile, 2, editMode, navigate, moveTile, hideTile, "", preset)}
                  </div>
                );
              })}
            </div>
            {tiles.length > 6 && (
              <div className="grid grid-cols-2 gap-2.5">
                {tiles.slice(6).map((tile) => renderHomeTile(tile, 2, editMode, navigate, moveTile, hideTile, "", preset))}
              </div>
            )}
          </>
        )}

        {preset === "mosaic" && (
          <div className="grid grid-cols-6 gap-2.5">
            {tiles.map((tile, index) => {
              const wide = index % 5 === 0 || index % 7 === 3;
              return renderHomeTile(
                tile,
                wide ? 1 : 3,
                editMode,
                navigate,
                moveTile,
                hideTile,
                wide ? "col-span-4 min-h-[132px]" : "col-span-2",
                preset,
                wide,
              );
            })}
          </div>
        )}

        {editMode && preset === "classic" && (
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
