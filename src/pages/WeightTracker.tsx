import { useState, useMemo } from "react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import {
  HeartPulse, Plus, TrendingDown, TrendingUp, Ruler, Syringe,
  Table2, LineChart as LineChartIcon, Activity,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format, subMonths, subYears, parseISO, differenceInDays } from "date-fns";
import { useWeightTracker } from "@/hooks/useWeightTracker";
import { type BPEntry } from "@/hooks/useWeightTracker";
import { useSharedScope } from "@/hooks/useSharedScope";
import ShareAccessButton from "@/components/sharing/ShareAccessButton";
import SharedScopeSwitcher from "@/components/sharing/SharedScopeSwitcher";
import DogLoader from "@/components/DogLoader";

// ── Period filter ──────────────────────────────────────────────────────────────
type Period = "1m" | "3m" | "6m" | "1y" | "all";
const PERIODS: { label: string; value: Period }[] = [
  { label: "1M",  value: "1m"  },
  { label: "3M",  value: "3m"  },
  { label: "6M",  value: "6m"  },
  { label: "1Y",  value: "1y"  },
  { label: "All", value: "all" },
];

function periodCutoff(p: Period): Date | null {
  const now = new Date();
  if (p === "1m")  return subMonths(now, 1);
  if (p === "3m")  return subMonths(now, 3);
  if (p === "6m")  return subMonths(now, 6);
  if (p === "1y")  return subYears(now, 1);
  return null;
}

function smartDateFmt(dateStr: string, spanDays: number): string {
  const d = parseISO(dateStr);
  return spanDays > 400 ? format(d, "MMM yy") : format(d, "d MMM");
}

// ── Custom tooltips ────────────────────────────────────────────────────────────
const WeightTooltip = ({ active, payload }: any) => {
  if (active && payload?.length) {
    return (
      <div className="rounded-lg bg-card border border-border shadow-elevated p-2.5 text-xs">
        <p className="text-muted-foreground">{payload[0]?.payload?.rawDate}</p>
        <p className="font-bold text-card-foreground">{payload[0]?.value} kg</p>
      </div>
    );
  }
  return null;
};

