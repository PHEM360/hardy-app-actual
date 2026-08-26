/** HSL components as used by the app's CSS variables, e.g. "178 62% 30%". */
export type Hsl = string;

export interface ThemeVars {
  background: Hsl;
  foreground: Hsl;
  card: Hsl;
  "card-foreground": Hsl;
  popover: Hsl;
  "popover-foreground": Hsl;
  primary: Hsl;
  "primary-foreground": Hsl;
  secondary: Hsl;
  "secondary-foreground": Hsl;
  muted: Hsl;
  "muted-foreground": Hsl;
  accent: Hsl;
  "accent-foreground": Hsl;
  border: Hsl;
  input: Hsl;
  ring: Hsl;
  gold: Hsl;
  "gold-foreground": Hsl;
  "chart-1": Hsl;
  "chart-2": Hsl;
  "gradient-primary": string;
  "gradient-warm": string;
  "gradient-accent": string;
  "gradient-hero": string;
  "chrome-header": string;
  "chrome-nav": string;
  "shadow-glow": string;
  "shadow-accent": string;
}

export type ThemeAtmosphere = "none" | "stars" | "farm" | "sea" | "celestial";

export interface AppTheme {
  id: string;
  name: string;
  description: string;
  icon: string;
  kind: "lifestyle" | "colour";
  atmosphere: ThemeAtmosphere;
  decorations: string[];
  defaultLoader: string;
  light: ThemeVars;
  dark: ThemeVars;
}

function palette(p: {
  primary: Hsl;
  primaryFg: Hsl;
  gold: Hsl;
  goldFg: Hsl;
  bg: Hsl;
  fg: Hsl;
  card: Hsl;
  muted: Hsl;
  mutedFg: Hsl;
  accent: Hsl;
  accentFg: Hsl;
  border: Hsl;
  secondary: Hsl;
  heroFrom: string;
  heroMid: string;
  heroTo: string;
}): ThemeVars {
  const [ph, ps, pl] = p.primary.split(" ");
  const [gh, gs, gl] = p.gold.split(" ");
  return {
    background: p.bg,
    foreground: p.fg,
    card: p.card,
    "card-foreground": p.fg,
    popover: p.card,
    "popover-foreground": p.fg,
    primary: p.primary,
    "primary-foreground": p.primaryFg,
    secondary: p.secondary,
    "secondary-foreground": p.fg,
    muted: p.muted,
    "muted-foreground": p.mutedFg,
    accent: p.accent,
    "accent-foreground": p.accentFg,
    border: p.border,
    input: p.border,
    ring: p.primary,
    gold: p.gold,
    "gold-foreground": p.goldFg,
    "chart-1": p.primary,
    "chart-2": p.gold,
    "gradient-primary": `linear-gradient(135deg, hsl(${ph} ${ps} ${Math.max(parseInt(pl) - 8, 12)}%), hsl(${p.primary}))`,
    "gradient-warm": `linear-gradient(135deg, hsl(${p.gold}), hsl(${gh} ${gs} ${Math.min(parseInt(gl) + 6, 62)}%))`,
    "gradient-accent": `linear-gradient(135deg, hsl(${p.primary}), hsl(${p.gold}))`,
    "gradient-hero": `linear-gradient(160deg, ${p.heroFrom} 0%, ${p.heroMid} 50%, ${p.heroTo} 100%)`,
    "chrome-header": `linear-gradient(135deg, ${p.heroFrom} 0%, ${p.heroMid} 40%, ${p.heroTo} 100%)`,
    "chrome-nav": `linear-gradient(135deg, ${p.heroTo} 0%, ${p.heroMid} 50%, ${p.heroFrom} 100%)`,
    "shadow-glow": `0 0 24px hsl(${p.primary} / 0.35)`,
    "shadow-accent": `0 6px 20px -4px hsl(${p.gold} / 0.30)`,
  };
}

