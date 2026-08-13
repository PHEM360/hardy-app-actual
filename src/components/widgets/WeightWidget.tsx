import { useNavigate } from "react-router-dom";
import { Activity, TrendingUp, TrendingDown, Minus, ChevronRight } from "lucide-react";
import { useWeightTracker } from "@/hooks/useWeightTracker";
import { WIDGET_ACCENT, accentGradient } from "@/lib/widgetAccents";

export function WeightWidget() {
  const navigate = useNavigate();
  const { entries, loading } = useWeightTracker();
  const accent = WIDGET_ACCENT.weight;

  const sorted = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const latest = sorted[0];
  const previous = sorted[1];
  const diff = latest && previous ? latest.weight - previous.weight : 0;
  const TrendIcon = diff > 0.1 ? TrendingUp : diff < -0.1 ? TrendingDown : Minus;
  const trendColor = diff > 0.1 ? "text-destructive" : diff < -0.1 ? "text-success" : "text-muted-foreground";

  // Last 8 entries for a simple sparkline
  const recent = sorted.slice(0, 8).reverse();

  return (
    <button
      className="w-full h-full p-3 pb-3.5 flex flex-col text-left overflow-y-auto group"
      onClick={() => navigate("/weight")}
    >
      <div
        className="flex items-center gap-2 -mx-3 -mt-3 mb-2 px-3 py-2.5 flex-shrink-0"
        style={{ background: accentGradient(accent) }}
      >
        <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-white/20 flex-shrink-0 text-white">
          <Activity className="w-3.5 h-3.5" />
        </span>
        <span className="text-[11px] font-bold text-white uppercase tracking-wider">Health</span>
        <ChevronRight className="w-3 h-3 text-white/50 ml-auto group-hover:text-white/80 group-hover:translate-x-0.5 transition-all" />
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : !latest ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-muted-foreground">No entries yet</p>
        </div>
      ) : (
        <>
          <div className="flex items-end gap-2 mb-1 flex-shrink-0">
            <p className="text-2xl font-bold font-display text-foreground leading-none">{latest.weight}<span className="text-sm font-normal text-muted-foreground ml-0.5">kg</span></p>
            <div className={`flex items-center gap-0.5 pb-0.5 ${trendColor}`}>
              <TrendIcon className="w-3 h-3" />
              {diff !== 0 && <span className="text-[10px] font-semibold">{diff > 0 ? "+" : ""}{diff.toFixed(1)}</span>}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mb-2 flex-shrink-0">
            {new Date(latest.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </p>

          {/* Line sparkline */}
          {recent.length > 1 && (
            <div className="flex-1 min-h-0" style={{ minHeight: 40 }}>
              {(() => {
                const min = Math.min(...recent.map((e) => e.weight));
                const max = Math.max(...recent.map((e) => e.weight));
                const range = max - min || 1;
                const W = 200, H = 40, pad = 2;
                const pts = recent.map((e, i) => {
                  const x = pad + (i / (recent.length - 1)) * (W - pad * 2);
                  const y = H - pad - ((e.weight - min) / range) * (H - pad * 2);
                  return `${x},${y}`;
                });
                const polyline = pts.join(" ");
                const lastPt = pts[pts.length - 1].split(",");
                return (
                  <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={accent} stopOpacity="0.32" />
                        <stop offset="100%" stopColor={accent} stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {/* Fill area */}
                    <polygon
                      points={`${pts[0].split(",")[0]},${H} ${polyline} ${lastPt[0]},${H}`}
                      fill="url(#wg)"
                    />
                    {/* Line */}
                    <polyline points={polyline} fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    {/* Last dot */}
                    <circle cx={lastPt[0]} cy={lastPt[1]} r="2.75" fill={accent} />
                  </svg>
                );
              })()}
            </div>
          )}
        </>
      )}
    </button>
  );
}
