import { useEffect, useState } from "react";
import { weatherDescription } from "@/hooks/useDisplayWeather";

export interface ForecastDay {
  date: string;
  high: number;
  low: number;
  code: number;
  description: string;
}

export interface WeatherForecast {
  temperature: number;
  description: string;
  code: number;
  days: ForecastDay[];
}

const CACHE_KEY = "hardy-weather-forecast";
const CACHE_TTL_MS = 20 * 60 * 1000;
const COORDS_KEY = "greeting-weather-coords";

function readCache<T>(key: string, ttl: number): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; value: T };
    return Date.now() - parsed.at > ttl ? null : parsed.value;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), value }));
  } catch {
    /* ignore */
  }
}

function getPosition(): Promise<{ lat: number; lon: number } | null> {
  const cached = readCache<{ lat: number; lon: number }>(COORDS_KEY, 24 * 60 * 60 * 1000);
  if (cached) return Promise.resolve(cached);
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        writeCache(COORDS_KEY, coords);
        resolve(coords);
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 24 * 60 * 60 * 1000 },
    );
  });
}

export function useWeatherForecast() {
  const [forecast, setForecast] = useState<WeatherForecast | null>(() => readCache<WeatherForecast>(CACHE_KEY, CACHE_TTL_MS));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const coords = await getPosition();
      if (cancelled) return;
      if (!coords) {
        setFailed(true);
        return;
      }
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}`
          + "&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=4";
        const res = await fetch(url);
        if (!res.ok) throw new Error("forecast failed");
        const data = await res.json();
        const code = Number(data?.current?.weather_code ?? -1);
        const dates: string[] = data?.daily?.time ?? [];
        const next: WeatherForecast = {
          temperature: Math.round(Number(data?.current?.temperature_2m ?? 0)),
          code,
          description: weatherDescription(code),
          days: dates.map((date, i) => {
            const dayCode = Number(data?.daily?.weather_code?.[i] ?? -1);
            return {
              date,
              high: Math.round(Number(data?.daily?.temperature_2m_max?.[i] ?? 0)),
              low: Math.round(Number(data?.daily?.temperature_2m_min?.[i] ?? 0)),
              code: dayCode,
              description: weatherDescription(dayCode),
            };
          }),
        };
        if (cancelled) return;
        setForecast(next);
        setFailed(false);
        writeCache(CACHE_KEY, next);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { forecast, failed };
}