const BPTooltip = ({ active, payload }: any) => {
  if (active && payload?.length) {
    const d = payload[0]?.payload;
    return (
      <div className="rounded-lg bg-card border border-border shadow-elevated p-2.5 text-xs space-y-0.5">
        <p className="text-muted-foreground">{d?.rawDate}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} className="font-semibold" style={{ color: p.color }}>
            {p.name}: {p.value}{p.dataKey === "heartRate" ? " bpm" : " mmHg"}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

function bpCategory(sys: number, dia: number): { label: string; colour: string } {
  if (sys < 90 || dia < 60)      return { label: "Low",      colour: "text-blue-500"   };
  if (sys <= 120 && dia <= 80)   return { label: "Normal",   colour: "text-green-600"  };
  if (sys <= 129 && dia <= 80)   return { label: "Elevated", colour: "text-yellow-600" };
  if (sys <= 139 || dia <= 89)   return { label: "Stage 1",  colour: "text-orange-500" };
  return                                { label: "Stage 2",  colour: "text-red-600"    };
}

function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="flex gap-0.5 p-1 bg-muted/60 backdrop-blur-sm rounded-full border border-border/30">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all duration-200 ${
            value === p.value
              ? "bg-card shadow-sm text-foreground ring-1 ring-border/40"
              : "text-muted-foreground hover:text-foreground hover:bg-card/50"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

function ViewToggle({ view, onChange }: { view: "chart" | "table"; onChange: (v: "chart" | "table") => void }) {
  return (
    <div className="flex gap-0.5 p-1 bg-muted/60 backdrop-blur-sm rounded-full border border-border/30">
      {(["chart", "table"] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-all duration-200 ${
            view === v
              ? "bg-card shadow-sm text-foreground ring-1 ring-border/40"
              : "text-muted-foreground hover:text-foreground hover:bg-card/50"
          }`}
        >
          {v === "chart" ? <LineChartIcon className="w-3 h-3" /> : <Table2 className="w-3 h-3" />}
          {v === "chart" ? "Chart" : "Table"}
        </button>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
const HealthTracker = () => {
  const { scopeUserId, permission, pageTitle } = useSharedScope("health");
  const canEdit = permission === "edit";
  const {
    entries, heightEntries, botoxRecords, bpEntries, loading,
    addEntry, addHeightEntry, addBotoxRecord, addBPEntry,
  } = useWeightTracker(scopeUserId ?? undefined);

  const [weightOpen, setWeightOpen]         = useState(false);
  const [newWeight, setNewWeight]           = useState("");
  const [newWeightDate, setNewWeightDate]   = useState(new Date().toISOString().split("T")[0]);
  const [weightPeriod, setWeightPeriod]     = useState<Period>("3m");
  const [weightView, setWeightView]         = useState<"chart" | "table">("chart");

  const [heightOpen, setHeightOpen]   = useState(false);
  const [newHeight, setNewHeight]     = useState("");

  const [botoxOpen, setBotoxOpen]         = useState(false);
  const [botoxDate, setBotoxDate]         = useState(new Date().toISOString().split("T")[0]);
  const [botoxRight, setBotoxRight]       = useState("");
  const [botoxLeft, setBotoxLeft]         = useState("");
  const [botoxNotes, setBotoxNotes]       = useState("");
  const [botoxLoading, setBotoxLoading]   = useState(false);
  const [botoxError, setBotoxError]       = useState<string | null>(null);

  const [bpOpen, setBpOpen]           = useState(false);
  const [bpDate, setBpDate]           = useState(new Date().toISOString().split("T")[0]);
  const [bpSys, setBpSys]             = useState("");
  const [bpDia, setBpDia]             = useState("");
  const [bpHR, setBpHR]               = useState("");
  const [bpNotes, setBpNotes]         = useState("");
  const [bpLoading, setBpLoading]     = useState(false);
  const [bpError, setBpError]         = useState<string | null>(null);
  const [bpPeriod, setBpPeriod]       = useState<Period>("3m");
  const [bpView, setBpView]           = useState<"chart" | "table">("chart");

  // ── Filtered weight ────────────────────────────────────────────────────────
  const filteredWeight = useMemo(() => {
    const cutoff = periodCutoff(weightPeriod);
    return cutoff ? entries.filter((e) => parseISO(e.date) >= cutoff) : entries;
  }, [entries, weightPeriod]);

  const weightSpanDays = useMemo(() => {
    if (filteredWeight.length < 2) return 30;
    return differenceInDays(
      parseISO(filteredWeight[filteredWeight.length - 1].date),
      parseISO(filteredWeight[0].date),
    );
  }, [filteredWeight]);

  const weightChartData = useMemo(() =>
    filteredWeight.map((d) => ({
      date: smartDateFmt(d.date, weightSpanDays),
      rawDate: format(parseISO(d.date), "d MMM yyyy"),
      weight: d.weight,
    })),
    [filteredWeight, weightSpanDays],
  );

  // ── Weight stats ───────────────────────────────────────────────────────────
  const latestWeight    = entries[entries.length - 1];
  const previousWeight  = entries[entries.length - 2];
  const firstWeight     = entries[0];
  const latestHeight    = heightEntries[heightEntries.length - 1];
  const weightDiff      = latestWeight && previousWeight ? latestWeight.weight - previousWeight.weight : 0;
  const totalChange     = latestWeight && firstWeight ? latestWeight.weight - firstWeight.weight : null;
  const lowestInPeriod  = filteredWeight.length ? Math.min(...filteredWeight.map((e) => e.weight)) : null;
  const highestInPeriod = filteredWeight.length ? Math.max(...filteredWeight.map((e) => e.weight)) : null;
  const bmi = latestWeight && latestHeight
    ? (latestWeight.weight / Math.pow(latestHeight.height / 100, 2)).toFixed(1)
    : null;

  // ── Filtered BP ────────────────────────────────────────────────────────────
  const filteredBP = useMemo(() => {
    const cutoff = periodCutoff(bpPeriod);
    return cutoff ? bpEntries.filter((e) => parseISO(e.date) >= cutoff) : bpEntries;
  }, [bpEntries, bpPeriod]);

  const bpSpanDays = useMemo(() => {
    if (filteredBP.length < 2) return 30;
    return differenceInDays(
      parseISO(filteredBP[filteredBP.length - 1].date),
      parseISO(filteredBP[0].date),
    );
  }, [filteredBP]);

  const bpChartData = useMemo(() =>
    filteredBP.map((d) => ({
      date: smartDateFmt(d.date, bpSpanDays),
      rawDate: format(parseISO(d.date), "d MMM yyyy"),
      systolic: d.systolic,
      diastolic: d.diastolic,
      heartRate: d.heartRate ?? null,
    })),
    [filteredBP, bpSpanDays],
  );

  const latestBP = bpEntries[bpEntries.length - 1];

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAddWeight = async () => {
    const w = parseFloat(newWeight);
    if (isNaN(w)) return;
    await addEntry(w, newWeightDate);
    setNewWeight("");
    setNewWeightDate(new Date().toISOString().split("T")[0]);
    setWeightOpen(false);
  };

  const handleAddHeight = async () => {
    const h = parseFloat(newHeight);
    if (isNaN(h)) return;
    await addHeightEntry(h);
    setNewHeight("");
    setHeightOpen(false);
  };

  const handleAddBotox = async () => {
    const right = parseFloat(botoxRight);
    const left  = parseFloat(botoxLeft);
    if (!botoxDate || isNaN(right) || isNaN(left)) { setBotoxError("Please fill in all required fields."); return; }
    setBotoxError(null); setBotoxLoading(true);
    try {
      await addBotoxRecord({ date: botoxDate, unitsRight: right, unitsLeft: left, notes: botoxNotes.trim() });
      setBotoxDate(new Date().toISOString().split("T")[0]);
      setBotoxRight(""); setBotoxLeft(""); setBotoxNotes("");
      setBotoxOpen(false);
    } catch (e: any) { setBotoxError(e?.message ?? "Failed to save.");
    } finally { setBotoxLoading(false); }
  };

  const handleAddBP = async () => {
    const sys = parseInt(bpSys, 10);
    const dia = parseInt(bpDia, 10);
    if (!bpDate || isNaN(sys) || isNaN(dia)) { setBpError("Please fill in date, systolic and diastolic."); return; }
    setBpError(null); setBpLoading(true);
    try {
      const entry: Omit<BPEntry, "id"> = {
        date: bpDate, systolic: sys, diastolic: dia,
        ...(bpHR ? { heartRate: parseInt(bpHR, 10) } : {}),
        ...(bpNotes.trim() ? { notes: bpNotes.trim() } : {}),
      };
      await addBPEntry(entry);
      setBpDate(new Date().toISOString().split("T")[0]);
      setBpSys(""); setBpDia(""); setBpHR(""); setBpNotes("");
      setBpOpen(false);
    } catch (e: any) { setBpError(e?.message ?? "Failed to save.");
    } finally { setBpLoading(false); }
  };

  if (loading) {
    return (
      <FeaturePageShell title={pageTitle} subtitle="Weight, BP & treatments" icon={<HeartPulse className="w-5 h-5" />}>
        <div className="flex items-center justify-center py-20"><DogLoader text="Loading…" /></div>
      </FeaturePageShell>
    );
  }

  return (
    <FeaturePageShell
      title={pageTitle}
      subtitle="Weight, BP & treatments"
      icon={<HeartPulse className="w-5 h-5" />}
      action={
        <div className="flex items-center gap-1.5">
          <SharedScopeSwitcher page="health" />
          <ShareAccessButton page="health" />
        </div>
      }
    >

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 gap-3 mb-5">

        {/* Weight card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-gradient-primary col-span-2 sm:col-span-1"
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-primary-foreground/70 uppercase tracking-wider font-medium">Current Weight</p>
            <button onClick={() => canEdit && setWeightOpen(true)} className="flex items-center gap-0.5 text-[10px] text-primary-foreground/70 hover:text-primary-foreground font-medium">
              <Plus className="w-3 h-3" /> Log
            </button>
          </div>
          <p className="text-3xl font-bold font-display text-primary-foreground">
            {latestWeight ? `${latestWeight.weight} kg` : "—"}
          </p>
          {latestWeight && (
            <div className="flex items-center gap-1 mt-1">
              {weightDiff <= 0
                ? <TrendingDown className="w-3.5 h-3.5 text-primary-foreground/70" />
                : <TrendingUp   className="w-3.5 h-3.5 text-primary-foreground/70" />}
              <span className="text-xs text-primary-foreground/70">
                {weightDiff > 0 ? "+" : ""}{weightDiff.toFixed(1)} kg from last
              </span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-3 pt-3 border-t border-primary-foreground/20">
            {totalChange !== null && (
              <div>
                <p className="text-[9px] text-primary-foreground/60 uppercase tracking-wider">Since Start</p>
                <p className="text-sm font-bold font-display text-primary-foreground">
                  {totalChange > 0 ? "+" : ""}{totalChange.toFixed(1)} kg
                </p>
              </div>
            )}
            {bmi && (
              <div>
                <p className="text-[9px] text-primary-foreground/60 uppercase tracking-wider">BMI</p>
                <p className="text-sm font-bold font-display text-primary-foreground">{bmi}</p>
              </div>
            )}
            {lowestInPeriod !== null && (
              <div>
                <p className="text-[9px] text-primary-foreground/60 uppercase tracking-wider">Lowest (period)</p>
                <p className="text-sm font-bold font-display text-primary-foreground">{lowestInPeriod} kg</p>
              </div>
            )}
            {highestInPeriod !== null && (
              <div>
                <p className="text-[9px] text-primary-foreground/60 uppercase tracking-wider">Highest (period)</p>
                <p className="text-sm font-bold font-display text-primary-foreground">{highestInPeriod} kg</p>
              </div>
            )}
            {firstWeight && latestWeight && firstWeight.id !== latestWeight.id && (
              <div className="col-span-2">
                <p className="text-[9px] text-primary-foreground/60 uppercase tracking-wider">First recorded</p>
                <p className="text-xs text-primary-foreground/80">
                  {firstWeight.weight} kg · {format(parseISO(firstWeight.date), "d MMM yyyy")}
                </p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Height + BP quick-stat */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="p-4 rounded-2xl bg-card border border-border/50 shadow-soft col-span-2 sm:col-span-1"
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <Ruler className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Height</p>
            </div>
            <button onClick={() => canEdit && setHeightOpen(true)} className="text-[10px] text-primary font-medium flex items-center gap-0.5">
              <Plus className="w-3 h-3" /> Update
            </button>
          </div>
          <p className="text-3xl font-bold font-display text-card-foreground mt-1">
            {latestHeight ? `${latestHeight.height} cm` : "—"}
          </p>
          {latestHeight && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Logged {format(parseISO(latestHeight.date), "d MMM yyyy")}
            </p>
          )}
          {latestBP && (
            <div className="mt-3 pt-3 border-t border-border/40">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Activity className="w-3 h-3 text-muted-foreground" />
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">Latest BP</p>
              </div>
              <p className="text-lg font-bold font-display text-card-foreground">
                {latestBP.systolic}/{latestBP.diastolic}
                <span className="text-xs font-normal text-muted-foreground ml-1">mmHg</span>
              </p>
              {latestBP.heartRate && (
                <p className="text-[10px] text-muted-foreground">{latestBP.heartRate} bpm</p>
              )}
              <p className={`text-[10px] font-semibold mt-0.5 ${bpCategory(latestBP.systolic, latestBP.diastolic).colour}`}>
                {bpCategory(latestBP.systolic, latestBP.diastolic).label}
              </p>
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Weight section ── */}
      <div className="p-4 rounded-2xl bg-card border border-border/50 shadow-soft mb-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Weight</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <PeriodPicker value={weightPeriod} onChange={setWeightPeriod} />
            <ViewToggle view={weightView} onChange={setWeightView} />
          </div>
        </div>

        {filteredWeight.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No entries in this period.</p>
        ) : weightView === "chart" ? (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(40,15%,88%)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "hsl(220,10%,46%)" }}
                  axisLine={false} tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={48}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(220,10%,46%)" }}
                  axisLine={false} tickLine={false}
                  domain={["auto", "auto"]}
                  width={40}
                  tickFormatter={(v) => `${v}kg`}
                />
                <Tooltip content={<WeightTooltip />} />
                <Line
                  type="monotone" dataKey="weight"
                  stroke="hsl(168,55%,38%)" strokeWidth={2.5}
                  dot={{ fill: "hsl(168,55%,38%)", r: 3 }} activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="rounded-xl border border-border/40 overflow-auto text-xs">
            <table className="w-full">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Date</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium">Weight</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {[...filteredWeight].reverse().map((e, i, arr) => {
                  const prev = arr[i + 1];
                  const diff = prev ? e.weight - prev.weight : null;
                  return (
                    <tr key={e.id} className="hover:bg-muted/20">
                      <td className="px-3 py-2 text-muted-foreground">{format(parseISO(e.date), "d MMM yyyy")}</td>
                      <td className="px-3 py-2 text-right font-bold font-display">{e.weight} kg</td>
                      <td className={`px-3 py-2 text-right font-semibold ${diff === null ? "" : diff < 0 ? "text-green-600" : diff > 0 ? "text-red-500" : "text-muted-foreground"}`}>
                        {diff === null ? "—" : `${diff > 0 ? "+" : ""}${diff.toFixed(1)} kg`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Blood Pressure & Heart Rate ── */}
      <div className="p-4 rounded-2xl bg-card border border-border/50 shadow-soft mb-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-muted-foreground" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Blood Pressure &amp; Heart Rate</h3>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <PeriodPicker value={bpPeriod} onChange={setBpPeriod} />
            <ViewToggle view={bpView} onChange={setBpView} />
            <button onClick={() => { if (canEdit) { setBpError(null); setBpOpen(true); } }} className="flex items-center gap-1 text-xs text-primary font-medium">
              <Plus className="w-3.5 h-3.5" /> Log
            </button>
          </div>
        </div>

        {filteredBP.length === 0 ? (
          <div className="text-center py-8">
            <Activity className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No readings in this period — tap Log to add one.</p>
          </div>
        ) : bpView === "chart" ? (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={bpChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(40,15%,88%)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "hsl(220,10%,46%)" }}
                  axisLine={false} tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={48}
                />
                <YAxis
                  yAxisId="bp"
                  tick={{ fontSize: 10, fill: "hsl(220,10%,46%)" }}
                  axisLine={false} tickLine={false}
                  domain={["auto", "auto"]} width={36}
                />
                <YAxis
                  yAxisId="hr"
                  orientation="right"
                  tick={{ fontSize: 10, fill: "hsl(220,10%,46%)" }}
                  axisLine={false} tickLine={false}
                  domain={["auto", "auto"]} width={36}
                />
                <Tooltip content={<BPTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line yAxisId="bp" type="monotone" dataKey="systolic"  name="Systolic"   stroke="hsl(0,72%,51%)"   strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line yAxisId="bp" type="monotone" dataKey="diastolic" name="Diastolic"  stroke="hsl(221,83%,53%)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line yAxisId="hr" type="monotone" dataKey="heartRate" name="Heart Rate" stroke="hsl(142,71%,45%)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} strokeDasharray="4 2" connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="rounded-xl border border-border/40 overflow-auto text-xs">
            <table className="w-full">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Date</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium">Sys</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium">Dia</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium">HR</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium">Category</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {[...filteredBP].reverse().map((e) => {
                  const cat = bpCategory(e.systolic, e.diastolic);
                  return (
                    <tr key={e.id} className="hover:bg-muted/20">
                      <td className="px-3 py-2 text-muted-foreground">{format(parseISO(e.date), "d MMM yyyy")}</td>
                      <td className="px-3 py-2 text-right font-bold font-display text-red-600">{e.systolic}</td>
                      <td className="px-3 py-2 text-right font-bold font-display text-blue-600">{e.diastolic}</td>
                      <td className="px-3 py-2 text-right font-semibold text-green-700">{e.heartRate ?? "—"}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${cat.colour}`}>{cat.label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Neck Botox ── */}
      <div className="mb-5">
        <div className="flex items-center justify-between px-1 mb-3">
          <div className="flex items-center gap-2">
            <Syringe className="w-3.5 h-3.5 text-muted-foreground" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Neck Botox</h3>
          </div>
          <button onClick={() => { if (canEdit) { setBotoxError(null); setBotoxOpen(true); } }} className="flex items-center gap-1 text-xs text-primary font-medium">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>

        {botoxRecords.length === 0 ? (
          <div className="p-5 rounded-xl bg-card border border-border/50 shadow-soft text-center">
            <Syringe className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No records yet — tap Add to log your first treatment.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {botoxRecords.map((rec, i) => (
              <motion.div
                key={rec.id ?? i}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="p-4 rounded-xl bg-card border border-border/50 shadow-soft"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-card-foreground">
                    {new Date(rec.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                  <span className="text-[10px] bg-primary/10 text-primary rounded-full px-2 py-0.5 font-medium">
                    {rec.unitsRight + rec.unitsLeft}u total
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-muted/40 text-center">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Right side</p>
                    <p className="text-sm font-bold font-display text-card-foreground">{rec.unitsRight}u</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/40 text-center">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Left side</p>
                    <p className="text-sm font-bold font-display text-card-foreground">{rec.unitsLeft}u</p>
                  </div>
                </div>
                {rec.notes && <p className="text-xs text-muted-foreground italic">{rec.notes}</p>}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ── Log Weight Dialog ── */}
      <Dialog open={weightOpen} onOpenChange={setWeightOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
          <DialogHeader><DialogTitle className="font-display">Log Weight</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={newWeightDate} onChange={(e) => setNewWeightDate(e.target.value)} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Weight (kg)</Label>
              <Input type="number" step="0.1" placeholder={latestWeight ? `e.g. ${latestWeight.weight}` : "e.g. 75.0"} value={newWeight} onChange={(e) => setNewWeight(e.target.value)} className="h-11 rounded-xl" />
            </div>
            <Button onClick={handleAddWeight} disabled={!newWeight.trim()} className="w-full h-11 rounded-xl bg-gradient-primary">Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Log Height Dialog ── */}
      <Dialog open={heightOpen} onOpenChange={setHeightOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
          <DialogHeader><DialogTitle className="font-display">Update Height</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Height (cm)</Label>
              <Input type="number" step="0.5" placeholder={latestHeight ? `e.g. ${latestHeight.height}` : "e.g. 172.0"} value={newHeight} onChange={(e) => setNewHeight(e.target.value)} className="h-11 rounded-xl" />
            </div>
            <Button onClick={handleAddHeight} disabled={!newHeight.trim()} className="w-full h-11 rounded-xl bg-gradient-primary">Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Log BP Dialog ── */}
      <Dialog open={bpOpen} onOpenChange={(o) => { setBpOpen(o); if (!o) setBpError(null); }}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Activity className="w-4 h-4" /> Blood Pressure &amp; Heart Rate
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={bpDate} onChange={(e) => setBpDate(e.target.value)} className="h-11 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Systolic (mmHg)</Label>
                <Input type="number" min="60" max="250" placeholder="e.g. 120" value={bpSys} onChange={(e) => setBpSys(e.target.value)} className="h-11 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Diastolic (mmHg)</Label>
                <Input type="number" min="40" max="160" placeholder="e.g. 80" value={bpDia} onChange={(e) => setBpDia(e.target.value)} className="h-11 rounded-xl" />
              </div>
            </div>
            {bpSys && bpDia && !isNaN(parseInt(bpSys)) && !isNaN(parseInt(bpDia)) && (
              <p className={`text-xs font-semibold ${bpCategory(parseInt(bpSys), parseInt(bpDia)).colour}`}>
                Category: {bpCategory(parseInt(bpSys), parseInt(bpDia)).label}
              </p>
            )}
            <div className="space-y-2">
              <Label>Heart Rate (bpm) <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input type="number" min="30" max="220" placeholder="e.g. 72" value={bpHR} onChange={(e) => setBpHR(e.target.value)} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea placeholder="e.g. After exercise, sitting, etc." value={bpNotes} onChange={(e) => setBpNotes(e.target.value)} className="rounded-xl text-xs min-h-[72px]" />
            </div>
            {bpError && <p className="text-xs text-destructive">{bpError}</p>}
            <Button onClick={handleAddBP} disabled={bpLoading || !bpDate || !bpSys || !bpDia} className="w-full h-11 rounded-xl bg-gradient-primary">
              {bpLoading ? "Saving…" : "Save Reading"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add Botox Dialog ── */}
      <Dialog open={botoxOpen} onOpenChange={(o) => { setBotoxOpen(o); if (!o) setBotoxError(null); }}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
          <DialogHeader><DialogTitle className="font-display flex items-center gap-2"><Syringe className="w-4 h-4" /> Neck Botox</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={botoxDate} onChange={(e) => setBotoxDate(e.target.value)} className="h-11 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Units — Right side</Label>
                <Input type="number" step="1" min="0" placeholder="e.g. 25" value={botoxRight} onChange={(e) => setBotoxRight(e.target.value)} className="h-11 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Units — Left side</Label>
                <Input type="number" step="1" min="0" placeholder="e.g. 25" value={botoxLeft} onChange={(e) => setBotoxLeft(e.target.value)} className="h-11 rounded-xl" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea placeholder="e.g. Treatment at Dr Smith. Some tenderness after." value={botoxNotes} onChange={(e) => setBotoxNotes(e.target.value)} className="rounded-xl text-xs min-h-[80px]" />
            </div>
            {botoxError && <p className="text-xs text-destructive">{botoxError}</p>}
            <Button onClick={handleAddBotox} disabled={botoxLoading || !botoxDate || !botoxRight || !botoxLeft} className="w-full h-11 rounded-xl bg-gradient-primary">
              {botoxLoading ? "Saving…" : "Save Record"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </FeaturePageShell>
  );
};

export default HealthTracker;
