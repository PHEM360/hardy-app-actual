import { useState, useMemo, useEffect } from "react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import {
  Wallet, Plus, Eye, EyeOff, Archive, RotateCcw, Table2, LineChart as LineChartIcon,
  Settings2, X, CalendarRange, ArrowUpDown, Upload, Sparkles, StickyNote, Landmark,
  ArrowLeftRight, ChevronDown, ChevronUp, CheckSquare, Square, Trash2,
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
import { useFinance, type Account, type AccountFee, type BalanceEntry, type FeeKind, type FinanceNote, type FinanceTodo, type FinanceTransaction, type FundAllocation, type InterestRatePeriod } from "@/hooks/useFinance";
import { useAppUsers } from "@/hooks/useAppUsers";
import { useSharedScope } from "@/hooks/useSharedScope";
import { useFinanceSettings } from "@/hooks/useFinanceSettings";
import { resolveAccountType } from "@/lib/financeAccounts";
import { AccountTypeFields } from "@/components/finance/AccountTypeFields";
import AccountHoldingsFields from "@/components/finance/AccountHoldingsFields";
import AccountTypesSettings from "@/components/finance/AccountTypesSettings";
import BankSyncSettings from "@/components/finance/BankSyncSettings";
import DisplayStatsSettings from "@/components/finance/DisplayStatsSettings";
import FinanceSummary from "@/components/finance/FinanceSummary";
import { FinanceAssetsPanel } from "@/components/finance/FinanceAssetsPanel";
import FinanceTaxPanel from "@/components/finance/FinanceTaxPanel";
import PensionModellerPanel from "@/components/finance/PensionModellerPanel";
import PlatformComparisonPanel from "@/components/finance/PlatformComparisonPanel";
import FinancialModellerPanel from "@/components/finance/FinancialModellerPanel";
import {
  buildPivotTable, computeChartYDomain, formatGBP,
} from "@/lib/financeCalculations";
import { balanceOnOrBefore } from "@/lib/financeTransfer";
import { totalPropertyValue, type FinanceAsset } from "@/lib/financeAssets";
import { accountFeeTotals, buildFinanceInsights, formatPct, formatSignedGBP, type PeriodDelta } from "@/lib/financeInsights";
import type { FinanceStatId } from "@/lib/financeDisplay";
import ImportBalancesDialog from "@/components/finance/ImportBalancesDialog";
import { FinanceAnalysisPanel } from "@/components/finance/FinanceAnalysisPanel";
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
    const rows = payload.filter((p: any) => {
      if (p.value == null || Number.isNaN(Number(p.value))) return false;
      const key = String(p.dataKey ?? "");
      return !key.endsWith("_note");
    });
    if (rows.length === 0) return null;
    const notes = payload
      .map((p: any) => {
        const note = p.payload?.[`${p.dataKey}_note`];
        if (!note || String(p.dataKey).endsWith("_proj")) return null;
        return { name: p.name, color: p.color ?? p.stroke, note };
      })
      .filter(Boolean) as { name: string; color: string; note: string }[];
    const projected = Boolean(payload[0]?.payload?.isProjection);
    return (
      <div className="min-w-[180px] max-w-[280px] rounded-2xl border-2 border-border bg-card p-3 shadow-elevated">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-foreground">{label}</p>
          {projected && (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
              Estimate
            </span>
          )}
        </div>
        {rows.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2 py-0.5">
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full ring-2 ring-card" style={{ backgroundColor: p.color ?? p.stroke }} />
            <span className="text-xs font-semibold" style={{ color: p.color ?? p.stroke }}>{p.name}</span>
            <span className="ml-auto font-display text-xs font-bold text-card-foreground">{formatGBP(p.value ?? 0)}</span>
          </div>
        ))}
        {notes.map((n) => (
          <p key={n.name} className="mt-2 border-t border-border pt-2 text-[11px] leading-snug text-foreground">
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
  return `h-9 px-3.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors border-2 ${
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

type ViewMode = "overview" | "history" | "spending" | "planning" | "settings";

const VIEW_MODES: { id: ViewMode; label: string; Icon: typeof LineChartIcon }[] = [
  { id: "overview", label: "Overview", Icon: LineChartIcon },
  { id: "history", label: "History", Icon: Table2 },
  { id: "spending", label: "Spending", Icon: ArrowUpDown },
  { id: "planning", label: "Planning", Icon: Sparkles },
  { id: "settings", label: "Settings", Icon: Settings2 },
];

interface FinanceProps {
  /** Dev-only preview hook (see FinancePreview.tsx) — bypasses Firestore/auth entirely. */
  mockData?: { accounts: Account[]; entries: BalanceEntry[]; assets?: FinanceAsset[]; transactions?: FinanceTransaction[]; notes?: FinanceNote[]; todos?: FinanceTodo[] };
}

const Finance = ({ mockData }: FinanceProps = {}) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isDark = useIsDarkMode();
  const palette = isDark ? ACCOUNT_COLORS_DARK : ACCOUNT_COLORS_LIGHT;
  const appUsers = useAppUsers();

  const { scopeUserId, permission: scopePermission, pageTitle, isOwnScope } = useSharedScope("finance");
  const canEdit = mockData ? false : scopePermission === "edit";
  const live = useFinance(scopeUserId ?? undefined);
  const { accountTypes, displayStats, pensionModel, platformComparison, saveAccountTypes, saveDisplayStats, savePensionModel, savePlatformComparison, ensureType } = useFinanceSettings(scopeUserId ?? undefined);
  const accounts = mockData?.accounts ?? live.accounts;
  const entries = mockData?.entries ?? live.entries;
  const assets = mockData?.assets ?? live.assets;
  const transactions = mockData?.transactions ?? live.transactions;
  const notes = mockData?.notes ?? live.notes;
  const todos = mockData?.todos ?? live.todos;
  const {
    loading, addAccount, updateAccount, transferAndCloseAccount, addBalanceEntry, updateEntry, deleteEntry, importEntries,
    addFinanceNote, deleteFinanceNote,
    addFinanceTodo, updateFinanceTodo, deleteFinanceTodo,
    addAsset, updateAsset, deleteAsset,
  } = live;
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  // Keep selectedAccounts in sync when accounts load
  useMemo(() => {
    if (accounts.length > 0 && selectedAccounts.length === 0) {
      setSelectedAccounts(accounts.map((a) => a.id));
    }
  }, [accounts.length]);
  const [timePeriod, setTimePeriod] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
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
  const [notesOpen, setNotesOpen] = useState(true);
  const [newGeneralNote, setNewGeneralNote] = useState("");
  const [newTodoTitle, setNewTodoTitle] = useState("");
  const [newTodoAssignee, setNewTodoAssignee] = useState("unassigned");
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
  const [closeTransferId, setCloseTransferId] = useState<string | null>(null);
  const [transferDestMode, setTransferDestMode] = useState<"existing" | "new">("existing");
  const [transferToId, setTransferToId] = useState("");
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split("T")[0]);
  const [transferNewName, setTransferNewName] = useState("");
  const [transferNewType, setTransferNewType] = useState("Savings");
  const [transferNewCustomType, setTransferNewCustomType] = useState("");
  const [transferNewOpenedOn, setTransferNewOpenedOn] = useState("");
  const [transferBusy, setTransferBusy] = useState(false);

  useEffect(() => {
    const bank = searchParams.get("bank");
    if (!bank) return;
    if (bank === "connected") {
      toast.success("Bank connected. Now attach each bank account below so its balances can come in.");
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

  const chartHeadline = useMemo(() => {
    const historical = combinedChartData.filter((row) => !row.isProjection) as Record<string, unknown>[];
    const startByAccount = new Map<string, number>();
    for (const row of historical) {
      for (const acc of accountsForChart) {
        const value = row[acc.id];
        if (!startByAccount.has(acc.id) && typeof value === "number") startByAccount.set(acc.id, value);
      }
    }
    const startTotal = [...startByAccount.values()].reduce((sum, value) => sum + value, 0);
    const latest = latestBalances
      .filter((acc) => selectedAccounts.includes(acc.id) && acc.active && !acc.hidden)
      .reduce((sum, acc) => sum + acc.latestBalance, 0);
    const change = startByAccount.size > 0 ? latest - startTotal : null;
    const pct = startTotal !== 0 && change != null ? (change / startTotal) * 100 : null;
    const first = historical[0] as { date?: string } | undefined;
    const last = historical[historical.length - 1] as { date?: string } | undefined;
    return { latest, change, pct, from: first?.date, to: last?.date };
  }, [accountsForChart, combinedChartData, latestBalances, selectedAccounts]);

  const totalBalance = latestBalances.filter((a) => a.active && !a.hidden).reduce((s, a) => s + a.latestBalance, 0);
  const propertyTotal = totalPropertyValue(assets);
  const netWorth = totalBalance + propertyTotal;
  const insights = useMemo(
    () => buildFinanceInsights(accounts.filter((a) => a.active && !a.hidden), entries),
    [accounts, entries]
  );
  const portfolio = insights.portfolio;
  const insightById = useMemo(
    () => Object.fromEntries(insights.accounts.map((row) => [row.account.id, row])),
    [insights]
  );

  const spending = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const allowedAccounts = new Set(visibleAccounts.map((account) => account.id));
    const recent = transactions.filter((tx) => allowedAccounts.has(tx.accountId) && new Date(tx.date) >= cutoff);
    const expenses = recent.filter((tx) => tx.amount < 0);
    const income = recent.filter((tx) => tx.amount > 0);
    const spendTotal = expenses.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const incomeTotal = income.reduce((sum, tx) => sum + tx.amount, 0);
    const byCategory = Object.values(expenses.reduce<Record<string, { category: string; amount: number; count: number }>>((acc, tx) => {
      const category = tx.category || "Spending";
      acc[category] = acc[category] ?? { category, amount: 0, count: 0 };
      acc[category].amount += Math.abs(tx.amount);
      acc[category].count += 1;
      return acc;
    }, {})).sort((a, b) => b.amount - a.amount);
    const largest = [...expenses].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 8);
    return { recent, expenses, spendTotal, incomeTotal, byCategory, largest };
  }, [transactions, visibleAccounts]);

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

  const saveGeneralNote = async () => {
    const text = newGeneralNote.trim();
    if (!text) return;
    await addFinanceNote(text);
    setNewGeneralNote("");
    setNotesOpen(true);
  };

  const saveFinanceTodo = async () => {
    const title = newTodoTitle.trim();
    if (!title) return;
    const assignee = appUsers.find((user) => user.id === newTodoAssignee);
    await addFinanceTodo({
      title,
      assigneeUid: assignee?.id,
      assigneeName: assignee?.name,
    });
    setNewTodoTitle("");
    setNewTodoAssignee("unassigned");
    setNotesOpen(true);
  };

  const toggleHide = (id: string) => {
    const acc = accounts.find((a) => a.id === id);
    if (acc) updateAccount(id, { hidden: !acc.hidden });
  };
  const beginCloseAccount = (id: string) => {
    const acc = accounts.find((account) => account.id === id);
    if (!acc) return;
    if (!acc.active) {
      if (mockData) return;
      updateAccount(id, { active: true, closedOn: deleteField() } as Partial<Account>);
      return;
    }
    const latest = latestBalances.find((account) => account.id === id)?.latestBalance ?? 0;
    if (latest === 0) {
      if (mockData) {
        toast.info("Preview only. Transfer is not saved.");
        setManageAccountId(null);
        return;
      }
      updateAccount(id, { active: false, closedOn: new Date().toISOString().split("T")[0] });
      setManageAccountId(null);
      toast.success("Account closed");
      return;
    }
    const firstOther = accounts.find((account) => account.id !== id && account.active);
    setManageAccountId(null);
    setTransferDestMode(firstOther ? "existing" : "new");
    setTransferToId(firstOther?.id ?? "");
    setTransferDate(new Date().toISOString().split("T")[0]);
    setTransferNewName("");
    setTransferNewType(accountTypes.includes(acc.type) || acc.type === "Other" ? acc.type : "Other");
    setTransferNewCustomType(accountTypes.includes(acc.type) || acc.type === "Other" ? "" : acc.type);
    setTransferNewOpenedOn(new Date().toISOString().split("T")[0]);
    setCloseTransferId(id);
  };

  const handleCloseAndTransfer = async () => {
    if (!closeTransferId) return;
    if (transferDestMode === "existing" && !transferToId) {
      toast.error("Choose the account that should receive the money.");
      return;
    }
    if (transferDestMode === "new" && !transferNewName.trim()) {
      toast.error("Name the new account first.");
      return;
    }
    if (mockData) {
      toast.info("Preview only. Transfer is not saved.");
      setCloseTransferId(null);
      return;
    }
    setTransferBusy(true);
    try {
      const type = resolveAccountType(transferNewType, transferNewCustomType);
      const result = await transferAndCloseAccount({
        fromId: closeTransferId,
        toId: transferDestMode === "existing" ? transferToId : undefined,
        newAccount: transferDestMode === "new"
          ? { name: transferNewName, type, openedOn: transferNewOpenedOn }
          : undefined,
        date: transferDate,
      });
      if (transferDestMode === "new") await ensureType(type);
      if (result?.toId) {
        setSelectedAccounts((prev) => (prev.includes(result.toId) ? prev : [...prev, result.toId]));
      }
      toast.success("Account closed and funds transferred");
      setCloseTransferId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not transfer the account.");
    } finally {
      setTransferBusy(false);
    }
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
  const closingAccount = closeTransferId ? latestBalances.find((account) => account.id === closeTransferId) : null;
  const closingTransferAmount = closeTransferId ? balanceOnOrBefore(closeTransferId, entries, transferDate) : 0;
  const transferDestinations = accounts.filter((account) => account.id !== closeTransferId && account.active);
  const transferReady = transferDestMode === "existing" ? Boolean(transferToId) : Boolean(transferNewName.trim());

  if (loading && !mockData) {
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
        <p className="text-xs text-white/70 uppercase tracking-wider font-medium">Net worth</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <p className="text-2xl font-bold font-display text-white">
            {formatGBP(netWorth)}
          </p>
          {propertyTotal > 0 && (
            <p className="text-xs text-white/80">
              of which {formatGBP(propertyTotal)} is property
            </p>
          )}
        </div>
        <p className="text-xs text-white/70 mt-1">
          {latestBalances.filter((a) => a.active && !a.hidden).length} accounts
          {assets.length > 0 ? ` · ${assets.length} propert${assets.length === 1 ? "y" : "ies"}` : ""}
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
                    {!acc.active && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md text-white" style={{ backgroundColor: "#7A2E2A" }}>
                        Closed
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
                  {acc.closedOn && (
                    <p className="text-[10px] text-muted-foreground">
                      Closed {new Date(acc.closedOn).toLocaleDateString("en-GB")}
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

      <FinanceAssetsPanel
        assets={assets}
        canEdit={canEdit}
        onAdd={addAsset}
        onUpdate={updateAsset}
        onDelete={deleteAsset}
      />

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-5 overflow-hidden rounded-3xl border-2 border-border bg-card shadow-card">
        <button
          type="button"
          onClick={() => setNotesOpen((open) => !open)}
          className="band flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-white"
          style={{ background: "#1F4D3A" }}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/75">Notes and jobs</p>
            <h3 className="font-display text-lg font-bold">Finance notebook</h3>
          </div>
          {notesOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {notesOpen && (
          <div className="grid gap-4 p-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">General notes</p>
                <p className="text-xs text-foreground/60">{notes.length} saved</p>
              </div>
              {canEdit && (
                <div className="space-y-2 rounded-xl border border-foreground/20 bg-background p-3">
                  <Textarea
                    value={newGeneralNote}
                    onChange={(event) => setNewGeneralNote(event.target.value)}
                    placeholder="Add a general finance note"
                    className="min-h-[86px] rounded-lg"
                  />
                  <Button onClick={() => void saveGeneralNote()} disabled={!newGeneralNote.trim()}>
                    <StickyNote />
                    Save note
                  </Button>
                </div>
              )}
              <div className="space-y-2">
                {notes.length === 0 ? (
                  <p className="rounded-xl border border-foreground/20 bg-background p-3 text-sm text-foreground/75">No finance notes yet.</p>
                ) : notes.map((note) => (
                  <div key={note.id} className="rounded-xl border border-foreground/20 bg-background p-3 shadow-card">
                    <p className="whitespace-pre-wrap text-sm text-foreground">{note.text}</p>
                    {canEdit && (
                      <div className="mt-2 flex justify-end">
                        <Button variant="ghost" size="sm" onClick={() => void deleteFinanceNote(note.id)}>
                          <Trash2 />
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">Finance to do</p>
                <p className="text-xs text-foreground/60">{todos.filter((todo) => !todo.done).length} open</p>
              </div>
              {canEdit && (
                <div className="space-y-2 rounded-xl border border-foreground/20 bg-background p-3">
                  <Input
                    value={newTodoTitle}
                    onChange={(event) => setNewTodoTitle(event.target.value)}
                    placeholder="e.g. Chase Santander transfer"
                    className="h-11 rounded-lg"
                  />
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Select value={newTodoAssignee} onValueChange={setNewTodoAssignee}>
                      <SelectTrigger className="h-11 rounded-lg">
                        <SelectValue placeholder="Assign to" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {appUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={() => void saveFinanceTodo()} disabled={!newTodoTitle.trim()} className="h-11">
                      <Plus />
                      Add task
                    </Button>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                {todos.length === 0 ? (
                  <p className="rounded-xl border border-foreground/20 bg-background p-3 text-sm text-foreground/75">No finance tasks yet.</p>
                ) : todos.map((todo) => (
                  <div key={todo.id} className="flex items-start gap-2 rounded-xl border border-foreground/20 bg-background p-3 shadow-card">
                    {canEdit ? (
                      <button type="button" onClick={() => void updateFinanceTodo(todo.id, { done: !todo.done })} className="mt-0.5 text-primary">
                        {todo.done ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      </button>
                    ) : (
                      <span className="mt-0.5 text-primary">{todo.done ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-bold ${todo.done ? "text-foreground/55 line-through" : "text-foreground"}`}>{todo.title}</p>
                      <p className="text-[11px] text-foreground/60">{todo.assigneeName || "Unassigned"}</p>
                    </div>
                    {canEdit && (
                      <Button variant="ghost" size="sm" onClick={() => void deleteFinanceTodo(todo.id)}>
                        <Trash2 />
                        Delete
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Controls Row */}
      <div
        className="mb-5 flex flex-wrap items-center gap-2 rounded-3xl border-2 border-primary/25 p-2.5 shadow-card"
        style={{ background: "color-mix(in srgb, hsl(var(--primary)) 14%, hsl(var(--card)))" }}
      >
        <div className="relative flex flex-wrap items-center gap-1 rounded-2xl border-2 border-border bg-card p-1 shadow-soft">
          {VIEW_MODES.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setViewMode(id)}
              className={`relative z-10 flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
                viewMode === id ? "text-primary-foreground" : "text-foreground hover:text-foreground"
              }`}
            >
              {viewMode === id && (
                <motion.span
                  layoutId="finance-view-tab"
                  className="absolute inset-0 -z-10 rounded-xl bg-gradient-primary shadow-sm"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        {viewMode === "overview" && (
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
      {viewMode === "overview" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-5 overflow-hidden rounded-3xl border-2 border-border bg-card shadow-card">
          <div
            className="flex flex-wrap items-end justify-between gap-3 border-b border-border/60 px-4 py-4 sm:px-5"
            style={{ background: "color-mix(in srgb, hsl(var(--primary)) 10%, hsl(var(--card)))" }}
          >
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground">
                <span className="inline-block h-4 w-1 rounded-full bg-gradient-primary" />
                Balance over time
              </h3>
              <p className="mt-1 font-display text-2xl font-bold leading-tight text-foreground">{formatGBP(chartHeadline.latest)}</p>
              <p className="mt-0.5 text-[11px] text-foreground/70">
                {chartHeadline.from && chartHeadline.to ? `${chartHeadline.from} – ${chartHeadline.to}` : "Selected accounts"}
                {chartHeadline.change != null && (
                  <span className={`ml-2 font-semibold ${chartHeadline.change >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
                    {formatSignedGBP(chartHeadline.change)}
                    {formatPct(chartHeadline.pct) ? ` · ${formatPct(chartHeadline.pct)}` : ""}
                  </span>
                )}
              </p>
            </div>
            {showTaxYears && (
              <span className="flex items-center gap-1.5 text-[10px] font-medium text-foreground/70">
                <CalendarRange className="w-3 h-3" /> Tax years shaded
              </span>
            )}
          </div>
          <div className="p-4 sm:p-5">

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
          <div className="h-80 rounded-2xl border border-border/50 px-1 pt-3 sm:h-[26rem]" style={{ background: "color-mix(in srgb, hsl(var(--card)) 88%, hsl(var(--background)))" }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={combinedChartData} margin={{ top: 8, right: 10, left: 0, bottom: 4 }}>
                <defs>
                  {accountsForChart.map((acc) => {
                    const color = colorFor(acc);
                    return (
                      <linearGradient key={acc.id} id={`fin-grad-${acc.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.38} />
                        <stop offset="62%" stopColor={color} stopOpacity={0.08} />
                        <stop offset="100%" stopColor={color} stopOpacity={0} />
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
                      strokeWidth={2.5}
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
                    strokeWidth={2.25}
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
                    className="flex items-center gap-1.5 text-[11px] font-semibold rounded-md px-2.5 py-1 border transition-opacity"
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
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground bg-muted rounded-md px-2.5 py-1 border border-border">
                  <span className="w-3.5 h-0.5 rounded-full flex-shrink-0" style={{ background: isDark ? "#ffffff" : "#0b0b0b" }} />
                  Total
                </span>
              )}
              {showProjection && (
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-foreground bg-muted rounded-md px-2.5 py-1 border border-border">
                  <svg width="14" height="2" className="flex-shrink-0"><line x1="0" y1="1" x2="14" y2="1" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" /></svg>
                  Projected ({SCENARIO_LABELS[scenario]})
                </span>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {viewMode === "overview" && (
        <div className="space-y-5">
          <FinanceSummary
            accounts={visibleAccounts}
            entries={entries}
            taxYears={TAX_YEARS}
            colorFor={colorFor}
            show={showStat}
          />
          <FinanceAnalysisPanel accounts={visibleAccounts} />
        </div>
      )}

      {/* Table View — spreadsheet-style pivot: dates down, accounts across */}
      {viewMode === "history" && (
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

      {viewMode === "spending" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-5 overflow-hidden rounded-3xl border-2 border-border bg-card shadow-card">
          <div className="band flex flex-wrap items-end justify-between gap-3 px-4 py-4 text-white" style={{ background: "#17475C" }}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/75">Bank transaction view</p>
              <h3 className="font-display text-2xl font-bold">Spending breakdown</h3>
              <p className="mt-1 text-xs text-white/80">Last 90 days from imported TrueLayer transactions.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-white/35 bg-white/15 px-3 py-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/70">Spent</p>
                <p className="font-display text-xl font-bold">{formatGBP(spending.spendTotal)}</p>
              </div>
              <div className="rounded-xl border border-white/35 bg-white/15 px-3 py-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/70">Income</p>
                <p className="font-display text-xl font-bold">{formatGBP(spending.incomeTotal)}</p>
              </div>
            </div>
          </div>
          {spending.recent.length === 0 ? (
            <div className="p-5">
              <div className="rounded-xl border border-foreground/20 bg-background p-4 shadow-card">
                <p className="font-display text-lg font-bold text-foreground">No transaction data yet</p>
                <p className="mt-1 text-sm text-foreground/80">
                  Balance tracking, returns, transfers and graph notes still work. To see spending categories, connect a bank in Settings and import history.
                </p>
                {canEdit && (
                  <Button className="mt-4" onClick={() => setViewMode("settings")}>
                    <Landmark />
                    Open bank settings
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
              <div className="rounded-xl border border-foreground/20 bg-background p-3 shadow-card">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">By category</p>
                  <p className="text-xs text-foreground/70">{spending.expenses.length} payments</p>
                </div>
                <div className="space-y-2">
                  {spending.byCategory.map((row, index) => {
                    const pct = spending.spendTotal > 0 ? (row.amount / spending.spendTotal) * 100 : 0;
                    const color = ACCOUNT_COLORS_LIGHT[index % ACCOUNT_COLORS_LIGHT.length];
                    return (
                      <div key={row.category} className="rounded-lg border border-foreground/15 bg-card p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-foreground">{row.category}</p>
                            <p className="text-[10px] uppercase tracking-[0.12em] text-foreground/60">
                              {row.count} {row.count === 1 ? "transaction" : "transactions"}
                            </p>
                          </div>
                          <p className="font-display text-lg font-bold text-foreground">{formatGBP(row.amount)}</p>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-foreground/10">
                          <div className="h-full rounded-full" style={{ width: `${Math.max(3, pct)}%`, background: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-xl border border-foreground/20 bg-background p-3 shadow-card">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">Largest payments</p>
                <div className="space-y-2">
                  {spending.largest.map((tx) => {
                    const account = accounts.find((item) => item.id === tx.accountId);
                    return (
                      <div key={tx.id} className="rounded-lg border border-foreground/15 bg-card p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-foreground">{tx.merchantName || tx.description}</p>
                            <p className="text-[11px] text-foreground/65">
                              {new Date(tx.date).toLocaleDateString("en-GB")} · {account?.name || "Account"}
                            </p>
                          </div>
                          <p className="font-display text-base font-bold text-rose-700 dark:text-rose-400">{formatGBP(Math.abs(tx.amount))}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {viewMode === "planning" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-5 space-y-5">
          <FinancialModellerPanel accounts={visibleAccounts} entries={entries} scopeUserId={scopeUserId ?? undefined} canEdit={canEdit} />
          <FinanceTaxPanel />
          <PensionModellerPanel
            accounts={accounts}
            entries={entries}
            model={pensionModel}
            canEdit={canEdit}
            onSave={savePensionModel}
          />
          <PlatformComparisonPanel doc={platformComparison} canEdit={canEdit} onSave={savePlatformComparison} />
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
              {(canEdit || mockData) && (
                <div className="flex gap-2">
                  <Button onClick={() => { beginCloseAccount(manageAccountId!); }} variant="outline" size="sm" className="flex-1 h-9 rounded-lg gap-1.5 text-xs">
                    {managingAccount.active ? <Archive className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    {managingAccount.active ? "Close and transfer" : "Reopen Account"}
                  </Button>
                  {canEdit && (
                    <Button onClick={() => { toggleHide(manageAccountId!); }} variant="outline" size="sm" className="flex-1 h-9 rounded-lg gap-1.5 text-xs">
                      {managingAccount.hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      {managingAccount.hidden ? "Show" : "Hide"}
                    </Button>
                  )}
                </div>
              )}
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

      <Dialog open={!!closeTransferId} onOpenChange={(open) => !open && !transferBusy && setCloseTransferId(null)}>
        <DialogContent aria-describedby={undefined} className="max-w-md mx-4 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4" />
              Close and transfer
            </DialogTitle>
          </DialogHeader>
          {closingAccount && (
            <div className="space-y-4 pt-1">
              <div className="rounded-xl overflow-hidden border border-foreground/20 shadow-card">
                <div className="band px-3 py-2 text-white" style={{ background: "#7A2E2A" }}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em]">Moving from {closingAccount.name}</p>
                </div>
                <div className="p-3" style={{ background: "#7A2E2A" }}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/80">Amount on transfer date</p>
                  <p className="font-display text-3xl text-white">{formatGBP(closingTransferAmount)}</p>
                  <p className="mt-1 text-xs text-white/85">
                    The old account will show £0.00 after this and stay on the graph with a transfer note.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.12em]">Send the money to</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" className={pillClass(transferDestMode === "existing")} onClick={() => setTransferDestMode("existing")}>
                    Existing account
                  </button>
                  <button type="button" className={pillClass(transferDestMode === "new")} onClick={() => setTransferDestMode("new")}>
                    New account
                  </button>
                </div>
              </div>

              {transferDestMode === "existing" ? (
                <div className="space-y-2">
                  <Label className="text-xs">Destination</Label>
                  {transferDestinations.length === 0 ? (
                    <p className="text-sm text-foreground">There is no other open account yet. Add a new one.</p>
                  ) : (
                    <Select value={transferToId} onValueChange={setTransferToId}>
                      <SelectTrigger className="h-11 rounded-lg">
                        <SelectValue placeholder="Choose an account" />
                      </SelectTrigger>
                      <SelectContent>
                        {transferDestinations.map((account) => (
                          <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Account name</Label>
                    <Input
                      placeholder="e.g. Vanguard ISA"
                      value={transferNewName}
                      onChange={(e) => setTransferNewName(e.target.value)}
                      className="h-11 rounded-lg"
                    />
                  </div>
                  <AccountTypeFields
                    types={accountTypes}
                    value={transferNewType}
                    onChange={setTransferNewType}
                    customValue={transferNewCustomType}
                    onCustomChange={setTransferNewCustomType}
                  />
                  <div className="space-y-2">
                    <Label>Date opened</Label>
                    <Input type="date" value={transferNewOpenedOn} onChange={(e) => setTransferNewOpenedOn(e.target.value)} className="h-11 rounded-lg" />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Transfer date</Label>
                <Input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} className="h-11 rounded-lg" />
              </div>

              <Button
                className="w-full"
                disabled={transferBusy || !transferReady}
                onClick={() => void handleCloseAndTransfer()}
              >
                <ArrowLeftRight />
                {transferBusy ? "Transferring…" : "Close and transfer"}
              </Button>
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
