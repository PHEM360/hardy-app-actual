/** Shared header + greeting animation catalog. */
export type ChromeSceneId =
  | "none"
  | "weather"
  | "seasons"
  | "stars"
  | "aurora"
  | "galaxy"
  | "fireflies"
  | "ocean"
  | "meadow"
  | "harbour"
  | "bokeh"
  | "embers"
  | "fireworks"
  | "glass"
  | "silk"
  | "nebula"
  | "rainglass"
  | "caustics"
  | "meteor"
  | "blizzard"
  | "quotes"
  | "sceptic"
  | "jokes"
  | "qotd";

export type ChromeSeason = "spring" | "summer" | "autumn" | "winter";

export const CHROME_SCENES: { id: ChromeSceneId; label: string; emoji: string; hint?: string }[] = [
  { id: "none", label: "Plain", emoji: "◻️" },
  { id: "weather", label: "Live weather", emoji: "🌦️", hint: "Follows rain, snow, sun, fog" },
  { id: "seasons", label: "Seasons", emoji: "🍃", hint: "Spring blossom to winter frost" },
  { id: "stars", label: "Night sky", emoji: "✨" },
  { id: "aurora", label: "Aurora", emoji: "🌌", hint: "Slow northern lights" },
  { id: "galaxy", label: "Galaxy", emoji: "🪐" },
  { id: "silk", label: "Silk light", emoji: "🎀", hint: "Iridescent cloth" },
  { id: "nebula", label: "Nebula", emoji: "🔭", hint: "Deep-space dust" },
  { id: "rainglass", label: "Golden hour", emoji: "🌅", hint: "Warm light and dust" },
  { id: "caustics", label: "Sunlit water", emoji: "💎", hint: "Underwater light" },
  { id: "meteor", label: "Meteors", emoji: "☄️", hint: "Ion trails" },
  { id: "blizzard", label: "Blizzard", emoji: "❄️", hint: "Slow, deep snow" },
  { id: "fireflies", label: "Candlelight", emoji: "🕯️", hint: "Quiet room, live flame" },
  { id: "ocean", label: "Ocean", emoji: "🌊", hint: "Slow sunset swell" },
  { id: "meadow", label: "Blossom", emoji: "🌸", hint: "Falling petals" },
  { id: "harbour", label: "Harbour", emoji: "⛵", hint: "Slow evening tide" },
  { id: "bokeh", label: "Soft lights", emoji: "🔮", hint: "Lens glow" },
  { id: "embers", label: "Embers", emoji: "🔥", hint: "Slow rising heat" },
  { id: "fireworks", label: "Spotlights", emoji: "🎭", hint: "Stage light sweep" },
  { id: "glass", label: "Ink wash", emoji: "🖋️", hint: "Dark ink in water" },
  { id: "quotes", label: "Motivational", emoji: "💪", hint: "Rotating pep talks" },
  { id: "sceptic", label: "Sceptic", emoji: "🧠", hint: "Why gods are unlikely" },
  { id: "jokes", label: "Jokes", emoji: "😄", hint: "A rotating joke book" },
  { id: "qotd", label: "Quote of the day", emoji: "📜", hint: "Short lines, one after another" },
];

export const ROTATE_HEADER_SCENES: ChromeSceneId[] = [
  "aurora",
  "silk",
  "nebula",
  "caustics",
  "meteor",
  "galaxy",
  "ocean",
  "stars",
  "quotes",
];

/** Older weather-as-options ids and retired cartoon scenes. */
const LEGACY_CHROME_SCENES: Record<string, ChromeSceneId> = {
  sun: "weather",
  clouds: "weather",
  rain: "weather",
  snow: "weather",
  storm: "weather",
  dusk: "weather",
  fog: "weather",
  leaves: "seasons",
  waves: "ocean",
  sparkles: "galaxy",
  lanterns: "embers",
  balloons: "silk",
  pawprints: "meadow",
  hearts: "silk",
  confetti: "fireworks",
  bubbles: "ocean",
};

