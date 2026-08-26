import { useEffect, useMemo, useRef, useState } from "react";
import type { RemoteDisplayPhoto } from "@/hooks/useRemoteDisplayPhotos";
import type { PhotoFrameSettings } from "@/hooks/useDeviceSettings";
import { visibleDisplayPhotos } from "@/lib/displayPhotos";

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function PhotoFrameScene({ photos, settings }: { photos: RemoteDisplayPhoto[]; settings: PhotoFrameSettings }) {
  const usable = visibleDisplayPhotos(photos);
  const order = useMemo(
    () => (settings.shuffle ? shuffleArray(usable) : usable),
    // Re-shuffle only when the underlying photo set actually changes, not every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [usable.map((p) => p.id).join(","), settings.shuffle]
  );
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setIndex(0);
  }, [order.length]);

  useEffect(() => {
    if (order.length < 2) return;
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % order.length);
    }, Math.max(5, settings.intervalSeconds) * 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [order.length, settings.intervalSeconds]);

  if (order.length === 0) return null;
  const current = order[index];

  return (
    <div className="absolute inset-0 bg-black">
      {order.map((photo, i) => (
        <div
          key={photo.id}
          className="absolute inset-0 transition-opacity duration-1000 ease-in-out"
          style={{ opacity: i === index ? 1 : 0 }}
        >
          {/* Blurred, scaled-up copy fills the frame behind the real photo so a
              portrait shot on a landscape screen (or vice versa) never gets
              cropped/zoomed — it's letterboxed onto a soft version of itself
              instead of leaving hard black bars. */}
          <img
            src={photo.url}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-60"
          />
          <img
            src={photo.url}
            alt={photo.caption || ""}
            className="absolute inset-0 w-full h-full object-contain"
          />
        </div>
      ))}
      {settings.showCaptions && current.caption && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-6 pt-10 pb-6">
          <p className="text-white text-sm font-medium">{current.caption}</p>
        </div>
      )}
    </div>
  );
}
