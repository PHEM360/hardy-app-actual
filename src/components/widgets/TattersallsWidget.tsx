import { useNavigate } from "react-router-dom";
import { Building2, TrendingUp, TrendingDown } from "lucide-react";
import { useTattersalls } from "@/hooks/useTattersalls";

function fmt(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

export function TattersallsWidget() {
  const navigate = useNavigate();
  const { balanceHistory, expenses, loading } = useTattersalls();

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
      className="w-full h-full p-3 flex flex-col text-left overflow-hidden"
      onClick={() => navigate("/tattersalls")}
    >
      <div className="flex items-center gap-1.5 mb-2 flex-shrink-0">
        <Building2 className="w-3.5 h-3.5 text-teal-500" />
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Tattersalls</span>
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
              <div className={`flex items-center gap-0.5 mt-0.5 ${diff >= 0 ? "text-green-600" : "text-red-500"}`}>
                {diff >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span className="text-[10px]">{diff >= 0 ? "+" : ""}{fmt(diff)}</span>
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-hidden space-y-1">
            {recentExpenses.map((e, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-[10px] text-foreground truncate flex-1">{e.desc}</span>
                <span className="text-[10px] font-medium text-red-500 flex-shrink-0 ml-1">-{fmt(e.amount)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </button>
  );
}
