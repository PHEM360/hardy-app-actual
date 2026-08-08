import { useEffect, useState } from "react";
import type { ClockSettings } from "@/hooks/useDeviceSettings";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

/** Small corner clock shown over the photo frame — the classic digital-photo-frame layout. */
export function CompactClockOverlay({ settings }: { settings: ClockSettings }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  let hours = now.getHours();
  let suffix = "";
  if (!settings.format24h) {
    suffix = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
  }
  const timeStr = `${settings.format24h ? pad(hours) : hours}:${pad(now.getMinutes())}${suffix ? ` ${suffix}` : ""}`;

  return (
    <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-sm rounded-2xl px-4 py-2.5 text-right">
      <p className="text-white text-2xl font-display font-bold tabular-nums leading-none">{timeStr}</p>
      {settings.showDate && (
        <p className="text-white/70 text-xs mt-1">
          {now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
        </p>
      )}
    </div>
  );
}
