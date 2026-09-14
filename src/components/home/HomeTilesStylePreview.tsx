import { HOME_TILES, type HomeTilesPresetId } from "@/lib/homeLayout";
import { homeTileSkinClass, tileInkClass, tileMotionClass, tileSurface } from "@/lib/homeTileSkins";

const SAMPLE = HOME_TILES.slice(1, 7);

function MiniTile({
  label,
  accent,
  preset,
  featured,
  tall,
}: {
  label: string;
  accent: string;
  preset: HomeTilesPresetId;
  featured?: boolean;
  tall?: boolean;
}) {
  const surface = tileSurface(preset, accent, Boolean(featured));
  const ink = tileInkClass(preset, Boolean(featured));
  return (
    <div
      className={`home-tile flex items-center gap-2.5 overflow-hidden border px-3 ${
        tall ? "min-h-[88px]" : "min-h-[56px]"
      } ${surface.radius} ${preset === "compact" ? "border-border/30" : preset === "orbit" ? "border-white/10" : "border-border/40"} ${tileMotionClass(preset, featured)}`}
      style={{
        ["--tile-accent" as string]: accent,
        background: surface.background,
        borderLeftWidth: surface.borderLeftWidth,
        borderLeftColor: accent,
      }}
    >
      <span
        className={`shrink-0 shadow-sm ${
          preset === "bento" || preset === "river" || preset === "orbit"
            ? "h-8 w-8 rounded-full"
            : preset === "mosaic"
              ? "home-tile-icon-stamp h-7 w-7 rounded-sm"
              : featured
                ? "h-10 w-10 rounded-xl"
                : "h-8 w-8 rounded-lg"
        }`}
        style={{ background: accent }}
      />
      <span className={`min-w-0 font-display font-bold leading-tight ${ink} ${featured ? "text-sm" : "text-xs"}`}>
        {label}
      </span>
    </div>
  );
}

export function HomeTilesStylePreview({
  preset,
  large = false,
}: {
  preset: HomeTilesPresetId;
  large?: boolean;
}) {
  const tiles = SAMPLE.map((tile) => ({ label: tile.label, accent: tile.accent }));
  const height = large ? "h-[220px] sm:h-[248px]" : "h-[188px]";

  const body =
    preset === "orbit" ? (
      <div className={`relative overflow-hidden ${height}`}>
        <div className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-primary shadow-card" />
        {tiles.slice(0, 6).map((tile, index) => {
          const angle = (index / 6) * Math.PI * 2 - Math.PI / 2;
          return (
            <div
              key={tile.label}
              className="absolute w-[34%]"
              style={{
                left: `calc(50% + ${Math.cos(angle) * 72}px - 17%)`,
                top: `calc(50% + ${Math.sin(angle) * 64}px - 28px)`,
              }}
            >
              <MiniTile {...tile} preset={preset} />
            </div>
          );
        })}
      </div>
    ) : preset === "spotlight" ? (
      <div className={`grid grid-cols-[1.4fr_1fr] gap-2.5 ${height}`}>
        <MiniTile {...tiles[0]} preset={preset} featured tall />
        <div className="grid grid-rows-3 gap-2.5">
          {tiles.slice(1, 4).map((tile) => <MiniTile key={tile.label} {...tile} preset={preset} />)}
        </div>
      </div>
    ) : preset === "magazine" ? (
      <div className={`flex flex-col gap-2.5 ${height}`}>
        <MiniTile {...tiles[0]} preset={preset} featured tall />
        <div className="grid flex-1 grid-cols-2 gap-2.5">
          {tiles.slice(1, 5).map((tile) => <MiniTile key={tile.label} {...tile} preset={preset} />)}
        </div>
      </div>
    ) : preset === "bento" ? (
      <div className={`grid grid-cols-4 grid-rows-2 gap-2.5 ${height}`}>
        <div className="col-span-2 row-span-2"><MiniTile {...tiles[0]} preset={preset} featured tall /></div>
        <div className="col-span-2"><MiniTile {...tiles[1]} preset={preset} /></div>
        {tiles.slice(2, 4).map((tile) => <MiniTile key={tile.label} {...tile} preset={preset} />)}
      </div>
    ) : preset === "river" ? (
      <div className={`grid grid-cols-3 gap-2.5 ${height}`}>
        <MiniTile {...tiles[0]} preset={preset} tall />
        <div className="mt-8"><MiniTile {...tiles[1]} preset={preset} /></div>
        <MiniTile {...tiles[2]} preset={preset} tall />
      </div>
    ) : preset === "mosaic" ? (
      <div className={`grid grid-cols-6 gap-2.5 ${height}`}>
        <div className="col-span-4"><MiniTile {...tiles[0]} preset={preset} featured tall /></div>
        <div className="col-span-2"><MiniTile {...tiles[1]} preset={preset} tall /></div>
        <div className="col-span-2"><MiniTile {...tiles[2]} preset={preset} /></div>
        <div className="col-span-4"><MiniTile {...tiles[3]} preset={preset} /></div>
      </div>
    ) : preset === "compact" ? (
      <div className={`grid grid-cols-3 content-start gap-1.5 ${height}`}>
        {tiles.map((tile) => <MiniTile key={tile.label} {...tile} preset={preset} />)}
      </div>
    ) : (
      <div className={`grid grid-cols-2 content-start gap-2.5 ${height}`}>
        {tiles.slice(0, 4).map((tile) => <MiniTile key={tile.label} {...tile} preset={preset} />)}
      </div>
    );

  return (
    <div className={`overflow-hidden rounded-xl ${homeTileSkinClass(preset)}`}>
      {body}
    </div>
  );
}
