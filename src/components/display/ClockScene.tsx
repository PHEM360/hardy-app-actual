import { useEffect, useState } from "react";
import type { ClockSettings } from "@/hooks/useDeviceSettings";

const SIZE_CLASSES: Record<ClockSettings["size"], string> = {
  medium: "text-[14vw] sm:text-[10vw]",
  large: "text-[18vw] sm:text-[13vw]",
  xlarge: "text-[22vw] sm:text-[16vw]",
};

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function DigitalClock({ now, settings }: { now: Date; settings: ClockSettings }) {
  let hours = now.getHours();
  let suffix = "";
  if (!settings.format24h) {
    suffix = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
  }
  const timeStr = `${settings.format24h ? pad(hours) : hours}:${pad(now.getMinutes())}${
    settings.showSeconds ? `:${pad(now.getSeconds())}` : ""
  }`;

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div
        className={`font-display font-bold tabular-nums leading-none ${SIZE_CLASSES[settings.size]}`}
        style={{ color: settings.accentColor }}
      >
        {timeStr}
        {suffix && <span className="text-[0.28em] ml-3 align-middle opacity-70">{suffix}</span>}
      </div>
      {settings.showDate && (
        <div className="text-2xl sm:text-3xl text-white/70 font-medium">
          {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        </div>
      )}
    </div>
  );
}

function AnalogClock({ now, settings }: { now: Date; settings: ClockSettings }) {
  const hours = now.getHours() % 12;
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const hourDeg = hours * 30 + minutes * 0.5;
  const minuteDeg = minutes * 6 + seconds * 0.1;
  const secondDeg = seconds * 6;

  return (
    <div className="flex flex-col items-center justify-center gap-6">
      <svg viewBox="0 0 200 200" className="w-[min(70vw,60vh)] h-[min(70vw,60vh)]">
        <circle cx="100" cy="100" r="96" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 30 * Math.PI) / 180;
          const x1 = 100 + 82 * Math.sin(angle);
          const y1 = 100 - 82 * Math.cos(angle);
          const x2 = 100 + 92 * Math.sin(angle);
          const y2 = 100 - 92 * Math.cos(angle);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.45)" strokeWidth="3" strokeLinecap="round" />;
        })}
        <line
          x1="100" y1="100"
          x2={100 + 50 * Math.sin((hourDeg * Math.PI) / 180)}
          y2={100 - 50 * Math.cos((hourDeg * Math.PI) / 180)}
          stroke="white" strokeWidth="6" strokeLinecap="round"
        />
        <line
          x1="100" y1="100"
          x2={100 + 72 * Math.sin((minuteDeg * Math.PI) / 180)}
          y2={100 - 72 * Math.cos((minuteDeg * Math.PI) / 180)}
          stroke="white" strokeWidth="4" strokeLinecap="round"
        />
        {settings.showSeconds && (
          <line
            x1="100" y1="100"
            x2={100 + 78 * Math.sin((secondDeg * Math.PI) / 180)}
            y2={100 - 78 * Math.cos((secondDeg * Math.PI) / 180)}
            stroke={settings.accentColor} strokeWidth="2" strokeLinecap="round"
          />
        )}
        <circle cx="100" cy="100" r="5" fill={settings.accentColor} />
      </svg>
      {settings.showDate && (
        <div className="text-2xl sm:text-3xl text-white/70 font-medium">
          {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        </div>
      )}
    </div>
  );
}

export function ClockScene({ settings }: { settings: ClockSettings }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    const interval = setInterval(tick, settings.showSeconds ? 1000 : 5000);
    return () => clearInterval(interval);
  }, [settings.showSeconds]);

  return (
    <div className="w-full h-full flex items-center justify-center">
      {settings.style === "analog" ? (
        <AnalogClock now={now} settings={settings} />
      ) : (
        <DigitalClock now={now} settings={settings} />
      )}
    </div>
  );
}