export const APP_THEMES: AppTheme[] = [
  {
    id: "default",
    name: "Hardy Hub",
    description: "Clean teal and amber — the original look",
    icon: "🏠",
    kind: "lifestyle",
    atmosphere: "stars",
    decorations: [],
    defaultLoader: "dogs",
    light: palette({
      primary: "178 62% 30%", primaryFg: "40 30% 98%",
      gold: "36 85% 54%", goldFg: "25 45% 15%",
      bg: "186 22% 88%", fg: "220 35% 13%", card: "0 0% 100%",
      muted: "186 16% 84%", mutedFg: "220 15% 38%",
      accent: "178 45% 91%", accentFg: "178 65% 22%",
      border: "200 16% 78%", secondary: "186 20% 95%",
      heroFrom: "hsl(178, 60%, 22%)", heroMid: "hsl(195, 45%, 24%)", heroTo: "hsl(215, 35%, 18%)",
    }),
    dark: palette({
      primary: "178 55% 46%", primaryFg: "215 35% 10%",
      gold: "36 90% 60%", goldFg: "25 45% 12%",
      bg: "215 32% 10%", fg: "40 25% 95%", card: "215 28% 15%",
      muted: "215 20% 20%", mutedFg: "215 15% 65%",
      accent: "178 35% 20%", accentFg: "178 60% 75%",
      border: "215 20% 24%", secondary: "215 22% 22%",
      heroFrom: "hsl(178, 40%, 16%)", heroMid: "hsl(200, 35%, 14%)", heroTo: "hsl(215, 32%, 10%)",
    }),
  },
  {
    id: "sailing",
    name: "Sailing",
    description: "Navy hull, brass fittings, salt-spray skies",
    icon: "⛵",
    kind: "lifestyle",
    atmosphere: "sea",
    decorations: ["⛵", "🌊", "⚓"],
    defaultLoader: "sea",
    light: palette({
      primary: "210 52% 28%", primaryFg: "40 40% 98%",
      gold: "38 48% 48%", goldFg: "28 40% 14%",
      bg: "198 28% 92%", fg: "214 40% 14%", card: "0 0% 100%",
      muted: "198 18% 84%", mutedFg: "214 18% 38%",
      accent: "198 40% 88%", accentFg: "210 50% 24%",
      border: "200 20% 76%", secondary: "198 22% 94%",
      heroFrom: "hsl(210, 55%, 18%)", heroMid: "hsl(198, 40%, 22%)", heroTo: "hsl(190, 35%, 20%)",
    }),
    dark: palette({
      primary: "200 55% 48%", primaryFg: "210 40% 8%",
      gold: "38 55% 58%", goldFg: "28 35% 10%",
      bg: "214 38% 9%", fg: "198 20% 94%", card: "214 32% 13%",
      muted: "214 24% 18%", mutedFg: "200 16% 68%",
      accent: "210 30% 18%", accentFg: "198 50% 78%",
      border: "214 22% 22%", secondary: "214 26% 16%",
      heroFrom: "hsl(214, 45%, 8%)", heroMid: "hsl(200, 40%, 12%)", heroTo: "hsl(190, 30%, 10%)",
    }),
  },
  {
    id: "farming",
    name: "Farming",
    description: "Hedgerow green, soil brown, harvest gold",
    icon: "🚜",
    kind: "lifestyle",
    atmosphere: "farm",
    decorations: ["🌾", "🚜", "🐄"],
    defaultLoader: "farm",
    light: palette({
      primary: "95 38% 28%", primaryFg: "42 50% 97%",
      gold: "38 62% 44%", goldFg: "28 40% 12%",
      bg: "42 32% 93%", fg: "30 28% 14%", card: "40 40% 98%",
      muted: "42 22% 86%", mutedFg: "30 16% 38%",
      accent: "88 30% 88%", accentFg: "95 40% 22%",
      border: "40 18% 76%", secondary: "42 24% 94%",
      heroFrom: "hsl(95, 40%, 18%)", heroMid: "hsl(40, 35%, 22%)", heroTo: "hsl(28, 30%, 18%)",
    }),
    dark: palette({
      primary: "95 35% 46%", primaryFg: "30 30% 8%",
      gold: "38 70% 56%", goldFg: "28 35% 10%",
      bg: "30 22% 9%", fg: "42 25% 94%", card: "30 18% 13%",
      muted: "30 14% 18%", mutedFg: "40 14% 68%",
      accent: "95 22% 16%", accentFg: "88 40% 72%",
      border: "30 14% 22%", secondary: "30 16% 16%",
      heroFrom: "hsl(95, 30%, 10%)", heroMid: "hsl(40, 25%, 12%)", heroTo: "hsl(28, 22%, 9%)",
    }),
  },
  {
    id: "god",
    name: "Celestial",
    description: "Stained-glass purple, incense ivory, sacred gold",
    icon: "✨",
    kind: "lifestyle",
    atmosphere: "celestial",
    decorations: ["✨", "🕯️", "🌙"],
    defaultLoader: "birds",
    light: palette({
      primary: "272 42% 32%", primaryFg: "42 50% 97%",
      gold: "42 78% 48%", goldFg: "30 50% 12%",
      bg: "40 28% 94%", fg: "272 28% 14%", card: "0 0% 100%",
      muted: "40 18% 86%", mutedFg: "272 12% 40%",
      accent: "272 35% 92%", accentFg: "272 45% 28%",
      border: "40 16% 78%", secondary: "40 22% 95%",
      heroFrom: "hsl(272, 45%, 18%)", heroMid: "hsl(280, 35%, 22%)", heroTo: "hsl(42, 40%, 22%)",
    }),
    dark: palette({
      primary: "272 48% 62%", primaryFg: "272 30% 10%",
      gold: "42 80% 58%", goldFg: "30 40% 10%",
      bg: "272 28% 8%", fg: "40 30% 95%", card: "272 24% 13%",
      muted: "272 18% 18%", mutedFg: "40 16% 70%",
      accent: "272 28% 18%", accentFg: "42 70% 78%",
      border: "272 18% 22%", secondary: "272 20% 16%",
      heroFrom: "hsl(272, 40%, 8%)", heroMid: "hsl(280, 30%, 12%)", heroTo: "hsl(42, 30%, 12%)",
    }),
  },
  {
    id: "forest",
    name: "Forest",
    description: "Deep moss and fern",
    icon: "🌲",
    kind: "colour",
    atmosphere: "none",
    decorations: [],
    defaultLoader: "wildlife",
    light: palette({
      primary: "152 42% 28%", primaryFg: "0 0% 100%",
      gold: "88 40% 42%", goldFg: "90 30% 10%",
      bg: "140 18% 93%", fg: "150 25% 12%", card: "0 0% 100%",
      muted: "140 12% 86%", mutedFg: "150 12% 38%",
      accent: "152 30% 90%", accentFg: "152 45% 22%",
      border: "140 12% 78%", secondary: "140 14% 95%",
      heroFrom: "hsl(152, 40%, 16%)", heroMid: "hsl(160, 30%, 18%)", heroTo: "hsl(140, 25%, 14%)",
    }),
    dark: palette({
      primary: "152 40% 48%", primaryFg: "150 30% 8%",
      gold: "88 45% 55%", goldFg: "90 25% 8%",
      bg: "150 22% 8%", fg: "140 15% 94%", card: "150 18% 12%",
      muted: "150 14% 16%", mutedFg: "140 12% 68%",
      accent: "152 22% 16%", accentFg: "152 40% 72%",
      border: "150 14% 20%", secondary: "150 16% 14%",
      heroFrom: "hsl(152, 30%, 8%)", heroMid: "hsl(160, 22%, 10%)", heroTo: "hsl(140, 20%, 8%)",
    }),
  },
  {
    id: "rose",
    name: "Rose",
    description: "Blush pink and berry",
    icon: "🌹",
    kind: "colour",
    atmosphere: "none",
    decorations: [],
    defaultLoader: "birds",
    light: palette({
      primary: "340 55% 42%", primaryFg: "0 0% 100%",
      gold: "18 70% 55%", goldFg: "15 40% 12%",
      bg: "350 30% 95%", fg: "340 30% 14%", card: "0 0% 100%",
      muted: "350 18% 88%", mutedFg: "340 12% 40%",
      accent: "340 40% 92%", accentFg: "340 50% 32%",
      border: "350 16% 80%", secondary: "350 22% 95%",
      heroFrom: "hsl(340, 45%, 22%)", heroMid: "hsl(350, 35%, 24%)", heroTo: "hsl(18, 40%, 28%)",
    }),
    dark: palette({
      primary: "340 55% 62%", primaryFg: "340 30% 10%",
      gold: "18 75% 62%", goldFg: "15 35% 10%",
      bg: "340 22% 9%", fg: "350 20% 95%", card: "340 18% 13%",
      muted: "340 14% 18%", mutedFg: "350 12% 68%",
      accent: "340 22% 16%", accentFg: "340 50% 78%",
      border: "340 14% 22%", secondary: "340 16% 16%",
      heroFrom: "hsl(340, 30%, 8%)", heroMid: "hsl(350, 22%, 10%)", heroTo: "hsl(18, 25%, 12%)",
    }),
  },
  {
    id: "slate",
    name: "Slate",
    description: "Cool stone and steel",
    icon: "🪨",
    kind: "colour",
    atmosphere: "none",
    decorations: [],
    defaultLoader: "dogs",
    light: palette({
      primary: "215 18% 32%", primaryFg: "0 0% 100%",
      gold: "32 20% 48%", goldFg: "30 20% 12%",
      bg: "210 14% 93%", fg: "220 20% 12%", card: "0 0% 100%",
      muted: "210 10% 86%", mutedFg: "220 10% 40%",
      accent: "210 14% 90%", accentFg: "215 20% 28%",
      border: "210 10% 78%", secondary: "210 12% 95%",
      heroFrom: "hsl(215, 22%, 16%)", heroMid: "hsl(210, 16%, 20%)", heroTo: "hsl(220, 18%, 14%)",
    }),
    dark: palette({
      primary: "210 16% 62%", primaryFg: "220 20% 8%",
      gold: "32 25% 58%", goldFg: "30 15% 8%",
      bg: "220 16% 8%", fg: "210 12% 94%", card: "220 14% 12%",
      muted: "220 10% 16%", mutedFg: "210 8% 68%",
      accent: "215 12% 16%", accentFg: "210 14% 78%",
      border: "220 10% 20%", secondary: "220 12% 14%",
      heroFrom: "hsl(220, 18%, 7%)", heroMid: "hsl(215, 14%, 10%)", heroTo: "hsl(210, 12%, 8%)",
    }),
  },
  {
    id: "coral",
    name: "Coral",
    description: "Warm reef orange",
    icon: "🪸",
    kind: "colour",
    atmosphere: "sea",
    decorations: [],
    defaultLoader: "sea",
    light: palette({
      primary: "16 72% 48%", primaryFg: "0 0% 100%",
      gold: "38 80% 52%", goldFg: "25 40% 12%",
      bg: "24 40% 95%", fg: "16 30% 14%", card: "0 0% 100%",
      muted: "24 22% 88%", mutedFg: "16 12% 40%",
      accent: "16 50% 92%", accentFg: "16 60% 32%",
      border: "24 18% 80%", secondary: "24 28% 95%",
      heroFrom: "hsl(16, 55%, 28%)", heroMid: "hsl(24, 45%, 30%)", heroTo: "hsl(200, 30%, 22%)",
    }),
    dark: palette({
      primary: "16 70% 58%", primaryFg: "16 30% 8%",
      gold: "38 80% 60%", goldFg: "25 30% 8%",
      bg: "16 22% 8%", fg: "24 20% 95%", card: "16 18% 12%",
      muted: "16 14% 16%", mutedFg: "24 12% 68%",
      accent: "16 24% 16%", accentFg: "16 60% 78%",
      border: "16 14% 20%", secondary: "16 16% 14%",
      heroFrom: "hsl(16, 35%, 8%)", heroMid: "hsl(24, 28%, 10%)", heroTo: "hsl(200, 22%, 10%)",
    }),
  },
];

