import { useEffect, useRef, useState } from "react";

/**
 * Keeps the screen from sleeping while active. Browsers release the lock
 * whenever the tab is hidden, so it's re-acquired on every visibilitychange.
 * Not supported on all browsers/older devices — callers should treat
 * `supported: false` as "tell the user to disable device sleep manually",
 * not as an error.
 */
export function useWakeLock(active: boolean) {
  const [supported] = useState(() => typeof navigator !== "undefined" && "wakeLock" in navigator);
  const [held, setHeld] = useState(false);
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active || !supported) return;

    let cancelled = false;

    async function acquire() {
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          lock.release().catch(() => {});
          return;
        }
        lockRef.current = lock;
        setHeld(true);
        lock.addEventListener("release", () => setHeld(false));
      } catch {
        setHeld(false);
      }
    }

    acquire();

    const onVisibility = () => {
      if (document.visibilityState === "visible" && !lockRef.current) acquire();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, [active, supported]);

  return { supported, held };
}
