import { useMemo } from "react";
import { isSameDay, startOfDay } from "date-fns";
import { useAppearance } from "@/hooks/useAppearance";
import { useCalendar } from "@/hooks/useCalendar";
import { useDisplayWeather } from "@/hooks/useDisplayWeather";
import { usePhotos } from "@/hooks/usePhotos";
import { resolveChromeScene, type ChromeSceneId } from "@/lib/chromeScenes";
import {
  normalizeHeaderPictureMode,
  pickTodayOccasion,
  weatherBackdropKind,
  WEATHER_BACKDROP_URLS,
} from "@/lib/headerBackdrop";

export function useHeaderBackdrop() {
  const appearance = useAppearance();
  const { weather } = useDisplayWeather();
  const { events } = useCalendar();
  const photos = usePhotos();
  const hour = new Date().getHours();
  const isNight = hour >= 20 || hour < 6;
  const mode = normalizeHeaderPictureMode(appearance.headerPictureMode, !!appearance.headerPhotoUrl);
  const albumIds = appearance.headerAlbumIds;

  const albumUrls = useMemo(() => {
    const wanted = new Set(albumIds);
    const items = wanted.size
      ? photos.items.filter((item) => wanted.has(item.albumId))
      : photos.items;
    return items.map((item) => item.url).filter(Boolean).slice(0, 40);
  }, [albumIds, photos.items]);

  const todayEvents = useMemo(() => {
    const today = startOfDay(new Date());
    return events.filter((event) => event.startDate && isSameDay(new Date(event.startDate), today));
  }, [events]);

  const occasion = useMemo(
    () => pickTodayOccasion(todayEvents, todayEvents.filter((event) => /birthday|bday/i.test(event.title)).map((event) => event.title)),
    [todayEvents],
  );

  const weatherUrl = weather
    ? WEATHER_BACKDROP_URLS[weatherBackdropKind(weather.code, weather.isDay)]
    : WEATHER_BACKDROP_URLS[isNight ? "night" : "clear"];

  const urls = useMemo(() => {
    if (mode === "off") return [] as string[];
    if (mode === "one" && appearance.headerPhotoUrl) return [appearance.headerPhotoUrl];
    if (mode === "album") return albumUrls;
    if (mode === "weather") return [weatherUrl];
    if (mode === "today") {
      if (occasion?.image) return [occasion.image, ...albumUrls].slice(0, 12);
      if (albumUrls.length) return albumUrls;
      return [weatherUrl];
    }
    return appearance.headerPhotoUrl ? [appearance.headerPhotoUrl] : [];
  }, [mode, appearance.headerPhotoUrl, albumUrls, weatherUrl, occasion]);

  const baseScene = resolveChromeScene(appearance.headerScene, {
    atmosphere: appearance.theme.atmosphere,
    isNight,
    fallback: "none",
  });
  const scene: ChromeSceneId = appearance.headerCelebrateToday && occasion ? occasion.scene : baseScene;
  const eventLabel = occasion && (mode === "today" || appearance.headerCelebrateToday) ? occasion.label : "";

  return {
    mode,
    urls,
    scene,
    eventLabel,
    albums: photos.albums,
  };
}
