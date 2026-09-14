import { Fog, Lightning, Rain, Stars, SunSky } from "@/components/chrome/ChromeSceneLayer";
import { ChromeCanvasScene } from "@/components/chrome/ChromeCanvasScene";
import { DisplayPlaceCanvas } from "@/components/display/DisplayPlaceCanvas";
import { useDisplayWeather } from "@/hooks/useDisplayWeather";
import type { DisplayBackdropKind } from "@/lib/displayPages";
import { weatherSceneFromForecast } from "@/lib/displayWeatherScene";
import type { WeatherScene } from "@/hooks/useLocalWeather";

/**
 * Full-screen atmosphere behind remote-display widgets. Live weather follows
 * the page’s weather-widget place when one is set, otherwise the screen’s own
 * location — so a kitchen display in Cornwall snows when Cornwall snows.
 */
export function DisplayBackdrop({
  kind,
  latitude,
  longitude,
}: {
  kind: DisplayBackdropKind | undefined;
  accent?: string;
  latitude?: number;
  longitude?: number;
}) {
  const live = kind === "weather";
  const { weather, failed } = useDisplayWeather(latitude, longitude, live);
  if (!kind || kind === "none") return null;

  const weatherScene = live ? weatherSceneFromForecast(weather, failed) : null;

  return (
    <div className="greeting-weather pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {kind === "weather" && weatherScene && <LiveWeather scene={weatherScene} />}
      {kind === "stars" && <Stars compact={false} />}
      {kind === "aurora" && <DisplayPlaceCanvas scene="aurora" />}
      {kind === "nebula" && <ChromeCanvasScene scene="nebula" />}
      {kind === "meteors" && <ChromeCanvasScene scene="meteor" />}
      {kind === "golden" && <ChromeCanvasScene scene="rainglass" />}
      {kind === "fireflies" && <ChromeCanvasScene scene="fireflies" />}
      {kind === "snow" && <DisplayPlaceCanvas scene="snow" />}
      {kind === "rain" && <Rain heavy />}
      {kind === "clouds" && <DisplayPlaceCanvas scene="clouds" />}
      {kind === "harbour" && <DisplayPlaceCanvas scene="harbour" />}
      {kind === "ocean" && <ChromeCanvasScene scene="ocean" />}
      {kind === "sailing" && <DisplayPlaceCanvas scene="sailing" />}
      {kind === "pasture" && <DisplayPlaceCanvas scene="pasture" />}
      {kind === "harvest" && <DisplayPlaceCanvas scene="harvest" />}
    </div>
  );
}

function LiveWeather({ scene }: { scene: WeatherScene }) {
  if (scene === "snow") return <DisplayPlaceCanvas scene="snow" />;
  if (scene === "rain") return <Rain heavy />;
  if (scene === "storm") {
    return (
      <>
        <DisplayPlaceCanvas scene="clouds" stormy />
        <Rain heavy />
        <Lightning />
      </>
    );
  }
  if (scene === "fog") return <Fog />;
  if (scene === "cloudy") return <DisplayPlaceCanvas scene="clouds" />;
  if (scene === "partly") {
    return (
      <>
        <SunSky />
        <DisplayPlaceCanvas scene="clouds" />
      </>
    );
  }
  if (scene === "stars") return <Stars compact={false} />;
  if (scene === "dusk") return <SunSky dusk />;
  return <SunSky />;
}
