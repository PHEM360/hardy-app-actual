import type { HomeTilesPresetId } from "@/lib/homeLayout";

export function homeTileSkinClass(preset: HomeTilesPresetId) {
  return `home-tiles-skin home-tiles-skin-${preset}`;
}

export function tileMotionClass(preset: HomeTilesPresetId, featured = false) {
  if (preset === "magazine") return featured ? "home-tile-sheen home-tile-lift" : "home-tile-lift";
  if (preset === "bento") return "home-tile-glass";
  if (preset === "river") return "home-tile-float home-tile-lift home-tile-pill";
  if (preset === "spotlight") return featured ? "home-tile-spotlight home-tile-sheen" : "home-tile-dim";
  if (preset === "orbit") return "home-tile-orbit home-tile-glass home-tile-round";
  if (preset === "mosaic") return "home-tile-mosaic home-tile-sheen";
  return "";
}

export function tileSurface(
  preset: HomeTilesPresetId,
  accent: string,
  featured: boolean,
): { background: string; borderLeftWidth: number; radius: string; borderColor?: string } {
  if (preset === "compact") {
    return { background: "hsl(var(--card))", borderLeftWidth: 0, radius: "rounded-lg" };
  }
  if (preset === "magazine") {
    return {
      background: featured
        ? `linear-gradient(160deg, color-mix(in oklab, ${accent} 84%, #ffffff) 0%, ${accent} 45%, color-mix(in oklab, ${accent} 62%, #14100C) 100%)`
        : "color-mix(in srgb, #f6efe3 82%, hsl(var(--card)))",
      borderLeftWidth: 0,
      radius: featured ? "rounded-[1.6rem]" : "rounded-xl",
    };
  }
  if (preset === "bento") {
    return {
      background: `color-mix(in srgb, ${accent} 18%, hsl(210 18% 16% / 0.08))`,
      borderLeftWidth: 0,
      radius: "rounded-3xl",
    };
  }
  if (preset === "river") {
    return {
      background: `linear-gradient(180deg, color-mix(in srgb, ${accent} 28%, #d8eef0), color-mix(in srgb, ${accent} 10%, hsl(var(--card))))`,
      borderLeftWidth: 0,
      radius: "rounded-[2rem]",
    };
  }
  if (preset === "spotlight") {
    return {
      background: featured
        ? `radial-gradient(120% 90% at 0% 0%, color-mix(in oklab, ${accent} 80%, #ffffff) 0%, transparent 60%), linear-gradient(145deg, ${accent} 0%, color-mix(in oklab, ${accent} 48%, #14100C) 100%)`
        : "color-mix(in srgb, hsl(var(--card)) 88%, #1a1814)",
      borderLeftWidth: featured ? 0 : 0,
      radius: featured ? "rounded-[1.75rem]" : "rounded-xl",
    };
  }
  if (preset === "orbit") {
    return {
      background: `radial-gradient(circle at 30% 20%, color-mix(in srgb, ${accent} 34%, #1a1630), color-mix(in srgb, ${accent} 12%, #12101c))`,
      borderLeftWidth: 0,
      radius: "rounded-[1.8rem]",
    };
  }
  if (preset === "mosaic") {
    return {
      background: featured
        ? `linear-gradient(135deg, color-mix(in srgb, ${accent} 38%, #f3d7b8), color-mix(in srgb, ${accent} 14%, #efe0cc))`
        : `color-mix(in srgb, ${accent} 16%, #f4e6d4)`,
      borderLeftWidth: 0,
      radius: featured ? "rounded-[1.15rem]" : "rounded-md",
    };
  }
  return {
    background: `radial-gradient(120% 160% at 100% 100%, color-mix(in oklab, ${accent} 46%, #F8F4EC) 0%, color-mix(in oklab, ${accent} 20%, #F8F4EC) 38%, transparent 72%), linear-gradient(180deg, #FDFBF6 0%, #F2EBDD 100%)`,
    borderLeftWidth: 4,
    radius: "rounded-2xl",
  };
}

export function tileIconWrapClass(preset: HomeTilesPresetId, featured: boolean, compact: boolean) {
  if (preset === "compact") return "h-8 w-8 rounded-md";
  if (preset === "magazine") return featured ? "h-12 w-12 rounded-2xl" : "h-9 w-9 rounded-lg";
  if (preset === "bento") return featured ? "h-12 w-12 rounded-full" : "h-10 w-10 rounded-full";
  if (preset === "river") return "h-10 w-10 rounded-full";
  if (preset === "spotlight") return featured ? "h-14 w-14 rounded-2xl" : "h-9 w-9 rounded-lg";
  if (preset === "orbit") return "home-tile-icon-ring h-10 w-10 rounded-full";
  if (preset === "mosaic") return "home-tile-icon-stamp h-9 w-9 rounded-sm";
  return compact ? "h-9 w-9 rounded-xl" : "h-11 w-11 rounded-xl";
}

export function tileInkClass(preset: HomeTilesPresetId, featured: boolean) {
  if (preset === "magazine" && featured) return "text-white";
  if (preset === "spotlight" && featured) return "text-white";
  if (preset === "orbit") return "text-white";
  return "text-foreground";
}
