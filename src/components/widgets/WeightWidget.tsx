import { useNavigate } from "react-router-dom";
import { Activity, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useWeightTracker } from "@/hooks/useWeightTracker";

export function WeightWidget() {
  const navigate = useNavigate();
  const { entries, loading } = useWeightTracker();

  const sorted = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const latest = sorted[0];
  const previous = sorted[1];
  const diff = latest && previous ? latest.weight - previous.weight : 0;
  const TrendIcon = diff > 0.1 ? TrendingUp : diff < -0.1 ? TrendingDown : Minus;
  const trendColor = diff > 0.1 ? "text-red-500" : diff < -0.1 ? "text-green-500" : "text-muted-foreground";

  // Last 5 entries for a simple sparkline
  const recent = sorted.slice(0, 8).reverse();

  return (
    <button
      className="w-full h-full p-3 flex flex-col text-left overflow-hidden"
      onClick={() => navigate("/weight")}
    >
      <div className="flex items-center gap-1.5 mb-2 flex-shrink-0">
        <Activity className="w-3.5 h-3.5 text-emerald-500" />
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Health</span>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : !latest ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-muted-foreground">No entries yet</p>
        </div>
      ) : (
        <>
          <div className="flex items-end gap-2 mb-2 flex-shrink-0">
            <p className="text-2xl font-bold font-display text-foreground leading-none">{latest.weight}<span className="text-sm font-normal text-muted-foreground ml-0.5">kg</span></p>
            <div className={`flex items-center gap-0.5 pb-0.5 ${trendColor}`}>
              <TrendIcon className="w-3 h-3" />
              {diff !== 0 && <span className="text-[10px] font-medium">{diff > 0 ? "+" : ""}{diff.toFixed(1)}</span>}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mb-2 flex-shrink-0">
            {new Date(latest.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </p>

          {/* Sparkline */}
          {recent.length > 1 && (
            <div className="flex-1 flex items-end gap-px min-h-0">
              {(() => {
                const min = Math.min(...recent.map((e) => e.weight));
                const max = Math.max(...recent.map((e) => e.weight));
                const range = max - min || 1;
                return recent.map((e, i) => {
                  const pct = ((e.weight - min) / range) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col justify-end" style={{ height: "40px" }}>
                      <div
                        className="w-full rounded-sm bg-emerald-400/70"
                        style={{ height: `${Math.max(10, pct)}%` }}
                      />
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </>
      )}
    </button>
  );
}
