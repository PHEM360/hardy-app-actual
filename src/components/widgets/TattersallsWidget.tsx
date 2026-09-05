import { useNavigate } from "react-router-dom";
import { Building2, TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
import { useTattersalls } from "@/hooks/useTattersalls";
import { WIDGET_ACCENT, accentGradient } from "@/lib/widgetAccents";

function fmt(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

export function TattersallsWidget() {
  const navigate = useNavigate();
  const { balanceHistory, expenses, loading } = useTattersalls();
  const accent = WIDGET_ACCENT.tattersalls;

  const latest = balanceHistory.length > 0
    ? [...balanceHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
    : null;

  const previous = balanceHistory.length > 1
    ? [...balanceHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[1]
    : null;

  const diff = latest && previous ? latest.balance - previous.balance : 0;

  const recentExpenses = [...expenses]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  return (
    <button
      className="w-full h-full p-3 pb-3.5 flex flex-col text-left overflow-y-auto group"
      onClick={() => navigate("/tattersalls")}
    >
      <div
        className="flex items-center gap-2 -mx-3 -mt-3 mb-2 px-3 py-2.5 flex-shrink-0"
        style={{ background: accentGradient(accent) }}
      >
        <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-white/20 flex-shrink-0 text-white">
          <Building2 className="w-3.5 h-3.5" />
        </span>
        <span className="text-[11px] font-bold text-white uppercase tracking-wider">Flats</span>
        <ChevronRight className="w-3 h-3 text-white/50 ml-auto group-hover:text-white/80 group-hover:translate-x-0.5 transition-all" />
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="flex-shrink-0 mb-2">
            <p className="text-xl font-bold font-display text-foreground leading-none">
              {latest ? fmt(latest.balance) : "—"}
            </p>
            {diff !== 0 && (
              <div className={`flex items-center gap-0.5 mt-1 ${diff >= 0 ? "text-success" : "text-destructive"}`}>
                {diff >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span className="text-[10px] font-semibold">{diff >= 0 ? "+" : ""}{fmt(diff)}</span>
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 space-y-1">
            {recentExpenses.map((e, i) => (
              <div key={i} className="flex items-center justify-between gap-2 py-0.5">
                <span className="text-[10px] text-foreground truncate flex-1">{e.desc}</span>
                <span className="text-[10px] font-semibold text-destructive flex-shrink-0">-{fmt(e.amount)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </button>
  );
}
