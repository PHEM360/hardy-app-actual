import { useState, useMemo, useEffect } from "react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import {
  Wallet, Plus, Eye, EyeOff, Archive, RotateCcw, Table2, LineChart as LineChartIcon,
  Settings2, X, CalendarRange, BarChart3, ArrowUpDown, TrendingUp, TrendingDown, Minus, Upload, Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import { deleteField } from "firebase/firestore";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea,
} from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFinance, type Account, type BalanceEntry } from "@/hooks/useFinance";
import { useSharedScope } from "@/hooks/useSharedScope";
import ShareAccessButton from "@/components/sharing/ShareAccessButton";
import SharedScopeSwitcher from "@/components/sharing/SharedScopeSwitcher";
import {
  buildPivotTable, computeAccountSummary, computeTaxYearSummary, computeChartYDomain, formatGBP,
} from "@/lib/financeCalculations";
import ImportBalancesDialog from "@/components/finance/ImportBalancesDialog";
import {
  type ScenarioId, SCENARIO_LABELS, resolveGrowthPct, defaultMonthlyContribution, projectAccountBalance,
} from "@/lib/financeProjection";

// Mock data removed — accounts and entries now come from Firestore via useFinance.

// Validated categorical palette (dataviz skill reference instance) — fixed order,
// never cycled per filtered selection, so an account keeps its color regardless
// of what else is currently shown.
const ACCOUNT_COLORS_LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
const ACCOUNT_COLORS_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];

const TAX_YEARS = [
  { label: "22/23", start: "2022-04-06", end: "2023-04-05" },
  { label: "23/24", start: "2023-04-06", end: "2024-04-05" },
  { label: "24/25", start: "2024-04-06", end: "2025-04-05" },
  { label: "25/26", start: "2025-04-06", end: "2026-04-05" },
  { label: "26/27", start: "2026-04-06", end: "2027-04-05" },
];

const TIME_PERIODS = [
  { label: "6 months", months: 6 },
  { label: "1 year", months: 12 },
  { label: "2 years", months: 24 },
  { label: "All time", months: 0 },
];

