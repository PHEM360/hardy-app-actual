import { useEffect, useMemo, useState } from "react";
import { Brain, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TEXT_MODEL_OPTIONS } from "@/lib/socialPlatforms";
import { analyzeFinanceSpending, type FinanceAnalysisResult } from "@/lib/financeAnalysisApi";
import { formatGBP } from "@/lib/financeCalculations";

type AccountOption = { id: string; name: string; type?: string; hidden?: boolean; active?: boolean };

export function FinanceAnalysisPanel({
  accounts,
  householdId,
}: {
  accounts: AccountOption[];
  householdId?: string;
}) {
  const visible = useMemo(
    () => accounts.filter((acc) => acc.active !== false && !acc.hidden),
    [accounts],
  );
  const [selected, setSelected] = useState<string[]>(() => visible.map((acc) => acc.id));
  const [model, setModel] = useState<string>("auto");
  const [days, setDays] = useState(90);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<FinanceAnalysisResult | null>(null);

  useEffect(() => {
    const ids = visible.map((acc) => acc.id);
    setSelected((current) => {
      if (current.length === 0) return ids;
      const kept = current.filter((id) => ids.includes(id));
      return kept.length > 0 ? kept : ids;
    });
  }, [visible]);

  const toggle = (id: string) => {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const run = async () => {
    if (selected.length === 0) {
      toast.error("Pick at least one account.");
      return;
    }
    setBusy(true);
    try {
      const next = await analyzeFinanceSpending({
        accountIds: selected,
        model,
        days,
        householdId,
      });
      setResult(next);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not analyse those accounts.";
      toast.error(message.replace(/^FirebaseError:\s*/i, ""));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="rounded-3xl border-2 border-border bg-card p-3 shadow-card">
        <p className="px-1 text-[10px] font-bold uppercase tracking-widest text-foreground">Accounts</p>
        <p className="mb-2 px-1 text-[11px] text-foreground/70">Choose what the model can see.</p>
        <div className="space-y-1">
          {visible.map((acc) => {
            const on = selected.includes(acc.id);
            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => toggle(acc.id)}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm font-semibold ${
                  on ? "border-primary bg-primary/12 text-foreground" : "border-border/60 bg-background text-foreground"
                }`}
              >
                <span className="truncate">{acc.name}</span>
                {on && <span className="text-[10px] uppercase tracking-wide text-primary">On</span>}
              </button>
            );
          })}
        </div>
        <label className="mt-4 block px-1 text-[10px] font-bold uppercase tracking-widest text-foreground">
          AI model
        </label>
        <select
          value={model}
          onChange={(event) => setModel(event.target.value)}
          className="mt-1 h-10 w-full rounded-xl border-2 border-border bg-background px-3 text-sm font-medium"
        >
          {TEXT_MODEL_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
        <label className="mt-3 block px-1 text-[10px] font-bold uppercase tracking-widest text-foreground">
          Period
        </label>
        <select
          value={days}
          onChange={(event) => setDays(Number(event.target.value))}
          className="mt-1 h-10 w-full rounded-xl border-2 border-border bg-background px-3 text-sm font-medium"
        >
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={180}>Last 6 months</option>
        </select>
        <Button
          onClick={() => void run()}
          disabled={busy || selected.length === 0}
          className="mt-4 h-11 w-full rounded-xl bg-gradient-primary font-semibold"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
          {busy ? "Reading the numbers…" : "Analyse spending"}
        </Button>
      </aside>

      <section className="min-w-0 rounded-3xl border-2 border-border bg-card p-4 shadow-card sm:p-5">
        {!result ? (
          <div className="flex min-h-[22rem] flex-col items-center justify-center px-6 text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </span>
            <p className="font-display text-lg font-bold">Spending and income</p>
            <p className="mt-1 max-w-md text-sm text-foreground/75">
              Linked bank accounts are read for real transactions. Unlinked accounts use balance history only.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div
              className="rounded-2xl border border-border/60 px-4 py-3"
              style={{ background: "color-mix(in srgb, hsl(var(--primary)) 10%, hsl(var(--card)))" }}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/70">{result.period} · {result.model}</p>
              <p className="mt-1 text-sm leading-relaxed text-foreground">{result.summary}</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Stat label="In" value={formatGBP(result.incomeTotal)} />
                <Stat label="Out" value={formatGBP(result.spendTotal)} />
                <Stat label="Net" value={formatGBP(result.net)} />
              </div>
              {result.source === "balances" && (
                <p className="mt-2 text-[11px] text-foreground/70">
                  No bank transactions were available for these accounts, so this used logged balances only.
                </p>
              )}
            </div>

            {result.categories.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-foreground">Where it went</h3>
                <div className="space-y-2">
                  {result.categories.map((cat) => (
                    <div key={cat.name} className="rounded-xl border border-border/60 bg-background px-3 py-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-display text-sm font-bold">{cat.name}</p>
                        <p className="text-sm font-semibold">{formatGBP(Number(cat.amount) || 0)} · {Math.round(Number(cat.pct) || 0)}%</p>
                      </div>
                      {cat.note && <p className="mt-0.5 text-[11px] text-foreground/70">{cat.note}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.savings.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-foreground">Ways to spend less</h3>
                <div className="space-y-2">
                  {result.savings.map((idea) => (
                    <div key={idea.title} className="rounded-xl border border-border/60 px-3 py-2" style={{ background: "color-mix(in srgb, hsl(152 40% 40%) 10%, hsl(var(--card)))" }}>
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-display text-sm font-bold">{idea.title}</p>
                        {Number(idea.monthlySaveGbp) > 0 && (
                          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                            ~{formatGBP(Number(idea.monthlySaveGbp))}/mo
                          </p>
                        )}
                      </div>
                      <p className="mt-0.5 text-[12px] text-foreground/80">{idea.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.insights.length > 0 && (
              <ul className="space-y-1.5">
                {result.insights.map((line) => (
                  <li key={line} className="rounded-xl bg-muted/40 px-3 py-2 text-sm text-foreground">{line}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card/80 px-2.5 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-foreground/65">{label}</p>
      <p className="font-display text-sm font-bold">{value}</p>
    </div>
  );
}
