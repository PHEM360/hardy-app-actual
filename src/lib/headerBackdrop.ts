import type { ChromeSceneId } from "@/lib/chromeScenes";

export type HeaderPictureMode = "off" | "one" | "album" | "weather" | "today";

export const HEADER_PICTURE_MODES: { id: HeaderPictureMode; label: string; hint: string }[] = [
  { id: "off", label: "No picture", hint: "Colour and animation only" },
  { id: "one", label: "One picture", hint: "A single photo behind your name" },
  { id: "album", label: "Rotate album", hint: "Cycles photos you pick" },
  { id: "weather", label: "Weather & place", hint: "Matches what’s outside" },
  { id: "today", label: "Today’s events", hint: "Birthdays and special days first" },
];

export function normalizeHeaderPictureMode(
  mode: string | undefined,
  hasStaticPhoto: boolean,
): HeaderPictureMode {
  if (mode === "off" || mode === "one" || mode === "album" || mode === "weather" || mode === "today") {
    return mode;
  }
  return hasStaticPhoto ? "one" : "off";
}

export function weatherBackdropKind(code: number, isDay: boolean): "clear" | "night" | "cloud" | "rain" | "snow" | "fog" | "storm" {
  if ([95, 96, 99].includes(code)) return "storm";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain";
  if ([45, 48].includes(code)) return "fog";
  if ([3].includes(code)) return "cloud";
  if (!isDay) return "night";
  return "clear";
}

/** Soft, landscape stills (Unsplash) used only as header atmosphere. */
export const WEATHER_BACKDROP_URLS: Record<ReturnType<typeof weatherBackdropKind>, string> = {
  clear: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1600&q=60",
  night: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=1600&q=60",
  cloud: "https://images.unsplash.com/photo-1499346030926-9a72daac6c63?auto=format&fit=crop&w=1600&q=60",
  rain: "https://images.unsplash.com/photo-1428592953211-077101b2021b?auto=format&fit=crop&w=1600&q=60",
  snow: "https://images.unsplash.com/photo-1491002052546-bf38f186af56?auto=format&fit=crop&w=1600&q=60",
  fog: "https://images.unsplash.com/photo-1487621167305-5d248087c724?auto=format&fit=crop&w=1600&q=60",
  storm: "https://images.unsplash.com/photo-1605727216801-e27ce1d0d7de?auto=format&fit=crop&w=1600&q=60",
};

export interface HeaderOccasion {
  label: string;
  scene: ChromeSceneId;
  image?: string;
}

const OCCASION_IMAGE = {
  birthday: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1600&q=60",
  hearts: "https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=1600&q=60",
  fireworks: "https://images.unsplash.com/photo-1467810563316-b5476525c0f1?auto=format&fit=crop&w=1600&q=60",
  party: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1600&q=60",
};

export function occasionFromTitle(title: string): HeaderOccasion | null {
  const text = title.trim();
  if (!text) return null;
  if (/birthday|bday/i.test(text)) return { label: text, scene: "hearts", image: OCCASION_IMAGE.birthday };
  if (/anniversary|valentine/i.test(text)) return { label: text, scene: "hearts", image: OCCASION_IMAGE.hearts };
  if (/new\s*year|nye|firework/i.test(text)) return { label: text, scene: "fireworks", image: OCCASION_IMAGE.fireworks };
  if (/christmas|xmas|boxing day/i.test(text)) return { label: text, scene: "lanterns", image: OCCASION_IMAGE.party };
  if (/wedding|engagement/i.test(text)) return { label: text, scene: "hearts", image: OCCASION_IMAGE.hearts };
  if (/party|celebration|graduation|babyshower|baby shower/i.test(text)) {
    return { label: text, scene: "confetti", image: OCCASION_IMAGE.party };
  }
  return null;
}

export function pickTodayOccasion(
  events: { title: string }[],
  birthdayNames: string[] = [],
): HeaderOccasion | null {
  for (const name of birthdayNames) {
    if (name.trim()) return { label: name.includes("birthday") ? name : `${name}'s birthday`, scene: "hearts", image: OCCASION_IMAGE.birthday };
  }
  for (const event of events) {
    const occasion = occasionFromTitle(event.title);
    if (occasion) return occasion;
  }
  if (events[0]?.title.trim()) {
    return { label: events[0].title.trim(), scene: "confetti", image: OCCASION_IMAGE.party };
  }
  return null;
}
