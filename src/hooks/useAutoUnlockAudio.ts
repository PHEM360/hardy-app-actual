import { useCallback, useEffect, useState } from "react";
import { isAudioUnlocked, unlockAudio } from "@/lib/alarmTone";

/**
 * Opportunistically unlocks the alarm AudioContext on the very first tap
 * anywhere on the page, from the moment the display is live — not just once
 * an alarm exists. Browsers only allow audio playback after a real user
 * gesture, and on a kiosk that gesture might only ever be "someone opened
 * settings once during setup" — so this needs to be listening from the start
 * to catch that, rather than waiting until there's something to unlock for.
 */
export function useAutoUnlockAudio(active: boolean) {
  const [unlocked, setUnlocked] = useState(() => isAudioUnlocked());

  useEffect(() => {
    if (!active || unlocked) return;
    const onPointerDown = async () => {
      if (await unlockAudio()) setUnlocked(true);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [active, unlocked]);

  const tryUnlock = useCallback(async () => {
    if (await unlockAudio()) setUnlocked(true);
  }, []);

  return { unlocked, tryUnlock };
}
