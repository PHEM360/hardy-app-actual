import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DEFAULT_DISPLAY_PAGES, type DeviceDoc } from "@/hooks/useDeviceSettings";
import { activeDisplayPages } from "@/lib/displayPages";
import { resolveNightMode } from "@/lib/displayNightMode";
import { NightModeView } from "@/components/display/NightModeView";
import type { RemoteDisplayPhoto } from "@/hooks/useRemoteDisplayPhotos";
import type { CalendarEvent, Task } from "@/types/app";
import { DisplayPageRenderer } from "@/components/display/DisplayPageRenderer";

const NEXT_KEYS = new Set(["ArrowRight", "ArrowDown", "PageDown", " ", "Spacebar", "MediaTrackNext"]);
const PREV_KEYS = new Set(["ArrowLeft", "ArrowUp", "PageUp", "Backspace", "MediaTrackPrevious"]);

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

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
  const [minuteTick, setMinuteTick] = useState(() => Date.now());
  const [hint, setHint] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setMinuteTick(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const pages = useMemo(
    () => activeDisplayPages(device.settings.pages, new Date(minuteTick)),
    [device.settings.pages, minuteTick],
  );

  useEffect(() => {
    if (index >= pages.length) setIndex(0);
  }, [pages.length, index]);

  const goTo = useCallback((next: number) => {
    if (pages.length < 2) return;
    setIndex(((next % pages.length) + pages.length) % pages.length);
  }, [pages.length]);

  useEffect(() => {
    if (pages.length < 2) return;
    const currentDuration = pages[index]?.durationSeconds || device.settings.scenes.rotateSeconds;
    const timeout = setTimeout(() => {
      setIndex((current) => (current + 1) % pages.length);
    }, Math.max(10, currentDuration) * 1000);
    return () => clearTimeout(timeout);
  }, [pages, index, device.settings.scenes.rotateSeconds]);

  useEffect(() => {
    if (pages.length < 2) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target)) return;
      if (NEXT_KEYS.has(event.key)) {
        event.preventDefault();
        goTo(index + 1);
        return;
      }
      if (PREV_KEYS.has(event.key)) {
        event.preventDefault();
        goTo(index - 1);
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        goTo(0);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        goTo(pages.length - 1);
        return;
      }
      const digit = Number(event.key);
      if (digit >= 1 && digit <= pages.length) {
        event.preventDefault();
        goTo(digit - 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goTo, index, pages.length]);

  useEffect(() => {
    if (pages.length < 2) return;
    setHint(true);
    const timer = setTimeout(() => setHint(false), 6_000);
    return () => clearTimeout(timer);
  }, [pages.length]);

  const current = pages[index] || pages[0] || DEFAULT_DISPLAY_PAGES[0];
  const night = resolveNightMode(device.settings.nightMode, device.settings.alarms, new Date(minuteTick));

  if (night.active) {
    return <NightModeView screen={device.settings.nightMode.screen} clock={device.settings.clock} />;
  }

  return (
    <div className="absolute inset-0">
      <DisplayPageRenderer
        page={current}
        photos={photos}
        calendarEvents={calendarEvents}
        tasks={tasks}
      />
      {pages.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            aria-label="Previous page"
            className="absolute left-0 top-0 z-20 flex h-full w-[min(12vmin,7rem)] items-center justify-start pl-[1.4vmin] text-white/35 transition hover:bg-white/[0.06] hover:text-white/80 focus-visible:bg-white/10 focus-visible:text-white focus-visible:outline-none"
          >
            <ChevronLeft className="h-[6vmin] w-[6vmin] min-h-8 min-w-8 drop-shadow-[0_1px_8px_rgba(0,0,0,.55)]" />
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            aria-label="Next page"
            className="absolute right-0 top-0 z-20 flex h-full w-[min(12vmin,7rem)] items-center justify-end pr-[1.4vmin] text-white/35 transition hover:bg-white/[0.06] hover:text-white/80 focus-visible:bg-white/10 focus-visible:text-white focus-visible:outline-none"
          >
            <ChevronRight className="h-[6vmin] w-[6vmin] min-h-8 min-w-8 drop-shadow-[0_1px_8px_rgba(0,0,0,.55)]" />
          </button>

          <div className="absolute bottom-[1.6vmin] left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-[0.8vmin]">
            <p
              className="rounded-full bg-black/45 px-[1.6vmin] py-[0.4vmin] text-center font-medium text-white/70 backdrop-blur-sm"
              style={{ fontSize: "clamp(10px, 1.4vmin, 14px)" }}
            >
              {current.name} · {index + 1} of {pages.length}
              {hint ? " · arrows, space or a remote" : ""}
            </p>
            <div className="flex items-center gap-[0.8vmin]">
              {pages.map((page, pageIndex) => (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => goTo(pageIndex)}
                  aria-label={`Show ${page.name}`}
                  aria-current={pageIndex === index ? "page" : undefined}
                  className={`h-[1vmin] min-h-[6px] rounded-full transition-all ${
                    pageIndex === index ? "w-[2.4vmin] bg-white/80" : "w-[1vmin] min-w-[6px] bg-white/30 hover:bg-white/55"
                  }`}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
