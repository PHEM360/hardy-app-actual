import { Volume2 } from "lucide-react";

/**
 * Shown only when there's something that actually needs sound (an enabled
 * alarm) AND no gesture has unlocked audio yet — e.g. a display that was set
 * up entirely via QR pairing from a phone, where nobody ever touched the
 * screen itself. The page-wide listener in useAutoUnlockAudio already tries
 * to unlock on any tap; this is the explicit, hard-to-miss fallback for when
 * that hasn't happened yet.
 */
export function AudioUnlockOverlay({
  hasEnabledAlarms,
  unlocked,
  onTryUnlock,
}: {
  hasEnabledAlarms: boolean;
  unlocked: boolean;
  onTryUnlock: () => void;
}) {
  if (!hasEnabledAlarms || unlocked) return null;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-amber-500 rounded-2xl px-5 py-3 shadow-lg animate-pulse">
      <Volume2 className="w-5 h-5 text-white flex-shrink-0" />
      <p className="text-white text-sm font-medium">Tap anywhere so your alarms can play sound</p>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onTryUnlock();
        }}
        className="text-white text-sm font-bold underline underline-offset-2 flex-shrink-0"
      >
        Enable
      </button>
    </div>
  );
}
