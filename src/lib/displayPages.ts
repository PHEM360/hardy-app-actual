export type DisplayWidgetType =
  | "clock"
  | "photos"
  | "calendar"
  | "tasks"
  | "today"
  | "weather"
  | "message"
  | "countdown"
  | "birthdays"
  | "familyBoard"
  | "empty";

export type DisplayPageLayout = "full" | "halves" | "stack" | "main-side" | "quarters";
export type DisplayCalendarView = "agenda" | "month" | "week";
export type DisplayEventStyle = "titles" | "compact" | "dots";
export type DisplaySubtaskMode = "hide" | "open" | "all";
export type DisplayBackdropKind =
  | "none"
  | "weather"
  | "stars"
  | "aurora"
  | "nebula"
  | "meteors"
  | "golden"
  | "fireflies"
  | "snow"
  | "rain"
  | "clouds"
  | "harbour"
  | "ocean"
  | "sailing"
  | "pasture"
  | "harvest"
  | "galaxy"
  | "silk"
  | "caustics"
  | "bokeh"
  | "plasma"
  | "orion"
  | "biolume"
  | "startrails"
  | "lava"
  | "ionstorm";

export type DisplayInkMode = "auto" | "light" | "dark";

export interface DisplayWidgetLayout {
  id: string;
  type: DisplayWidgetType;
  x: number;
  y: number;
  w: number;
  h: number;
  title?: string;
  accentColor?: string;
  clockStyle?: "digital" | "analog";
  format24h?: boolean;
  showSeconds?: boolean;
  showDate?: boolean;
  photoIds?: string[];
  photoAlbumIds?: string[];
  photoRefs?: { id: string; url: string; caption?: string }[];
  photoIntervalSeconds?: number;
  calendarView?: DisplayCalendarView;
  calendarEventStyle?: DisplayEventStyle;
  calendarDaysAhead?: number;
  calendarCategories?: string[];
  eventColor?: string;
  taskFilter?: "today" | "open" | "all";
  taskLimit?: number;
  taskIds?: string[];
  subtaskMode?: DisplaySubtaskMode;
  /** Seconds before a long list scrolls on to what it could not fit. */
  autoCycleSeconds?: number;
  message?: string;
  countdownTo?: string;
  countdownLabel?: string;
  weatherLatitude?: number;
  weatherLongitude?: number;
  weatherPlace?: string;
  birthdaysDaysAhead?: number;
  familyBoardLimit?: number;
}

export interface DisplayPage {
  id: string;
  name: string;
  durationSeconds: number;
  background: string;
  layout?: DisplayPageLayout;
  /** How much of the page the first area takes, 0.25–0.75. */
  splitRatio?: number;
  theme?: string;
  backdrop?: DisplayBackdropKind;
  /** Auto follows the backdrop; light/dark force clock and body text. */
  ink?: DisplayInkMode;
  /** Hex override for clock and body text. Empty/omitted means use ink + theme. */
  textColor?: string;
  /** "HH:mm" window this page may appear in. Omitted means all day. */
  activeFrom?: string;
  activeTo?: string;
  widgets: DisplayWidgetLayout[];
}

