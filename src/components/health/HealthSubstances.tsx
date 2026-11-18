import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  FlaskConical, Plus, Trash2, Table2, LineChart as LineChartIcon, Calendar,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSubstances } from "@/hooks/useSubstances";
import { JEWEL } from "@/lib/brandPalette";
import {
  DOSE_UNITS,
  SUBSTANCE_PERIODS,
  type DoseUnit,
  type SubstancePeriod,
  type SwigSize,
  buildDailyChartRows,
  computeSubstanceTotals,
  filterLogsByPeriod,
  filterLogsBySubstances,
  formatDoseLabel,
  formatTotalAmount,
  isSwigUnit,
  listChartSeries,
  mergeSubstanceOptions,
  sortLogsNewestFirst,
  substanceColor,
} from "@/lib/substances";

const SEC = {
  log: JEWEL.aubergine,
  view: JEWEL.petrol,
  totals: JEWEL.forest,
} as const;

function optionClass(active: boolean) {
  return `rounded-md border px-3 py-2 text-xs font-bold transition-colors min-h-10 ${
    active
      ? "btn-edge border-[var(--sec)] bg-[var(--sec)] text-white"
      : "border-foreground/20 bg-card text-foreground hover:border-[var(--sec)] hover:text-[var(--sec)]"
  }`;
}

function SectionCard({
  title,
  color,
  action,
  children,
}: {
  title: string;
  color: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="overflow-hidden rounded-xl border border-foreground/20 bg-card shadow-card"
      style={{ ["--sec" as string]: color }}
    >
      <div
        className="band flex items-center justify-between gap-2 px-4 py-3 text-white"
        style={{ backgroundColor: color }}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.12em]">{title}</p>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function StatBlock({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="btn-edge rounded-lg p-3 text-white" style={{ backgroundColor: color }}>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] opacity-85">{label}</p>
      <p className="mt-1 font-display text-lg font-bold tabular-nums leading-tight">{value}</p>
    </div>
  );
}

