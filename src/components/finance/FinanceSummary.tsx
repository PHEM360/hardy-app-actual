import { CalendarRange, TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { Account, BalanceEntry } from "@/hooks/useFinance";
import type { FinanceStatId } from "@/lib/financeDisplay";
import {
  buildFinanceInsights,
  formatPct,
  formatSignedGBP,
  kindLabel,
  type AccountInsight,
  type MixSlice,
  type PeriodDelta,
} from "@/lib/financeInsights";
import { computeTaxYearSummary, formatGBP, type TaxYearDef } from "@/lib/financeCalculations";

const MIX_COLORS: Record<string, string> = {
  isa: "#1f6f78",
  other: "#8a7a4a",
  ss: "#1f6f78",
  cash: "#c8961e",
  lisa: "#5c4a7d",
  liquid: "#3c6e47",
  invested: "#3d5a80",
};

function toneClass(value: number | null) {
  if (value === null || value === 0) return "text-muted-foreground";
  return value > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";
}

function DeltaIcon({ value }: { value: number | null }) {
  if (value === null || value === 0) return <Minus className="w-3.5 h-3.5" />;
  return value > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />;
}

function StatChip({
  label,
  value,
  pct,
  hint,
}: {
  label: string;
  value: string;
  pct?: string | null;
  hint?: string;
}) {
  return (
    <div className="rounded-xl bg-background/80 border border-border/80 px-3 py-2.5 min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-bold font-display text-foreground mt-0.5 truncate">{value}</p>
      {(pct || hint) && (
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
          {pct}
          {pct && hint ? " · " : ""}
          {hint}
        </p>
      )}
    </div>
  );
}

function ChangeChip({ label, delta }: { label: string; delta: PeriodDelta }) {
  const value = delta.change;
  return (
    <div className="rounded-xl bg-background/80 border border-border/80 px-3 py-2.5 min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      {value === null ? (
        <p className="text-sm text-muted-foreground mt-0.5">Not enough history</p>
      ) : (
        <>
          <p className={`text-sm font-bold font-display mt-0.5 inline-flex items-center gap-1 ${toneClass(value)}`}>
            <DeltaIcon value={value} />
            {formatSignedGBP(value)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {formatPct(delta.changePct) ?? "—"}
            {delta.from !== null && ` · from ${formatGBP(delta.from)}`}
          </p>
        </>
      )}
    </div>
  );
}

