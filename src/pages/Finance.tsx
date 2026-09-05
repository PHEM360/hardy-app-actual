import { useState, useMemo, useEffect } from "react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import {
  Wallet, Plus, Eye, EyeOff, Archive, RotateCcw, Table2, LineChart as LineChartIcon,
  Settings2, X, CalendarRange, BarChart3, ArrowUpDown, Upload, Sparkles, StickyNote, Calculator,
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useFinance, type Account, type AccountFee, type BalanceEntry, type FeeKind, type FundAllocation, type InterestRatePeriod } from "@/hooks/useFinance";
import { useSharedScope } from "@/hooks/useSharedScope";
import { useFinanceSettings } from "@/hooks/useFinanceSettings";
import { resolveAccountType } from "@/lib/financeAccounts";
import { AccountTypeFields } from "@/components/finance/AccountTypeFields";
import AccountHoldingsFields from "@/components/finance/AccountHoldingsFields";
import AccountTypesSettings from "@/components/finance/AccountTypesSettings";
import BankSyncSettings from "@/components/finance/BankSyncSettings";
import DisplayStatsSettings from "@/components/finance/DisplayStatsSettings";
import FinanceSummary from "@/components/finance/FinanceSummary";
import FinanceTaxPanel from "@/components/finance/FinanceTaxPanel";
import {
  buildPivotTable, computeChartYDomain, formatGBP,
} from "@/lib/financeCalculations";
import { accountFeeTotals, buildFinanceInsights, formatPct, formatSignedGBP, type PeriodDelta } from "@/lib/financeInsights";
import type { FinanceStatId } from "@/lib/financeDisplay";
import ImportBalancesDialog from "@/components/finance/ImportBalancesDialog";
import {
  type ScenarioId, SCENARIO_LABELS, resolveGrowthPct, defaultMonthlyContribution, projectAccountBalance,
} from "@/lib/financeProjection";

// Mock data removed — accounts and entries now come from Firestore via useFinance.

