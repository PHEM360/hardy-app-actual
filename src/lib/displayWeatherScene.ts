import type { WeatherScene } from "@/hooks/useLocalWeather";
import type { DisplayWeather } from "@/hooks/useDisplayWeather";

export function weatherSceneFromForecast(
  weather: DisplayWeather | null,
  failed: boolean,
  now = new Date(),
): WeatherScene {
  if (weather) return weatherSceneFromCode(weather.code, weather.isDay, now.getHours());
  const hour = now.getHours();
  if (hour < 6 || hour >= 21) return "stars";
  if (hour >= 18) return "dusk";
  return failed ? "cloudy" : "partly";
}

export function weatherSceneFromCode(code: number, isDay: boolean, hour: number): WeatherScene {
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
