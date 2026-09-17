import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Rocket, Info, Wallet, Repeat, TrendingUp, LineChart as LineChartIcon, BarChart3, Sparkles,
  Plus, X, Copy, Save,
} from "lucide-react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fmtGbp } from "@/lib/flatFinance";
import { useBusinessSetups } from "@/hooks/useBusinessSetups";
import {
  BusinessSetup, BusinessSetupCostItem, BusinessSetupExpenseGrowth, BusinessSetupIncomeStream,
  ONGOING_COST_PRESETS, STARTUP_COST_PRESETS, newCostItem, newIncomeStream, projectBusinessSetup,
} from "@/lib/businessSetupModel";
import { analyzeBusinessSetup } from "@/lib/businessSetupAnalysisApi";
import { toast } from "sonner";

const SECTIONS = [
  { id: "basics", label: "Basics", icon: Info },
  { id: "startup", label: "Start-up Costs", icon: Wallet },
  { id: "ongoing", label: "Ongoing Costs", icon: Repeat },
  { id: "income", label: "Income Streams", icon: TrendingUp },
  { id: "growth", label: "Cost Growth", icon: LineChartIcon },
  { id: "projection", label: "Projection", icon: BarChart3 },
  { id: "ai", label: "AI Critique", icon: Sparkles },
] as const;
type SectionId = typeof SECTIONS[number]["id"];

const DIRTY_KEYS: (keyof BusinessSetup)[] = ["name", "description", "years", "taxRatePercent", "startupCosts", "ongoingCosts", "incomeStreams", "expenseGrowth"];

function pillClass(active: boolean) {
  return `rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all ${
    active
      ? "border-primary bg-gradient-primary text-primary-foreground shadow-md"
      : "border-border bg-card text-foreground shadow-sm hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/10 hover:shadow-md"
  }`;
}

function moneyField(value: number, onChange: (n: number) => void, placeholder?: string) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">£</span>
      <Input
        type="number"
        value={value || ""}
        placeholder={placeholder}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="h-9 rounded-lg pl-5"
      />
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" | "bad" }) {
  const color = tone === "good" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : tone === "bad" ? "text-rose-600" : "text-foreground";
  return (
    <div className="rounded-xl border border-border/50 bg-card p-3 shadow-card">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function CostSection({
  title, hint, totalLabel, items, presets, onChange,
}: {
  title: string;
  hint: string;
  totalLabel: string;
  items: BusinessSetupCostItem[];
  presets: { name: string; amount: number }[];
  onChange: (items: BusinessSetupCostItem[]) => void;
}) {
  const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const togglePreset = (preset: { name: string; amount: number }) => {
    const existing = items.find((i) => i.name === preset.name);
    if (existing) onChange(items.filter((i) => i.id !== existing.id));
    else onChange([...items, newCostItem(preset.name, preset.amount)]);
  };
  const updateItem = (id: string, patch: Partial<BusinessSetupCostItem>) =>
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const removeItem = (id: string) => onChange(items.filter((i) => i.id !== id));

  return (
    <div className="space-y-4">
      <div>
        <p className="font-display text-base font-bold">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <button key={preset.name} type="button" onClick={() => togglePreset(preset)} className={pillClass(items.some((i) => i.name === preset.name))}>
            {preset.name}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {items.length === 0 && (
          <p className="rounded-xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
            No costs added yet — tap a preset above or add your own.
          </p>
        )}
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2 rounded-xl border border-border/50 bg-card p-2 shadow-sm">
            <Input
              value={item.name}
              onChange={(e) => updateItem(item.id, { name: e.target.value })}
              placeholder="Cost name"
              className="h-9 flex-1 rounded-lg"
            />
            <div className="w-28 shrink-0">{moneyField(item.amount, (n) => updateItem(item.id, { amount: n }))}</div>
            <button
              type="button"
              onClick={() => removeItem(item.id)}
              aria-label="Remove cost"
              className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onChange([...items, newCostItem("", 0)])}
          className="flex items-center gap-1 text-xs font-semibold text-primary"
        >
          <Plus className="h-3.5 w-3.5" /> Add custom cost
        </button>
        <p className="text-sm font-bold tabular-nums">{totalLabel}: {fmtGbp(total)}</p>
      </div>
    </div>
  );
}