export interface DisplayPageSlot {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const WIDGET_LABELS: Record<DisplayWidgetType, string> = {
  today: "Today summary",
  clock: "Clock",
  photos: "Photo frame",
  calendar: "Calendar",
  tasks: "Task list",
  weather: "Weather",
  message: "Message board",
  countdown: "Countdown",
  birthdays: "Birthdays",
  familyBoard: "Family board",
  empty: "Empty area",
};

export const WIDGET_DESCRIPTIONS: Record<DisplayWidgetType, string> = {
  today: "Date, next events and today’s jobs together",
  clock: "Large digital or analogue clock",
  photos: "Slideshow of the photos you choose",
  calendar: "Month grid, this week, or what’s coming up",
  tasks: "Outstanding jobs, including their subtasks",
  weather: "Today’s conditions and temperature",
  message: "A note for the household, in big friendly text",
  countdown: "Days to go until a date that matters",
  birthdays: "Upcoming birthdays with a countdown",
  familyBoard: "Notes anyone in the household has posted from their phone",
  empty: "Nothing in this area",
};

export const WIDGET_ORDER: DisplayWidgetType[] = [
  "today", "clock", "calendar", "tasks", "photos", "weather", "birthdays", "familyBoard", "message", "countdown",
];

export interface DisplayTheme {
  id: string;
  label: string;
  background: string;
  accent: string;
  /** Clock and body text when the backdrop does not force a contrast colour. */
  ink: string;
  /** Tint layered over the background behind each widget. */
  panel: string;
}

export const DISPLAY_THEMES: DisplayTheme[] = [
  { id: "midnight", label: "Midnight", background: "#09090b", accent: "#7dd3fc", ink: "#e0f2fe", panel: "rgba(255,255,255,0.055)" },
  { id: "harbour", label: "Harbour", background: "#0b1524", accent: "#93c5fd", ink: "#dbeafe", panel: "rgba(147,197,253,0.09)" },
  { id: "forest", label: "Forest", background: "#0a1a14", accent: "#6ee7b7", ink: "#d1fae5", panel: "rgba(110,231,183,0.08)" },
  { id: "plum", label: "Plum", background: "#170d1e", accent: "#f0abfc", ink: "#fae8ff", panel: "rgba(240,171,252,0.09)" },
  { id: "ember", label: "Ember", background: "#1b0f07", accent: "#fbbf24", ink: "#fef3c7", panel: "rgba(251,191,36,0.09)" },
  { id: "slate", label: "Slate", background: "#131417", accent: "#e4e4e7", ink: "#f4f4f5", panel: "rgba(255,255,255,0.07)" },
];

export const BACKDROP_LABELS: Record<DisplayBackdropKind, string> = {
  none: "Plain",
  weather: "Live weather",
  stars: "Night sky",
  aurora: "Northern lights",
  nebula: "Nebula",
  meteors: "Meteor shower",
  golden: "Golden hour",
  fireflies: "Candlelight",
  snow: "Snowfall",
  rain: "Rain",
  clouds: "Passing clouds",
  harbour: "Harbour evening",
  ocean: "Open water",
  sailing: "Under sail",
  pasture: "Summer pasture",
  harvest: "Harvest fields",
  galaxy: "Spiral galaxy",
  silk: "Iridescent silk",
  caustics: "Sunlit water",
  bokeh: "Soft lights",
  plasma: "Plasma ribbons",
  orion: "Orion pillars",
  biolume: "Bioluminescence",
  startrails: "Star trails",
  lava: "Lava lamp",
  ionstorm: "Ion storm",
};

export const BACKDROP_HINTS: Record<DisplayBackdropKind, string> = {
  none: "Just the page colour",
  weather: "Snow, rain, sun or stars from the real forecast",
  stars: "Moon, constellations and the odd shooting star",
  aurora: "Slow curtains of green and violet light",
  nebula: "Deep-space colour drifting behind the widgets",
  meteors: "A quiet sky with ion trails",
  golden: "Warm late-day light and dust",
  fireflies: "Warm lights in a quiet evening",
  snow: "Deep, slow flakes with a winter haze",
  rain: "Streaks on glass and a dark wet sky",
  clouds: "Layered cloud sliding across the sun",
  harbour: "Tide, a lighthouse and a small boat",
  ocean: "A long sunset swell",
  sailing: "A yacht on open water",
  pasture: "Wind moving through summer grass",
  harvest: "Gold fields and hay at dusk",
  galaxy: "A slow spiral with a ringed planet",
  silk: "Iridescent cloth catching the light",
  caustics: "Sun through water, shifting on the floor",
  bokeh: "Out-of-focus lights drifting past",
  plasma: "Electric colour folding through darkness",
  orion: "A denser nebula with a dark dust lane",
  biolume: "Creatures lighting a deep-sea night",
  startrails: "Long-exposure rings around the pole",
  lava: "Slow molten blobs rising and falling",
  ionstorm: "Violet sky with the odd lightning fork",
};

export const BACKDROP_GROUPS: { id: string; label: string; options: DisplayBackdropKind[] }[] = [
  { id: "space", label: "Space", options: ["none", "stars", "nebula", "orion", "galaxy", "startrails", "meteors", "plasma", "ionstorm"] },
  { id: "light", label: "Light & water", options: ["aurora", "silk", "bokeh", "caustics", "biolume", "lava", "golden"] },
  { id: "weather", label: "Weather", options: ["weather", "snow", "rain"] },
  { id: "places", label: "Places", options: ["harbour", "ocean", "sailing", "pasture", "harvest"] },
];

export const BACKDROP_THUMBS: Record<DisplayBackdropKind, string> = {
  none: "linear-gradient(180deg, #18181b, #09090b)",
  weather: "linear-gradient(180deg, #7dd3fc 0%, #0ea5e9 38%, #0f172a 100%)",
  stars: "radial-gradient(circle at 76% 18%, #93c5fd 0%, #0b1228 42%, #020617 100%)",
  aurora: "linear-gradient(180deg, #022c22 0%, #14532d 28%, #5b21b6 72%, #0f172a 100%)",
  nebula: "radial-gradient(circle at 30% 40%, #db2777 0%, #1e1b4b 46%, #020617 100%)",
  meteors: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #312e81 100%)",
  golden: "linear-gradient(180deg, #fdba74 0%, #fb7185 42%, #7c2d12 100%)",
  fireflies: "radial-gradient(circle at 30% 70%, #fbbf24 0%, #1c1917 55%, #09090b 100%)",
  snow: "linear-gradient(180deg, #e2e8f0 0%, #94a3b8 40%, #1e293b 100%)",
  rain: "linear-gradient(180deg, #334155 0%, #1e3a5f 50%, #0f172a 100%)",
  clouds: "linear-gradient(180deg, #f8fafc 0%, #94a3b8 45%, #334155 100%)",
  harbour: "linear-gradient(180deg, #fdba74 0%, #0369a1 48%, #082f49 100%)",
  ocean: "linear-gradient(180deg, #fdba74 0%, #fb7185 28%, #0c4a6e 100%)",
  sailing: "linear-gradient(180deg, #7dd3fc 0%, #0284c7 40%, #0c4a6e 100%)",
  pasture: "linear-gradient(180deg, #7dd3fc 0%, #86efac 42%, #365314 100%)",
  harvest: "linear-gradient(180deg, #fdba74 0%, #f59e0b 40%, #78350f 100%)",
  galaxy: "conic-gradient(from 120deg at 40% 45%, #2e1065, #db2777, #1d4ed8, #020617)",
  silk: "linear-gradient(135deg, #fda4af 0%, #c4b5fd 45%, #7dd3fc 100%)",
  caustics: "radial-gradient(circle at 40% 30%, #fef9c3 0%, #22d3ee 38%, #0e7490 100%)",
  bokeh: "radial-gradient(circle at 30% 40%, #f9a8d4 0%, #7c3aed 48%, #0f172a 100%)",
  plasma: "linear-gradient(120deg, #4c1d95 0%, #db2777 40%, #0ea5e9 100%)",
  orion: "radial-gradient(circle at 48% 50%, #fda4af 0%, #7c3aed 32%, #083344 70%, #020617 100%)",
  biolume: "linear-gradient(180deg, #082f49 0%, #155e75 40%, #022c22 100%)",
  startrails: "radial-gradient(circle at 52% 42%, #93c5fd 0%, #1e3a8a 42%, #020617 100%)",
  lava: "radial-gradient(circle at 50% 80%, #fb923c 0%, #b91c1c 40%, #1c1917 100%)",
  ionstorm: "linear-gradient(180deg, #5b21b6 0%, #1e1b4b 48%, #0f0320 100%)",
};

/** Light scenes need dark type so the clock stays readable. */
export const BACKDROP_DARK_TEXT = new Set<DisplayBackdropKind>([
  "golden", "snow", "clouds", "pasture", "harvest",
]);

export function displayInkColor(page: DisplayPage, theme: DisplayTheme = displayTheme(page)): string {
  const custom = page.textColor?.trim();
  if (custom) return custom;
  if (page.ink === "dark") return "#1c1917";
  if (page.ink === "light") return "#f8fafc";
  const kind = page.backdrop || "none";
  if (BACKDROP_DARK_TEXT.has(kind)) return "#1c1917";
  return theme.ink;
}

export function displayInkShadow(ink: string): string {
  const hex = ink.replace("#", "");
  const n = hex.length === 3
    ? hex.split("").map((c) => parseInt(c + c, 16))
    : [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  const luma = (n[0] * 299 + n[1] * 587 + n[2] * 114) / 1000;
  return luma > 150
    ? "0 1px 10px rgba(0,0,0,.55), 0 0 2px rgba(0,0,0,.4)"
    : "0 1px 10px rgba(255,255,255,.35), 0 0 2px rgba(255,255,255,.25)";
}

export function displayTheme(page: DisplayPage): DisplayTheme {
  const found = DISPLAY_THEMES.find((theme) => theme.id === page.theme);
  if (found) return found;
  // Pages built before themes existed keep whatever background they were given.
  return { ...DISPLAY_THEMES[0], background: page.background || DISPLAY_THEMES[0].background };
}

function clampRatio(ratio: number | undefined, fallback: number) {
  if (!Number.isFinite(ratio)) return fallback;
  return Math.min(0.75, Math.max(0.25, ratio as number));
}

/** Ratio expressed in whole grid columns, so widgets always land on the grid. */
function ratioColumns(ratio: number | undefined, fallback: number, min = 3, max = 9) {
  return Math.min(max, Math.max(min, Math.round(clampRatio(ratio, fallback) * 12)));
}

export function layoutSlots(layout: DisplayPageLayout | undefined, splitRatio?: number): DisplayPageSlot[] {
  switch (layout) {
    case "halves": {
      const left = ratioColumns(splitRatio, 0.5);
      return [{ x: 0, y: 0, w: left, h: 12 }, { x: left, y: 0, w: 12 - left, h: 12 }];
    }
    case "stack": {
      const top = ratioColumns(splitRatio, 0.5);
      return [{ x: 0, y: 0, w: 12, h: top }, { x: 0, y: top, w: 12, h: 12 - top }];
    }
    case "main-side": {
      const main = ratioColumns(splitRatio, 0.66, 4, 9);
      const side = 12 - main;
      return [
        { x: 0, y: 0, w: main, h: 12 },
        { x: main, y: 0, w: side, h: 6 },
        { x: main, y: 6, w: side, h: 6 },
      ];
    }
    case "quarters":
      return [
        { x: 0, y: 0, w: 6, h: 6 }, { x: 6, y: 0, w: 6, h: 6 },
        { x: 0, y: 6, w: 6, h: 6 }, { x: 6, y: 6, w: 6, h: 6 },
      ];
    default:
      return [{ x: 0, y: 0, w: 12, h: 12 }];
  }
}

export const PAGE_LAYOUTS: { id: DisplayPageLayout; label: string; hint: string; resizable: boolean }[] = [
  { id: "full", label: "Full screen", hint: "One widget fills the screen", resizable: false },
  { id: "halves", label: "Side by side", hint: "Two widgets, left and right", resizable: true },
  { id: "stack", label: "Top and bottom", hint: "Two widgets stacked", resizable: true },
  { id: "main-side", label: "Main plus sidebar", hint: "One large widget with two smaller", resizable: true },
  { id: "quarters", label: "Four panels", hint: "Four equal widgets", resizable: false },
];

export function layoutIsResizable(layout: DisplayPageLayout | undefined) {
  return PAGE_LAYOUTS.find((option) => option.id === layout)?.resizable === true;
}

function newId(prefix: string) {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Every field is given a concrete value: Firestore rejects undefined, and a
 * half-filled widget would fail to save the whole page.
 */
export function createDisplayWidget(type: DisplayWidgetType): DisplayWidgetLayout {
  return {
    id: newId("w"),
    type,
    x: 0,
    y: 0,
    w: 12,
    h: 12,
    title: "",
    accentColor: type === "clock" ? "#7dd3fc" : type === "photos" ? "#f0abfc" : "#5eead4",
    clockStyle: "digital",
    format24h: true,
    showSeconds: false,
    showDate: true,
    photoIds: [],
    photoAlbumIds: [],
    photoRefs: [],
    photoIntervalSeconds: 20,
    calendarView: type === "calendar" ? "month" : "agenda",
    calendarEventStyle: "titles",
    calendarDaysAhead: 14,
    calendarCategories: [],
    eventColor: "#f87171",
    taskFilter: "open",
    taskLimit: 8,
    taskIds: [],
    subtaskMode: "open",
    autoCycleSeconds: 20,
    message: "",
    countdownTo: "",
    countdownLabel: "",
    weatherLatitude: 0,
    weatherLongitude: 0,
    weatherPlace: "",
    birthdaysDaysAhead: 30,
    familyBoardLimit: 6,
  };
}

export function isEmptyDisplayWidget(widget?: Pick<DisplayWidgetLayout, "type"> | null): boolean {
  return !widget || widget.type === "empty";
}

/** Legacy pages were free-form, so infer the closest layout from widget count. */
function inferLayout(page: DisplayPage): DisplayPageLayout {
  if (page.layout) return page.layout;
  const filled = page.widgets.filter((widget) => !isEmptyDisplayWidget(widget)).length;
  const count = Math.max(filled, page.widgets.length);
  if (count >= 4) return "quarters";
  if (count === 3) return "main-side";
  if (count === 2) return "halves";
  return "full";
}

/** Snaps a page's widgets onto its layout so the editor and the screen agree. */
export function applyPageLayout(page: DisplayPage): DisplayPage {
  const layout = inferLayout(page);
  const slots = layoutSlots(layout, page.splitRatio);
  return {
    ...page,
    layout,
    widgets: slots.map((slot, index) => {
      const widget = page.widgets[index];
      if (isEmptyDisplayWidget(widget)) {
        return {
          ...createDisplayWidget("empty"),
          ...(widget?.id ? { id: widget.id } : {}),
          ...slot,
        };
      }
      return {
        ...createDisplayWidget(widget.type),
        ...widget,
        ...slot,
      };
    }),
  };
}

function minutesFromTime(value: string | undefined) {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

/**
 * A page with an active window only appears inside it, so a screen can show a
 * clock overnight and a summary during the day. Windows may cross midnight.
 */
export function isPageActiveAt(page: DisplayPage, now: Date) {
  const from = minutesFromTime(page.activeFrom);
  const to = minutesFromTime(page.activeTo);
  if (from === null || to === null || from === to) return true;
  const minuteOfDay = now.getHours() * 60 + now.getMinutes();
  return from < to
    ? minuteOfDay >= from && minuteOfDay < to
    : minuteOfDay >= from || minuteOfDay < to;
}

/** Pages due on screen right now, falling back to everything if none match. */
export function activeDisplayPages(pages: DisplayPage[], now: Date) {
  const scheduled = pages.filter((page) => isPageActiveAt(page, now));
  return scheduled.length > 0 ? scheduled : pages;
}

export function pageScheduleLabel(page: DisplayPage) {
  if (!page.activeFrom || !page.activeTo || page.activeFrom === page.activeTo) return "All day";
  return `${page.activeFrom} – ${page.activeTo}`;
}

export function durationLabel(seconds: number) {
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

export const DURATION_CHOICES = [15, 30, 60, 300, 600, 900, 1800, 3600, 7200];

/** Firestore rejects undefined anywhere in a document, including nested arrays. */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => stripUndefined(item)) as unknown as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, stripUndefined(item)]),
    ) as T;
  }
  return value;
}

