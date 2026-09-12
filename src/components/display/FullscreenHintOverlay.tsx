import { Maximize } from "lucide-react";

/**
 * Shown until the screen is actually fullscreen. useAutoFullscreen already
 * tries on every tap/click/key anywhere on the page — this is the visible,
 * hard-to-miss version of that for whoever is setting the screen up, mirroring
 * AudioUnlockOverlay's "tap anywhere" banner.
 */
export function FullscreenHintOverlay({
  supported,
  isFullscreen,
  offset,
  onRequest,
}: {
  supported: boolean;
  isFullscreen: boolean;
  /** Push down below the audio-unlock banner when both are showing at once. */
  offset: boolean;
  onRequest: () => void;
}) {
  if (!supported || isFullscreen) return null;

  return (
    <div
      className={`absolute left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-sky-500 px-5 py-3 shadow-lg animate-pulse ${offset ? "top-20" : "top-4"}`}
    >
      <Maximize className="h-5 w-5 flex-shrink-0 text-white" />
      <p className="text-sm font-medium text-white">Tap anywhere to fill the whole screen</p>
      <button
        onClick={(event) => {
          event.stopPropagation();
          onRequest();
        }}
        className="flex-shrink-0 text-sm font-bold text-white underline underline-offset-2"
      >
        Go fullscreen
      </button>
    </div>
  );
}