function IncomeStreamsSection({ streams, onChange }: { streams: BusinessSetupIncomeStream[]; onChange: (s: BusinessSetupIncomeStream[]) => void }) {
  const update = (id: string, patch: Partial<BusinessSetupIncomeStream>) =>
    onChange(streams.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const remove = (id: string) => onChange(streams.filter((s) => s.id !== id));

  return (
    <div className="space-y-4">
      <div>
        <p className="font-display text-base font-bold">Income streams</p>
        <p className="mt-1 text-sm text-muted-foreground">Add each source of income and how you expect it to grow over the plan.</p>
      </div>
      {streams.length === 0 && (
        <p className="rounded-xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
          No income streams yet — add at least one to project revenue.
        </p>
      )}
      <div className="space-y-3">
        {streams.map((stream) => {
          const displayAmount = stream.period === "monthly" ? stream.amount / 12 : stream.amount;
          const setAmount = (n: number) => update(stream.id, { amount: stream.period === "monthly" ? n * 12 : n });
          return (
            <div key={stream.id} className="space-y-3 rounded-2xl border border-border/50 bg-card p-3 shadow-card">
              <div className="flex items-center gap-2">
                <Input
                  value={stream.name}
                  onChange={(e) => update(stream.id, { name: e.target.value })}
                  placeholder="e.g. Product sales"
                  className="h-9 flex-1 rounded-lg font-semibold"
                />
                <button
                  type="button"
                  onClick={() => remove(stream.id)}
                  aria-label="Remove income stream"
                  className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Year 1 amount</Label>
                  {moneyField(displayAmount, setAmount)}
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Per</Label>
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => update(stream.id, { period: "yearly" })} className={pillClass(stream.period === "yearly")}>Year</button>
                    <button type="button" onClick={() => update(stream.id, { period: "monthly" })} className={pillClass(stream.period === "monthly")}>Month</button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Growth</Label>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => update(stream.id, { growthMode: "rate" })} className={pillClass(stream.growthMode === "rate")}>
                    Steady % per year
                  </button>
                  <button type="button" onClick={() => update(stream.id, { growthMode: "toMax" })} className={pillClass(stream.growthMode === "toMax")}>
                    Grow to a cap
                  </button>
                </div>
              </div>

              {stream.growthMode === "rate" ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Growth rate</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={stream.growthRatePercent}
                        onChange={(e) => update(stream.id, { growthRatePercent: Number(e.target.value) || 0 })}
                        className="h-9 rounded-lg pr-10"
                      />
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%/yr</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Cap (optional)</Label>
                    {moneyField(stream.maxAnnualAmount, (n) => update(stream.id, { maxAnnualAmount: n }), "No cap")}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Max annual amount</Label>
                    {moneyField(stream.maxAnnualAmount, (n) => update(stream.id, { maxAnnualAmount: n }))}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Years to reach it</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={stream.yearsToMax}
                      onChange={(e) => update(stream.id, { yearsToMax: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })}
                      className="h-9 rounded-lg"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onChange([...streams, newIncomeStream("")])}
        className="flex items-center gap-1 text-xs font-semibold text-primary"
      >
        <Plus className="h-3.5 w-3.5" /> Add income stream
      </button>
    </div>
  );
}

function ExpenseGrowthSection({ growth, years, onChange }: { growth: BusinessSetupExpenseGrowth; years: number; onChange: (g: BusinessSetupExpenseGrowth) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="font-display text-base font-bold">Ongoing cost growth</p>
        <p className="mt-1 text-sm text-muted-foreground">Should your running costs increase over time, or do you want full control year by year?</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => onChange({ ...growth, mode: "flat" })} className={pillClass(growth.mode === "flat")}>Stay flat</button>
        <button type="button" onClick={() => onChange({ ...growth, mode: "rate" })} className={pillClass(growth.mode === "rate")}>Grow % per year</button>
        <button type="button" onClick={() => onChange({ ...growth, mode: "manual" })} className={pillClass(growth.mode === "manual")}>Enter manually per year</button>
      </div>
      {growth.mode === "rate" && (
        <div className="max-w-[180px] space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Growth rate</Label>
          <div className="relative">
            <Input
              type="number"
              value={growth.ratePercent}
              onChange={(e) => onChange({ ...growth, ratePercent: Number(e.target.value) || 0 })}
              className="h-9 rounded-lg pr-10"
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%/yr</span>
          </div>
        </div>
      )}
      {growth.mode === "manual" && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Array.from({ length: years }).map((_, i) => (
            <div key={i} className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Year {i + 1} total</Label>
              {moneyField(growth.manualByYear[i] ?? 0, (n) => {
                const next = [...growth.manualByYear];
                next[i] = n;
                onChange({ ...growth, manualByYear: next });
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectionSection({ setup }: { setup: BusinessSetup }) {
  const projection = useMemo(() => projectBusinessSetup(setup), [setup]);
  const [chartType, setChartType] = useState<"bar" | "area">("bar");
  const chartData = projection.years.map((y) => ({ name: `Y${y.year}`, Revenue: y.revenue, Costs: y.ongoingCosts + y.startupCosts, "Net profit": y.netProfit }));
  const lastYear = projection.years[projection.years.length - 1];

  const copySummary = async () => {
    const lines = [
      `${setup.name || "Business idea"} — ${setup.years}-year plan`,
      `Start-up cost: ${fmtGbp(projection.totalStartupCost)}`,
      projection.breakEvenYear ? `Break-even: Year ${projection.breakEvenYear}` : `No break-even within ${setup.years} years`,
      `Peak funding needed: ${fmtGbp(projection.peakFundingNeeded)}`,
      "",
      ...projection.years.map((y) => `Year ${y.year}: revenue ${fmtGbp(y.revenue)}, costs ${fmtGbp(y.ongoingCosts + y.startupCosts)}, tax ${fmtGbp(y.tax)}, net profit ${fmtGbp(y.netProfit)}, cumulative cash ${fmtGbp(y.cumulativeCash)}`),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success("Summary copied to clipboard");
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="font-display text-base font-bold">Projection</p>
        <p className="mt-1 text-sm text-muted-foreground">{setup.years}-year outlook based on your assumptions.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Start-up cost" value={fmtGbp(projection.totalStartupCost)} />
        <StatCard label="Break-even" value={projection.breakEvenYear ? `Year ${projection.breakEvenYear}` : `Not in ${setup.years}y`} tone={projection.breakEvenYear ? "good" : "warn"} />
        <StatCard label="Funding needed" value={fmtGbp(projection.peakFundingNeeded)} tone={projection.peakFundingNeeded > 0 ? "warn" : "good"} />
        <StatCard label={`Year ${setup.years} net profit`} value={fmtGbp(lastYear?.netProfit ?? 0)} tone={(lastYear?.netProfit ?? 0) >= 0 ? "good" : "bad"} />
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-3 shadow-card">
        <div className="mb-2 flex items-center justify-end gap-1.5">
          <button type="button" onClick={() => setChartType("bar")} className={`rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${chartType === "bar" ? "border-primary bg-primary text-white" : "border-border bg-muted text-muted-foreground"}`}>Bar</button>
          <button type="button" onClick={() => setChartType("area")} className={`rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${chartType === "area" ? "border-primary bg-primary text-white" : "border-border bg-muted text-muted-foreground"}`}>Area</button>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          {chartType === "bar" ? (
            <BarChart data={chartData} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v) => `£${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v: number) => fmtGbp(v)} />
              <Bar dataKey="Revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Costs" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Net profit" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v) => `£${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v: number) => fmtGbp(v)} />
              <Area type="monotone" dataKey="Revenue" stroke="#22c55e" fill="#22c55e33" />
              <Area type="monotone" dataKey="Costs" stroke="#ef4444" fill="#ef444433" />
              <Area type="monotone" dataKey="Net profit" stroke="#6366f1" fill="#6366f133" />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/50">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="p-2 text-left">Year</th>
              <th className="p-2 text-right">Revenue</th>
              <th className="p-2 text-right">Costs</th>
              <th className="p-2 text-right">Tax</th>
              <th className="p-2 text-right">Net profit</th>
              <th className="p-2 text-right">Cumulative cash</th>
            </tr>
          </thead>
          <tbody>
            {projection.years.map((y) => (
              <tr key={y.year} className={`border-t border-border/30 ${projection.breakEvenYear === y.year ? "bg-emerald-500/10" : ""}`}>
                <td className="p-2 font-semibold">Year {y.year}</td>
                <td className="p-2 text-right tabular-nums">{fmtGbp(y.revenue)}</td>
                <td className="p-2 text-right tabular-nums">{fmtGbp(y.ongoingCosts + y.startupCosts)}</td>
                <td className="p-2 text-right tabular-nums">{fmtGbp(y.tax)}</td>
                <td className={`p-2 text-right tabular-nums font-semibold ${y.netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmtGbp(y.netProfit)}</td>
                <td className={`p-2 text-right tabular-nums font-semibold ${y.cumulativeCash >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmtGbp(y.cumulativeCash)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button type="button" onClick={() => void copySummary()} className="flex items-center gap-1.5 text-xs font-semibold text-primary">
        <Copy className="h-3.5 w-3.5" /> Copy plan summary
      </button>
    </div>
  );
}

function CritiqueList({ title, items, tone }: { title: string; items: string[]; tone: "good" | "bad" | "neutral" }) {
  const dot = tone === "good" ? "bg-emerald-500" : tone === "bad" ? "bg-rose-500" : "bg-primary";
  return (
    <div className="rounded-xl border border-border/50 bg-card p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm leading-snug">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

const VERDICT_COLOR: Record<string, string> = {
  strong: "bg-emerald-500",
  promising: "bg-sky-500",
  risky: "bg-amber-500",
  needs_work: "bg-rose-500",
};

function AiCritiqueSection({ setup, onRun, running }: { setup: BusinessSetup; onRun: () => void; running: boolean }) {
  const critique = setup.aiCritique;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-display text-base font-bold">AI critique</p>
          <p className="mt-1 text-sm text-muted-foreground">An honest second opinion on your assumptions and cashflow risk.</p>
        </div>
        <Button onClick={onRun} disabled={running} className="h-9 shrink-0 rounded-xl bg-gradient-primary">
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          {running ? "Analysing…" : critique ? "Re-analyse" : "Analyse plan"}
        </Button>
      </div>
      {!critique && !running && (
        <p className="rounded-xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
          No analysis yet. This saves your plan first, then asks an AI model to critique it.
        </p>
      )}
      {critique && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white ${VERDICT_COLOR[critique.verdict] || "bg-muted-foreground"}`}>
              {critique.verdict.replace("_", " ")}
            </span>
            <span className="text-[10px] text-muted-foreground">{critique.model} · {new Date(critique.generatedAt).toLocaleString()}</span>
          </div>
          <p className="text-sm leading-relaxed">{critique.summary}</p>
          {critique.strengths.length > 0 && <CritiqueList title="Strengths" items={critique.strengths} tone="good" />}
          {critique.risks.length > 0 && <CritiqueList title="Risks" items={critique.risks} tone="bad" />}
          {critique.suggestions.length > 0 && <CritiqueList title="Suggestions" items={critique.suggestions} tone="neutral" />}
        </div>
      )}
    </div>
  );
}

export default function BusinessModellerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setups, loading, updateSetup } = useBusinessSetups();
  const saved = setups.find((s) => s.id === id);

  const [draft, setDraft] = useState<BusinessSetup | null>(null);
  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current && saved) {
      setDraft(saved);
      initialized.current = true;
    }
  }, [saved]);

  const [section, setSection] = useState<SectionId>("basics");
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const dirty = useMemo(() => {
    if (!draft || !saved) return false;
    return DIRTY_KEYS.some((key) => JSON.stringify(draft[key]) !== JSON.stringify(saved[key]));
  }, [draft, saved]);

  const save = async (): Promise<boolean> => {
    if (!draft || !id) return false;
    setSaving(true);
    try {
      await updateSetup(id, draft);
      return true;
    } catch {
      toast.error("Couldn't save changes. Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const runAnalysis = async () => {
    if (!draft || !id) return;
    setAnalyzing(true);
    try {
      const ok = await save();
      if (!ok) return;
      const projection = projectBusinessSetup(draft);
      const critique = await analyzeBusinessSetup({ setup: draft, projection });
      const aiCritique = { ...critique, generatedAt: Date.now() };
      setDraft((d) => (d ? { ...d, aiCritique } : d));
      await updateSetup(id, { aiCritique });
      toast.success("Analysis complete");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't analyse this plan.");
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading || (!draft && !initialized.current)) {
    return (
      <FeaturePageShell title="Business Setup Modeller" icon={<Rocket className="h-5 w-5" />}>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </FeaturePageShell>
    );
  }

  if (!draft) {
    return (
      <FeaturePageShell title="Business Setup Modeller" icon={<Rocket className="h-5 w-5" />}>
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground">This scenario couldn't be found.</p>
          <Button variant="outline" className="mt-3 rounded-xl" onClick={() => navigate("/companies/business-modeller")}>
            Back to Business Modeller
          </Button>
        </div>
      </FeaturePageShell>
    );
  }

  return (
    <FeaturePageShell
      title={draft.name || "Business idea"}
      subtitle="Business setup modeller"
      icon={<Rocket className="h-5 w-5" />}
      action={
        <Button
          className="h-9 rounded-xl bg-gradient-primary disabled:opacity-60"
          disabled={!dirty || saving}
          onClick={() => void save().then((ok) => ok && toast.success("Saved"))}
        >
          <Save className="mr-1.5 h-3.5 w-3.5" /> {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
        </Button>
      }
    >
      <div className="flex min-w-0 gap-3">
        <aside className="hidden w-[11rem] shrink-0 lg:block">
          <nav className="sticky top-2 space-y-1 rounded-2xl border border-border/50 bg-card p-1.5 shadow-card">
            {SECTIONS.map((item) => {
              const on = section === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`flex w-full items-center gap-2 rounded-xl border px-2 py-2 text-left text-xs font-semibold transition ${
                    on ? "border-primary/45 bg-primary/10 text-foreground" : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap gap-1.5 lg:hidden">
            {SECTIONS.map((item) => {
              const on = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${on ? "border-primary/45 bg-primary/10" : "border-border/50 bg-card text-muted-foreground"}`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-card">
            {section === "basics" && (
              <div className="space-y-4">
                <div>
                  <p className="font-display text-base font-bold">Basics</p>
                  <p className="mt-1 text-sm text-muted-foreground">Name the idea and choose how many years to model.</p>
                </div>
                <div className="space-y-1">
                  <Label>Business / idea name</Label>
                  <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="h-9 rounded-xl" />
                </div>
                <div className="space-y-1">
                  <Label>Description</Label>
                  <Textarea
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    placeholder="What's the idea? Who's it for?"
                    className="min-h-[80px] rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Years to model</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                      <button key={n} type="button" onClick={() => setDraft({ ...draft, years: n })} className={pillClass(draft.years === n)}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="max-w-[180px] space-y-1">
                  <Label>Tax rate</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={draft.taxRatePercent}
                      onChange={(e) => setDraft({ ...draft, taxRatePercent: Number(e.target.value) || 0 })}
                      className="h-9 rounded-lg pr-8"
                    />
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Applied to profit each year — defaults to UK corporation tax.</p>
                </div>
              </div>
            )}

            {section === "startup" && (
              <CostSection
                title="Start-up costs"
                hint="One-off costs to get the business running, applied in Year 1."
                totalLabel="Total start-up cost"
                items={draft.startupCosts}
                presets={STARTUP_COST_PRESETS}
                onChange={(startupCosts) => setDraft({ ...draft, startupCosts })}
              />
            )}

            {section === "ongoing" && (
              <CostSection
                title="Ongoing costs"
                hint="Running costs per year, before any growth assumptions are applied."
                totalLabel="Total ongoing cost (Year 1)"
                items={draft.ongoingCosts}
                presets={ONGOING_COST_PRESETS}
                onChange={(ongoingCosts) => setDraft({ ...draft, ongoingCosts })}
              />
            )}

            {section === "income" && (
              <IncomeStreamsSection streams={draft.incomeStreams} onChange={(incomeStreams) => setDraft({ ...draft, incomeStreams })} />
            )}

            {section === "growth" && (
              <ExpenseGrowthSection growth={draft.expenseGrowth} years={draft.years} onChange={(expenseGrowth) => setDraft({ ...draft, expenseGrowth })} />
            )}

            {section === "projection" && <ProjectionSection setup={draft} />}

            {section === "ai" && <AiCritiqueSection setup={draft} onRun={() => void runAnalysis()} running={analyzing} />}
          </div>
        </div>
      </div>
    </FeaturePageShell>
  );
}
