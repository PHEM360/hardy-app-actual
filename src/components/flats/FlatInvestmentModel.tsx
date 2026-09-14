import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calculator,
  LineChart,
  Loader2,
  Plus,
  Scale,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as ReLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useFlat } from "@/hooks/useFlats";
import { fmtGbp } from "@/lib/flatFinance";
import {
  addMonthsToKey,
  buildVerdict,
  currentMonthKey,
  defaultInvestmentInputs,
  formatMonthKey,
  inputsFromFlatDefaults,
  monthsBetweenKeys,
  parseMonthKey,
  runFlatInvestmentModel,
  STRATEGY_LABELS,
  type FlatInvestmentInputs,
  type FlatInvestmentOneOff,
  type FlatInvestmentStrategy,
  type FlatInvestmentVerdict,
} from "@/lib/flatInvestmentModel";
import type { FlatRecord } from "@/types/flats";

const ACCENT = "hsl(195,50%,45%)";

function tint(pct = 14) {
  return `color-mix(in srgb, ${ACCENT} ${pct}%, hsl(var(--card)))`;
}

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function monthsBetweenSafe(from: string, to: string): number {
  return monthsBetweenKeys(from || currentMonthKey(), to || currentMonthKey());
}

function Field({
  label,
  value,
  onChange,
  suffix,
  step = "1",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
  step?: string;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 rounded-xl pr-10"
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
  emphasise,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasise?: boolean;
}) {
  return (
    <div
      className="min-w-0 rounded-2xl border border-border/50 p-3 shadow-soft"
      style={{ background: tint(emphasise ? 18 : 12) }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display font-bold text-foreground ${emphasise ? "text-xl" : "text-lg"}`}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Section({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card"
      style={{ borderLeft: `4px solid ${ACCENT}` }}
    >
      <div
        className="flex items-center justify-between gap-2 border-b border-border/40 px-4 py-3"
        style={{ background: tint(10) }}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
            style={{ background: `linear-gradient(135deg,hsl(195,53%,48%),hsl(205,48%,42%))` }}
          >
            {icon}
          </span>
          <h2 className="truncate font-display text-sm font-bold text-foreground">{title}</h2>
        </div>
        {action}
      </div>
      <div className="min-w-0 p-4">{children}</div>
    </section>
  );
}

function MonthYearField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const parsed = parseMonthKey(value) || parseMonthKey(currentMonthKey())!;
  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="grid grid-cols-[minmax(0,1fr)_5.25rem] gap-2">
        <select
          value={parsed.m}
          onChange={(e) => onChange(`${parsed.y}-${String(Number(e.target.value)).padStart(2, "0")}`)}
          className="h-10 min-w-0 rounded-xl border border-input bg-background px-3 text-sm"
        >
          {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((name, index) => (
            <option key={name} value={index + 1}>{name}</option>
          ))}
        </select>
        <Input
          type="number"
          value={parsed.y}
          onChange={(e) => {
            const y = Math.max(2000, Math.round(Number(e.target.value) || parsed.y));
            onChange(`${y}-${String(parsed.m).padStart(2, "0")}`);
          }}
          className="h-10 rounded-xl"
        />
      </div>
    </div>
  );
}

function inputsToForm(inputs: FlatInvestmentInputs) {
  const duration = inputs.rentalDurationMonths ?? inputs.horizonYears * 12;
  const voidTotal = inputs.voidMonthsTotal ?? inputs.voidMonthsPerYear * (duration / 12);
  return {
    marketValueGbp: String(inputs.marketValueGbp),
    offerPriceGbp: String(inputs.offerPriceGbp),
    mortgageBalanceGbp: String(inputs.mortgageBalanceGbp),
    rentMonthlyGbp: String(inputs.rentMonthlyGbp),
    voidMonthsTotal: String(voidTotal),
    asOfMonth: inputs.asOfMonth || currentMonthKey(),
    saleCompletionMonth: inputs.saleCompletionMonth || inputs.asOfMonth || currentMonthKey(),
    rentalStartMonth: inputs.rentalStartMonth || inputs.asOfMonth || currentMonthKey(),
    rentalDurationYears: String(Math.max(1, Math.round((duration / 12) * 10) / 10)),
    serviceChargeAnnualGbp: String(inputs.serviceChargeAnnualGbp),
    maintenanceAnnualGbp: String(inputs.maintenanceAnnualGbp),
    insuranceAnnualGbp: String(inputs.insuranceAnnualGbp),
    groundRentAnnualGbp: String(inputs.groundRentAnnualGbp),
    lettingFeesPctOfRent: String(inputs.lettingFeesPctOfRent),
    otherAnnualCostsGbp: String(inputs.otherAnnualCostsGbp),
    mortgageInterestAnnualGbp: String(inputs.mortgageInterestAnnualGbp),
    councilTaxAnnualGbp: String(inputs.councilTaxAnnualGbp),
    councilTaxSecondHomeEnabled: parseMonthKey(inputs.councilTaxSecondHomeFromMonth) ? "yes" : "",
    councilTaxSecondHomeFromMonth: inputs.councilTaxSecondHomeFromMonth || inputs.asOfMonth || currentMonthKey(),
    councilTaxSecondHomeAnnualGbp: String(
      inputs.councilTaxSecondHomeAnnualGbp && inputs.councilTaxSecondHomeAnnualGbp > 0
        ? inputs.councilTaxSecondHomeAnnualGbp
        : Math.max(0, inputs.councilTaxAnnualGbp) * 2 || 0,
    ),
    sellingCostsPct: String(inputs.sellingCostsPct),
    sellingFixedGbp: String(inputs.sellingFixedGbp),
    capitalGrowthPctPa: String(inputs.capitalGrowthPctPa),
    rentGrowthPctPa: String(inputs.rentGrowthPctPa),
    costGrowthPctPa: String(inputs.costGrowthPctPa),
    alternativeReturnPctPa: String(inputs.alternativeReturnPctPa),
    incomeTaxRatePct: String(inputs.incomeTaxRatePct),
    financeCostReliefPct: String(inputs.financeCostReliefPct),
    horizonYears: String(inputs.horizonYears),
  };
}

type FormState = ReturnType<typeof inputsToForm>;

function formToInputs(form: FormState, oneOffs: FlatInvestmentOneOff[]): FlatInvestmentInputs {
  const horizonYears = num(form.horizonYears);
  const rentalDurationMonths = Math.max(1, Math.round(num(form.rentalDurationYears) * 12) || horizonYears * 12);
  const voidMonthsTotal = num(form.voidMonthsTotal);
  return defaultInvestmentInputs({
    marketValueGbp: num(form.marketValueGbp),
    offerPriceGbp: num(form.offerPriceGbp),
    mortgageBalanceGbp: num(form.mortgageBalanceGbp),
    rentMonthlyGbp: num(form.rentMonthlyGbp),
    voidMonthsPerYear: rentalDurationMonths > 0 ? (voidMonthsTotal * 12) / rentalDurationMonths : 0,
    voidMonthsTotal,
    asOfMonth: form.asOfMonth,
    saleCompletionMonth: form.saleCompletionMonth,
    rentalStartMonth: form.rentalStartMonth,
    rentalDurationMonths,
    serviceChargeAnnualGbp: num(form.serviceChargeAnnualGbp),
    maintenanceAnnualGbp: num(form.maintenanceAnnualGbp),
    insuranceAnnualGbp: num(form.insuranceAnnualGbp),
    groundRentAnnualGbp: num(form.groundRentAnnualGbp),
    lettingFeesPctOfRent: num(form.lettingFeesPctOfRent),
    otherAnnualCostsGbp: num(form.otherAnnualCostsGbp),
    mortgageInterestAnnualGbp: num(form.mortgageInterestAnnualGbp),
    councilTaxAnnualGbp: num(form.councilTaxAnnualGbp),
    councilTaxSecondHomeFromMonth: form.councilTaxSecondHomeEnabled === "yes" ? form.councilTaxSecondHomeFromMonth : "",
    councilTaxSecondHomeAnnualGbp:
      form.councilTaxSecondHomeEnabled === "yes" ? num(form.councilTaxSecondHomeAnnualGbp) : 0,
    sellingCostsPct: num(form.sellingCostsPct),
    sellingFixedGbp: num(form.sellingFixedGbp),
    capitalGrowthPctPa: num(form.capitalGrowthPctPa),
    rentGrowthPctPa: num(form.rentGrowthPctPa),
    costGrowthPctPa: num(form.costGrowthPctPa),
    alternativeReturnPctPa: num(form.alternativeReturnPctPa),
    incomeTaxRatePct: num(form.incomeTaxRatePct),
    financeCostReliefPct: num(form.financeCostReliefPct),
    horizonYears,
    oneOffs,
  });
}

function WealthTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-2.5 shadow-elevated">
      <p className="mb-1 text-xs text-muted-foreground">Year {label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-xs font-semibold" style={{ color: p.color }}>
          {p.name}: {fmtGbp(p.value)}
        </p>
      ))}
    </div>
  );
}

export default function FlatInvestmentModelPanel({
  flats,
  initialFlatId,
  localOnly = false,
}: {
  flats: FlatRecord[];
  initialFlatId?: string;
  /** Skip Firestore — keep inputs in memory (dev preview). */
  localOnly?: boolean;
}) {
  const [flatId, setFlatId] = useState(initialFlatId || flats[0]?.id || "");
  const live = useFlat(localOnly ? null : flatId || null);
  const [localFlats, setLocalFlats] = useState(flats);
  const flat = localOnly
    ? localFlats.find((f) => f.id === flatId) || localFlats[0] || null
    : live.flat;
  const loading = localOnly ? false : live.loading;
  const saveFlat = localOnly
    ? async (patch: Partial<FlatRecord>) => {
        setLocalFlats((prev) =>
          prev.map((f) => (f.id === flatId ? { ...f, ...patch } : f)),
        );
      }
    : live.saveFlat;
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<FormState>(() => inputsToForm(defaultInvestmentInputs()));
  const [oneOffs, setOneOffs] = useState<FlatInvestmentOneOff[]>([]);
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);
  // Unsaved edits per flat, so switching the flat dropdown and back doesn't
  // discard whatever you were mid-way through typing for the flat you left.
  const draftsRef = useRef<Map<string, { form: FormState; oneOffs: FlatInvestmentOneOff[] }>>(new Map());
  const currentDraftRef = useRef<{ form: FormState; oneOffs: FlatInvestmentOneOff[] }>({ form, oneOffs });
  useEffect(() => {
    currentDraftRef.current = { form, oneOffs };
  }, [form, oneOffs]);

  useEffect(() => {
    if (localOnly) setLocalFlats(flats);
  }, [flats, localOnly]);

  useEffect(() => {
    if (initialFlatId && initialFlatId !== flatId) {
      setHydratedFor(null);
      setFlatId(initialFlatId);
    }
  }, [initialFlatId]); // eslint-disable-line react-hooks/exhaustive-deps -- only re-seed when parent flat changes

  useEffect(() => {
    if (!flatId && flats[0]?.id) setFlatId(flats[0].id);
  }, [flats, flatId]);

  useEffect(() => {
    if (!flat || flat.id !== flatId) return;
    if (hydratedFor === flat.id) return;
    if (hydratedFor) draftsRef.current.set(hydratedFor, currentDraftRef.current);
    const cached = draftsRef.current.get(flat.id);
    if (cached) {
      setForm(cached.form);
      setOneOffs(cached.oneOffs);
    } else {
      const seeded = defaultInvestmentInputs(inputsFromFlatDefaults(flat));
      setForm(inputsToForm(seeded));
      setOneOffs(seeded.oneOffs || []);
    }
    setHydratedFor(flat.id);
  }, [flat, flatId, hydratedFor]);

  const setField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const inputs = useMemo(() => formToInputs(form, oneOffs), [form, oneOffs]);
  // The toggle only changes what's *displayed* — saving always persists the
  // real inputs (including one-offs) below in saveModel().
  const [includeOneOffs, setIncludeOneOffs] = useState(true);
  const effectiveInputs = useMemo(
    () => (includeOneOffs ? inputs : { ...inputs, oneOffs: [] }),
    [inputs, includeOneOffs],
  );
  const result = useMemo(() => runFlatInvestmentModel(effectiveInputs), [effectiveInputs]);

  // One selected year drives both the verdict and the highlighted table row,
  // so year 1 in the box always matches year 1 in the table.
  const [compareYear, setCompareYear] = useState(result.inputs.horizonYears);
  const yearByYearRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCompareYear((prev) => Math.min(result.inputs.horizonYears, Math.max(1, prev || result.inputs.horizonYears)));
  }, [result.inputs.horizonYears]);

  const clampedYear = Math.min(result.years.length, Math.max(1, Math.round(compareYear) || 1));
  const selectedRow = result.years[clampedYear - 1] || result.years[result.years.length - 1];
  const verdict: FlatInvestmentVerdict = useMemo(
    () => buildVerdict(selectedRow, clampedYear, result.inputs),
    [selectedRow, clampedYear, result.inputs],
  );
  const verdictYearsLabel = clampedYear;

  const chartData = useMemo(
    () =>
      result.years.map((y) => ({
        year: y.year,
        "Sell at offer": Math.round(y.sellOfferWealthGbp),
        "Sell at market": Math.round(y.sellMarketWealthGbp),
        "Hold vacant": Math.round(y.holdVacantWealthGbp),
        "Rent out": Math.round(y.rentWealthGbp),
      })),
    [result.years],
  );

  const saveModel = async () => {
    if (!flatId) return;
    setBusy(true);
    try {
      await saveFlat({ investmentModel: inputs });
      toast.success("Investment model saved for this flat");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save model");
    } finally {
      setBusy(false);
    }
  };

  const addOneOff = () => {
    setOneOffs((prev) => [
      ...prev,
      {
        id: `oo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        label: "One-off cost",
        amountGbp: 0,
        year: 0,
        monthKey: form.rentalStartMonth || form.asOfMonth || currentMonthKey(),
      },
    ]);
  };

  const strategyTone = (s: FlatInvestmentStrategy) =>
    verdict.recommendation === s
      ? "border-primary/45 bg-primary/10"
      : "border-border/50 bg-card";

  const pill = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
    }`;

  if (!flats.length) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card p-8 text-center shadow-card">
        <p className="text-sm text-muted-foreground">Add a flat first to run the investment model.</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="rounded-2xl border border-border/60 bg-card p-4 shadow-card"
        style={{ borderLeft: `4px solid ${ACCENT}`, background: tint(10) }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Investment model
            </p>
            <h2 className="font-display text-lg font-bold text-foreground">Sell, hold, or rent?</h2>
            <p className="max-w-xl text-sm text-muted-foreground">
              Set when a sale would complete and when a let would start. The model waits through empty months,
              then compares invested sale proceeds with renting — including voids and one-off costs.
            </p>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="min-w-[10rem] flex-1 space-y-1.5 sm:flex-none">
              <Label className="text-xs">Flat</Label>
              <select
                value={flatId}
                onChange={(e) => {
                  setHydratedFor(null);
                  setFlatId(e.target.value);
                }}
                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                {(localOnly ? localFlats : flats).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              size="sm"
              className="h-10 rounded-xl bg-gradient-primary px-4 text-xs"
              disabled={busy || loading}
              onClick={() => void saveModel()}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save inputs"}
            </Button>
          </div>
        </div>
      </motion.div>

      {loading && !flat ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading flat…</div>
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
          >
            <Section title="Verdict" icon={<Scale className="h-4 w-4" />}>
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Compare after</span>
                <input
                  type="range"
                  min={1}
                  max={result.years.length}
                  value={clampedYear}
                  onChange={(e) => setCompareYear(Number(e.target.value) || 1)}
                  className="h-8 w-32 accent-primary"
                  aria-label="Compare year"
                />
                <input
                  type="number"
                  min={1}
                  max={result.years.length}
                  value={clampedYear}
                  onChange={(e) => setCompareYear(Number(e.target.value) || 1)}
                  className="h-8 w-16 rounded-lg border border-input bg-background px-2 text-xs"
                  aria-label="Compare year"
                />
                <span className="text-xs font-semibold text-foreground">
                  year{clampedYear === 1 ? "" : "s"}
                </span>
                <button type="button" className={pill(clampedYear === result.inputs.horizonYears)} onClick={() => setCompareYear(result.inputs.horizonYears)}>
                  Full horizon ({result.inputs.horizonYears})
                </button>
                <button
                  type="button"
                  className={pill(false)}
                  onClick={() => yearByYearRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                >
                  Year-by-year ↓
                </button>
                <label className="ml-auto flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  Include one-off costs
                  <Switch checked={includeOneOffs} onCheckedChange={setIncludeOneOffs} />
                </label>
              </div>
              {!includeOneOffs && oneOffs.length > 0 && (
                <p className="mb-2 text-[11px] text-muted-foreground">
                  Showing figures with one-off costs excluded, for comparison — toggle back on to include them.
                </p>
              )}
              <div className="mb-3 rounded-2xl border border-primary/35 bg-primary/10 px-4 py-3">
                <p className="font-display text-base font-bold text-foreground">
                  Best actionable path at {verdictYearsLabel} years: {verdict.recommendationLabel}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{verdict.recommendationDetail}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Figures are total wealth after {verdictYearsLabel} year{verdictYearsLabel === 1 ? "" : "s"} from {formatMonthKey(result.timing.asOfMonth)}.
                  Sell paths invest cash after a sale completing {formatMonthKey(result.timing.saleCompletionMonth)}.
                  Rent runs from {formatMonthKey(result.timing.rentalStartMonth)} for {result.timing.rentalDurationMonths} months
                  ({result.timing.voidMonthsTotal.toFixed(result.timing.voidMonthsTotal % 1 ? 1 : 0)} void), and still counts the flat’s value at the end.
                  {clampedYear === 1 && (
                    <> This year’s leftover rent is {fmtGbp(selectedRow.netRentCashGbp)}.</>
                  )}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {(Object.keys(STRATEGY_LABELS) as FlatInvestmentStrategy[]).map((s) => (
                  <div
                    key={s}
                    className={`min-w-0 rounded-2xl border p-3 shadow-soft ${strategyTone(s)}`}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {STRATEGY_LABELS[s]}
                      {s === "sell_market" ? " (if achievable)" : ""}
                    </p>
                    <p className="mt-1 font-display text-lg font-bold text-foreground">
                      {fmtGbp(verdict.wealthAtHorizon[s])}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">wealth in {verdictYearsLabel} yrs</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile
                  label="Difference (rent − offer)"
                  value={fmtGbp(verdict.differencesAtHorizon.rentMinusOfferGbp)}
                  hint={`After ${verdictYearsLabel} years from ${formatMonthKey(result.timing.asOfMonth)}`}
                  emphasise
                />
                <StatTile
                  label="Break-even sale price"
                  value={fmtGbp(result.breakEvenSalePriceGbp)}
                  hint={`Sale completing ${formatMonthKey(result.timing.saleCompletionMonth)} to match renting`}
                  emphasise
                />
                <StatTile
                  label="Break-even monthly rent"
                  value={fmtGbp(result.breakEvenMonthlyRentGbp)}
                  hint={`Let from ${formatMonthKey(result.timing.rentalStartMonth)} to match the offer`}
                />
                <StatTile
                  label="Break-even return"
                  value={result.breakEvenAltReturnPctPa == null ? "Over 40%" : `${result.breakEvenAltReturnPctPa.toFixed(1)}%`}
                  hint={`Needed on the ${formatMonthKey(result.timing.saleCompletionMonth)} sale to match renting`}
                />
              </div>
              <div className="mt-3 space-y-2 rounded-2xl border border-border/50 bg-card p-3 text-xs leading-relaxed text-muted-foreground">
                <p>{result.breakEvenSaleHint}</p>
                <p>{result.breakEvenRentHint}</p>
                <p>{result.breakEvenReturnHint}</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatTile label="Net offer proceeds" value={fmtGbp(result.netOfferProceedsGbp)} hint={`Cash from the offer in ${formatMonthKey(result.timing.saleCompletionMonth)}, before investing`} />
                <StatTile label="Net market proceeds" value={fmtGbp(result.netMarketProceedsGbp)} hint="What full market value would net" />
                <StatTile
                  label="Years until rent beats offer"
                  value={
                    result.yearsUntilRentBeatsOffer != null
                      ? `${result.yearsUntilRentBeatsOffer} yr`
                      : "Not within horizon"
                  }
                />
                <StatTile
                  label="Year-1 net rent (after tax)"
                  value={fmtGbp(result.annualNetRentAfterTaxYear0Gbp)}
                />
              </div>
            </Section>
          </motion.div>

          <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            <Section title="Values & sale" icon={<TrendingUp className="h-4 w-4" />}>
              <div className="grid grid-cols-2 gap-3">
                <MonthYearField
                  label="Compare from"
                  value={form.asOfMonth}
                  onChange={(v) => setField("asOfMonth", v)}
                />
                <MonthYearField
                  label="Sale completes"
                  value={form.saleCompletionMonth}
                  onChange={(v) => setField("saleCompletionMonth", v)}
                />
                <Field
                  label="Market value"
                  value={form.marketValueGbp}
                  onChange={(v) => setField("marketValueGbp", v)}
                  suffix="£"
                />
                <Field
                  label="Offer / sale price"
                  value={form.offerPriceGbp}
                  onChange={(v) => setField("offerPriceGbp", v)}
                  suffix="£"
                />
                <Field
                  label="Mortgage balance"
                  value={form.mortgageBalanceGbp}
                  onChange={(v) => setField("mortgageBalanceGbp", v)}
                  suffix="£"
                />
                <Field
                  label="Mortgage interest / yr"
                  value={form.mortgageInterestAnnualGbp}
                  onChange={(v) => setField("mortgageInterestAnnualGbp", v)}
                  suffix="£"
                />
                <Field
                  label="Selling costs"
                  value={form.sellingCostsPct}
                  onChange={(v) => setField("sellingCostsPct", v)}
                  suffix="%"
                  step="0.1"
                />
                <Field
                  label="Selling fixed costs"
                  value={form.sellingFixedGbp}
                  onChange={(v) => setField("sellingFixedGbp", v)}
                  suffix="£"
                />
              </div>
              <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
                Empty months before completion still cost service charge, insurance and council tax. Proceeds then earn the alternative return until the horizon.
              </p>
            </Section>

            <Section title="Rent & running costs" icon={<Calculator className="h-4 w-4" />}>
              <div className="grid grid-cols-2 gap-3">
                <MonthYearField
                  label="Rent from"
                  value={form.rentalStartMonth}
                  onChange={(v) => setField("rentalStartMonth", v)}
                />
                <Field
                  label="Rent for"
                  value={form.rentalDurationYears}
                  onChange={(v) => setField("rentalDurationYears", v)}
                  suffix="yrs"
                  step="0.5"
                />
                <Field
                  label="Monthly rent"
                  value={form.rentMonthlyGbp}
                  onChange={(v) => setField("rentMonthlyGbp", v)}
                  suffix="£"
                />
                <Field
                  label="Void months in that period"
                  value={form.voidMonthsTotal}
                  onChange={(v) => setField("voidMonthsTotal", v)}
                  step="0.25"
                />
                <Field
                  label="Service charge / yr"
                  value={form.serviceChargeAnnualGbp}
                  onChange={(v) => setField("serviceChargeAnnualGbp", v)}
                  suffix="£"
                />
                <Field
                  label="Maintenance / yr"
                  value={form.maintenanceAnnualGbp}
                  onChange={(v) => setField("maintenanceAnnualGbp", v)}
                  suffix="£"
                />
                <Field
                  label="Insurance / yr"
                  value={form.insuranceAnnualGbp}
                  onChange={(v) => setField("insuranceAnnualGbp", v)}
                  suffix="£"
                />
                <Field
                  label="Ground rent / yr"
                  value={form.groundRentAnnualGbp}
                  onChange={(v) => setField("groundRentAnnualGbp", v)}
                  suffix="£"
                />
                <Field
                  label="Letting fees"
                  value={form.lettingFeesPctOfRent}
                  onChange={(v) => setField("lettingFeesPctOfRent", v)}
                  suffix="% rent"
                  step="0.5"
                />
                <Field
                  label="Other costs / yr"
                  value={form.otherAnnualCostsGbp}
                  onChange={(v) => setField("otherAnnualCostsGbp", v)}
                  suffix="£"
                />
                <Field
                  label="Council tax while empty"
                  value={form.councilTaxAnnualGbp}
                  onChange={(v) => {
                    setField("councilTaxAnnualGbp", v);
                    if (form.councilTaxSecondHomeEnabled !== "yes") {
                      setField("councilTaxSecondHomeAnnualGbp", String(num(v) * 2));
                    }
                  }}
                  suffix="£/yr"
                />
              </div>
              <div
                className="mt-3 rounded-xl border border-border/50 p-3"
                style={{ background: "color-mix(in srgb, hsl(var(--primary)) 8%, hsl(var(--card)))" }}
              >
                <label className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-foreground">Second-home / empty-home rate</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                      You only pay council tax while the flat is empty. Occupied months are the tenant’s bill. Turn this on if empty months after a date are charged a higher rate (often double).
                    </span>
                  </span>
                  <Switch
                    checked={form.councilTaxSecondHomeEnabled === "yes"}
                    onCheckedChange={(on) => {
                      setField("councilTaxSecondHomeEnabled", on ? "yes" : "");
                      if (on && !num(form.councilTaxSecondHomeAnnualGbp)) {
                        setField("councilTaxSecondHomeAnnualGbp", String(num(form.councilTaxAnnualGbp) * 2));
                      }
                    }}
                  />
                </label>
                {form.councilTaxSecondHomeEnabled === "yes" && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <MonthYearField
                      label="Higher rate from"
                      value={form.councilTaxSecondHomeFromMonth}
                      onChange={(v) => setField("councilTaxSecondHomeFromMonth", v)}
                    />
                    <Field
                      label="Council tax from then"
                      value={form.councilTaxSecondHomeAnnualGbp}
                      onChange={(v) => setField("councilTaxSecondHomeAnnualGbp", v)}
                      suffix="£/yr"
                    />
                  </div>
                )}
              </div>
              <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
                The flat is empty from “Compare from” until “Rent from”. Void months are extra empty months inside the tenancy, not that wait.
                {result.timing.rentStartIndex + result.timing.rentalDurationMonths > result.timing.horizonMonths ? (
                  <> Raise the horizon if you want the whole tenancy inside the comparison.</>
                ) : null}
                {result.timing.saleMonthIndex >= result.timing.horizonMonths - 1 &&
                monthsBetweenKeys(result.timing.asOfMonth, form.saleCompletionMonth) >= result.timing.horizonMonths ? (
                  <> The sale sits on or after the comparison date — move completion earlier or raise the horizon.</>
                ) : null}
              </p>
            </Section>
          </div>

          <Section
            title="One-off costs"
            icon={<Plus className="h-4 w-4" />}
            action={
              <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs" onClick={addOneOff}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add
              </Button>
            }
          >
            {oneOffs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add doing-up, major works, lease extensions, or other one-offs and the month they fall in.
              </p>
            ) : (
              <div className="space-y-2">
                {oneOffs.map((o) => (
                  <div
                    key={o.id}
                    className="grid min-w-0 grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_minmax(11rem,12rem)_2.5rem]"
                  >
                    <div className="min-w-0 space-y-1.5">
                      <Label className="text-xs">Label</Label>
                      <Input
                        value={o.label}
                        onChange={(e) =>
                          setOneOffs((prev) =>
                            prev.map((x) => (x.id === o.id ? { ...x, label: e.target.value } : x)),
                          )
                        }
                        className="h-10 rounded-xl"
                        placeholder="Doing up, major works…"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Amount £</Label>
                      <Input
                        type="number"
                        value={o.amountGbp || ""}
                        onChange={(e) =>
                          setOneOffs((prev) =>
                            prev.map((x) =>
                              x.id === o.id ? { ...x, amountGbp: num(e.target.value) } : x,
                            ),
                          )
                        }
                        className="h-10 rounded-xl"
                      />
                    </div>
                    <MonthYearField
                      label="When"
                      value={o.monthKey || addMonthsToKey(form.asOfMonth || currentMonthKey(), (o.year || 0) * 12)}
                      onChange={(v) =>
                        setOneOffs((prev) =>
                          prev.map((x) =>
                            x.id === o.id
                              ? {
                                  ...x,
                                  monthKey: v,
                                  year: Math.max(0, Math.floor(Math.max(0, monthsBetweenSafe(form.asOfMonth, v)) / 12)),
                                }
                              : x,
                          ),
                        )
                      }
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-10 w-10 rounded-xl text-muted-foreground"
                      onClick={() => setOneOffs((prev) => prev.filter((x) => x.id !== o.id))}
                      aria-label="Remove one-off"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Assumptions" icon={<LineChart className="h-4 w-4" />}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <Field
                label="Horizon"
                value={form.horizonYears}
                onChange={(v) => setField("horizonYears", v)}
                suffix="yrs"
              />
              <Field
                label="Capital growth"
                value={form.capitalGrowthPctPa}
                onChange={(v) => setField("capitalGrowthPctPa", v)}
                suffix="%/yr"
                step="0.1"
              />
              <Field
                label="Rent growth"
                value={form.rentGrowthPctPa}
                onChange={(v) => setField("rentGrowthPctPa", v)}
                suffix="%/yr"
                step="0.1"
              />
              <Field
                label="Cost inflation"
                value={form.costGrowthPctPa}
                onChange={(v) => setField("costGrowthPctPa", v)}
                suffix="%/yr"
                step="0.1"
              />
              <Field
                label="Alt. return on cash"
                value={form.alternativeReturnPctPa}
                onChange={(v) => setField("alternativeReturnPctPa", v)}
                suffix="%/yr"
                step="0.1"
              />
              <Field
                label="Income tax rate"
                value={form.incomeTaxRatePct}
                onChange={(v) => setField("incomeTaxRatePct", v)}
                suffix="%"
              />
              <Field
                label="Finance-cost relief"
                value={form.financeCostReliefPct}
                onChange={(v) => setField("financeCostReliefPct", v)}
                suffix="%"
              />
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Comparison runs from the start month for the horizon. A sale waits until completion, pays empty-flat costs until then, then invests net proceeds. Rent waits until the start month, then lets for the chosen length with voids and one-offs. Both paths still count the flat’s sale value at the horizon if you still own it. Tax is a simplified personal-landlord model. Not advice.
            </p>
          </Section>

          <Section title="Wealth over time" icon={<LineChart className="h-4 w-4" />}>
            <div className="h-64 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <ReLineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.6} />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `£${Math.round(v / 1000)}k`}
                    width={48}
                  />
                  <Tooltip content={<WealthTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="Sell at offer" stroke="hsl(15,55%,48%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Sell at market" stroke="hsl(35,60%,45%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Hold vacant" stroke="hsl(220,12%,55%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Rent out" stroke={ACCENT} strokeWidth={2.5} dot={false} />
                </ReLineChart>
              </ResponsiveContainer>
            </div>
          </Section>

          <div ref={yearByYearRef} />
          <Section title="Year-by-year" icon={<Calculator className="h-4 w-4" />}>
            <p className="mb-2 text-[11px] text-muted-foreground">
              Tap a year to show that same year in the verdict. “Net rent” is leftover cash that year. The four wealth columns are the same totals as the verdict cards.
            </p>
            <div className="min-w-0 overflow-x-auto">
              <table className="w-full min-w-[48rem] text-left text-xs">
                <thead>
                  <tr className="border-b border-border/50 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-2 font-semibold">Yr</th>
                    <th className="py-2 pr-2 font-semibold">Value</th>
                    <th className="py-2 pr-2 font-semibold">Net rent</th>
                    <th className="py-2 pr-2 font-semibold">Sell offer</th>
                    <th className="py-2 pr-2 font-semibold">Sell market</th>
                    <th className="py-2 pr-2 font-semibold">Vacant</th>
                    <th className="py-2 pr-2 font-semibold">Rent path</th>
                    <th className="py-2 font-semibold">vs offer</th>
                  </tr>
                </thead>
                <tbody>
                  {result.years.map((y) => {
                    const active = y.year === clampedYear;
                    return (
                      <tr
                        key={y.year}
                        className={`cursor-pointer border-b border-border/30 ${active ? "bg-primary/10" : "hover:bg-muted/40"}`}
                        onClick={() => setCompareYear(y.year)}
                      >
                        <td className="py-2 pr-2 font-semibold text-foreground">{y.year}</td>
                        <td className="py-2 pr-2 text-foreground">{fmtGbp(y.propertyValueGbp)}</td>
                        <td className="py-2 pr-2 text-foreground">{fmtGbp(y.netRentCashGbp)}</td>
                        <td className="py-2 pr-2 text-foreground">{fmtGbp(y.sellOfferWealthGbp)}</td>
                        <td className="py-2 pr-2 text-foreground">{fmtGbp(y.sellMarketWealthGbp)}</td>
                        <td className="py-2 pr-2 text-foreground">{fmtGbp(y.holdVacantWealthGbp)}</td>
                        <td className="py-2 pr-2 font-semibold text-foreground">{fmtGbp(y.rentWealthGbp)}</td>
                        <td
                          className={`py-2 font-semibold ${
                            y.rentVsOfferGbp >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
                          }`}
                        >
                          {y.rentVsOfferGbp >= 0 ? "+" : ""}
                          {fmtGbp(y.rentVsOfferGbp)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
