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
  // Broken links (an expired share, a deleted file) drop out of rotation
  // instead of sitting in the slideshow as a dead black frame — self-healing
  // the moment the underlying photo set changes again.
  const [broken, setBroken] = useState<Set<string>>(() => new Set());
  const usable = useMemo(
    () => visibleDisplayPhotos(photos).filter((photo) => !broken.has(photo.id)),
    [photos, broken],
  );
  const order = useMemo(
    () => (settings.shuffle ? shuffleArray(usable) : usable),
    // Re-shuffle only when the underlying photo set actually changes, not every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [usable.map((p) => p.id).join(","), settings.shuffle]
  );
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // A photo set that changes shape (new album pick, items added/removed)
    // may well no longer include ids we'd previously marked broken.
    setBroken((current) => {
      const stillPresent = new Set(photos.map((photo) => photo.id));
      const next = new Set([...current].filter((id) => stillPresent.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [photos]);

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

  if (order.length === 0) {
    // Only reachable once every photo passed in has actually failed to load
    // (DisplayPageRenderer only mounts this once there's at least one) —
    // say so instead of leaving a silent black rectangle behind.
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black p-4 text-center text-sm text-white/40">
        Couldn't load these photos — check they still exist on the Photos page.
      </div>
    );
  }
  const current = order[index];
  const markBroken = (id: string) => setBroken((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));

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
            loading={Math.abs(i - index) <= 1 ? "eager" : "lazy"}
            className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-60"
          />
          <img
            src={photo.url}
            alt={photo.caption || ""}
            loading={Math.abs(i - index) <= 1 ? "eager" : "lazy"}
            className="absolute inset-0 w-full h-full object-contain"
            onError={() => markBroken(photo.id)}
          />
        </div>
      ))}
      {settings.showCaptions && current.caption && (
        <div
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-6 pt-10"
          style={{ paddingBottom: "max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 0.75rem))" }}
        >
          <p className="text-white text-sm font-medium">{current.caption}</p>
        </div>
      )}
    </div>
  );
}