// Validated categorical palette (dataviz skill reference instance) — fixed order,
// never cycled per filtered selection, so an account keeps its color regardless
// of what else is currently shown.
const ACCOUNT_COLORS_LIGHT = ["#1f6f78", "#c8961e", "#3d5a80", "#3c6e47", "#8a4a5c", "#5c4a7d", "#a34c3f", "#2f7d8c"];
const ACCOUNT_COLORS_DARK = ["#4ea3ac", "#d9ac3f", "#7fa0c9", "#6fae7d", "#c07f92", "#9884b8", "#d1786a", "#5fb0bf"];

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
    const notes = payload
      .map((p: any) => {
        const note = p.payload?.[`${p.dataKey}_note`];
        if (!note || String(p.dataKey).endsWith("_proj")) return null;
        return { name: p.name, color: p.color ?? p.stroke, note };
      })
      .filter(Boolean) as { name: string; color: string; note: string }[];
    return (
      <div className="rounded-lg bg-card border-2 border-border shadow-elevated p-3 max-w-[260px]">
        <p className="text-xs text-muted-foreground font-medium mb-1.5">{label}</p>
        {payload.filter((p: any) => !String(p.dataKey).endsWith("_note")).map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2 py-0.5">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-2 ring-card" style={{ backgroundColor: p.color ?? p.stroke }} />
            <span className="text-xs font-semibold" style={{ color: p.color ?? p.stroke }}>{p.name}</span>
            <span className="text-xs font-bold text-card-foreground ml-auto">{formatGBP(p.value ?? 0)}</span>
          </div>
        ))}
        {notes.map((n) => (
          <p key={n.name} className="text-[11px] text-foreground mt-2 pt-2 border-t border-border leading-snug">
            <span className="font-semibold" style={{ color: n.color }}>{n.name}: </span>
            {n.note}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

function NoteDot({ cx, cy, payload, dataKey, stroke }: { cx?: number; cy?: number; payload?: Record<string, unknown>; dataKey?: string; stroke?: string }) {
  const note = dataKey ? payload?.[`${dataKey}_note`] : undefined;
  if (!note || cx == null || cy == null) return <g />;
  return (
    <g transform={`translate(${cx},${cy})`} style={{ pointerEvents: "none" }}>
      <circle r={8} fill={stroke || "#1f6f78"} stroke="#fff" strokeWidth={1.5} />
      <text textAnchor="middle" dy={3.5} fontSize={9} fontWeight={800} fill="#fff">i</text>
    </g>
  );
}

function TaxYearLabel({ viewBox, value, isDark }: { viewBox?: { x: number; y: number; width: number }; value: string; isDark: boolean }) {
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
  return `h-9 px-3.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors border-2 ${
    active
      ? "bg-primary text-primary-foreground border-primary shadow-sm"
      : "bg-card border-border text-foreground hover:border-primary/50"
  }`;
}

function HeroDelta({ label, change, pct }: { label: string; change: number | null; pct: number | null }) {
  return (
    <div className="min-w-0 rounded-xl bg-white/25 border border-white/45 px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]">
      <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wide text-white/80 leading-tight">{label}</p>
      {change === null ? (
        <p className="text-[11px] sm:text-sm text-white/75 mt-0.5 leading-tight">Not enough history</p>
      ) : (
        <p className="truncate text-xs sm:text-sm font-bold font-display text-white mt-0.5">
          {formatSignedGBP(change)}
          {formatPct(pct) && <span className="text-white/85 font-medium ml-1.5">{formatPct(pct)}</span>}
        </p>
      )}
    </div>
  );
}

function TileDelta({ label, delta }: { label: string; delta: PeriodDelta }) {
  const value = delta.change;
  const tone =
    value == null || value === 0
      ? "text-muted-foreground"
      : value > 0
        ? "text-emerald-700 dark:text-emerald-400"
        : "text-rose-600 dark:text-rose-400";
  return (
    <div className="flex items-center justify-between gap-1 mt-1 text-[10px] leading-tight">
      <span className="text-muted-foreground uppercase tracking-wide font-semibold">{label}</span>
      <span className={`font-bold tabular-nums ${tone}`}>
        {value == null ? "—" : formatSignedGBP(value, true)}
      </span>
    </div>
  );
}

type ViewMode = "chart" | "table" | "summary" | "tax" | "settings";

const VIEW_MODES: { id: ViewMode; label: string; Icon: typeof LineChartIcon }[] = [
  { id: "chart", label: "Chart", Icon: LineChartIcon },
  { id: "table", label: "Table", Icon: Table2 },
  { id: "summary", label: "Summary", Icon: BarChart3 },
  { id: "tax", label: "Tax", Icon: Calculator },
  { id: "settings", label: "Settings", Icon: Settings2 },
];

interface FinanceProps {
  /** Dev-only preview hook (see FinancePreview.tsx) — bypasses Firestore/auth entirely. */
  mockData?: { accounts: Account[]; entries: BalanceEntry[] };
}

const Finance = ({ mockData }: FinanceProps = {}) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isDark = useIsDarkMode();
  const palette = isDark ? ACCOUNT_COLORS_DARK : ACCOUNT_COLORS_LIGHT;

  const { scopeUserId, permission: scopePermission, pageTitle, isOwnScope } = useSharedScope("finance");
  const canEdit = mockData ? false : scopePermission === "edit";
  const live = useFinance(scopeUserId ?? undefined);
  const { accountTypes, displayStats, saveAccountTypes, saveDisplayStats, ensureType } = useFinanceSettings(scopeUserId ?? undefined);
  const accounts = mockData?.accounts ?? live.accounts;
  const entries = mockData?.entries ?? live.entries;
  const { loading, addAccount, updateAccount, addBalanceEntry, updateEntry, deleteEntry, importEntries } = live;
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
  const [newAccountCustomType, setNewAccountCustomType] = useState("");
  const [newAccountOpenedOn, setNewAccountOpenedOn] = useState("");
  const [manageType, setManageType] = useState("Savings");
  const [manageCustomType, setManageCustomType] = useState("");
  const [newBalanceAccountId, setNewBalanceAccountId] = useState("");
  const [newBalanceAmount, setNewBalanceAmount] = useState("");
  const [newBalanceDate, setNewBalanceDate] = useState(new Date().toISOString().split("T")[0]);
  const [newBalanceNote, setNewBalanceNote] = useState("");
  const [noteEditor, setNoteEditor] = useState<{ entryId: string; accountName: string; date: string; note: string } | null>(null);
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
  const [assumptionOcf, setAssumptionOcf] = useState("");
  const [assumptionAnnualFee, setAssumptionAnnualFee] = useState("");
  const [assumptionAdviceFee, setAssumptionAdviceFee] = useState("");
  const [assumptionAdviceKind, setAssumptionAdviceKind] = useState<FeeKind>("percent");
  const [assumptionExtraFees, setAssumptionExtraFees] = useState<AccountFee[]>([]);
  const [assumptionInterestRates, setAssumptionInterestRates] = useState<InterestRatePeriod[]>([]);
  const [assumptionOpenedOn, setAssumptionOpenedOn] = useState("");
  const [assumptionAllocations, setAssumptionAllocations] = useState<FundAllocation[]>([]);

  useEffect(() => {
    const bank = searchParams.get("bank");
    if (!bank) return;
    if (bank === "connected") {
      toast.success("Bank connected. Link each account below — we’ll copy today’s balance and past month-ends.");
      setViewMode("settings");
    } else if (bank === "cancelled") {
      toast.info("Bank connection cancelled.");
    } else {
      toast.error("Could not connect the bank. Try again from Settings.");
      setViewMode("settings");
    }
    const next = new URLSearchParams(searchParams);
    next.delete("bank");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const visibleAccounts = accounts.filter((a) => showHidden || !a.hidden);
  const colorFor = (acc: Account) => {
    const idx = Math.max(0, accounts.findIndex((a) => a.id === acc.id));
    return palette[idx % palette.length];
  };
  const showStat = (id: FinanceStatId) => displayStats[id] !== false;

  const chartData = useMemo(() => {
    const cutoff = timePeriod > 0
      ? new Date(Date.now() - timePeriod * 30 * 24 * 60 * 60 * 1000)
      : new Date(0);

    const selected = new Set(selectedAccounts);
    const relevantEntries = entries.filter((e) => new Date(e.date) >= cutoff && selected.has(e.accountId));
    const dates = [...new Set(relevantEntries.map((e) => e.date))].sort();

    return dates.map((date) => {
      const row: Record<string, unknown> = {
        date: new Date(date).toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
        rawDate: date,
      };
      let total = 0;
      accounts.forEach((acc) => {
        if (!selected.has(acc.id)) return;
        const entry = relevantEntries.find((e) => e.accountId === acc.id && e.date === date);
        if (entry) {
          row[acc.id] = entry.balance;
          total += entry.balance;
          if (entry.note?.trim()) row[`${acc.id}_note`] = entry.note.trim();
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
        const feePct = accountFeeTotals(acc).pct ?? 0;
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
  const insights = useMemo(
    () => buildFinanceInsights(accounts.filter((a) => a.active && !a.hidden), entries),
    [accounts, entries]
  );
  const portfolio = insights.portfolio;
  const insightById = useMemo(
    () => Object.fromEntries(insights.accounts.map((row) => [row.account.id, row])),
    [insights]
  );

  const pivot = useMemo(() => buildPivotTable(entries), [entries]);
  const sortedPivotDates = useMemo(
    () => (tableSortDesc ? [...pivot.dates].reverse() : pivot.dates),
    [pivot.dates, tableSortDesc]
  );

  const toggleAccount = (id: string) => {
    setSelectedAccounts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleAddAccount = async () => {
    if (!newAccountName.trim()) return;
    const type = resolveAccountType(newAccountType, newAccountCustomType);
    await addAccount(newAccountName, type, { openedOn: newAccountOpenedOn });
    await ensureType(type);
    setNewAccountName("");
    setNewAccountType("Savings");
    setNewAccountCustomType("");
    setNewAccountOpenedOn("");
    setAddAccountOpen(false);
  };

  const handleAddBalance = async () => {
    const amount = parseFloat(newBalanceAmount);
    if (!newBalanceAccountId || isNaN(amount)) return;
    const existing = entries.find((e) => e.accountId === newBalanceAccountId && e.date === newBalanceDate);
    if (existing) {
      await updateEntry(existing.id, { balance: amount, note: newBalanceNote });
    } else {
      await addBalanceEntry(newBalanceAccountId, newBalanceDate, amount, newBalanceNote);
    }
    setNewBalanceAmount("");
    setNewBalanceNote("");
    setAddBalanceOpen(false);
  };

  const saveNoteEditor = async () => {
    if (!noteEditor) return;
    await updateEntry(noteEditor.entryId, { note: noteEditor.note });
    setNoteEditor(null);
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
    const cleanedAllocations = assumptionAllocations
      .map((row) => ({
        id: row.id,
        name: row.name.trim(),
        pct: Number(row.pct) || 0,
        assetClass: row.assetClass,
      }))
      .filter((row) => row.name || row.pct > 0);
    const cleanedFees = assumptionExtraFees
      .map((row) => ({
        id: row.id,
        name: row.name.trim(),
        kind: row.kind,
        amount: Number(row.amount) || 0,
      }))
      .filter((row) => row.name || row.amount > 0);
    const cleanedRates = assumptionInterestRates
      .map((row) => ({
        id: row.id,
        ratePct: Number(row.ratePct) || 0,
        from: row.from,
      }))
      .filter((row) => row.from && row.ratePct > 0)
      .sort((a, b) => a.from.localeCompare(b.from));
    const updates = {
      openedOn: assumptionOpenedOn.trim() ? assumptionOpenedOn : deleteField(),
      growthAssumptionPct: assumptionGrowth.trim() ? parseFloat(assumptionGrowth) : deleteField(),
      monthlyContribution: assumptionContribution.trim() ? parseFloat(assumptionContribution) : deleteField(),
      feePct: assumptionFee.trim() ? parseFloat(assumptionFee) : deleteField(),
      ocfPct: assumptionOcf.trim() ? parseFloat(assumptionOcf) : deleteField(),
      annualFeeGbp: assumptionAnnualFee.trim() ? parseFloat(assumptionAnnualFee) : deleteField(),
      adviceFeeAmount: assumptionAdviceFee.trim() ? parseFloat(assumptionAdviceFee) : deleteField(),
      adviceFeeKind: assumptionAdviceFee.trim() ? assumptionAdviceKind : deleteField(),
      extraFees: cleanedFees.length ? cleanedFees : deleteField(),
      interestRates: cleanedRates.length ? cleanedRates : deleteField(),
      allocations: cleanedAllocations.length ? cleanedAllocations : deleteField(),
    };
    updateAccount(id, updates as Partial<Account>);
    toast.success("Account details saved");
  };

  const managingAccount = manageAccountId ? accounts.find(a => a.id === manageAccountId) : null;
  const managingEntries = manageAccountId ? entries.filter(e => e.accountId === manageAccountId).sort((a, b) => b.date.localeCompare(a.date)) : [];

  if (loading) {
    return (
      <FeaturePageShell title={pageTitle} subtitle="Account balances over time" icon={<Wallet className="w-5 h-5" />} sharePage="finance">
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </FeaturePageShell>
    );
  }

  return (
    <FeaturePageShell
      title={pageTitle}
      subtitle={isOwnScope ? "Account balances over time" : "Shared with you"}
      icon={<Wallet className="w-5 h-5" />}
      sharePage="finance"
    >
      {isOwnScope && (
        <button
          onClick={() => navigate("/household-finance")}
          className="w-full text-left rounded-xl border-2 border-border bg-card hover:border-primary/40 px-3.5 py-2.5 mb-3 sm:mb-4 transition-colors shadow-soft"
        >
          <p className="text-xs font-semibold text-foreground">This page is your personal finances</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Joint accounts shared with your household live on Household Finance →
          </p>
        </button>
      )}

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-4 sm:p-5 rounded-2xl shadow-card mb-3 sm:mb-5 bg-gradient-primary">
        <p className="text-xs text-white/70 uppercase tracking-wider font-medium">Total balance</p>
        <p className="text-2xl font-bold font-display text-white mt-1">
          {formatGBP(totalBalance)}
        </p>
        <p className="text-xs text-white/70 mt-1">
          Across {latestBalances.filter((a) => a.active && !a.hidden).length} active accounts
        </p>
        {(showStat("heroMonth") || showStat("heroTaxYear") || showStat("heroOpened")) && (
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mt-3 sm:mt-4">
            {showStat("heroMonth") && (
              <HeroDelta label="Since last month" change={portfolio.month.change} pct={portfolio.month.changePct} />
            )}
            {showStat("heroTaxYear") && (
              <HeroDelta label="This tax year" change={portfolio.taxYear.change} pct={portfolio.taxYear.changePct} />
            )}
            {showStat("heroOpened") && (
              <HeroDelta label="Since opened" change={portfolio.opened.change} pct={portfolio.opened.changePct} />
            )}
          </div>
        )}
        <p className="hidden sm:block text-[11px] text-white/75 mt-3 leading-snug">
          These changes include money paid in. Individual deposits and withdrawals aren’t recorded, so this isn’t a pure return.
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
                <AccountTypeFields
                  types={accountTypes}
                  value={newAccountType}
                  onChange={setNewAccountType}
                  customValue={newAccountCustomType}
                  onCustomChange={setNewAccountCustomType}
                />
                <div className="space-y-2">
                  <Label>Date opened <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input type="date" value={newAccountOpenedOn} onChange={(e) => setNewAccountOpenedOn(e.target.value)} className="h-11 rounded-xl" />
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

      <div className={`grid gap-2 mb-5 ${
        showStat("tileMonth") || showStat("tileTaxYear") || showStat("tileOpened")
          ? "grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
          : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
      }`}>
        {latestBalances.filter((a) => showHidden || !a.hidden).map((acc, i) => {
          const color = colorFor(acc);
          const isSelected = selectedAccounts.includes(acc.id);
          const insight = insightById[acc.id];
          return (
            <motion.div
              key={acc.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ y: -2 }}
              transition={{ delay: 0.03 * i }}
              className={`rounded-2xl border-2 text-left transition-all relative group overflow-hidden shadow-card ${
                !acc.active ? "opacity-45" : ""
              }`}
              style={{
                borderColor: color,
                background: `color-mix(in srgb, ${color} ${isSelected ? 22 : 10}%, hsl(var(--card)))`,
                outline: isSelected ? `2px solid ${color}` : undefined,
                outlineOffset: 0,
              }}
            >
              <div className="h-1.5 w-full" style={{ background: color }} />
              <div className="p-3 relative">
                <button onClick={() => toggleAccount(acc.id)} className="w-full text-left relative">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center shadow-sm"
                      style={{ backgroundColor: color }}
                    >
                      <span className="w-2 h-2 rounded-full bg-white/90" />
                    </span>
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider truncate px-1.5 py-0.5 rounded-md text-white"
                      style={{ backgroundColor: color }}
                    >
                      {acc.type}
                    </span>
                    {acc.bankAccountId && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-600 text-white">
                        Linked
                      </span>
                    )}
                  </div>
                  <p className="text-base font-bold font-display text-foreground">
                    {formatGBP(acc.latestBalance)}
                  </p>
                  <p className="text-xs font-medium truncate" style={{ color }}>{acc.name}</p>
                  {(acc.openedOn || insight?.openedOn) && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Opened {new Date(acc.openedOn || insight.openedOn!).toLocaleDateString("en-GB")}
                    </p>
                  )}
                  {insight?.currentRate && (
                    <p className="text-[10px] text-muted-foreground">
                      {insight.currentRate.ratePct}% from {new Date(insight.currentRate.from).toLocaleDateString("en-GB")}
                    </p>
                  )}
                  {insight && (showStat("tileMonth") || showStat("tileTaxYear") || showStat("tileOpened")) && (
                    <div className="mt-2 rounded-lg bg-muted/90 border border-border/70 px-2 py-1.5">
                      {showStat("tileMonth") && <TileDelta label="1 month" delta={insight.month} />}
                      {showStat("tileTaxYear") && <TileDelta label="Tax year" delta={insight.taxYear} />}
                      {showStat("tileOpened") && <TileDelta label="Opened" delta={insight.opened} />}
                    </div>
                  )}
                </button>
                <button
                  onClick={() => {
                    setManageAccountId(acc.id);
                    setRenameValue(acc.name);
                    if (accountTypes.includes(acc.type) || acc.type === "Other") {
                      setManageType(acc.type);
                      setManageCustomType("");
                    } else {
                      setManageType("Other");
                      setManageCustomType(acc.type);
                    }
                    setAssumptionGrowth(acc.growthAssumptionPct !== undefined ? String(acc.growthAssumptionPct) : "");
                    setAssumptionContribution(acc.monthlyContribution !== undefined ? String(acc.monthlyContribution) : "");
                    setAssumptionFee(acc.feePct !== undefined ? String(acc.feePct) : "");
                    setAssumptionOcf(acc.ocfPct !== undefined ? String(acc.ocfPct) : "");
                    setAssumptionAnnualFee(acc.annualFeeGbp !== undefined ? String(acc.annualFeeGbp) : "");
                    setAssumptionAdviceFee(acc.adviceFeeAmount !== undefined ? String(acc.adviceFeeAmount) : "");
                    setAssumptionAdviceKind(acc.adviceFeeKind ?? "percent");
                    setAssumptionExtraFees(acc.extraFees ?? []);
                    setAssumptionInterestRates(acc.interestRates ?? []);
                    setAssumptionOpenedOn(acc.openedOn ?? "");
                    setAssumptionAllocations(acc.allocations ?? []);
                  }}
                  className="absolute top-1.5 right-1.5 p-1 rounded-md opacity-70 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-muted transition-all text-muted-foreground"
                >
                  <Settings2 className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Controls Row */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-1 p-1 bg-card border-2 border-border rounded-2xl relative shadow-soft">
          {VIEW_MODES.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setViewMode(id)}
              className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors z-10 ${
                viewMode === id ? "text-primary-foreground" : "text-foreground/80 hover:text-foreground"
              }`}
            >
              {viewMode === id && (
                <motion.span
                  layoutId="finance-view-tab"
                  className="absolute inset-0 bg-gradient-primary rounded-xl shadow-sm -z-10"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        {viewMode === "chart" && (
          <>
            <Select value={String(timePeriod)} onValueChange={(v) => setTimePeriod(Number(v))}>
              <SelectTrigger className="h-9 rounded-xl text-xs w-28 bg-card border-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_PERIODS.map((tp) => (
                  <SelectItem key={tp.months} value={String(tp.months)}>{tp.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

        {viewMode !== "settings" && canEdit && (
          <Button
            onClick={() => setImportOpen(true)}
            variant="outline"
            className="h-9 px-3 rounded-xl gap-1.5"
          >
            <Upload className="w-4 h-4" /> Import
          </Button>
        )}
        {viewMode !== "settings" && canEdit && (
          <Button
            onClick={() => {
              setNewBalanceNote("");
              setAddBalanceOpen(true);
            }}
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
              <div className="space-y-2">
                <Label>Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea
                  value={newBalanceNote}
                  onChange={(e) => setNewBalanceNote(e.target.value)}
                  placeholder="e.g. £12k transferred in from bike sale"
                  className="min-h-[72px] rounded-xl text-sm"
                />
              </div>
              <Button onClick={handleAddBalance} disabled={!newBalanceAccountId || !newBalanceAmount} className="w-full h-11 rounded-xl bg-gradient-primary">Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Chart View */}
      {viewMode === "chart" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="p-4 sm:p-5 rounded-3xl bg-card border-2 border-border shadow-card mb-5">
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

          {accountsForChart.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-16">Tap an account name below to show it on the chart.</p>
          ) : (
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
                  type="number"
                  domain={yDomain ?? [0, 1]}
                  allowDataOverflow
                  tick={{ fontSize: 10, fill: isDark ? "#c3c2b7" : "#52514e" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatGBP(v, { compact: true, decimals: 0 })}
                  width={56}
                />
                <Tooltip content={<CustomTooltip />} />
                {accountsForChart.map((acc) => {
                  const color = colorFor(acc);
                  return (
                    <Area
                      key={acc.id}
                      type="monotone"
                      dataKey={acc.id}
                      name={acc.name}
                      stroke={color}
                      strokeWidth={2.75}
                      fill={`url(#fin-grad-${acc.id})`}
                      dot={(props) => <NoteDot {...props} dataKey={acc.id} stroke={color} />}
                      activeDot={{ r: 5, strokeWidth: 2, stroke: isDark ? "#1a1a19" : "#fcfcfb", fill: color }}
                      connectNulls
                      isAnimationActive={false}
                    />
                  );
                })}
                {showTotalLine && selectedAccounts.length > 1 && (
                  <Line
                    type="monotone"
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
                      type="monotone"
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
          )}
          {/* Custom legend */}
          <div className="flex flex-wrap gap-2 mt-4 px-0.5">
              {visibleAccounts.map((acc) => {
                const on = selectedAccounts.includes(acc.id);
                const color = colorFor(acc);
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => toggleAccount(acc.id)}
                    className="flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-2.5 py-1 border transition-opacity"
                    style={{
                      color: on ? color : undefined,
                      borderColor: on ? color : "hsl(var(--border))",
                      background: on ? `color-mix(in srgb, ${color} 16%, hsl(var(--card)))` : "hsl(var(--muted))",
                      opacity: on ? 1 : 0.45,
                    }}
                    title={on ? `Hide ${acc.name}` : `Show ${acc.name}`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                    {acc.name}
                  </button>
                );
              })}
              {showTotalLine && selectedAccounts.length > 1 && (
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground bg-muted rounded-full px-2.5 py-1 border border-border">
                  <span className="w-3.5 h-0.5 rounded-full flex-shrink-0" style={{ background: isDark ? "#ffffff" : "#0b0b0b" }} />
                  Total
                </span>
              )}
              {showProjection && (
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-foreground bg-muted rounded-full px-2.5 py-1 border border-border">
                  <svg width="14" height="2" className="flex-shrink-0"><line x1="0" y1="1" x2="14" y2="1" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" /></svg>
                  Projected ({SCENARIO_LABELS[scenario]})
                </span>
              )}
            </div>
        </motion.div>
      )}

      {/* Table View — spreadsheet-style pivot: dates down, accounts across */}
      {viewMode === "table" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl bg-card border-2 border-border shadow-card mb-5 overflow-hidden">
          <div className="p-3 border-b border-border flex items-center justify-between bg-muted/40">
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
                    <th key={acc.id} className="text-right p-3 font-semibold whitespace-nowrap" style={{ color: colorFor(acc) }}>
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
                              <span className="inline-flex items-center gap-1.5 justify-end">
                                {cell.note && (
                                  <button
                                    type="button"
                                    title={cell.note}
                                    onClick={() => setNoteEditor({ entryId: cell.entryId, accountName: acc.name, date, note: cell.note || "" })}
                                    className="text-primary hover:text-foreground"
                                  >
                                    <StickyNote className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {formatGBP(cell.balance)}
                                {canEdit && !cell.note && (
                                  <button
                                    type="button"
                                    title="Add note"
                                    onClick={() => setNoteEditor({ entryId: cell.entryId, accountName: acc.name, date, note: "" })}
                                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary"
                                  >
                                    <StickyNote className="w-3.5 h-3.5" />
                                  </button>
                                )}
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

      {viewMode === "summary" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <FinanceSummary
            accounts={visibleAccounts}
            entries={entries}
            taxYears={TAX_YEARS}
            colorFor={colorFor}
            show={showStat}
          />
        </motion.div>
      )}

      {viewMode === "tax" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <FinanceTaxPanel />
        </motion.div>
      )}

      {viewMode === "settings" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <DisplayStatsSettings
            values={displayStats}
            canEdit={canEdit}
            onChange={(next) => void saveDisplayStats(next)}
          />
          <BankSyncSettings
            scopeUserId={scopeUserId}
            canEdit={canEdit && isOwnScope}
            accounts={accounts}
          />
          <AccountTypesSettings
            types={accountTypes}
            canEdit={canEdit}
            onSave={saveAccountTypes}
            onRenameType={(from, to) => {
              accounts.filter((a) => a.type === from).forEach((a) => updateAccount(a.id, { type: to }));
            }}
          />
        </motion.div>
      )}

      {/* Account Management Dialog — click on account card gear icon */}
      <Dialog open={!!manageAccountId} onOpenChange={(o) => !o && setManageAccountId(null)}>
        <DialogContent aria-describedby={undefined} className="max-w-md mx-4 max-h-[85vh] overflow-y-auto">
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
              <AccountTypeFields
                types={accountTypes}
                value={manageType}
                onChange={setManageType}
                customValue={manageCustomType}
                onCustomChange={setManageCustomType}
              />
              <div className="space-y-2">
                <Label className="text-xs">Date opened</Label>
                <Input type="date" value={assumptionOpenedOn} onChange={(e) => setAssumptionOpenedOn(e.target.value)} className="h-10 rounded-xl" />
              </div>
              {canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-9 rounded-lg text-xs"
                  onClick={async () => {
                    if (!manageAccountId) return;
                    const type = resolveAccountType(manageType, manageCustomType);
                    await updateAccount(manageAccountId, { type });
                    await ensureType(type);
                  }}
                >
                  Save type
                </Button>
              )}
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
              <div className="space-y-2 p-3 rounded-xl bg-muted/50 border border-border">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
                  <Label className="text-xs">Projection assumptions</Label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Growth %/yr</Label>
                    <Input type="number" step="0.1" placeholder="4" value={assumptionGrowth} onChange={(e) => setAssumptionGrowth(e.target.value)} className="h-9 rounded-lg text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Monthly £</Label>
                    <Input type="number" step="1" placeholder="0" value={assumptionContribution} onChange={(e) => setAssumptionContribution(e.target.value)} className="h-9 rounded-lg text-xs" />
                  </div>
                </div>
                {managingAccount.type === "LISA" && (
                  <p className="text-[10px] text-muted-foreground">
                    LISA rules apply automatically under every scenario: contributions capped at £4,000/yr with a 25% government bonus added on top.
                  </p>
                )}
              </div>
              {canEdit && (
                <AccountHoldingsFields
                  feePct={assumptionFee}
                  ocfPct={assumptionOcf}
                  annualFeeGbp={assumptionAnnualFee}
                  adviceFeeAmount={assumptionAdviceFee}
                  adviceFeeKind={assumptionAdviceKind}
                  extraFees={assumptionExtraFees}
                  interestRates={assumptionInterestRates}
                  allocations={assumptionAllocations}
                  onFeePct={setAssumptionFee}
                  onOcfPct={setAssumptionOcf}
                  onAnnualFeeGbp={setAssumptionAnnualFee}
                  onAdviceFeeAmount={setAssumptionAdviceFee}
                  onAdviceFeeKind={setAssumptionAdviceKind}
                  onExtraFees={setAssumptionExtraFees}
                  onInterestRates={setAssumptionInterestRates}
                  onAllocations={setAssumptionAllocations}
                />
              )}
              {canEdit && (
                <Button onClick={() => manageAccountId && saveAssumptions(manageAccountId)} size="sm" className="w-full h-9 rounded-lg text-xs bg-gradient-primary">
                  Save account details
                </Button>
              )}
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
                          <td className="p-2 text-right">
                            <button
                              type="button"
                              title={entry.note || "Add note"}
                              onClick={() => setNoteEditor({
                                entryId: entry.id,
                                accountName: managingAccount.name,
                                date: entry.date,
                                note: entry.note || "",
                              })}
                              className={entry.note ? "text-primary" : "text-muted-foreground opacity-0 group-hover:opacity-100"}
                            >
                              <StickyNote className="w-3.5 h-3.5" />
                            </button>
                          </td>
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

      <Dialog open={!!noteEditor} onOpenChange={(open) => !open && setNoteEditor(null)}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="font-display">Balance note</DialogTitle>
          </DialogHeader>
          {noteEditor && (
            <div className="space-y-3 pt-1">
              <p className="text-xs text-muted-foreground">
                {noteEditor.accountName} · {new Date(noteEditor.date).toLocaleDateString("en-GB")}
              </p>
              <Textarea
                value={noteEditor.note}
                onChange={(e) => setNoteEditor({ ...noteEditor, note: e.target.value })}
                placeholder="e.g. £12k transferred in from bike sale"
                className="min-h-[88px] rounded-xl text-sm"
              />
              <div className="flex gap-2">
                {noteEditor.note.trim() && (
                  <Button
                    variant="outline"
                    className="h-10 rounded-xl"
                    onClick={async () => {
                      await updateEntry(noteEditor.entryId, { note: "" });
                      setNoteEditor(null);
                    }}
                  >
                    Remove
                  </Button>
                )}
                <Button className="flex-1 h-10 rounded-xl bg-gradient-primary" onClick={() => void saveNoteEditor()}>
                  Save note
                </Button>
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
