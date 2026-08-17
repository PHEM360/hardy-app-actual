import { useEffect, useState } from "react";

export type WeatherScene =
  | "sunny"
  | "partly"
  | "cloudy"
  | "rain"
  | "snow"
  | "storm"
  | "fog"
  | "stars"
  | "dusk";

const COORDS_KEY = "greeting-weather-coords";
const FORECAST_KEY = "greeting-weather-forecast";
const COORDS_TTL_MS = 24 * 60 * 60 * 1000;
const FORECAST_TTL_MS = 20 * 60 * 1000;

function sceneFromCode(code: number, isDay: boolean, hour: number): WeatherScene {
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([95, 96, 99].includes(code)) return "storm";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain";
  if ([45, 48].includes(code)) return "fog";
  if (!isDay) return "stars";
  if (code === 0) return hour >= 17 ? "dusk" : "sunny";
  if (code === 1 || code === 2) return hour >= 17 ? "dusk" : "partly";
  if (code === 3) return "cloudy";
  return isDay ? (hour >= 17 ? "dusk" : "sunny") : "stars";
}

function sceneFromHour(hour: number): WeatherScene {
  if (hour < 6 || hour >= 20) return "stars";
  if (hour >= 17) return "dusk";
  if (hour < 10) return "sunny";
  return "partly";
}

function readCache<T>(key: string, ttl: number): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; value: T };
    if (Date.now() - parsed.at > ttl) return null;
    return parsed.value;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), value }));
  } catch {
    /* ignore quota / private mode */
  }
}

function getPosition(): Promise<{ lat: number; lon: number } | null> {
  const cached = readCache<{ lat: number; lon: number }>(COORDS_KEY, COORDS_TTL_MS);
  if (cached) return Promise.resolve(cached);

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        writeCache(COORDS_KEY, coords);
        resolve(coords);
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 4000, maximumAge: COORDS_TTL_MS }
    );
  });
}

export function useLocalWeather(): WeatherScene {
  const hour = new Date().getHours();
  const [scene, setScene] = useState<WeatherScene>(() => {
    const cached = readCache<{ scene: WeatherScene }>(FORECAST_KEY, FORECAST_TTL_MS);
    return cached?.scene ?? sceneFromHour(hour);
  });

  useEffect(() => {
    let cancelled = false;

    const cached = readCache<{ scene: WeatherScene }>(FORECAST_KEY, FORECAST_TTL_MS);
    if (cached) {
      setScene(cached.scene);
      return;
    }

    (async () => {
      const coords = await getPosition();
      if (cancelled) return;
      if (!coords) {
        setScene(sceneFromHour(new Date().getHours()));
        return;
      }

      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=weather_code,is_day&timezone=auto`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("weather fetch failed");
        const data = await res.json();
        const code = Number(data?.current?.weather_code ?? -1);
        const isDay = Number(data?.current?.is_day) === 1;
        const next = sceneFromCode(code, isDay, new Date().getHours());
        if (cancelled) return;
        writeCache(FORECAST_KEY, { scene: next });
        setScene(next);
      } catch {
        if (!cancelled) setScene(sceneFromHour(new Date().getHours()));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return scene;
}
