import { describe, expect, it } from "vitest";
import { weatherSceneFromCode, weatherSceneFromForecast } from "@/lib/displayWeatherScene";
import type { DisplayWeather } from "@/hooks/useDisplayWeather";

describe("display weather backdrop", () => {
  it("follows the Open-Meteo code instead of time of day", () => {
    expect(weatherSceneFromCode(73, true, 14)).toBe("snow");
    expect(weatherSceneFromCode(95, true, 14)).toBe("storm");
    expect(weatherSceneFromCode(61, true, 14)).toBe("rain");
    expect(weatherSceneFromCode(45, true, 14)).toBe("fog");
    expect(weatherSceneFromCode(0, true, 11)).toBe("sunny");
    expect(weatherSceneFromCode(2, true, 11)).toBe("partly");
    expect(weatherSceneFromCode(3, true, 11)).toBe("cloudy");
    expect(weatherSceneFromCode(0, false, 22)).toBe("stars");
  });

  it("does not invent sunshine when the forecast failed", () => {
    const evening = new Date("2026-01-15T19:00:00");
    expect(weatherSceneFromForecast(null, true, evening)).toBe("dusk");
    const noon = new Date("2026-01-15T12:00:00");
    expect(weatherSceneFromForecast(null, true, noon)).toBe("cloudy");
    const night = new Date("2026-01-15T23:00:00");
    expect(weatherSceneFromForecast(null, true, night)).toBe("stars");
  });

  it("uses the live forecast when it arrives", () => {
    const weather: DisplayWeather = {
      temperature: 2,
      high: 4,
      low: 0,
      code: 75,
      isDay: true,
      description: "Snow",
    };
    expect(weatherSceneFromForecast(weather, false, new Date("2026-01-15T12:00:00"))).toBe("snow");
  });
});