function MixCard({
  title,
  slices,
  colors,
}: {
  title: string;
  slices: MixSlice[];
  colors: Record<string, string>;
}) {
  if (slices.length === 0) {
    return (
      <div className="p-4 rounded-2xl bg-card border-2 border-border shadow-card">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground">Nothing to show yet.</p>
      </div>
    );
  }
  return (
    <div className="p-4 rounded-2xl bg-card border-2 border-border shadow-card">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{title}</h3>
      <div className="h-3 rounded-full overflow-hidden flex bg-muted mb-3">
        {slices.map((slice) => (
          <div
            key={slice.key}
            className="h-full"
            style={{ width: `${Math.max(slice.pct, 1.5)}%`, background: colors[slice.key] || "#5c6b73" }}
            title={`${slice.label} ${slice.pct.toFixed(0)}%`}
          />
        ))}
      </div>
      <div className="space-y-1.5">
        {slices.map((slice) => (
          <div key={slice.key} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colors[slice.key] || "#5c6b73" }} />
              <span className="truncate">{slice.label}</span>
            </span>
            <span className="font-semibold tabular-nums flex-shrink-0">
              {formatGBP(slice.amount)} <span className="text-muted-foreground font-medium">({slice.pct.toFixed(0)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AccountDetailTile({
  insight,
  color,
  show,
}: {
  insight: AccountInsight;
  color: string;
  show: (id: FinanceStatId) => boolean;
}) {
  const growthLabel = insight.kind === "current" || insight.kind === "savings" || insight.kind === "cash_isa"
    ? "Est. interest"
    : "Est. growth";
  const feePctOfBalance =
    insight.estimatedFees != null && insight.latest > 0 ? (insight.estimatedFees / insight.latest) * 100 : null;

  return (
    <div
      className="rounded-2xl border-2 overflow-hidden shadow-card"
      style={{
        borderColor: color,
        background: `color-mix(in srgb, ${color} 12%, hsl(var(--card)))`,
      }}
    >
      <div className="h-1" style={{ background: color }} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <p className="text-base font-bold font-display text-foreground truncate">{insight.account.name}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {kindLabel(insight.kind)}
              {insight.openedOn ? ` · opened ${new Date(insight.openedOn).toLocaleDateString("en-GB")}` : ""}
            </p>
          </div>
          <p className="text-lg font-bold font-display text-foreground flex-shrink-0">{formatGBP(insight.latest)}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {show("startingBalance") && (
            <StatChip
              label="Starting balance"
              value={insight.starting == null ? "—" : formatGBP(insight.starting)}
              hint={insight.openedOn ? new Date(insight.openedOn).toLocaleDateString("en-GB") : undefined}
            />
          )}
          {show("changeMonth") && <ChangeChip label="Since last month" delta={insight.month} />}
          {show("changeTaxYear") && <ChangeChip label="This tax year" delta={insight.taxYear} />}
          {show("changeOpened") && <ChangeChip label="Since opened" delta={insight.opened} />}
          {show("interest") && (
            <StatChip
              label={growthLabel}
              value={insight.estimatedGrowth == null ? "—" : formatSignedGBP(insight.estimatedGrowth)}
              pct={formatPct(insight.opened.changePct)}
              hint={
                insight.estimatedContributions != null
                  ? `after ${formatGBP(insight.estimatedContributions)} estimated deposits`
                  : "net change on logged balances"
              }
            />
          )}
          {show("fees") && (
            <StatChip
              label="Est. fees"
              value={insight.estimatedFees == null ? (insight.feePct == null ? "No fee set" : "—") : formatGBP(insight.estimatedFees)}
              pct={formatPct(feePctOfBalance)}
              hint={
                insight.annualFee != null
                  ? `${formatGBP(insight.annualFee)}/yr at ${insight.feePct}%`
                  : "Set a fee % on the account"
              }
            />
          )}
          {show("highLow") && (
            <StatChip
              label="High / low"
              value={
                insight.high == null || insight.low == null
                  ? "—"
                  : `${formatGBP(insight.high, { compact: true })} / ${formatGBP(insight.low, { compact: true })}`
              }
            />
          )}
          {show("cagr") && (
            <StatChip
              label="Annualised"
              value={formatPct(insight.cagrPct) ?? "—"}
              hint={insight.years != null ? `over ${insight.years.toFixed(1)} years` : "Need more history"}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function FinanceSummary({
  accounts,
  entries,
  taxYears,
  colorFor,
  show,
}: {
  accounts: Account[];
  entries: BalanceEntry[];
  taxYears: TaxYearDef[];
  colorFor: (acc: Account) => string;
  show: (id: FinanceStatId) => boolean;
}) {
  const insights = buildFinanceInsights(accounts, entries);
  const taxYearRows = computeTaxYearSummary(
    accounts.filter((acc) => acc.active && !acc.hidden),
    entries,
    taxYears
  );
  const typeColors = Object.fromEntries(
    insights.typeMix.map((slice, i) => {
      const acc = accounts.find((a) => a.type === slice.key);
      return [slice.key, acc ? colorFor(acc) : ["#1f6f78", "#c8961e", "#3d5a80", "#3c6e47", "#8a4a5c"][i % 5]];
    })
  );

  const showAccountStats = (
    ["startingBalance", "changeMonth", "changeTaxYear", "changeOpened", "fees", "interest", "highLow", "cagr"] as FinanceStatId[]
  ).some(show);
  const showInsights = (["isaSplit", "isaMix", "liquidity", "typeMix", "movers"] as FinanceStatId[]).some(show);

  return (
    <div className="mb-5 space-y-5">
      {showAccountStats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {insights.accounts.map((insight) => (
            <AccountDetailTile
              key={insight.account.id}
              insight={insight}
              color={colorFor(insight.account)}
              show={show}
            />
          ))}
        </div>
      )}

      {showInsights && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {show("isaSplit") && <MixCard title="ISA vs not in an ISA" slices={insights.isaSplit} colors={MIX_COLORS} />}
          {show("isaMix") && <MixCard title="Inside ISAs" slices={insights.isaMix} colors={MIX_COLORS} />}
          {show("liquidity") && <MixCard title="Cash vs invested" slices={insights.liquidity} colors={MIX_COLORS} />}
          {show("typeMix") && <MixCard title="Mix by account type" slices={insights.typeMix} colors={typeColors} />}
        </div>
      )}

      {show("movers") && insights.movers.length > 0 && (
        <div className="p-4 rounded-2xl bg-card border-2 border-border shadow-card">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Biggest movers this tax year</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {insights.movers.map((row) => (
              <div key={row.account.id} className="rounded-xl border border-border bg-background px-3 py-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{row.account.name}</p>
                  <p className="text-[11px] text-muted-foreground">{kindLabel(row.kind)}</p>
                </div>
                <div className={`text-right ${toneClass(row.taxYear.change)}`}>
                  <p className="text-sm font-bold font-display">{row.taxYear.change == null ? "—" : formatSignedGBP(row.taxYear.change)}</p>
                  <p className="text-[11px]">{formatPct(row.taxYear.changePct) ?? "—"}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {show("taxYears") && (
        <div className="rounded-2xl bg-card border-2 border-border shadow-card overflow-hidden">
          <div className="p-3 border-b border-border bg-muted/40">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
              <CalendarRange className="w-3.5 h-3.5" /> Tax year breakdown
            </h3>
          </div>
          <div className="overflow-auto max-h-96">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="sticky left-0 z-10 bg-muted/50 text-left p-3 font-semibold text-muted-foreground whitespace-nowrap">Tax year</th>
                  {insights.accounts.map((row) => (
                    <th key={row.account.id} className="text-right p-3 font-semibold whitespace-nowrap" style={{ color: colorFor(row.account) }}>
                      {row.account.name}
                    </th>
                  ))}
                  <th className="text-right p-3 font-semibold text-foreground whitespace-nowrap">Total</th>
                </tr>
              </thead>
              <tbody>
                {taxYearRows.map((row) => (
                  <tr key={row.label} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="sticky left-0 z-10 bg-card p-3 font-medium text-foreground whitespace-nowrap">{row.label}</td>
                    {insights.accounts.map((acc) => {
                      const value = row.perAccount[acc.account.id] ?? null;
                      return (
                        <td key={acc.account.id} className={`p-3 text-right whitespace-nowrap font-semibold ${toneClass(value)}`}>
                          {value === null ? "—" : formatSignedGBP(value, true)}
                        </td>
                      );
                    })}
                    <td className={`p-3 text-right whitespace-nowrap font-bold ${toneClass(row.total)}`}>
                      {row.total === null ? "—" : formatSignedGBP(row.total, true)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
