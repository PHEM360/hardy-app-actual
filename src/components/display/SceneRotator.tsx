import { useEffect, useState } from "react";
import { DEFAULT_DISPLAY_PAGES, type DeviceDoc } from "@/hooks/useDeviceSettings";
import type { RemoteDisplayPhoto } from "@/hooks/useRemoteDisplayPhotos";
import type { CalendarEvent, Task } from "@/types/app";
import { DisplayPageRenderer } from "@/components/display/DisplayPageRenderer";

export function SceneRotator({
  device,
  photos,
  calendarEvents,
  tasks,
}: {
  device: DeviceDoc;
  photos: RemoteDisplayPhoto[];
  calendarEvents: CalendarEvent[];
  tasks: Task[];
}) {
  const [index, setIndex] = useState(0);
  const pages = device.settings.pages;

  useEffect(() => {
    if (index >= pages.length) setIndex(0);
  }, [pages.length, index]);

  useEffect(() => {
    if (pages.length < 2) return;
    const currentDuration = pages[index]?.durationSeconds || device.settings.scenes.rotateSeconds;
    const timeout = setTimeout(() => {
      setIndex((current) => (current + 1) % pages.length);
    }, Math.max(10, currentDuration) * 1000);
    return () => clearTimeout(timeout);
  }, [pages, index, device.settings.scenes.rotateSeconds]);

  return (
    <div className="absolute inset-0">
      <DisplayPageRenderer
        page={pages[index] || pages[0] || DEFAULT_DISPLAY_PAGES[0]}
        photos={photos}
        calendarEvents={calendarEvents}
        tasks={tasks}
      />
      {pages.length > 1 && (
        <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
          {pages.map((page, pageIndex) => (
            <span key={page.id} className={`h-1 rounded-full transition-all ${pageIndex === index ? "w-6 bg-white/70" : "w-1.5 bg-white/25"}`} />
          ))}
        </div>
      )}
    </div>
  );
}
