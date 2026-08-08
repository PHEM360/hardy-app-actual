import { useEffect, useMemo, useState } from "react";
import type { DeviceDoc } from "@/hooks/useDeviceSettings";
import type { HouseholdPhoto } from "@/hooks/useHouseholdPhotos";
import type { HouseholdCalendarEvent } from "@/hooks/useHouseholdCalendar";
import { ClockScene } from "@/components/display/ClockScene";
import { CompactClockOverlay } from "@/components/display/CompactClockOverlay";
import { PhotoFrameScene } from "@/components/display/PhotoFrameScene";
import { CalendarScene } from "@/components/display/CalendarScene";
import { KioskWidgetGrid } from "@/components/display/KioskWidgetGrid";

type SceneType = "clock" | "photos" | "calendar" | "overview";

export function SceneRotator({
  device,
  photos,
  calendarEvents,
  calendarLoading,
  calendarError,
}: {
  device: DeviceDoc;
  photos: HouseholdPhoto[];
  calendarEvents: HouseholdCalendarEvent[];
  calendarLoading: boolean;
  calendarError: string | null;
}) {
  const scenes = useMemo(() => {
    const list: SceneType[] = ["clock"];
    if (device.settings.photoFrame.enabled && photos.length > 0) list.push("photos");
    if (device.settings.calendar.enabled && device.householdId) list.push("calendar");
    if (device.settings.overview.enabled && device.householdId) list.push("overview");
    return list;
  }, [device, photos.length]);

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index >= scenes.length) setIndex(0);
  }, [scenes.length, index]);

  useEffect(() => {
    if (scenes.length < 2) return;
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % scenes.length);
    }, Math.max(10, device.settings.scenes.rotateSeconds) * 1000);
    return () => clearInterval(interval);
  }, [scenes.length, device.settings.scenes.rotateSeconds]);

  const current = scenes[index] ?? "clock";

  return (
    <div className="absolute inset-0">
      {current === "clock" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <ClockScene settings={device.settings.clock} />
        </div>
      )}
      {current === "photos" && (
        <>
          <PhotoFrameScene photos={photos} settings={device.settings.photoFrame} />
          <CompactClockOverlay settings={device.settings.clock} />
        </>
      )}
      {current === "calendar" && (
        <>
          <CalendarScene events={calendarEvents} loading={calendarLoading} error={calendarError} />
          <CompactClockOverlay settings={device.settings.clock} />
        </>
      )}
      {current === "overview" && (
        <>
          <KioskWidgetGrid enabled={device.settings.overview.widgets} />
          <CompactClockOverlay settings={device.settings.clock} />
        </>
      )}
    </div>
  );
}
