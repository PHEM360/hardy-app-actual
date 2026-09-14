import { useEffect, useState } from "react";
import { resolveStoredPhotoUrl } from "@/lib/photoUrl";

export function PhotoThumb({
  url,
  storagePath,
  alt,
  className,
  onError,
}: {
  url?: string;
  storagePath?: string;
  alt: string;
  className?: string;
  onError?: () => void;
}) {
  const [src, setSrc] = useState(url || "");
  const [retried, setRetried] = useState(false);

  useEffect(() => {
    setSrc(url || "");
    setRetried(false);
  }, [url, storagePath]);

  if (!src) return null;

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={className}
      onError={() => {
        if (retried) {
          onError?.();
          return;
        }
        setRetried(true);
        void resolveStoredPhotoUrl({ url, storagePath }).then((next) => {
          if (next && next !== src) setSrc(next);
          else onError?.();
        });
      }}
    />
  );
}
