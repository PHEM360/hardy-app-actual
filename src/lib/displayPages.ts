export type DisplayWidgetType =
  | "clock"
  | "photos"
  | "calendar"
  | "tasks"
  | "today"
  | "weather"
  | "message"
  | "countdown";

export type DisplayPageLayout = "full" | "halves" | "stack" | "main-side" | "quarters";
export type DisplayCalendarView = "agenda" | "month" | "week";
export type DisplayEventStyle = "titles" | "compact" | "dots";
export type DisplaySubtaskMode = "hide" | "open" | "all";
export type DisplayBackdropKind = "none" | "weather" | "stars" | "snow" | "rain" | "clouds" | "aurora";

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
  /** Picture albums from the Pictures page to include in this frame. */
  albumIds?: string[];
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
};

export const WIDGET_ORDER: DisplayWidgetType[] = [
  "today", "clock", "calendar", "tasks", "photos", "weather", "message", "countdown",
];

export interface DisplayTheme {
  id: string;
  label: string;
  background: string;
  accent: string;
  /** Tint layered over the background behind each widget. */
  panel: string;
}

export const DISPLAY_THEMES: DisplayTheme[] = [
  { id: "midnight", label: "Midnight", background: "#09090b", accent: "#7dd3fc", panel: "rgba(255,255,255,0.055)" },
  { id: "harbour", label: "Harbour", background: "#0b1524", accent: "#93c5fd", panel: "rgba(147,197,253,0.09)" },
  { id: "forest", label: "Forest", background: "#0a1a14", accent: "#6ee7b7", panel: "rgba(110,231,183,0.08)" },
  { id: "plum", label: "Plum", background: "#170d1e", accent: "#f0abfc", panel: "rgba(240,171,252,0.09)" },
  { id: "ember", label: "Ember", background: "#1b0f07", accent: "#fbbf24", panel: "rgba(251,191,36,0.09)" },
  { id: "slate", label: "Slate", background: "#131417", accent: "#e4e4e7", panel: "rgba(255,255,255,0.07)" },
];

export const BACKDROP_LABELS: Record<DisplayBackdropKind, string> = {
  none: "Plain",
  weather: "Match the weather",
  stars: "Night sky",
  snow: "Falling snow",
  rain: "Rain",
  clouds: "Drifting cloud",
  aurora: "Soft aurora",
};

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
    albumIds: [],
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
  };
}

/** Legacy pages were free-form, so infer the closest layout from widget count. */
function inferLayout(page: DisplayPage): DisplayPageLayout {
  if (page.layout) return page.layout;
  if (page.widgets.length >= 4) return "quarters";
  if (page.widgets.length === 3) return "main-side";
  if (page.widgets.length === 2) return "halves";
  return "full";
}

/** Snaps a page's widgets onto its layout so the editor and the screen agree. */
export function applyPageLayout(page: DisplayPage): DisplayPage {
  const layout = inferLayout(page);
  const slots = layoutSlots(layout, page.splitRatio);
  return {
    ...page,
    layout,
    widgets: page.widgets.slice(0, slots.length).map((widget, index) => ({
      ...createDisplayWidget(widget.type),
      ...widget,
      ...slots[index],
    })),
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
  {
    id: "today",
    name: "Today",
    durationSeconds: 300,
    background: DISPLAY_THEMES[0].background,
    theme: "midnight",
    backdrop: "none",
    layout: "full",
    widgets: [{ ...createDisplayWidget("today"), id: "today-main" }],
  },
];
