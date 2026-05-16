import { useNavigate } from "react-router-dom";
import { PiggyBank, TrendingUp, TrendingDown } from "lucide-react";
import { useFinance } from "@/hooks/useFinance";

function fmt(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

export function FinanceWidget() {
  const navigate = useNavigate();
  const { accounts, entries, loading } = useFinance();

  const activeAccounts = accounts.filter((a) => a.active && !a.hidden);

  const latestBalance = (accountId: string): number => {
    const acctEntries = entries
      .filter((e) => e.accountId === accountId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return acctEntries[0]?.balance ?? 0;
  };

  const total = activeAccounts.reduce((sum, a) => sum + latestBalance(a.id), 0);

  // Rough trend: compare to balance 30 days ago
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
      className="w-full h-full p-3 flex flex-col text-left overflow-hidden"
      onClick={() => navigate("/finance")}
    >
      <div className="flex items-center gap-1.5 mb-2 flex-shrink-0">
        <PiggyBank className="w-3.5 h-3.5 text-amber-500" />
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Finance</span>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="flex-shrink-0 mb-2">
            <p className="text-xl font-bold font-display text-foreground leading-none">{fmt(total)}</p>
            <div className={`flex items-center gap-0.5 mt-0.5 ${diff >= 0 ? "text-green-600" : "text-red-500"}`}>
              {diff >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span className="text-[10px] font-medium">{diff >= 0 ? "+" : ""}{fmt(diff)} vs 30d</span>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden space-y-1">
            {activeAccounts.slice(0, 4).map((a) => (
              <div key={a.id} className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground truncate flex-1">{a.name}</span>
                <span className="text-[10px] font-medium text-foreground flex-shrink-0 ml-2">{fmt(latestBalance(a.id))}</span>
              </div>
            ))}
            {activeAccounts.length > 4 && (
              <p className="text-[9px] text-muted-foreground">+{activeAccounts.length - 4} more</p>
            )}
          </div>
        </>
      )}
    </button>
  );
}
