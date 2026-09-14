import { useEffect } from "react";

const CALENDAR_MANIFEST = "/calendar.webmanifest";

export function useCalendarManifest(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const previousHref = link?.getAttribute("href") || "/manifest.webmanifest";
    link?.setAttribute("href", CALENDAR_MANIFEST);
    return () => {
      link?.setAttribute("href", previousHref);
    };
  }, [enabled]);
}
