import { useEffect, useState } from "react";

export function ChromePhotoRotator({
  urls,
  intervalMs = 12000,
}: {
  urls: string[];
  intervalMs?: number;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [urls.join("|")]);

  useEffect(() => {
    if (urls.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % urls.length);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [urls.length, intervalMs]);

  if (!urls.length) return null;
  const current = urls[index] || urls[0];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {urls.map((url) => (
        <img
          key={url}
          src={url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-1000"
          style={{
            opacity: url === current ? 0.42 : 0,
            transform: url === current ? "scale(1.06)" : "scale(1)",
            transitionProperty: "opacity, transform",
            transitionDuration: "1s, 14s",
          }}
        />
      ))}
      <div className="absolute inset-0 bg-black/35" />
    </div>
  );
}