function preset(
  name: string,
  layout: DisplayPageLayout,
  types: DisplayWidgetType[],
  durationSeconds: number,
  extra: Partial<DisplayPage> = {},
): DisplayPage {
  return applyPageLayout({
    id: newId("p"),
    name,
    durationSeconds,
    background: DISPLAY_THEMES[0].background,
    theme: "midnight",
    backdrop: "none",
    layout,
    widgets: types.map(createDisplayWidget),
    ...extra,
  });
}

export interface DisplayPagePreset {
  id: string;
  name: string;
  description: string;
  build: () => DisplayPage;
}

export const PAGE_PRESETS: DisplayPagePreset[] = [
  {
    id: "today",
    name: "Today page",
    description: "Date, next events and today’s jobs",
    build: () => preset("Today", "full", ["today"], 300),
  },
  {
    id: "month-calendar",
    name: "Full month calendar",
    description: "This month’s grid with every event",
    build: () => preset("Calendar", "full", ["calendar"], 3600),
  },
  {
    id: "photo-frame",
    name: "Digital photo frame",
    description: "Your chosen photos, full screen",
    build: () => preset("Photos", "full", ["photos"], 300, { backdrop: "none" }),
  },
  {
    id: "clock",
    name: "Night clock",
    description: "Big clock under a night sky, 21:00–06:00",
    build: () => preset("Clock", "full", ["clock"], 3600, {
      activeFrom: "21:00", activeTo: "06:00", backdrop: "stars",
    }),
  },
  {
    id: "photos-tasks",
    name: "Photos and jobs",
    description: "Slideshow beside the task list",
    build: () => preset("Photos & jobs", "halves", ["photos", "tasks"], 300),
  },
  {
    id: "morning",
    name: "Morning briefing",
    description: "Clock and weather with what’s on and to do",
    build: () => preset("Morning", "main-side", ["today", "weather", "tasks"], 300, {
      theme: "harbour", backdrop: "weather",
    }),
  },
];

export const DEFAULT_DISPLAY_PAGES: DisplayPage[] = [
  applyPageLayout({
    id: "today",
    name: "Today",
    durationSeconds: 300,
    background: DISPLAY_THEMES[0].background,
    theme: "midnight",
    backdrop: "none",
    layout: "full",
    widgets: [{ ...createDisplayWidget("today"), id: "today-main" }],
  }),
];