export type LoaderMotion = "pair" | "trail";

export const LOADER_PRESETS: { id: string; label: string; left: string; right: string; motion?: LoaderMotion }[] = [
  { id: "dogs", label: "Dogs", left: "🐕", right: "🐶" },
  { id: "cats", label: "Cats", left: "🐈", right: "🐱" },
  { id: "horses", label: "Horses", left: "🐴", right: "🐎" },
  { id: "boats", label: "Boats", left: "⛵", right: "🛥️" },
  { id: "farm", label: "Farm animals", left: "🐄", right: "🐷" },
  { id: "sheep", label: "Sheep", left: "🐑", right: "🐏" },
  { id: "chickens", label: "Chickens", left: "🐔", right: "🐓" },
  { id: "harvest", label: "Farm life", left: "🚜", right: "🌾" },
  { id: "paws", label: "Paw prints", left: "🐾", right: "🐾", motion: "trail" },
  { id: "birds", label: "Birds", left: "🐦", right: "🦜" },
  { id: "rabbits", label: "Rabbits", left: "🐰", right: "🐇" },
  { id: "wildlife", label: "Wildlife", left: "🦊", right: "🦉" },
  { id: "sea", label: "Sea", left: "🐟", right: "🐙" },
  { id: "ducks", label: "Ducks", left: "🦆", right: "🪿" },
  { id: "bees", label: "Bees", left: "🐝", right: "🌻" },
  { id: "penguins", label: "Penguins", left: "🐧", right: "❄️" },
  { id: "dinos", label: "Dinosaurs", left: "🦕", right: "🦖" },
  { id: "space", label: "Space", left: "🚀", right: "🪐" },
  { id: "butterflies", label: "Butterflies", left: "🦋", right: "🌸" },
  { id: "trains", label: "Trains", left: "🚂", right: "🚃" },
];

