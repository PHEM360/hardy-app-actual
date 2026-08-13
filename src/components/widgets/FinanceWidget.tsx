import { useNavigate } from "react-router-dom";
import { PiggyBank, TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
import { useFinance } from "@/hooks/useFinance";
import { WIDGET_ACCENT, accentGradient } from "@/lib/widgetAccents";

function fmt(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

export function FinanceWidget() {
  const navigate = useNavigate();
  const { accounts, entries, loading } = useFinance();
  const accent = WIDGET_ACCENT.finance;

  const activeAccounts = accounts.filter((a) => a.active && !a.hidden);

  const latestBalance = (accountId: string): number => {
    const acctEntries = entries
      .filter((e) => e.accountId === accountId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return acctEntries[0]?.balance ?? 0;
  };

  const total = activeAccounts.reduce((sum, a) => sum + latestBalance(a.id), 0);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const oldTotal = activeAccounts.reduce((sum, a) => {
    const old = entries
      .filter((e) => e.accountId === a.id && new Date(e.date) <= thirtyDaysAgo)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    return sum + (old?.balance ?? latestBalance(a.id));
  }, 0);
  const diff = total - oldTotal;

  return (
    <button
      className="w-full h-full p-3 pb-3.5 flex flex-col text-left overflow-y-auto group"
      onClick={() => navigate("/finance")}
    >
      <div
        className="flex items-center gap-2 -mx-3 -mt-3 mb-2 px-3 py-2.5 flex-shrink-0"
        style={{ background: accentGradient(accent) }}
      >
        <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-white/20 flex-shrink-0 text-white">
          <PiggyBank className="w-3.5 h-3.5" />
        </span>
        <span className="text-[11px] font-bold text-white uppercase tracking-wider">Finance</span>
        <ChevronRight className="w-3 h-3 text-white/50 ml-auto group-hover:text-white/80 group-hover:translate-x-0.5 transition-all" />
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="flex-shrink-0 mb-2.5">
            <p className="text-2xl font-bold font-display text-foreground leading-none">{fmt(total)}</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              across {activeAccounts.length} account{activeAccounts.length === 1 ? "" : "s"}
            </p>
            <div className={`flex items-center gap-0.5 mt-1 ${diff >= 0 ? "text-success" : "text-destructive"}`}>
              {diff >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span className="text-xs font-semibold">{diff >= 0 ? "+" : ""}{fmt(diff)} vs 30 days ago</span>
            </div>
          </div>

          <div className="flex-1 min-h-0 space-y-1">
            {activeAccounts.slice(0, 4).map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 py-0.5">
                <span className="text-xs text-muted-foreground truncate flex-1">{a.name}</span>
                <span className="text-xs font-semibold text-foreground flex-shrink-0">{fmt(latestBalance(a.id))}</span>
              </div>
            ))}
            {activeAccounts.length > 4 && (
              <p className="text-[11px] text-muted-foreground">+{activeAccounts.length - 4} more</p>
            )}
          </div>
        </>
      )}
    </button>
  );
}