function useIsDarkMode() {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => setIsDark(el.classList.contains("dark")));
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg bg-card border border-border shadow-elevated p-3 max-w-[220px]">
        <p className="text-xs text-muted-foreground font-medium mb-1.5">{label}</p>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2 py-0.5">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-2 ring-card" style={{ backgroundColor: p.color ?? p.stroke }} />
            <span className="text-xs text-muted-foreground">{p.name}</span>
            <span className="text-xs font-bold text-card-foreground ml-auto">{formatGBP(p.value ?? 0)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

function DeltaBadge({ value, pct }: { value: number | null; pct: number | null }) {
  if (value === null) return <span className="text-xs text-muted-foreground">No entries in this period</span>;
  const isUp = value > 0;
  const isFlat = value === 0;
  const colorClass = isFlat
    ? "text-muted-foreground"
    : isUp
    ? "text-[#006300] dark:text-[#0ca30c]"
    : "text-[#d03b3b] dark:text-[#e66767]";
  const Icon = isFlat ? Minus : isUp ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-bold ${colorClass}`}>
      <Icon className="w-3.5 h-3.5" />
      {isUp ? "+" : ""}
      {formatGBP(value)}
      {pct !== null && (
        <span className="font-medium opacity-80">
          ({isUp ? "+" : ""}
          {pct.toFixed(1)}%)
        </span>
      )}
    </span>
  );
}

function TaxYearCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground/40">—</span>;
  if (value === 0) return <span className="text-muted-foreground">£0</span>;
  const isUp = value > 0;
  return (
    <span className={`font-semibold ${isUp ? "text-[#006300] dark:text-[#0ca30c]" : "text-[#d03b3b] dark:text-[#e66767]"}`}>
      {isUp ? "+" : ""}
      {formatGBP(value, { compact: true })}
    </span>
  );
}

function TaxYearLabel({ viewBox, value, isDark }: any) {
  if (!viewBox) return null;
  const { x, y, width } = viewBox;
  const cx = x + width / 2;
  const padX = Math.max(14, value.length * 3.6);
  return (
    <g pointerEvents="none">
      <rect
        x={cx - padX}
        y={y + 6}
        width={padX * 2}
        height={15}
        rx={7.5}
        fill={isDark ? "#2c2c2a" : "#ffffff"}
        stroke={isDark ? "#3a3a37" : "#e1e0d9"}
        strokeWidth={1}
      />
      <text x={cx} y={y + 16.5} textAnchor="middle" fontSize={9} fontWeight={700} fill={isDark ? "#c3c2b7" : "#52514e"}>
        {value}
      </text>
    </g>
  );
}

function pillClass(active: boolean) {
  return `h-9 px-3.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
    active
      ? "bg-primary/10 text-primary border-primary/25"
      : "bg-transparent border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
  }`;
}

type ViewMode = "chart" | "table" | "summary";

const VIEW_MODES: { id: ViewMode; label: string; Icon: typeof LineChartIcon }[] = [
  { id: "chart", label: "Chart", Icon: LineChartIcon },
  { id: "table", label: "Table", Icon: Table2 },
  { id: "summary", label: "Summary", Icon: BarChart3 },
];

interface FinanceProps {
  /** Dev-only preview hook (see FinancePreview.tsx) — bypasses Firestore/auth entirely. */
  mockData?: { accounts: Account[]; entries: BalanceEntry[] };
}

const Finance = ({ mockData }: FinanceProps = {}) => {
  const isDark = useIsDarkMode();
  const palette = isDark ? ACCOUNT_COLORS_DARK : ACCOUNT_COLORS_LIGHT;

  const { scopeUserId, permission: scopePermission } = useSharedScope("finance");
  const canEdit = mockData ? false : scopePermission === "edit";
  const live = useFinance(scopeUserId ?? undefined);
  const accounts = mockData?.accounts ?? live.accounts;
  const entries = mockData?.entries ?? live.entries;
  const { loading, addAccount, updateAccount, addBalanceEntry, deleteEntry, importEntries } = live;
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  // Keep selectedAccounts in sync when accounts load
  useMemo(() => {
    if (accounts.length > 0 && selectedAccounts.length === 0) {
      setSelectedAccounts(accounts.map((a) => a.id));
    }
  }, [accounts.length]);
  const [timePeriod, setTimePeriod] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("chart");
  const [showHidden, setShowHidden] = useState(false);
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [addBalanceOpen, setAddBalanceOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [manageAccountId, setManageAccountId] = useState<string | null>(null);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountType, setNewAccountType] = useState("Savings");
  const [newBalanceAccountId, setNewBalanceAccountId] = useState("");
  const [newBalanceAmount, setNewBalanceAmount] = useState("");
  const [newBalanceDate, setNewBalanceDate] = useState(new Date().toISOString().split("T")[0]);
  const [renameValue, setRenameValue] = useState("");
  const [showTaxYears, setShowTaxYears] = useState(true);
  const [showTotalLine, setShowTotalLine] = useState(false);
  const [tableSortDesc, setTableSortDesc] = useState(true);
  const [showProjection, setShowProjection] = useState(false);
  const [scenario, setScenario] = useState<ScenarioId>("historical");
  const [projectionYears, setProjectionYears] = useState(10);
  const [assumptionGrowth, setAssumptionGrowth] = useState("");
  const [assumptionContribution, setAssumptionContribution] = useState("");
  const [assumptionFee, setAssumptionFee] = useState("");

  const visibleAccounts = accounts.filter((a) => showHidden || !a.hidden);
  const colorFor = (acc: Account) => palette[accounts.indexOf(acc) % palette.length];

  const periodStartISO = useMemo(() => {
    if (timePeriod <= 0) return undefined;
    return new Date(Date.now() - timePeriod * 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  }, [timePeriod]);

  const chartData = useMemo(() => {
    const cutoff = timePeriod > 0
      ? new Date(Date.now() - timePeriod * 30 * 24 * 60 * 60 * 1000)
      : new Date(0);

    const relevantEntries = entries.filter((e) => new Date(e.date) >= cutoff);
    const dates = [...new Set(relevantEntries.map((e) => e.date))].sort();

    return dates.map((date) => {
      const row: any = { date: new Date(date as string).toLocaleDateString("en-GB", { month: "short", year: "2-digit" }), rawDate: date };
      let total = 0;
      accounts.forEach((acc) => {
        const entry = relevantEntries.find((e) => e.accountId === acc.id && e.date === date);
        if (entry) {
          row[acc.id] = entry.balance;
          if (selectedAccounts.includes(acc.id)) total += entry.balance;
        }
      });
      row.total = total;
      return row;
    });
  }, [entries, accounts, timePeriod, selectedAccounts]);

  const taxYearAreas = useMemo(() => {
    if (chartData.length < 2) return [];
    return TAX_YEARS.map((ty, i) => {
      const start = chartData.find((d) => d.rawDate >= ty.start);
      const end = chartData.filter((d) => d.rawDate <= ty.end).pop();
      if (start && end && start.date !== end.date) return { x1: start.date, x2: end.date, label: ty.label, shade: i % 2 === 1 };
      return null;
    }).filter(Boolean);
  }, [chartData]);

  const accountsForChart = accounts.filter((a) => selectedAccounts.includes(a.id));

  // ── Predictive modelling ──────────────────────────────────────────────────
  const projectionKeys = useMemo(() => accountsForChart.map((acc) => `${acc.id}_proj`), [accountsForChart]);

  const combinedChartData = useMemo(() => {
    if (!showProjection || chartData.length === 0) return chartData;

    const latestByAccount = new Map(
      accountsForChart.map((acc) => {
        const accEntries = entries.filter((e) => e.accountId === acc.id).sort((a, b) => b.date.localeCompare(a.date));
        return [acc.id, accEntries[0]?.balance ?? 0] as const;
      })
    );

    const thisYear = new Date().getFullYear();
    const seededLastRow = { ...chartData[chartData.length - 1] };
    accountsForChart.forEach((acc) => {
      seededLastRow[`${acc.id}_proj`] = seededLastRow[acc.id] ?? latestByAccount.get(acc.id);
    });

    const futureRows = Array.from({ length: projectionYears }, (_, i) => {
      const year = i + 1;
      const row: any = { date: `${thisYear + year}`, isProjection: true };
      accountsForChart.forEach((acc) => {
        const startingBalance = latestByAccount.get(acc.id) ?? 0;
        const accEntries = entries.filter((e) => e.accountId === acc.id);
        const growthPct = resolveGrowthPct(scenario, acc, accEntries);
        const monthlyContribution = scenario === "custom" ? defaultMonthlyContribution(acc) : (acc.monthlyContribution ?? (acc.type === "LISA" ? 4000 / 12 : 0));
        const feePct = acc.feePct ?? 0;
        const points = projectAccountBalance({
          startingBalance,
          annualGrowthPct: growthPct,
          monthlyContribution,
          annualFeePct: feePct,
          years: projectionYears,
          isLisa: acc.type === "LISA",
        });
        row[`${acc.id}_proj`] = points[year]?.balance;
      });
      return row;
    });

    return [...chartData.slice(0, -1), seededLastRow, ...futureRows];
  }, [showProjection, chartData, accountsForChart, entries, scenario, projectionYears]);

  const yDomain = useMemo(() => {
    const keys = showTotalLine && selectedAccounts.length > 1 ? [...selectedAccounts, "total"] : selectedAccounts;
    const allKeys = showProjection ? [...keys, ...projectionKeys] : keys;
    return computeChartYDomain(combinedChartData, allKeys);
  }, [combinedChartData, selectedAccounts, showTotalLine, showProjection, projectionKeys]);

  const latestBalances = useMemo(() => {
    return accounts.map((acc) => {
      const accEntries = entries.filter((e) => e.accountId === acc.id).sort((a, b) => b.date.localeCompare(a.date));
      return { ...acc, latestBalance: accEntries[0]?.balance ?? 0, latestDate: accEntries[0]?.date ?? "" };
    });
  }, [accounts, entries]);

  const totalBalance = latestBalances.filter((a) => a.active && !a.hidden).reduce((s, a) => s + a.latestBalance, 0);

  const pivot = useMemo(() => buildPivotTable(entries), [entries]);
  const sortedPivotDates = useMemo(
    () => (tableSortDesc ? [...pivot.dates].reverse() : pivot.dates),
    [pivot.dates, tableSortDesc]
  );

  const accountSummaries = useMemo(
    () => visibleAccounts.map((acc) => computeAccountSummary(acc.id, entries, periodStartISO)),
    [visibleAccounts, entries, periodStartISO]
  );

  const overallSummary = useMemo(() => {
    const withData = accountSummaries.filter((s) => s.hasData);
    if (withData.length === 0) return { netChange: null as number | null, netChangePct: null as number | null };
    const opening = withData.reduce((s, a) => s + (a.opening ?? 0), 0);
    const closing = withData.reduce((s, a) => s + (a.closing ?? 0), 0);
    const netChange = closing - opening;
    const netChangePct = opening !== 0 ? (netChange / Math.abs(opening)) * 100 : null;
    return { netChange, netChangePct };
  }, [accountSummaries]);

  const taxYearRows = useMemo(
    () => computeTaxYearSummary(visibleAccounts, entries, TAX_YEARS),
    [visibleAccounts, entries]
  );

  const toggleAccount = (id: string) => {
    setSelectedAccounts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleAddAccount = async () => {
    if (!newAccountName.trim()) return;
    await addAccount(newAccountName, newAccountType);
    setNewAccountName("");
    setAddAccountOpen(false);
  };

  const handleAddBalance = async () => {
    const amount = parseFloat(newBalanceAmount);
    if (!newBalanceAccountId || isNaN(amount)) return;
    await addBalanceEntry(newBalanceAccountId, newBalanceDate, amount);
    setNewBalanceAmount("");
    setAddBalanceOpen(false);
  };

  const toggleHide = (id: string) => {
    const acc = accounts.find((a) => a.id === id);
    if (acc) updateAccount(id, { hidden: !acc.hidden });
  };
  const toggleActive = (id: string) => {
    const acc = accounts.find((a) => a.id === id);
    if (acc) updateAccount(id, { active: !acc.active });
  };
  const renameAccount = (id: string) => {
    if (!renameValue.trim()) return;
    updateAccount(id, { name: renameValue });
    setManageAccountId(null);
    setRenameValue("");
  };

  const saveAssumptions = (id: string) => {
    // Firestore's updateDoc rejects literal `undefined` — deleteField() clears a
    // previously-set assumption when the input is left blank.
    const updates = {
      growthAssumptionPct: assumptionGrowth.trim() ? parseFloat(assumptionGrowth) : deleteField(),
      monthlyContribution: assumptionContribution.trim() ? parseFloat(assumptionContribution) : deleteField(),
      feePct: assumptionFee.trim() ? parseFloat(assumptionFee) : deleteField(),
    };
    updateAccount(id, updates as Partial<Account>);
  };

  const managingAccount = manageAccountId ? accounts.find(a => a.id === manageAccountId) : null;
  const managingEntries = manageAccountId ? entries.filter(e => e.accountId === manageAccountId).sort((a, b) => b.date.localeCompare(a.date)) : [];

  if (loading) {
    return (
      <FeaturePageShell title="My Finances" subtitle="Account balances over time" icon={<Wallet className="w-5 h-5" />}>
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </FeaturePageShell>
    );
  }

  return (
    <FeaturePageShell
      title="My Finances"
      subtitle="Account balances over time"
      icon={<Wallet className="w-5 h-5" />}
      action={
        <div className="flex items-center gap-1.5">
          <SharedScopeSwitcher page="finance" />
          <ShareAccessButton page="finance" />
        </div>
      }
    >
      {/* Total Balance */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-5 rounded-2xl border border-primary/15 shadow-card mb-5" style={{ background: "linear-gradient(135deg, hsl(190, 29%, 35%) 0%, hsl(191, 33%, 50%) 100%)" }}>
        <p className="text-xs text-white/70 uppercase tracking-wider font-medium">Total Balance</p>
        <p className="text-2xl font-bold font-display text-white mt-1">
          {formatGBP(totalBalance)}
        </p>
        <p className="text-xs text-white/60 mt-1">
          Across {latestBalances.filter((a) => a.active && !a.hidden).length} active accounts
        </p>
      </motion.div>

      {/* Account Summary Cards — click to select in graph, gear to manage */}
      <div className="flex items-center justify-between px-1 mb-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <span className="w-1 h-4 rounded-full bg-gradient-primary inline-block" />
          Accounts
        </h3>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button size="sm" variant="outline" className="h-8 rounded-lg gap-1.5" onClick={() => setAddAccountOpen(true)}>
              <Plus className="w-3.5 h-3.5" /> Add Account
            </Button>
          )}
          <Dialog open={addAccountOpen} onOpenChange={setAddAccountOpen}>
            <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
              <DialogHeader><DialogTitle className="font-display">New Account</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Account Name</Label>
                  <Input placeholder="e.g. Stocks & Shares ISA" value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={newAccountType} onValueChange={setNewAccountType}>
                    <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Current", "Savings", "ISA", "LISA", "Cash", "Investment", "Pension", "Other"].map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddAccount} disabled={!newAccountName.trim()} className="w-full h-11 rounded-xl bg-gradient-primary">Create Account</Button>
              </div>
            </DialogContent>
          </Dialog>
          <button onClick={() => setShowHidden(!showHidden)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            {showHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showHidden ? "Hide closed" : "Show all"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-5">
        {latestBalances.filter((a) => showHidden || !a.hidden).map((acc, i) => {
          const color = colorFor(acc);
          const isSelected = selectedAccounts.includes(acc.id);
          return (
            <motion.div
              key={acc.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ y: -2 }}
              transition={{ delay: 0.03 * i }}
              className={`p-3 rounded-2xl border-2 text-left transition-all relative group overflow-hidden ${
                isSelected ? "shadow-card" : "hover:shadow-soft"
              } ${!acc.active ? "opacity-40" : ""}`}
              style={{
                borderColor: isSelected ? `${color}55` : `${color}25`,
                background: isSelected
                  ? `linear-gradient(160deg, ${color}2e 0%, ${color}12 100%)`
                  : `${color}0d`,
              }}
            >
              <button onClick={() => toggleAccount(acc.id)} className="w-full text-left relative">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center shadow-sm"
                    style={{ backgroundColor: color }}
                  >
                    <span className="w-2 h-2 rounded-full bg-white/90" />
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider truncate px-1.5 py-0.5 rounded-md bg-muted/60 text-muted-foreground">
                    {acc.type}
                  </span>
                </div>
                <p className="text-base font-bold font-display text-card-foreground">
                  {formatGBP(acc.latestBalance)}
                </p>
                <p className="text-xs text-muted-foreground truncate">{acc.name}</p>
              </button>
              <button
                onClick={() => {
                  setManageAccountId(acc.id);
                  setRenameValue(acc.name);
                  setAssumptionGrowth(acc.growthAssumptionPct !== undefined ? String(acc.growthAssumptionPct) : "");
                  setAssumptionContribution(acc.monthlyContribution !== undefined ? String(acc.monthlyContribution) : "");
                  setAssumptionFee(acc.feePct !== undefined ? String(acc.feePct) : "");
                }}
                className="absolute top-1.5 right-1.5 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-muted transition-all text-muted-foreground"
              >
                <Settings2 className="w-3 h-3" />
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* Controls Row */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-0.5 p-1 bg-muted/30 border border-border/40 rounded-2xl relative">
          {VIEW_MODES.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setViewMode(id)}
              className={`relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors z-10 ${
                viewMode === id ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {viewMode === id && (
                <motion.span
                  layoutId="finance-view-tab"
                  className="absolute inset-0 bg-primary/12 rounded-xl shadow-sm ring-1 ring-primary/25 -z-10"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        {(viewMode === "chart" || viewMode === "summary") && (
          <Select value={String(timePeriod)} onValueChange={(v) => setTimePeriod(Number(v))}>
            <SelectTrigger className="h-9 rounded-xl text-xs w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_PERIODS.map((tp) => (
                <SelectItem key={tp.months} value={String(tp.months)}>{tp.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {viewMode === "chart" && (
          <>
            <button onClick={() => setShowTaxYears(!showTaxYears)} className={pillClass(showTaxYears)}>
              <CalendarRange className="w-3.5 h-3.5" />
              Tax years
            </button>
            {selectedAccounts.length > 1 && (
              <button onClick={() => setShowTotalLine(!showTotalLine)} className={pillClass(showTotalLine)}>
                <span className="text-sm font-bold leading-none">Σ</span>
                Total
              </button>
            )}
            <button onClick={() => setShowProjection(!showProjection)} className={pillClass(showProjection)}>
              <Sparkles className="w-3.5 h-3.5" />
              Projection
            </button>
          </>
        )}

        <div className="flex-1" />

        {canEdit && (
          <Button
            onClick={() => setImportOpen(true)}
            variant="outline"
            className="h-9 px-3 rounded-xl gap-1.5"
          >
            <Upload className="w-4 h-4" /> Import
          </Button>
        )}
        {canEdit && (
          <Button
            onClick={() => setAddBalanceOpen(true)}
            className="h-9 px-4 rounded-xl gap-1.5 bg-gradient-primary text-white font-semibold shadow-sm hover:shadow-md transition-shadow"
          >
            <Plus className="w-4 h-4" /> Log Balance
          </Button>
        )}
        <Dialog open={addBalanceOpen} onOpenChange={setAddBalanceOpen}>
          <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
            <DialogHeader><DialogTitle className="font-display">Log Balance</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Account</Label>
                <Select value={newBalanceAccountId} onValueChange={setNewBalanceAccountId}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>
                    {accounts.filter((a) => a.active).map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={newBalanceDate} onChange={(e) => setNewBalanceDate(e.target.value)} className="h-11 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Balance (£)</Label>
                <Input type="number" step="0.01" placeholder="e.g. 12500.00" value={newBalanceAmount} onChange={(e) => setNewBalanceAmount(e.target.value)} className="h-11 rounded-xl" />
              </div>
              <Button onClick={handleAddBalance} disabled={!newBalanceAccountId || !newBalanceAmount} className="w-full h-11 rounded-xl bg-gradient-primary">Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Chart View */}
      {viewMode === "chart" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="p-4 sm:p-5 rounded-3xl bg-card border border-border/50 shadow-soft mb-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-gradient-primary inline-block" />
              Balance Over Time
            </h3>
            {showTaxYears && (
              <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/80 font-medium">
                <CalendarRange className="w-3 h-3" /> Tax years shaded
              </span>
            )}
          </div>

          {showProjection && (
            <div className="flex items-center gap-2 mb-4 flex-wrap p-2.5 rounded-2xl bg-muted/30 border border-border/30">
              <span className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pl-0.5">
                <Sparkles className="w-3 h-3" /> Projection
              </span>
              <Select value={scenario} onValueChange={(v) => setScenario(v as ScenarioId)}>
                <SelectTrigger className="h-8 rounded-lg text-xs w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(SCENARIO_LABELS) as ScenarioId[]).map((id) => (
                    <SelectItem key={id} value={id}>{SCENARIO_LABELS[id]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(projectionYears)} onValueChange={(v) => setProjectionYears(Number(v))}>
                <SelectTrigger className="h-8 rounded-lg text-xs w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[5, 10, 15, 20].map((y) => (
                    <SelectItem key={y} value={String(y)}>{y} years</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Dashed lines are estimates, not guarantees. Set per-account assumptions via each account's gear icon.
              </p>
            </div>
          )}

          <div className="h-64 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={combinedChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  {accountsForChart.map((acc) => {
                    const color = colorFor(acc);
                    return (
                      <linearGradient key={acc.id} id={`fin-grad-${acc.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                      </linearGradient>
                    );
                  })}
                </defs>
                <CartesianGrid stroke={isDark ? "#2c2c2a" : "#e1e0d9"} vertical={false} />
                {showTaxYears && taxYearAreas.map((area: any, i: number) => (
                  <ReferenceArea
                    key={i}
                    x1={area.x1}
                    x2={area.x2}
                    fill={isDark ? "#ffffff" : "#0b0b0b"}
                    fillOpacity={area.shade ? 0.09 : 0.035}
                    stroke={isDark ? "#3a3a37" : "#d8d6cd"}
                    strokeWidth={1}
                    label={<TaxYearLabel value={area.label} isDark={isDark} />}
                  />
                ))}
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: isDark ? "#c3c2b7" : "#52514e" }} axisLine={false} tickLine={false} />
                <YAxis
                  domain={yDomain ?? ["auto", "auto"]}
                  tick={{ fontSize: 10, fill: isDark ? "#c3c2b7" : "#52514e" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatGBP(v, { compact: true, decimals: 0 })}
                  width={52}
                />
                <Tooltip content={<CustomTooltip />} />
                {accountsForChart.map((acc) => {
                  const color = colorFor(acc);
                  return (
                    <Area
                      key={acc.id}
                      type="linear"
                      dataKey={acc.id}
                      name={acc.name}
                      stroke={color}
                      strokeWidth={2}
                      fill={`url(#fin-grad-${acc.id})`}
                      dot={{ r: 4, strokeWidth: 2, stroke: isDark ? "#1a1a19" : "#fcfcfb", fill: color }}
                      activeDot={{ r: 6, strokeWidth: 2, stroke: isDark ? "#1a1a19" : "#fcfcfb" }}
                      connectNulls
                      isAnimationActive={false}
                    />
                  );
                })}
                {showTotalLine && selectedAccounts.length > 1 && (
                  <Line
                    type="linear"
                    dataKey="total"
                    name="Total"
                    stroke={isDark ? "#ffffff" : "#0b0b0b"}
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                )}
                {showProjection && accountsForChart.map((acc) => {
                  const color = colorFor(acc);
                  return (
                    <Line
                      key={`${acc.id}_proj`}
                      type="linear"
                      dataKey={`${acc.id}_proj`}
                      name={`${acc.name} (projected)`}
                      stroke={color}
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      strokeOpacity={0.75}
                      dot={false}
                      connectNulls
                      isAnimationActive={false}
                    />
                  );
                })}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {/* Custom legend */}
          {(accountsForChart.length > 1 || (showTotalLine && selectedAccounts.length > 1) || showProjection) && (
            <div className="flex flex-wrap gap-1.5 mt-4 px-0.5">
              {accountsForChart.map((acc) => (
                <span
                  key={acc.id}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground bg-muted/40 rounded-full px-2.5 py-1"
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colorFor(acc) }} />
                  {acc.name}
                </span>
              ))}
              {showTotalLine && selectedAccounts.length > 1 && (
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground bg-muted/40 rounded-full px-2.5 py-1">
                  <span className="w-3.5 h-0.5 rounded-full flex-shrink-0" style={{ background: isDark ? "#ffffff" : "#0b0b0b" }} />
                  Total
                </span>
              )}
              {showProjection && (
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground bg-muted/40 rounded-full px-2.5 py-1">
                  <svg width="14" height="2" className="flex-shrink-0"><line x1="0" y1="1" x2="14" y2="1" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" /></svg>
                  Projected ({SCENARIO_LABELS[scenario]})
                </span>
              )}
            </div>
          )}
        </motion.div>
      )}

      {/* Table View — spreadsheet-style pivot: dates down, accounts across */}
      {viewMode === "table" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl bg-card border border-border/50 shadow-soft mb-5 overflow-hidden">
          <div className="p-3 border-b border-border/30 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{sortedPivotDates.length} logged date{sortedPivotDates.length === 1 ? "" : "s"}</p>
            <button onClick={() => setTableSortDesc((v) => !v)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ArrowUpDown className="w-3.5 h-3.5" />
              {tableSortDesc ? "Newest first" : "Oldest first"}
            </button>
          </div>
          <div className="overflow-auto max-h-[28rem]">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="sticky left-0 z-10 bg-muted/50 text-left p-3 font-semibold text-muted-foreground whitespace-nowrap">Date</th>
                  {visibleAccounts.map((acc) => (
                    <th key={acc.id} className="text-right p-3 font-semibold text-muted-foreground whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 justify-end">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colorFor(acc) }} />
                        {acc.name}
                      </span>
                    </th>
                  ))}
                  <th className="text-right p-3 font-semibold text-muted-foreground whitespace-nowrap">Total</th>
                </tr>
              </thead>
              <tbody>
                {sortedPivotDates.map((date) => {
                  const row = pivot.cellsByDate[date] ?? {};
                  const rowHasAny = visibleAccounts.some((acc) => row[acc.id]);
                  if (!rowHasAny) return null;
                  const rowTotal = visibleAccounts.reduce((s, acc) => s + (row[acc.id]?.balance ?? 0), 0);
                  return (
                    <tr key={date} className="border-b border-border/30 hover:bg-muted/30 group">
                      <td className="sticky left-0 z-10 bg-card group-hover:bg-muted/30 p-3 text-muted-foreground whitespace-nowrap">
                        {new Date(date).toLocaleDateString("en-GB")}
                      </td>
                      {visibleAccounts.map((acc) => {
                        const cell = row[acc.id];
                        return (
                          <td key={acc.id} className="p-3 text-right font-medium text-card-foreground whitespace-nowrap">
                            {cell ? (
                              <span className="inline-flex items-center gap-1.5">
                                {formatGBP(cell.balance)}
                                {canEdit && (
                                  <button
                                    onClick={() => deleteEntry(cell.entryId)}
                                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                                    title="Delete entry"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="p-3 text-right font-bold font-display text-card-foreground whitespace-nowrap">{formatGBP(rowTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Summary View — per-account growth/loss + tax-year breakdown */}
      {viewMode === "summary" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {visibleAccounts.map((acc) => {
              const summary = accountSummaries.find((s) => s.accountId === acc.id)!;
              return (
                <div
                  key={acc.id}
                  className="p-4 rounded-xl bg-card border border-border/50 shadow-soft"
                  style={{ borderLeftWidth: 4, borderLeftColor: colorFor(acc) }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-card-foreground truncate">{acc.name}</p>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider flex-shrink-0 ml-2">{acc.type}</span>
                  </div>
                  {summary.hasData && (
                    <div className="flex items-center gap-3 mb-2 text-xs text-muted-foreground">
                      <span>Opening <span className="font-semibold text-card-foreground">{formatGBP(summary.opening!)}</span></span>
                      <span>Closing <span className="font-semibold text-card-foreground">{formatGBP(summary.closing!)}</span></span>
                    </div>
                  )}
                  <DeltaBadge value={summary.netChange} pct={summary.netChangePct} />
                </div>
              );
            })}
          </div>

          <div className="p-5 rounded-2xl shadow-card" style={{ background: "linear-gradient(135deg, hsl(190, 29%, 35%) 0%, hsl(191, 33%, 50%) 100%)" }}>
            <p className="text-xs text-white/70 uppercase tracking-wider font-medium mb-1">Overall Net Change</p>
            {overallSummary.netChange !== null ? (
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-bold font-display text-white">
                  {overallSummary.netChange >= 0 ? "+" : ""}
                  {formatGBP(overallSummary.netChange)}
                </span>
                {overallSummary.netChangePct !== null && (
                  <span className="text-sm text-white/80 font-medium">
                    {overallSummary.netChangePct >= 0 ? "+" : ""}
                    {overallSummary.netChangePct.toFixed(1)}%
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm text-white/70">No entries in this period</p>
            )}
          </div>

          <div className="rounded-3xl bg-card border border-border/50 shadow-soft overflow-hidden">
            <div className="p-3 border-b border-border/30">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <CalendarRange className="w-3.5 h-3.5" /> Tax Year Breakdown
              </h3>
            </div>
            <div className="overflow-auto max-h-96">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="sticky left-0 z-10 bg-muted/50 text-left p-3 font-semibold text-muted-foreground whitespace-nowrap">Tax Year</th>
                    {visibleAccounts.map((acc) => (
                      <th key={acc.id} className="text-right p-3 font-semibold text-muted-foreground whitespace-nowrap">{acc.name}</th>
                    ))}
                    <th className="text-right p-3 font-semibold text-muted-foreground whitespace-nowrap">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {taxYearRows.map((row) => (
                    <tr key={row.label} className="border-b border-border/30 hover:bg-muted/30">
                      <td className="sticky left-0 z-10 bg-card p-3 font-medium text-card-foreground whitespace-nowrap">{row.label}</td>
                      {visibleAccounts.map((acc) => (
                        <td key={acc.id} className="p-3 text-right whitespace-nowrap"><TaxYearCell value={row.perAccount[acc.id] ?? null} /></td>
                      ))}
                      <td className="p-3 text-right whitespace-nowrap"><TaxYearCell value={row.total} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* Account Management Dialog — click on account card gear icon */}
      <Dialog open={!!manageAccountId} onOpenChange={(o) => !o && setManageAccountId(null)}>
        <DialogContent aria-describedby={undefined} className="max-w-md mx-4">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              {managingAccount && (
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: colorFor(managingAccount) }} />
              )}
              {managingAccount?.name}
            </DialogTitle>
          </DialogHeader>
          {managingAccount && (
            <div className="space-y-4 pt-2">
              {/* Rename */}
              <div className="space-y-2">
                <Label className="text-xs">Account Name</Label>
                <div className="flex gap-2">
                  <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} className="h-10 rounded-xl flex-1" />
                  <Button onClick={() => manageAccountId && renameAccount(manageAccountId)} size="sm" className="h-10 rounded-xl bg-gradient-primary">Rename</Button>
                </div>
              </div>
              {/* Status actions */}
              <div className="flex gap-2">
                <Button onClick={() => { toggleActive(manageAccountId!); }} variant="outline" size="sm" className="flex-1 h-9 rounded-lg gap-1.5 text-xs">
                  {managingAccount.active ? <Archive className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  {managingAccount.active ? "Close Account" : "Reopen Account"}
                </Button>
                <Button onClick={() => { toggleHide(manageAccountId!); }} variant="outline" size="sm" className="flex-1 h-9 rounded-lg gap-1.5 text-xs">
                  {managingAccount.hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  {managingAccount.hidden ? "Show" : "Hide"}
                </Button>
              </div>
              {/* Projection assumptions (used by the "Custom" scenario) */}
              <div className="space-y-2 p-3 rounded-xl bg-muted/30">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
                  <Label className="text-xs">Projection Assumptions (Custom scenario)</Label>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Growth %/yr</Label>
                    <Input type="number" step="0.1" placeholder="4" value={assumptionGrowth} onChange={(e) => setAssumptionGrowth(e.target.value)} className="h-9 rounded-lg text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Monthly £</Label>
                    <Input type="number" step="1" placeholder="0" value={assumptionContribution} onChange={(e) => setAssumptionContribution(e.target.value)} className="h-9 rounded-lg text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Fee %/yr</Label>
                    <Input type="number" step="0.1" placeholder="0" value={assumptionFee} onChange={(e) => setAssumptionFee(e.target.value)} className="h-9 rounded-lg text-xs" />
                  </div>
                </div>
                {managingAccount.type === "LISA" && (
                  <p className="text-[10px] text-muted-foreground">
                    LISA rules apply automatically under every scenario: contributions capped at £4,000/yr with a 25% government bonus added on top.
                  </p>
                )}
                <Button onClick={() => manageAccountId && saveAssumptions(manageAccountId)} size="sm" variant="outline" className="w-full h-8 rounded-lg text-xs">
                  Save Assumptions
                </Button>
              </div>
              {/* History for this account */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Balance History</p>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border/50">
                  <table className="w-full text-xs">
                    <tbody>
                      {managingEntries.map((entry) => (
                        <tr key={entry.id} className="border-b border-border/30 last:border-0 group">
                          <td className="p-2 text-muted-foreground">{new Date(entry.date).toLocaleDateString("en-GB")}</td>
                          <td className="p-2 text-right font-bold font-display text-card-foreground">{formatGBP(entry.balance)}</td>
                          <td className="p-2 text-right w-8">
                            {canEdit && (
                              <button onClick={() => deleteEntry(entry.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ImportBalancesDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        accounts={accounts}
        entries={entries}
        onImport={importEntries}
      />
    </FeaturePageShell>
  );
};

export default Finance;