export function getTheme(id: string | undefined): AppTheme {
  return APP_THEMES.find((t) => t.id === id) ?? APP_THEMES[0];
}

export function getLoaderPreset(id: string | undefined) {
  return LOADER_PRESETS.find((p) => p.id === id) ?? LOADER_PRESETS[0];
}

export function hslToHex(hsl: Hsl): string {
  const [hStr, sStr, lStr] = hsl.trim().split(/\s+/);
  const h = parseFloat(hStr) / 360;
  const s = parseFloat(sStr) / 100;
  const l = parseFloat(lStr) / 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

export function hexToHsl(hex: string): Hsl {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      default: h = ((r - g) / d + 4) / 6;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function applyThemeVars(theme: AppTheme, customPrimary?: Hsl, customAccent?: Hsl) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const isDark = root.classList.contains("dark");
  const vars = { ...(isDark ? theme.dark : theme.light) };
  if (customPrimary) {
    vars.primary = customPrimary;
    vars.ring = customPrimary;
    vars["chart-1"] = customPrimary;
    const [ph, ps, pl] = customPrimary.split(" ");
    vars["gradient-primary"] = `linear-gradient(135deg, hsl(${ph} ${ps} ${Math.max(parseInt(pl) - 8, 12)}%), hsl(${customPrimary}))`;
    vars["shadow-glow"] = `0 0 24px hsl(${customPrimary} / 0.35)`;
  }
  if (customAccent) {
    vars.gold = customAccent;
    vars["chart-2"] = customAccent;
    vars["gradient-warm"] = `linear-gradient(135deg, hsl(${customAccent}), hsl(${customAccent}))`;
    vars["shadow-accent"] = `0 6px 20px -4px hsl(${customAccent} / 0.30)`;
  }
  if (customPrimary && customAccent) {
    vars["gradient-accent"] = `linear-gradient(135deg, hsl(${customPrimary}), hsl(${customAccent}))`;
  }
  root.setAttribute("data-theme", theme.id);
  (Object.entries(vars) as [keyof ThemeVars, string][]).forEach(([key, value]) => {
    root.style.setProperty(`--${key}`, value);
  });
  root.style.setProperty("--chrome-header", vars["chrome-header"]);
  root.style.setProperty("--chrome-nav", vars["chrome-nav"]);
}

export function clearThemeVars() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.removeAttribute("data-theme");
  const keys: (keyof ThemeVars)[] = [
    "background", "foreground", "card", "card-foreground", "popover", "popover-foreground",
    "primary", "primary-foreground", "secondary", "secondary-foreground",
    "muted", "muted-foreground", "accent", "accent-foreground",
    "border", "input", "ring", "gold", "gold-foreground", "chart-1", "chart-2",
    "gradient-primary", "gradient-warm", "gradient-accent", "gradient-hero",
    "chrome-header", "chrome-nav",
    "shadow-glow", "shadow-accent",
  ];
  keys.forEach((key) => root.style.removeProperty(`--${key}`));
}
