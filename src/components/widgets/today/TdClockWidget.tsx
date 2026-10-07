import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { TdHead } from "./TdHead";

interface ClockConfig {
  format24h?: boolean;
}

export function TdClockWidget({
  config,
  onConfigChange,
}: {
  config?: Record<string, unknown>;
  onConfigChange: (config: Record<string, unknown>) => void;
}) {
  const cfg = (config ?? {}) as ClockConfig;
  const boxRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(new Date());
  const [box, setBox] = useState({ w: 220, h: 120 });

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, []);

  const timeStr = format(now, cfg.format24h === false ? "h:mm a" : "HH:mm");
  const dateStr = format(now, "EEEE d MMMM");
  const timeSize = Math.max(28, Math.min(box.w * 0.34, box.h * 0.48));
  const dateSize = Math.max(12, Math.min(box.w * 0.09, box.h * 0.16, 22));

  return (
    <div className="flex h-full flex-col p-3">
      <TdHead
        emoji="🕒"
        title="Date and time"
        action={
          <button
            type="button"
            onClick={() => onConfigChange({ ...cfg, format24h: cfg.format24h === false })}
            className="rounded-md bg-black/20 px-2 py-0.5 text-[10px] font-bold text-white"
          >
            {cfg.format24h === false ? "12h" : "24h"}
          </button>
        }
      />
      <div ref={boxRef} className="flex min-h-0 flex-1 flex-col items-center justify-center px-1 text-center">
        <p
          className="font-display font-bold tabular-nums leading-none text-foreground"
          style={{ fontSize: `${timeSize}px` }}
        >
          {timeStr}
        </p>
        <p
          className="mt-2 font-semibold leading-tight text-foreground/75"
          style={{ fontSize: `${dateSize}px` }}
        >
          {dateStr}
        </p>
      </div>
    </div>
  );
}
