import { useEffect, useState } from "react";

export interface DisplayWeather {
  temperature: number;
  high: number;
  low: number;
  code: number;
  isDay: boolean;
  description: string;
}

const CACHE_PREFIX = "hardy-display-weather:";
const CACHE_TTL_MS = 15 * 60 * 1000;

const DESCRIPTIONS: [number[], string][] = [
  [[0], "Clear"],
  [[1, 2], "Partly cloudy"],
  [[3], "Cloudy"],
  [[45, 48], "Fog"],
  [[51, 53, 55, 56, 57], "Drizzle"],
  [[61, 63, 65, 66, 67, 80, 81, 82], "Rain"],
  [[71, 73, 75, 77, 85, 86], "Snow"],
  [[95, 96, 99], "Thunderstorms"],
];

export function weatherDescription(code: number) {
  return DESCRIPTIONS.find(([codes]) => codes.includes(code))?.[1] || "Unavailable";
}

function readCache(key: string): DisplayWeather | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; value: DisplayWeather };
    return Date.now() - parsed.at > CACHE_TTL_MS ? null : parsed.value;
  } catch {
    return null;
  }
}

function coordsFromDevice(): Promise<{ lat: number; lon: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lon: position.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 24 * 60 * 60 * 1000 },
    );
  });
}

/**
 * Current conditions for a wall display. A place chosen in the widget settings
 * wins, because a screen in a hallway is often refused location permission.
 */
export function useDisplayWeather(latitude?: number, longitude?: number) {
  const fixed = !!latitude && !!longitude;
  const cacheKey = fixed ? `${latitude!.toFixed(2)},${longitude!.toFixed(2)}` : "device";
  const [weather, setWeather] = useState<DisplayWeather | null>(() => readCache(cacheKey));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const cached = readCache(cacheKey);
    if (cached) setWeather(cached);

    const load = async () => {
      const coords = fixed ? { lat: latitude!, lon: longitude! } : await coordsFromDevice();
      if (cancelled) return;
      if (!coords) {
        setFailed(true);
        return;
      }
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}`
          + "&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1";
        const response = await fetch(url);
        if (!response.ok) throw new Error("weather request failed");
        const data = await response.json();
        const code = Number(data?.current?.weather_code ?? -1);
        const next: DisplayWeather = {
          temperature: Math.round(Number(data?.current?.temperature_2m ?? 0)),
          high: Math.round(Number(data?.daily?.temperature_2m_max?.[0] ?? 0)),
          low: Math.round(Number(data?.daily?.temperature_2m_min?.[0] ?? 0)),
          code,
          isDay: Number(data?.current?.is_day) === 1,
          description: weatherDescription(code),
        };
        if (cancelled) return;
        setWeather(next);
        setFailed(false);
        try {
          localStorage.setItem(`${CACHE_PREFIX}${cacheKey}`, JSON.stringify({ at: Date.now(), value: next }));
        } catch {
          /* private mode or quota — the in-memory value is enough */
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    };

    void load();
    const timer = setInterval(() => void load(), CACHE_TTL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [cacheKey, fixed, latitude, longitude]);

  return { weather, failed };
}
