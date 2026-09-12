import { useCallback, useEffect, useState } from "react";

/**
 * A plain browser tab always keeps its own chrome (address bar, tabs, the
 * OS taskbar behind it) unless something actually calls the Fullscreen API —
 * the on-screen button alone is easy to miss on a kiosk nobody is watching
 * set up. So, like the alarm audio unlock, this opportunistically requests
 * fullscreen on the very first tap/click/key anywhere on the page, and again
 * on any later one if fullscreen ever drops (e.g. someone pressed Escape) —
 * a browser only grants it inside a real user gesture, so it cannot be done
 * silently on load, but it also only takes one gesture to satisfy that for
 * the rest of the session.
 */
export function useAutoFullscreen(active: boolean) {
  const [isFullscreen, setIsFullscreen] = useState(() => typeof document !== "undefined" && !!document.fullscreenElement);
  const [supported] = useState(() => typeof document !== "undefined" && !!document.documentElement.requestFullscreen);

  const requestFullscreen = useCallback(() => {
    if (!supported || document.fullscreenElement) return;
    document.documentElement.requestFullscreen?.().catch(() => {});
  }, [supported]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (!active || !supported || isFullscreen) return;
    const onGesture = () => requestFullscreen();
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, [active, supported, isFullscreen, requestFullscreen]);

  return { isFullscreen, supported, requestFullscreen };
}