export const HEADER_COLOR_PRESETS: { id: string; label: string; value: string }[] = [
  { id: "theme", label: "Theme", value: "" },
  { id: "teal", label: "Teal", value: "linear-gradient(135deg, hsl(178, 58%, 20%) 0%, hsl(198, 42%, 22%) 50%, hsl(215, 34%, 16%) 100%)" },
  { id: "navy", label: "Navy", value: "linear-gradient(135deg, hsl(218, 52%, 16%) 0%, hsl(205, 40%, 20%) 100%)" },
  { id: "forest", label: "Forest", value: "linear-gradient(135deg, hsl(148, 38%, 16%) 0%, hsl(95, 28%, 18%) 100%)" },
  { id: "sunset", label: "Sunset", value: "linear-gradient(135deg, hsl(16, 62%, 28%) 0%, hsl(340, 42%, 24%) 100%)" },
  { id: "berry", label: "Berry", value: "linear-gradient(135deg, hsl(328, 48%, 24%) 0%, hsl(272, 36%, 22%) 100%)" },
  { id: "slate", label: "Slate", value: "linear-gradient(135deg, hsl(220, 16%, 18%) 0%, hsl(215, 12%, 22%) 100%)" },
  { id: "cocoa", label: "Cocoa", value: "linear-gradient(135deg, hsl(24, 32%, 18%) 0%, hsl(18, 28%, 14%) 100%)" },
  { id: "ocean", label: "Ocean", value: "linear-gradient(135deg, hsl(200, 62%, 22%) 0%, hsl(230, 48%, 20%) 100%)" },
  { id: "plum", label: "Plum", value: "linear-gradient(135deg, hsl(285, 42%, 22%) 0%, hsl(320, 38%, 18%) 100%)" },
  { id: "amber", label: "Amber", value: "linear-gradient(135deg, hsl(38, 68%, 26%) 0%, hsl(20, 58%, 20%) 100%)" },
  { id: "emerald", label: "Emerald", value: "linear-gradient(135deg, hsl(160, 55%, 20%) 0%, hsl(178, 48%, 16%) 100%)" },
  { id: "crimson", label: "Crimson", value: "linear-gradient(135deg, hsl(350, 58%, 26%) 0%, hsl(10, 48%, 20%) 100%)" },
  { id: "indigo", label: "Indigo", value: "linear-gradient(135deg, hsl(248, 52%, 26%) 0%, hsl(228, 46%, 18%) 100%)" },
  { id: "charcoal", label: "Charcoal", value: "linear-gradient(135deg, hsl(220, 14%, 12%) 0%, hsl(220, 10%, 8%) 100%)" },
];

export type ThemeAtmosphere = "none" | "stars" | "farm" | "sea" | "celestial";

export function isChromeSceneId(value: string | undefined): value is ChromeSceneId {
  return CHROME_SCENES.some((scene) => scene.id === value);
}

export function normalizeChromeScene(id: string | undefined): ChromeSceneId | undefined {
  if (!id) return undefined;
  if (isChromeSceneId(id)) return id;
  return LEGACY_CHROME_SCENES[id];
}

export function getChromeScene(id: string | undefined) {
  const normalized = normalizeChromeScene(id);
  return CHROME_SCENES.find((scene) => scene.id === normalized) ?? CHROME_SCENES[0];
}

export function seasonForDate(date: Date = new Date()): ChromeSeason {
  const month = date.getMonth();
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "autumn";
  return "winter";
}

/** Header default: follow the active lifestyle theme until the user picks a scene. */
export function resolveAutoScene(atmosphere: ThemeAtmosphere, isNight: boolean): ChromeSceneId {
  if (atmosphere === "stars" || atmosphere === "celestial") return "stars";
  if (atmosphere === "farm") return "meadow";
  if (atmosphere === "sea") return "harbour";
  return isNight ? "stars" : "none";
}

export function resolveChromeScene(
  chosen: string | undefined,
  opts: { atmosphere?: ThemeAtmosphere; isNight?: boolean; fallback?: ChromeSceneId } = {},
): ChromeSceneId {
  if (chosen === "auto") return resolveAutoScene(opts.atmosphere ?? "none", opts.isNight ?? false);
  return normalizeChromeScene(chosen) ?? opts.fallback ?? "none";
}

export function rotateChromeScene(index: number): ChromeSceneId {
  return ROTATE_HEADER_SCENES[Math.abs(index) % ROTATE_HEADER_SCENES.length];
}
