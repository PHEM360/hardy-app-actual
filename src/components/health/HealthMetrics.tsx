import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  HeartPulse, Plus, TrendingDown, TrendingUp, Ruler, Syringe,
  Table2, LineChart as LineChartIcon, Activity, User,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { format, subMonths, subYears, parseISO, differenceInDays } from "date-fns";
import { useWeightTracker, type BPEntry, type MeasurementEntry } from "@/hooks/useWeightTracker";
import { useHealthProfile, idealWeightRange, ACTIVITY_LABELS, type ActivityLevel, type SmokingStatus } from "@/hooks/useHealthProfile";
import AiHealthAssessment from "@/components/health/AiHealthAssessment";
import { useMeds } from "@/hooks/useMeds";
import DogLoader from "@/components/DogLoader";

type Period = "1m" | "3m" | "6m" | "1y" | "all";
const PERIODS: { label: string; value: Period }[] = [
  { label: "1M", value: "1m" }, { label: "3M", value: "3m" },
  { label: "6M", value: "6m" }, { label: "1Y", value: "1y" }, { label: "All", value: "all" },
];

function periodCutoff(p: Period): Date | null {
  const now = new Date();
  if (p === "1m") return subMonths(now, 1);
  if (p === "3m") return subMonths(now, 3);
  if (p === "6m") return subMonths(now, 6);
  if (p === "1y") return subYears(now, 1);
  return null;
}

function smartDateFmt(dateStr: string, spanDays: number): string {
  const d = parseISO(dateStr);
  return spanDays > 400 ? format(d, "MMM yy") : format(d, "d MMM");
}

export function bpCategory(sys: number, dia: number): { label: string; colour: string } {
  if (sys < 90 || dia < 60)    return { label: "Low",     colour: "text-blue-500" };
  if (sys <= 120 && dia <= 80) return { label: "Normal",  colour: "text-green-600" };
  if (sys <= 129 && dia <= 80) return { label: "Elevated", colour: "text-yellow-600" };
  if (sys <= 139 || dia <= 89) return { label: "Stage 1", colour: "text-orange-500" };
  return                              { label: "Stage 2", colour: "text-red-600" };
}

function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="flex gap-0.5 p-1 bg-muted/60 rounded-full border border-border/30">
      {PERIODS.map((p) => (
        <button key={p.value} onClick={() => onChange(p.value)}
          className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${value === p.value ? "bg-card shadow-sm text-foreground ring-1 ring-border/40" : "text-muted-foreground hover:text-foreground"}`}>
          {p.label}
        </button>
      ))}
    </div>
  );
}

function ViewToggle({ view, onChange }: { view: "chart" | "table"; onChange: (v: "chart" | "table") => void }) {
  return (
    <div className="flex gap-0.5 p-1 bg-muted/60 rounded-full border border-border/30">
      {(["chart", "table"] as const).map((v) => (
        <button key={v} onClick={() => onChange(v)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${view === v ? "bg-card shadow-sm text-foreground ring-1 ring-border/40" : "text-muted-foreground"}`}>
          {v === "chart" ? <LineChartIcon className="w-3 h-3" /> : <Table2 className="w-3 h-3" />}
          {v === "chart" ? "Chart" : "Table"}
        </button>
      ))}
    </div>
  );
}

