import { useState, type ReactNode } from "react";
import { CalendarRange, PieChart as PieIcon, Receipt, TrendingDown, TrendingUp, Minus, FilterX } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { Account, BalanceEntry } from "@/hooks/useFinance";
import type { FinanceStatId } from "@/lib/financeDisplay";
import {
  ASSET_CLASS_COLORS,
  ASSET_CLASS_LABELS,
  CONTRIBUTIONS_HINT,
  CONTRIBUTIONS_NOTE,
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
  ...ASSET_CLASS_COLORS,
};

function toneClass(value: number | null) {
  if (value === null || value === 0) return "text-muted-foreground";
  return value > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";
}

function DeltaIcon({ value }: { value: number | null }) {
  if (value === null || value === 0) return <Minus className="w-3.5 h-3.5" />;
  return value > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />;
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border-2 border-border bg-card shadow-card overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

function InnerChip({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl bg-muted border border-border/80 px-3 py-2.5 min-w-0 shadow-sm ${className}`}>
      {children}
    </div>
  );
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
    <InnerChip>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-bold font-display text-foreground mt-0.5 truncate">{value}</p>
      {(pct || hint) && (
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
          {pct}
          {pct && hint ? " · " : ""}
          {hint}
        </p>
      )}
    </InnerChip>
  );
}

function ChangeChip({ label, delta }: { label: string; delta: PeriodDelta }) {
  const value = delta.change;
  return (
    <InnerChip>
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
            {" · incl. money in"}
          </p>
        </>
      )}
    </InnerChip>
  );
}

function MixCard({
  title,
  slices,
  colors,
  selectedKey,
  onSelect,
}: {
  title: string;
  slices: MixSlice[];
  colors: Record<string, string>;
  selectedKey?: string | null;
  onSelect?: (slice: MixSlice | null) => void;
}) {
  if (slices.length === 0) {
    return (
      <Panel>
        <div className="p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{title}</h3>
          <p className="text-sm text-muted-foreground">Nothing to show yet.</p>
        </div>
      </Panel>
    );
  }
  return (
    <Panel>
      <div className="px-4 py-3 border-b border-border bg-muted/70">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">{title}</h3>
        {onSelect && <p className="text-[11px] text-muted-foreground mt-0.5">Tap a slice to highlight matching accounts</p>}
      </div>
      <div className="p-4">
        <div className="h-3 rounded-full overflow-hidden flex bg-background border border-border mb-3">
          {slices.map((slice) => (
            <button
              key={slice.key}
              type="button"
              className="h-full min-w-[6px] transition-opacity"
              style={{
                width: `${Math.max(slice.pct, 1.5)}%`,
                background: colors[slice.key] || "#5c6b73",
                opacity: selectedKey && selectedKey !== slice.key ? 0.35 : 1,
              }}
              title={`${slice.label} ${slice.pct.toFixed(0)}%`}
              onClick={() => onSelect?.(selectedKey === slice.key ? null : slice)}
            />
          ))}
        </div>
        <div className="space-y-1.5">
          {slices.map((slice) => {
            const active = selectedKey === slice.key;
            return (
              <button
                key={slice.key}
                type="button"
                onClick={() => onSelect?.(active ? null : slice)}
                className={`w-full flex items-center justify-between gap-2 text-sm rounded-xl px-2.5 py-2 text-left transition-colors border ${
                  active
                    ? "bg-background border-foreground/20 shadow-sm"
                    : "bg-muted/80 border-transparent hover:border-border hover:bg-background"
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colors[slice.key] || "#5c6b73" }} />
                  <span className="truncate font-medium">{slice.label}</span>
                </span>
                <span className="font-semibold tabular-nums flex-shrink-0">
                  {formatGBP(slice.amount)} <span className="text-muted-foreground font-medium">({slice.pct.toFixed(0)}%)</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

function AllocationDonut({ slices }: { slices: MixSlice[] }) {
  if (slices.length === 0) return null;
  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={slices} dataKey="amount" nameKey="label" innerRadius={42} outerRadius={64} paddingAngle={2} stroke="none">
            {slices.map((slice) => (
              <Cell key={slice.key} fill={MIX_COLORS[slice.key] || "#7a7a74"} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function AllocationBar({ insight }: { insight: AccountInsight }) {
  if (insight.allocations.length === 0) {
    return <p className="text-[11px] text-muted-foreground">Add holdings on this account to show a split.</p>;
  }
  const total = insight.allocations.reduce((sum, row) => sum + row.pct, 0) || 100;
  return (
    <div>
      <div className="h-2 rounded-full overflow-hidden flex bg-background border border-border">
        {insight.allocations.map((row) => (
          <div
            key={row.id}
            className="h-full"
            style={{ width: `${(row.pct / total) * 100}%`, background: ASSET_CLASS_COLORS[row.assetClass] }}
            title={`${row.name || ASSET_CLASS_LABELS[row.assetClass]} ${row.pct}%`}
          />
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground mt-1.5 truncate">
        {insight.allocations
          .map((row) => `${row.name || ASSET_CLASS_LABELS[row.assetClass]} ${row.pct.toFixed(0)}%`)
          .join(" · ")}
      </p>
    </div>
  );
}

function AccountDetailTile({
  insight,
  color,
  show,
  dimmed,
}: {
  insight: AccountInsight;
  color: string;
  show: (id: FinanceStatId) => boolean;
  dimmed?: boolean;
}) {
  const growthLabel = insight.kind === "current" || insight.kind === "savings" || insight.kind === "cash_isa"
    ? "Est. interest"
    : "Est. growth";
  const feePctOfBalance =
    insight.annualFee != null && insight.latest > 0 ? (insight.annualFee / insight.latest) * 100 : null;
  const feeHint = insight.feeLines.join(" · ");

  return (
    <div
      className="rounded-2xl border-2 overflow-hidden shadow-card transition-opacity"
      style={{
        borderColor: color,
        background: `color-mix(in srgb, ${color} 14%, hsl(var(--card)))`,
        opacity: dimmed ? 0.38 : 1,
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
              {insight.currentRate
                ? ` · ${insight.currentRate.ratePct}% from ${new Date(insight.currentRate.from).toLocaleDateString("en-GB")}`
                : ""}
            </p>
          </div>
          <p className="text-lg font-bold font-display text-foreground flex-shrink-0">{formatGBP(insight.latest)}</p>
        </div>
        {show("allocation") && (
          <div className="mb-3 rounded-xl bg-muted border border-border/80 p-2.5">
            <AllocationBar insight={insight} />
          </div>
        )}
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
              hint={CONTRIBUTIONS_HINT}
            />
          )}
          {show("fees") && (
            <StatChip
              label="Est. fees"
              value={insight.estimatedFees == null ? (insight.annualFee == null ? "No fee set" : "—") : formatGBP(insight.estimatedFees)}
              pct={formatPct(feePctOfBalance)}
              hint={feeHint || "Set fees on the account"}
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
              hint={
                insight.years != null
                  ? `${CONTRIBUTIONS_HINT} · ${insight.years.toFixed(1)} years`
                  : CONTRIBUTIONS_HINT
              }
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
  const [focus, setFocus] = useState<{ source: string; slice: MixSlice } | null>(null);

  const showAccountStats = (
    ["startingBalance", "changeMonth", "changeTaxYear", "changeOpened", "fees", "interest", "highLow", "cagr", "allocation"] as FinanceStatId[]
  ).some(show);
  const showMix = (["isaSplit", "isaMix", "liquidity", "typeMix"] as FinanceStatId[]).some(show);
  const focusedIds = focus?.slice.accountIds ?? null;
  const cashPct = insights.liquidity.find((slice) => slice.key === "liquid")?.pct ?? 0;
  const isaPct = insights.isaSplit.find((slice) => slice.key === "isa")?.pct ?? 0;

  const selectSlice = (source: string, slice: MixSlice | null) => {
    if (!slice || (focus?.source === source && focus.slice.key === slice.key)) {
      setFocus(null);
      return;
    }
    setFocus({ source, slice });
  };

  return (
    <div className="mb-5 space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Panel>
          <div className="p-4 bg-muted/60">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">This tax year</p>
            <p className={`text-xl font-bold font-display mt-1 ${toneClass(insights.portfolio.taxYear.change)}`}>
              {insights.portfolio.taxYear.change == null ? "—" : formatSignedGBP(insights.portfolio.taxYear.change)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{formatPct(insights.portfolio.taxYear.changePct) ?? "Need more history"}</p>
          </div>
        </Panel>
        <Panel>
          <div className="p-4 bg-muted/60">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Since last month</p>
            <p className={`text-xl font-bold font-display mt-1 ${toneClass(insights.portfolio.month.change)}`}>
              {insights.portfolio.month.change == null ? "—" : formatSignedGBP(insights.portfolio.month.change)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{formatPct(insights.portfolio.month.changePct) ?? "Need more history"}</p>
          </div>
        </Panel>
        <Panel>
          <div className="p-4 bg-muted/60">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5" /> Est. fees / year
            </p>
            <p className="text-xl font-bold font-display mt-1 text-foreground">
              {insights.totalAnnualFees == null ? "—" : formatGBP(insights.totalAnnualFees)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {insights.accountsMissingFees > 0
                ? `${insights.accountsMissingFees} account${insights.accountsMissingFees === 1 ? "" : "s"} with no fee set`
                : "Platform, OCF, advice and other fees"}
            </p>
          </div>
        </Panel>
        <Panel>
          <div className="p-4 bg-muted/60">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Mix snapshot</p>
            <p className="text-xl font-bold font-display mt-1 text-foreground">{cashPct.toFixed(0)}% cash</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{isaPct.toFixed(0)}% held in an ISA</p>
          </div>
        </Panel>
      </div>

      <div className="rounded-2xl border-2 border-border bg-muted/70 px-4 py-3">
        <p className="text-xs text-foreground leading-relaxed">{CONTRIBUTIONS_NOTE}</p>
      </div>

      {focus && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-primary/30 bg-accent px-3 py-2.5">
          <p className="text-sm font-medium text-foreground">
            Showing accounts in <span className="font-bold">{focus.slice.label}</span>
          </p>
          <button type="button" onClick={() => setFocus(null)} className="text-xs font-semibold inline-flex items-center gap-1 text-primary">
            <FilterX className="w-3.5 h-3.5" /> Clear
          </button>
        </div>
      )}

      {show("allocation") && (
        <Panel>
          <div className="px-4 py-3 border-b border-border bg-muted/70 flex items-center gap-2">
            <PieIcon className="w-3.5 h-3.5 text-muted-foreground" />
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Asset allocation</h3>
              <p className="text-[11px] text-muted-foreground">Weighted by current balance. Tap a class to filter accounts.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-2 p-4">
            <AllocationDonut slices={insights.allocation} />
            <div className="space-y-1.5">
              {insights.allocation.map((slice) => {
                const active = focus?.source === "allocation" && focus.slice.key === slice.key;
                return (
                  <button
                    key={slice.key}
                    type="button"
                    onClick={() => selectSlice("allocation", active ? null : slice)}
                    className={`w-full flex items-center justify-between gap-2 text-sm rounded-xl px-2.5 py-2 text-left border transition-colors ${
                      active ? "bg-background border-foreground/20 shadow-sm" : "bg-muted/80 border-transparent hover:bg-background hover:border-border"
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: MIX_COLORS[slice.key] || "#7a7a74" }} />
                      <span className="truncate font-medium">{slice.label}</span>
                    </span>
                    <span className="font-semibold tabular-nums flex-shrink-0">
                      {formatGBP(slice.amount)} <span className="text-muted-foreground font-medium">({slice.pct.toFixed(0)}%)</span>
                    </span>
                  </button>
                );
              })}
              {insights.accountsMissingAllocations > 0 && (
                <p className="text-[11px] text-muted-foreground pt-1">
                  {insights.accountsMissingAllocations} invested account{insights.accountsMissingAllocations === 1 ? "" : "s"} still need a fund split — open the account gear to add holdings.
                </p>
              )}
            </div>
          </div>
        </Panel>
      )}

      {showMix && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {show("isaSplit") && (
            <MixCard title="ISA vs not in an ISA" slices={insights.isaSplit} colors={MIX_COLORS} selectedKey={focus?.source === "isaSplit" ? focus.slice.key : null} onSelect={(slice) => selectSlice("isaSplit", slice)} />
          )}
          {show("isaMix") && (
            <MixCard title="Inside ISAs" slices={insights.isaMix} colors={MIX_COLORS} selectedKey={focus?.source === "isaMix" ? focus.slice.key : null} onSelect={(slice) => selectSlice("isaMix", slice)} />
          )}
          {show("liquidity") && (
            <MixCard title="Cash vs invested" slices={insights.liquidity} colors={MIX_COLORS} selectedKey={focus?.source === "liquidity" ? focus.slice.key : null} onSelect={(slice) => selectSlice("liquidity", slice)} />
          )}
          {show("typeMix") && (
            <MixCard title="Mix by account type" slices={insights.typeMix} colors={typeColors} selectedKey={focus?.source === "typeMix" ? focus.slice.key : null} onSelect={(slice) => selectSlice("typeMix", slice)} />
          )}
        </div>
      )}

      {show("feesOverview") && (
        <Panel>
          <div className="px-4 py-3 border-b border-border bg-muted/70">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Fees overview</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Estimated from the fees you set on each account.</p>
          </div>
          <div className="divide-y divide-border">
            {insights.accounts.map((row) => (
              <div
                key={row.account.id}
                className="flex items-center justify-between gap-3 px-4 py-3 bg-card hover:bg-muted/40 transition-opacity"
                style={{ opacity: focusedIds && !focusedIds.includes(row.account.id) ? 0.38 : 1 }}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{row.account.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {row.feeLines.join(" · ") || "No fee set"}
                    {row.currentRate ? ` · Rate ${row.currentRate.ratePct}%` : ""}
                  </p>
                </div>
                <p className="text-sm font-bold font-display flex-shrink-0">
                  {row.annualFee == null ? "—" : `${formatGBP(row.annualFee)}/yr`}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {showAccountStats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {insights.accounts.map((insight) => (
            <AccountDetailTile
              key={insight.account.id}
              insight={insight}
              color={colorFor(insight.account)}
              show={show}
              dimmed={Boolean(focusedIds && !focusedIds.includes(insight.account.id))}
            />
          ))}
        </div>
      )}

      {show("movers") && insights.movers.length > 0 && (
        <Panel>
          <div className="px-4 py-3 border-b border-border bg-muted/70">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Biggest movers this tax year</h3>
          </div>
          <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {insights.movers.map((row) => (
              <div key={row.account.id} className="rounded-xl border border-border bg-muted px-3 py-2.5 flex items-center justify-between gap-2">
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
        </Panel>
      )}

      {show("taxYears") && (
        <Panel>
          <div className="p-3 border-b border-border bg-muted/70">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
              <CalendarRange className="w-3.5 h-3.5" /> Tax year breakdown
            </h3>
          </div>
          <div className="overflow-auto max-h-96">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th className="sticky left-0 z-10 bg-muted text-left p-3 font-semibold text-muted-foreground whitespace-nowrap">Tax year</th>
                  {insights.accounts.map((row) => (
                    <th key={row.account.id} className="text-right p-3 font-semibold whitespace-nowrap" style={{ color: colorFor(row.account) }}>
                      {row.account.name}
                    </th>
                  ))}
                  <th className="text-right p-3 font-semibold text-foreground whitespace-nowrap">Total</th>
                </tr>
              </thead>
              <tbody>
                {taxYearRows.map((row, i) => (
                  <tr key={row.label} className={`border-b border-border/40 ${i % 2 === 0 ? "bg-card" : "bg-muted/50"} hover:bg-accent/60`}>
                    <td className={`sticky left-0 z-10 p-3 font-medium text-foreground whitespace-nowrap ${i % 2 === 0 ? "bg-card" : "bg-muted/50"}`}>{row.label}</td>
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
        </Panel>
      )}
    </div>
  );
}