function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function HealthSubstances() {
  const {
    logs,
    loading,
    addLog,
    deleteLog,
    substanceNames,
    addSubstanceName,
  } = useSubstances();

  const [logOpen, setLogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<"table" | "graph">("table");
  const [period, setPeriod] = useState<SubstancePeriod>("1m");

  const [logSubstance, setLogSubstance] = useState("");
  const [dose, setDose] = useState("");
  const [unit, setUnit] = useState<DoseUnit>("mg");
  const [swigSize, setSwigSize] = useState<SwigSize>("small");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [time, setTime] = useState(nowTime);
  const [notes, setNotes] = useState("");

  const catalog = useMemo(
    () => mergeSubstanceOptions(substanceNames, logs.map((l) => l.name)),
    [substanceNames, logs],
  );

  const [selected, setSelected] = useState<string[]>([]);
  const selectionInitialized = useRef(false);

  useEffect(() => {
    if (selectionInitialized.current) return;
    const fromLogs = Array.from(new Set(logs.map((l) => l.name)));
    if (fromLogs.length === 0) return;
    selectionInitialized.current = true;
    setSelected(fromLogs);
  }, [logs]);

  const filtered = useMemo(() => {
    const inPeriod = filterLogsByPeriod(logs, period);
    return sortLogsNewestFirst(filterLogsBySubstances(inPeriod, selected));
  }, [logs, period, selected]);

  const totals = useMemo(() => computeSubstanceTotals(filtered), [filtered]);
  const chartSeries = useMemo(() => listChartSeries(filtered, selected), [filtered, selected]);
  const chartSeriesKeys = useMemo(() => chartSeries.map((s) => s.key), [chartSeries]);
  const chartRows = useMemo(() => buildDailyChartRows(filtered, chartSeries), [filtered, chartSeries]);
  const doseCount = filtered.length;

  const openLog = (name?: string) => {
    setLogSubstance(name ?? selected[0] ?? catalog[0] ?? "");
    setDose("");
    setUnit("mg");
    setSwigSize("small");
    setDate(new Date().toISOString().split("T")[0]);
    setTime(nowTime());
    setNotes("");
    setLogOpen(true);
  };

  const toggleSubstance = (name: string) => {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  };

  const save = async () => {
    if (!logSubstance.trim()) return;
    const resolvedDose = isSwigUnit(unit) ? swigSize : dose.trim();
    if (!resolvedDose) return;
    setSaving(true);
    try {
      const name = logSubstance.trim();
      if (!substanceNames.includes(name)) await addSubstanceName(name);
      await addLog({
        name,
        dose: resolvedDose,
        unit,
        date,
        time,
        notes: notes.trim() || undefined,
      });
      if (!selected.includes(name)) setSelected((prev) => [...prev, name]);
      setLogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const canSave = Boolean(logSubstance.trim()) && (isSwigUnit(unit) || Boolean(dose.trim()));

  if (loading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-xl font-semibold text-foreground">Substance tracking</h3>
          <p className="text-xs text-foreground/70">Private to you. Log dose, time and amount.</p>
        </div>
        <Button onClick={() => openLog()}>
          <Plus /> Log dose
        </Button>
      </div>

      <SectionCard title="What to show" color={SEC.view}>
        <p className="mb-3 text-xs text-foreground/70">Choose substances for the table and graph.</p>
        <div className="flex flex-wrap gap-2">
          {catalog.map((name) => {
            const active = selected.includes(name);
            return (
              <button
                key={name}
                type="button"
                onClick={() => toggleSubstance(name)}
                className={optionClass(active)}
                style={active ? { ["--sec" as string]: substanceColor(name, catalog) } : { ["--sec" as string]: SEC.view }}
              >
                {name}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/70">Timeframe</p>
          <div className="flex flex-wrap gap-1.5">
            {SUBSTANCE_PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriod(p.value)}
                className={optionClass(period === p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {(["table", "graph"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`${optionClass(view === v)} inline-flex items-center gap-1.5`}
            >
              {v === "table" ? <Table2 className="h-3.5 w-3.5" /> : <LineChartIcon className="h-3.5 w-3.5" />}
              {v === "table" ? "Table" : "Graph"}
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Overall" color={SEC.totals}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <StatBlock label="Doses logged" value={String(doseCount)} color={JEWEL.ink} />
          <StatBlock label="Substances" value={String(new Set(filtered.map((l) => l.name)).size)} color={JEWEL.cobalt} />
          <StatBlock label="Days with a dose" value={String(new Set(filtered.map((l) => l.date)).size)} color={JEWEL.teal} />
        </div>
        {totals.length > 0 ? (
          <div className="mt-3 space-y-2">
            {totals.map((t) => (
              <div
                key={`${t.name}-${t.unit}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-foreground/20 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">{t.name}</p>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-foreground/60">
                    {t.doseCount} dose{t.doseCount === 1 ? "" : "s"} · {t.unit}
                  </p>
                </div>
                <p className="shrink-0 font-display text-base font-bold tabular-nums text-foreground">
                  {formatTotalAmount(t)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-foreground/70">No doses in this timeframe for the selected substances.</p>
        )}
      </SectionCard>

      <SectionCard
        title={view === "table" ? "Dose table" : "Dose graph"}
        color={SEC.log}
        action={
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/80">
            {filtered.length} entr{filtered.length === 1 ? "y" : "ies"}
          </span>
        }
      >
        {selected.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-foreground/80">Select one or more substances above, then log a dose.</p>
            <Button onClick={() => openLog()}>
              <FlaskConical /> Log first dose
            </Button>
          </div>
        ) : view === "table" ? (
          filtered.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-foreground/80">Nothing logged in this timeframe yet.</p>
              <Button onClick={() => openLog()}>
                <Plus /> Log dose
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((log, i) => (
                <div
                  key={log.id}
                  className={`flex items-start gap-2 rounded-lg border border-foreground/20 px-3 py-2.5 ${
                    i % 2 === 0 ? "bg-card" : "bg-[color-mix(in_srgb,var(--sec)_8%,hsl(var(--card)))]"
                  }`}
                >
                  <span
                    className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: substanceColor(log.name, catalog) }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-bold text-foreground">{log.name}</p>
                      <p className="shrink-0 font-display text-sm font-bold tabular-nums text-foreground">
                        {formatDoseLabel(log.dose, log.unit)}
                      </p>
                    </div>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs tabular-nums text-foreground/70">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3 opacity-60" />
                        {format(parseISO(log.date), "d MMM yyyy")}
                      </span>
                      <span>{log.time}</span>
                    </p>
                    {log.notes ? (
                      <p className="mt-1 text-xs text-foreground/60">{log.notes}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteLog(log.id)}
                    className="shrink-0 rounded-md p-2 text-foreground/50 hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Delete dose"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )
        ) : chartRows.length === 0 ? (
          <p className="text-sm text-foreground/80">Nothing to plot in this timeframe yet.</p>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => format(parseISO(String(d)), "d MMM")}
                  tick={{ fontSize: 10 }}
                />
                <YAxis tick={{ fontSize: 10 }} width={36} />
                <Tooltip
                  labelFormatter={(d) => format(parseISO(String(d)), "d MMM yyyy")}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid hsl(var(--foreground) / 0.2)",
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {chartSeries.map((series) => (
                  <Bar
                    key={series.key}
                    dataKey={series.key}
                    name={series.key}
                    stackId={series.unit}
                    fill={substanceColor(series.key, chartSeriesKeys)}
                    radius={[2, 2, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-2 text-[10px] text-foreground/60">
              Each substance and unit is its own series. Same units stack. A small swig counts as 1 and a big swig as 2.
            </p>
          </div>
        )}
      </SectionCard>

      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent aria-describedby={undefined} className="mx-4 max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <FlaskConical className="h-4 w-4" /> Log dose
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1" style={{ ["--sec" as string]: SEC.log }}>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-[0.12em]">Substance</Label>
              <Select value={logSubstance} onValueChange={setLogSubstance}>
                <SelectTrigger className="h-11 rounded-lg">
                  <SelectValue placeholder="Choose substance" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {catalog.map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={logSubstance}
                onChange={(e) => setLogSubstance(e.target.value)}
                placeholder="Or type a custom name"
                className="h-10 rounded-lg"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-[0.12em]">Dose unit</Label>
              <div className="flex flex-wrap gap-1.5">
                {DOSE_UNITS.map((u) => (
                  <button
                    key={u.value}
                    type="button"
                    onClick={() => setUnit(u.value)}
                    className={optionClass(unit === u.value)}
                  >
                    {u.label}
                  </button>
                ))}
              </div>
            </div>

            {isSwigUnit(unit) ? (
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-[0.12em]">Swig size</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["small", "big"] as const).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setSwigSize(size)}
                      className={optionClass(swigSize === size)}
                    >
                      {size === "big" ? "Big swig" : "Small swig"}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-[0.12em]">Dose</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={dose}
                  onChange={(e) => setDose(e.target.value)}
                  placeholder="e.g. 10"
                  className="h-11 rounded-lg"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-[0.12em]">Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-[0.12em]">Time</Label>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-11 rounded-lg" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-[0.12em]">Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Context or effects"
                className="min-h-[60px] rounded-lg text-sm"
              />
            </div>

            <Button onClick={save} disabled={saving || !canSave} className="w-full">
              <Plus /> {saving ? "Saving…" : "Save dose"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