const WeightTooltip = ({ active, payload }: any) => {
  if (active && payload?.length) return (
    <div className="rounded-lg bg-card border border-border shadow-elevated p-2.5 text-xs">
      <p className="text-muted-foreground">{payload[0]?.payload?.rawDate}</p>
      <p className="font-bold text-card-foreground">{payload[0]?.value} kg</p>
    </div>
  );
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

function cmToIn(cm: number) { return (cm / 2.54).toFixed(1); }

export default function HealthMetrics() {
  const {
    entries, heightEntries, botoxRecords, bpEntries, measurements, loading,
    addEntry, addHeightEntry, addBotoxRecord, addBPEntry, addMeasurementEntry,
  } = useWeightTracker();
  const { medications } = useMeds();
  const { profile, saveProfile } = useHealthProfile();

  const [unit, setUnit] = useState<"cm" | "in">("cm");
  const [demoOpen, setDemoOpen] = useState(false);

  // Demographics form state
  const [dAge, setDAge]       = useState("");
  const [dSex, setDSex]       = useState<"male" | "female" | "">(""); 
  const [dAct, setDAct]       = useState<ActivityLevel | "">("");
  const [dSmoke, setDSmoke]   = useState<SmokingStatus | "">("");
  const [dAlc, setDAlc]       = useState("");
  const [dDia, setDDia]       = useState(false);

  // Weight
  const [weightOpen, setWeightOpen]       = useState(false);
  const [newWeight, setNewWeight]         = useState("");
  const [newWeightDate, setNewWeightDate] = useState(new Date().toISOString().split("T")[0]);
  const [weightPeriod, setWeightPeriod]   = useState<Period>("3m");
  const [weightView, setWeightView]       = useState<"chart" | "table">("chart");

  // Height
  const [heightOpen, setHeightOpen] = useState(false);
  const [newHeight, setNewHeight]   = useState("");

  // Botox
  const [botoxOpen, setBotoxOpen]       = useState(false);
  const [botoxDate, setBotoxDate]       = useState(new Date().toISOString().split("T")[0]);
  const [botoxRight, setBotoxRight]     = useState("");
  const [botoxLeft, setBotoxLeft]       = useState("");
  const [botoxNotes, setBotoxNotes]     = useState("");
  const [botoxLoading, setBotoxLoading] = useState(false);
  const [botoxError, setBotoxError]     = useState<string | null>(null);

  // BP
  const [bpOpen, setBpOpen]     = useState(false);
  const [bpDate, setBpDate]     = useState(new Date().toISOString().split("T")[0]);
  const [bpSys, setBpSys]       = useState("");
  const [bpDia, setBpDia]       = useState("");
  const [bpHR, setBpHR]         = useState("");
  const [bpNotes, setBpNotes]   = useState("");
  const [bpLoading, setBpLoading] = useState(false);
  const [bpError, setBpError]   = useState<string | null>(null);
  const [bpPeriod, setBpPeriod] = useState<Period>("3m");
  const [bpView, setBpView]     = useState<"chart" | "table">("chart");

  // Measurements
  const [measOpen, setMeasOpen]   = useState(false);
  const [measDate, setMeasDate]   = useState(new Date().toISOString().split("T")[0]);
  const [chest, setChest]         = useState("");
  const [waist, setWaist]         = useState("");
  const [hip, setHip]             = useState("");
  const [measLoading, setMeasLoading] = useState(false);

  // ── Derived ────────────────────────────────────────────────────────────────
  const filteredWeight = useMemo(() => {
    const cutoff = periodCutoff(weightPeriod);
    return cutoff ? entries.filter((e) => parseISO(e.date) >= cutoff) : entries;
  }, [entries, weightPeriod]);

  const weightSpanDays = useMemo(() => {
    if (filteredWeight.length < 2) return 30;
    return differenceInDays(parseISO(filteredWeight[filteredWeight.length - 1].date), parseISO(filteredWeight[0].date));
  }, [filteredWeight]);

  const weightChartData = useMemo(() =>
    filteredWeight.map((d) => ({
      date: smartDateFmt(d.date, weightSpanDays),
      rawDate: format(parseISO(d.date), "d MMM yyyy"),
      weight: d.weight,
    })), [filteredWeight, weightSpanDays]);

  const latestWeight   = entries[entries.length - 1];
  const previousWeight = entries[entries.length - 2];
  const firstWeight    = entries[0];
  const latestHeight   = heightEntries[heightEntries.length - 1];
  const latestMeas     = measurements[measurements.length - 1];
  const weightDiff     = latestWeight && previousWeight ? latestWeight.weight - previousWeight.weight : 0;
  const totalChange    = latestWeight && firstWeight ? latestWeight.weight - firstWeight.weight : null;
  const lowestInPeriod = filteredWeight.length ? Math.min(...filteredWeight.map((e) => e.weight)) : null;
  const highestInPeriod = filteredWeight.length ? Math.max(...filteredWeight.map((e) => e.weight)) : null;
  const bmi = latestWeight && latestHeight
    ? (latestWeight.weight / Math.pow(latestHeight.height / 100, 2)).toFixed(1) : null;

  const filteredBP = useMemo(() => {
    const cutoff = periodCutoff(bpPeriod);
    return cutoff ? bpEntries.filter((e) => parseISO(e.date) >= cutoff) : bpEntries;
  }, [bpEntries, bpPeriod]);

  const bpSpanDays = useMemo(() => {
    if (filteredBP.length < 2) return 30;
    return differenceInDays(parseISO(filteredBP[filteredBP.length - 1].date), parseISO(filteredBP[0].date));
  }, [filteredBP]);

  const bpChartData = useMemo(() =>
    filteredBP.map((d) => ({
      date: smartDateFmt(d.date, bpSpanDays),
      rawDate: format(parseISO(d.date), "d MMM yyyy"),
      systolic: d.systolic, diastolic: d.diastolic, heartRate: d.heartRate ?? null,
    })), [filteredBP, bpSpanDays]);

  const latestBP = bpEntries[bpEntries.length - 1];

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAddWeight = async () => {
    const w = parseFloat(newWeight);
    if (isNaN(w)) return;
    await addEntry(w, newWeightDate);
    setNewWeight(""); setNewWeightDate(new Date().toISOString().split("T")[0]); setWeightOpen(false);
  };

  const openDemo = () => {
    setDAge(profile.age ? String(profile.age) : "");
    setDSex(profile.sex ?? "");
    setDAct(profile.activityLevel ?? "");
    setDSmoke(profile.smokingStatus ?? "");
    setDAlc(profile.alcoholUnitsPerWeek !== undefined ? String(profile.alcoholUnitsPerWeek) : "");
    setDDia(profile.diabetic ?? false);
    setDemoOpen(true);
  };

  const saveDemographics = async () => {
    await saveProfile({
      age:                  dAge ? Number(dAge) : undefined,
      sex:                  dSex || undefined,
      activityLevel:        dAct || undefined,
      smokingStatus:        dSmoke || undefined,
      alcoholUnitsPerWeek:  dAlc !== "" ? Number(dAlc) : undefined,
      diabetic:             dDia,
    });
    setDemoOpen(false);
  };

  // Target weight
  const targetRange = latestHeight ? idealWeightRange(latestHeight.height) : null;

  const handleAddHeight = async () => {
    const h = parseFloat(newHeight);
    if (isNaN(h)) return;
    await addHeightEntry(h);
    setNewHeight(""); setHeightOpen(false);
  };

  const handleAddBotox = async () => {
    const right = parseFloat(botoxRight), left = parseFloat(botoxLeft);
    if (!botoxDate || isNaN(right) || isNaN(left)) { setBotoxError("Please fill in all required fields."); return; }
    setBotoxError(null); setBotoxLoading(true);
    try {
      await addBotoxRecord({ date: botoxDate, unitsRight: right, unitsLeft: left, notes: botoxNotes.trim() });
      setBotoxDate(new Date().toISOString().split("T")[0]); setBotoxRight(""); setBotoxLeft(""); setBotoxNotes(""); setBotoxOpen(false);
    } catch (e: any) { setBotoxError(e?.message ?? "Failed to save."); } finally { setBotoxLoading(false); }
  };

  const handleAddBP = async () => {
    const sys = parseInt(bpSys, 10), dia = parseInt(bpDia, 10);
    if (!bpDate || isNaN(sys) || isNaN(dia)) { setBpError("Please fill in date, systolic and diastolic."); return; }
    setBpError(null); setBpLoading(true);
    try {
      const entry: Omit<BPEntry, "id"> = { date: bpDate, systolic: sys, diastolic: dia, ...(bpHR ? { heartRate: parseInt(bpHR, 10) } : {}), ...(bpNotes.trim() ? { notes: bpNotes.trim() } : {}) };
      await addBPEntry(entry);
      setBpDate(new Date().toISOString().split("T")[0]); setBpSys(""); setBpDia(""); setBpHR(""); setBpNotes(""); setBpOpen(false);
    } catch (e: any) { setBpError(e?.message ?? "Failed."); } finally { setBpLoading(false); }
  };

  const handleAddMeas = async () => {
    const c = parseFloat(chest);
    if (!measDate || isNaN(c)) return;
    setMeasLoading(true);
    try {
      const entry: Omit<MeasurementEntry, "id"> = {
        date: measDate, chestCm: c,
        ...(waist ? { waistCm: parseFloat(waist) } : {}),
        ...(hip   ? { hipCm:   parseFloat(hip)   } : {}),
      };
      await addMeasurementEntry(entry);
      setChest(""); setWaist(""); setHip(""); setMeasDate(new Date().toISOString().split("T")[0]); setMeasOpen(false);
    } finally { setMeasLoading(false); }
  };

  function displayCm(cm: number) {
    return unit === "cm" ? `${cm} cm` : `${cmToIn(cm)}"`;
  }

  if (loading) return <div className="py-20 text-center"><DogLoader text="Loading…" /></div>;

  return (
    <div>
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {/* Weight card */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-gradient-primary col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-primary-foreground/70 uppercase tracking-wider font-medium">Current Weight</p>
            <button onClick={() => setWeightOpen(true)} className="flex items-center gap-0.5 text-[10px] text-primary-foreground/70 hover:text-primary-foreground font-medium">
              <Plus className="w-3 h-3" /> Log
            </button>
          </div>
          <p className="text-3xl font-bold font-display text-primary-foreground">{latestWeight ? `${latestWeight.weight} kg` : "—"}</p>
          {latestWeight && (
            <div className="flex items-center gap-1 mt-1">
              {weightDiff <= 0 ? <TrendingDown className="w-3.5 h-3.5 text-primary-foreground/70" /> : <TrendingUp className="w-3.5 h-3.5 text-primary-foreground/70" />}
              <span className="text-xs text-primary-foreground/70">{weightDiff > 0 ? "+" : ""}{weightDiff.toFixed(1)} kg from last</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-3 pt-3 border-t border-primary-foreground/20">
            {totalChange !== null && (
              <div><p className="text-[9px] text-primary-foreground/60 uppercase tracking-wider">Since Start</p>
                <p className="text-sm font-bold font-display text-primary-foreground">{totalChange > 0 ? "+" : ""}{totalChange.toFixed(1)} kg</p></div>
            )}
            {bmi && (
              <div><p className="text-[9px] text-primary-foreground/60 uppercase tracking-wider">BMI</p>
                <p className="text-sm font-bold font-display text-primary-foreground">{bmi}</p></div>
            )}
            {targetRange && (
              <div className="col-span-2">
                <p className="text-[9px] text-primary-foreground/60 uppercase tracking-wider">Healthy Range (BMI 18.5–25)</p>
                <p className="text-sm font-bold font-display text-primary-foreground">{targetRange.min}–{targetRange.max} kg
                  {latestWeight && (
                    <span className="text-[10px] font-normal ml-1.5">
                      {latestWeight.weight < targetRange.min
                        ? `(${(targetRange.min - latestWeight.weight).toFixed(1)} kg to gain)`
                        : latestWeight.weight > targetRange.max
                        ? `(${(latestWeight.weight - targetRange.max).toFixed(1)} kg to lose)`
                        : "✓ In range"}
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Height + BP card */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="p-4 rounded-2xl bg-card border border-border/50 shadow-soft col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <Ruler className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Height</p>
            </div>
            <button onClick={() => setHeightOpen(true)} className="text-[10px] text-primary font-medium flex items-center gap-0.5"><Plus className="w-3 h-3" /> Update</button>
          </div>
          <p className="text-3xl font-bold font-display text-card-foreground mt-1">{latestHeight ? `${latestHeight.height} cm` : "—"}</p>
          {latestBP && (
            <div className="mt-3 pt-3 border-t border-border/40">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Activity className="w-3 h-3 text-muted-foreground" />
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">Latest BP</p>
              </div>
              <p className="text-lg font-bold font-display text-card-foreground">{latestBP.systolic}/{latestBP.diastolic}<span className="text-xs font-normal text-muted-foreground ml-1">mmHg</span></p>
              {latestBP.heartRate && <p className="text-[10px] text-muted-foreground">{latestBP.heartRate} bpm</p>}
              <p className={`text-[10px] font-semibold mt-0.5 ${bpCategory(latestBP.systolic, latestBP.diastolic).colour}`}>{bpCategory(latestBP.systolic, latestBP.diastolic).label}</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Measurements */}
      <div className="p-4 rounded-2xl bg-card border border-border/50 shadow-soft mb-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Ruler className="w-3.5 h-3.5 text-muted-foreground" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Body Measurements</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 p-0.5 bg-muted/60 rounded-full border border-border/30">
              {(["cm", "in"] as const).map((u) => (
                <button key={u} onClick={() => setUnit(u)}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-all ${unit === u ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
                  {u}
                </button>
              ))}
            </div>
            <button onClick={() => setMeasOpen(true)} className="flex items-center gap-1 text-xs text-primary font-medium"><Plus className="w-3.5 h-3.5" /> Log</button>
          </div>
        </div>

        {!latestMeas ? (
          <p className="text-xs text-muted-foreground text-center py-6">No measurements yet. Tap Log to add chest, waist &amp; hip.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {latestMeas.chestCm && (
              <div className="p-3 rounded-xl bg-muted/30 text-center">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Chest</p>
                <p className="text-lg font-bold font-display text-card-foreground">{displayCm(latestMeas.chestCm)}</p>
              </div>
            )}
            {latestMeas.waistCm && (
              <div className="p-3 rounded-xl bg-muted/30 text-center">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Waist</p>
                <p className="text-lg font-bold font-display text-card-foreground">{displayCm(latestMeas.waistCm)}</p>
              </div>
            )}
            {latestMeas.hipCm && (
              <div className="p-3 rounded-xl bg-muted/30 text-center">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Hip</p>
                <p className="text-lg font-bold font-display text-card-foreground">{displayCm(latestMeas.hipCm)}</p>
              </div>
            )}
          </div>
        )}
        {measurements.length > 1 && (
          <div className="mt-3 pt-3 border-t border-border/40">
            <p className="text-[10px] text-muted-foreground font-medium mb-2">History</p>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {[...measurements].reverse().slice(1).map((m) => (
                <div key={m.id} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{format(parseISO(m.date), "d MMM yyyy")}</span>
                  <span className="text-card-foreground font-medium">
                    {m.chestCm && `Chest ${displayCm(m.chestCm)}`}
                    {m.waistCm && ` · Waist ${displayCm(m.waistCm)}`}
                    {m.hipCm && ` · Hip ${displayCm(m.hipCm)}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Weight chart/table */}
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
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(220,10%,46%)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={48} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(220,10%,46%)" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} width={40} tickFormatter={(v) => `${v}kg`} />
                <Tooltip content={<WeightTooltip />} />
                <Line type="monotone" dataKey="weight" stroke="hsl(168,55%,38%)" strokeWidth={2.5} dot={{ fill: "hsl(168,55%,38%)", r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="rounded-xl border border-border/40 overflow-auto text-xs">
            <table className="w-full">
              <thead className="bg-muted/40"><tr>
                <th className="text-left px-3 py-2 text-muted-foreground font-medium">Date</th>
                <th className="text-right px-3 py-2 text-muted-foreground font-medium">Weight</th>
                <th className="text-right px-3 py-2 text-muted-foreground font-medium">Change</th>
              </tr></thead>
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

      {/* Blood Pressure */}
      <div className="p-4 rounded-2xl bg-card border border-border/50 shadow-soft mb-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-muted-foreground" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Blood Pressure &amp; Heart Rate</h3>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <PeriodPicker value={bpPeriod} onChange={setBpPeriod} />
            <ViewToggle view={bpView} onChange={setBpView} />
            <button onClick={() => { setBpError(null); setBpOpen(true); }} className="flex items-center gap-1 text-xs text-primary font-medium"><Plus className="w-3.5 h-3.5" /> Log</button>
          </div>
        </div>
        {filteredBP.length === 0 ? (
          <div className="text-center py-8"><Activity className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No readings yet — tap Log to add one.</p></div>
        ) : bpView === "chart" ? (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={bpChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(40,15%,88%)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(220,10%,46%)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={48} />
                <YAxis yAxisId="bp" tick={{ fontSize: 10, fill: "hsl(220,10%,46%)" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} width={36} />
                <YAxis yAxisId="hr" orientation="right" tick={{ fontSize: 10, fill: "hsl(220,10%,46%)" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} width={36} />
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
              <thead className="bg-muted/40"><tr>
                <th className="text-left px-3 py-2 text-muted-foreground font-medium">Date</th>
                <th className="text-right px-3 py-2 text-muted-foreground font-medium">Sys</th>
                <th className="text-right px-3 py-2 text-muted-foreground font-medium">Dia</th>
                <th className="text-right px-3 py-2 text-muted-foreground font-medium">HR</th>
                <th className="text-right px-3 py-2 text-muted-foreground font-medium">Category</th>
              </tr></thead>
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

      {/* Botox */}
      <div className="mb-5">
        <div className="flex items-center justify-between px-1 mb-3">
          <div className="flex items-center gap-2">
            <Syringe className="w-3.5 h-3.5 text-muted-foreground" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Neck Botox</h3>
          </div>
          <button onClick={() => { setBotoxError(null); setBotoxOpen(true); }} className="flex items-center gap-1 text-xs text-primary font-medium"><Plus className="w-3.5 h-3.5" /> Add</button>
        </div>
        {botoxRecords.length === 0 ? (
          <div className="p-5 rounded-xl bg-card border border-border/50 text-center">
            <Syringe className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No records yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {botoxRecords.map((rec, i) => (
              <motion.div key={rec.id ?? i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="p-4 rounded-xl bg-card border border-border/50 shadow-soft">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold">{new Date(rec.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
                  <span className="text-[10px] bg-primary/10 text-primary rounded-full px-2 py-0.5 font-medium">{rec.unitsRight + rec.unitsLeft}u total</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-muted/40 text-center"><p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Right</p><p className="text-sm font-bold font-display">{rec.unitsRight}u</p></div>
                  <div className="p-2 rounded-lg bg-muted/40 text-center"><p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Left</p><p className="text-sm font-bold font-display">{rec.unitsLeft}u</p></div>
                </div>
                {rec.notes && <p className="text-xs text-muted-foreground italic">{rec.notes}</p>}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ── Demographics ── */}
      <div className="p-4 rounded-2xl bg-card border border-border/50 shadow-soft mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-muted-foreground" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Demographics</h3>
          </div>
          <button onClick={openDemo} className="text-xs text-primary font-medium">{profile.age ? "Edit" : "Add"}</button>
        </div>
        {!profile.age && !profile.sex ? (
          <p className="text-xs text-muted-foreground text-center py-4">Add your demographics for target weight calculation and better AI analysis.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-xs">
            {profile.age && <div className="p-2 rounded-xl bg-muted/30"><p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Age</p><p className="font-bold">{profile.age}</p></div>}
            {profile.sex && <div className="p-2 rounded-xl bg-muted/30"><p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Sex</p><p className="font-bold capitalize">{profile.sex}</p></div>}
            {profile.activityLevel && <div className="p-2 rounded-xl bg-muted/30 col-span-2"><p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Activity</p><p className="font-semibold leading-tight">{ACTIVITY_LABELS[profile.activityLevel]}</p></div>}
            {profile.smokingStatus && <div className="p-2 rounded-xl bg-muted/30"><p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Smoking</p><p className="font-bold capitalize">{profile.smokingStatus === "ex" ? "Ex-smoker" : profile.smokingStatus === "current" ? "Current smoker" : "Never"}</p></div>}
            {profile.alcoholUnitsPerWeek !== undefined && <div className="p-2 rounded-xl bg-muted/30"><p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Alcohol</p><p className="font-bold">{profile.alcoholUnitsPerWeek} units/wk</p></div>}
          </div>
        )}
      </div>

      {/* ── AI Health Assessment ── */}
      <AiHealthAssessment
        entries={entries}
        heightEntries={heightEntries}
        bpEntries={bpEntries}
        measurements={measurements}
        medications={medications}
        profile={profile}
      />

      {/* ── Dialogs ── */}
      <Dialog open={weightOpen} onOpenChange={setWeightOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
          <DialogHeader><DialogTitle className="font-display">Log Weight</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2"><Label>Date</Label><Input type="date" value={newWeightDate} onChange={(e) => setNewWeightDate(e.target.value)} className="h-11 rounded-xl" /></div>
            <div className="space-y-2"><Label>Weight (kg)</Label><Input type="number" step="0.1" placeholder="e.g. 75.0" value={newWeight} onChange={(e) => setNewWeight(e.target.value)} className="h-11 rounded-xl" /></div>
            <Button onClick={handleAddWeight} disabled={!newWeight.trim()} className="w-full h-11 rounded-xl bg-gradient-primary">Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={heightOpen} onOpenChange={setHeightOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
          <DialogHeader><DialogTitle className="font-display">Update Height</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2"><Label>Height (cm)</Label><Input type="number" step="0.5" placeholder="e.g. 172.0" value={newHeight} onChange={(e) => setNewHeight(e.target.value)} className="h-11 rounded-xl" /></div>
            <Button onClick={handleAddHeight} disabled={!newHeight.trim()} className="w-full h-11 rounded-xl bg-gradient-primary">Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={measOpen} onOpenChange={setMeasOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
          <DialogHeader><DialogTitle className="font-display">Log Measurements</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2"><Label>Date</Label><Input type="date" value={measDate} onChange={(e) => setMeasDate(e.target.value)} className="h-11 rounded-xl" /></div>
            <div className="space-y-2"><Label>Chest (cm) *</Label><Input type="number" step="0.5" placeholder="e.g. 92" value={chest} onChange={(e) => setChest(e.target.value)} className="h-11 rounded-xl" /></div>
            <div className="space-y-2"><Label>Waist (cm) <span className="text-muted-foreground font-normal">(optional)</span></Label><Input type="number" step="0.5" placeholder="e.g. 80" value={waist} onChange={(e) => setWaist(e.target.value)} className="h-11 rounded-xl" /></div>
            <div className="space-y-2"><Label>Hip (cm) <span className="text-muted-foreground font-normal">(optional)</span></Label><Input type="number" step="0.5" placeholder="e.g. 96" value={hip} onChange={(e) => setHip(e.target.value)} className="h-11 rounded-xl" /></div>
            <Button onClick={handleAddMeas} disabled={measLoading || !chest.trim()} className="w-full h-11 rounded-xl bg-gradient-primary">{measLoading ? "Saving…" : "Save Measurements"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={bpOpen} onOpenChange={(o) => { setBpOpen(o); if (!o) setBpError(null); }}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
          <DialogHeader><DialogTitle className="font-display flex items-center gap-2"><Activity className="w-4 h-4" /> Blood Pressure &amp; Heart Rate</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2"><Label>Date</Label><Input type="date" value={bpDate} onChange={(e) => setBpDate(e.target.value)} className="h-11 rounded-xl" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Systolic</Label><Input type="number" min="60" max="250" placeholder="120" value={bpSys} onChange={(e) => setBpSys(e.target.value)} className="h-11 rounded-xl" /></div>
              <div className="space-y-2"><Label>Diastolic</Label><Input type="number" min="40" max="160" placeholder="80" value={bpDia} onChange={(e) => setBpDia(e.target.value)} className="h-11 rounded-xl" /></div>
            </div>
            {bpSys && bpDia && !isNaN(parseInt(bpSys)) && !isNaN(parseInt(bpDia)) && (
              <p className={`text-xs font-semibold ${bpCategory(parseInt(bpSys), parseInt(bpDia)).colour}`}>Category: {bpCategory(parseInt(bpSys), parseInt(bpDia)).label}</p>
            )}
            <div className="space-y-2"><Label>Heart Rate (bpm) <span className="text-muted-foreground font-normal">(optional)</span></Label><Input type="number" min="30" max="220" placeholder="72" value={bpHR} onChange={(e) => setBpHR(e.target.value)} className="h-11 rounded-xl" /></div>
            <div className="space-y-2"><Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label><Textarea placeholder="e.g. After exercise" value={bpNotes} onChange={(e) => setBpNotes(e.target.value)} className="rounded-xl text-xs min-h-[72px]" /></div>
            {bpError && <p className="text-xs text-destructive">{bpError}</p>}
            <Button onClick={handleAddBP} disabled={bpLoading || !bpDate || !bpSys || !bpDia} className="w-full h-11 rounded-xl bg-gradient-primary">{bpLoading ? "Saving…" : "Save Reading"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={botoxOpen} onOpenChange={(o) => { setBotoxOpen(o); if (!o) setBotoxError(null); }}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
          <DialogHeader><DialogTitle className="font-display flex items-center gap-2"><Syringe className="w-4 h-4" /> Neck Botox</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2"><Label>Date</Label><Input type="date" value={botoxDate} onChange={(e) => setBotoxDate(e.target.value)} className="h-11 rounded-xl" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Units — Right</Label><Input type="number" step="1" min="0" placeholder="25" value={botoxRight} onChange={(e) => setBotoxRight(e.target.value)} className="h-11 rounded-xl" /></div>
              <div className="space-y-2"><Label>Units — Left</Label><Input type="number" step="1" min="0" placeholder="25" value={botoxLeft} onChange={(e) => setBotoxLeft(e.target.value)} className="h-11 rounded-xl" /></div>
            </div>
            <div className="space-y-2"><Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label><Textarea value={botoxNotes} onChange={(e) => setBotoxNotes(e.target.value)} className="rounded-xl text-xs min-h-[80px]" /></div>
            {botoxError && <p className="text-xs text-destructive">{botoxError}</p>}
            <Button onClick={handleAddBotox} disabled={botoxLoading || !botoxDate || !botoxRight || !botoxLeft} className="w-full h-11 rounded-xl bg-gradient-primary">{botoxLoading ? "Saving…" : "Save Record"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Demographics dialog */}
      <Dialog open={demoOpen} onOpenChange={setDemoOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display flex items-center gap-2"><User className="w-4 h-4" /> Your Demographics</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Age</Label>
                <Input type="number" min="1" max="120" placeholder="e.g. 35" value={dAge} onChange={(e) => setDAge(e.target.value)} className="h-11 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label>Sex</Label>
                <Select value={dSex} onValueChange={(v) => setDSex(v as "male" | "female")}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Activity level</Label>
              <Select value={dAct} onValueChange={(v) => setDAct(v as ActivityLevel)}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(ACTIVITY_LABELS) as [ActivityLevel, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Smoking status</Label>
              <Select value={dSmoke} onValueChange={(v) => setDSmoke(v as SmokingStatus)}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">Never smoked</SelectItem>
                  <SelectItem value="ex">Ex-smoker</SelectItem>
                  <SelectItem value="current">Current smoker</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Alcohol (units/week) <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input type="number" min="0" max="200" placeholder="e.g. 14" value={dAlc} onChange={(e) => setDAlc(e.target.value)} className="h-11 rounded-xl" />
              <p className="text-[10px] text-muted-foreground">1 unit = 1 small wine / half pint beer / single spirit</p>
            </div>

            <div className="flex items-center justify-between py-1">
              <div><Label>Diabetic</Label><p className="text-[11px] text-muted-foreground">Type 1 or 2</p></div>
              <Switch checked={dDia} onCheckedChange={setDDia} />
            </div>

            <Button onClick={saveDemographics} className="w-full h-11 rounded-xl bg-gradient-primary">Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
