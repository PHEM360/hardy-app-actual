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
  | "lanterns"
  | "fireworks"
  | "confetti"
  | "hearts"
  | "balloons"
  | "pawprints"
  | "bubbles"
  | "glass";

export type ChromeSeason = "spring" | "summer" | "autumn" | "winter";

export const CHROME_SCENES: { id: ChromeSceneId; label: string; emoji: string; hint?: string }[] = [
  { id: "none", label: "Plain", emoji: "◻️" },
  { id: "weather", label: "Live weather", emoji: "🌦️", hint: "Follows rain, snow, sun, fog" },
  { id: "seasons", label: "Seasons", emoji: "🍃", hint: "Spring blossom to winter frost" },
  { id: "stars", label: "Night sky", emoji: "✨" },
  { id: "aurora", label: "Aurora", emoji: "🌌" },
  { id: "galaxy", label: "Galaxy", emoji: "🪐" },
  { id: "fireflies", label: "Fireflies", emoji: "🕯️" },
  { id: "ocean", label: "Ocean", emoji: "🌊" },
  { id: "meadow", label: "Meadow", emoji: "🌾" },
  { id: "harbour", label: "Harbour", emoji: "⛵" },
  { id: "bokeh", label: "Soft lights", emoji: "🔮" },
  { id: "embers", label: "Embers", emoji: "🔥" },
  { id: "lanterns", label: "Lanterns", emoji: "🏮" },
  { id: "fireworks", label: "Fireworks", emoji: "🎆" },
  { id: "confetti", label: "Confetti", emoji: "🎉" },
  { id: "hearts", label: "Hearts", emoji: "💗" },
  { id: "balloons", label: "Balloons", emoji: "🎈" },
  { id: "pawprints", label: "Paw prints", emoji: "🐾" },
  { id: "bubbles", label: "Bubbles", emoji: "🫧" },
  { id: "glass", label: "Stained glass", emoji: "🪟" },
];

/** Older weather-as-options ids now fold into live weather / seasons / ocean. */
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
