import { useEffect, useState } from "react";
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
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const timeStr = format(now, cfg.format24h ? "HH:mm:ss" : "h:mm:ss a");

  return (
    <div className="h-full flex flex-col p-3">
      <TdHead
        emoji="🕒"
        title="Clock"
        action={
          <button
            type="button"
            onClick={() => onConfigChange({ ...cfg, format24h: !cfg.format24h })}
            className="rounded-lg bg-muted px-2 py-0.5 text-[10px] font-semibold text-foreground"
          >
            {cfg.format24h ? "24h" : "12h"}
          </button>
        }
      />
      <div className="flex flex-1 flex-col items-center justify-center gap-1">
        <p className="font-display text-3xl font-bold tabular-nums text-foreground">{timeStr}</p>
        <p className="text-xs text-muted-foreground">{format(now, "EEEE d MMMM yyyy")}</p>
      </div>
    </div>
  );
}
