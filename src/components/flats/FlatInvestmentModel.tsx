import { useEffect, useMemo, useState } from "react";
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
import { useFlat } from "@/hooks/useFlats";
import { fmtGbp } from "@/lib/flatFinance";
import {
  defaultInvestmentInputs,
  inputsFromFlatDefaults,
  runFlatInvestmentModel,
  STRATEGY_LABELS,
  type FlatInvestmentInputs,
  type FlatInvestmentOneOff,
  type FlatInvestmentStrategy,
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

function inputsToForm(inputs: FlatInvestmentInputs) {
  return {
    marketValueGbp: String(inputs.marketValueGbp),
    offerPriceGbp: String(inputs.offerPriceGbp),
    mortgageBalanceGbp: String(inputs.mortgageBalanceGbp),
    rentMonthlyGbp: String(inputs.rentMonthlyGbp),
    voidMonthsPerYear: String(inputs.voidMonthsPerYear),
    serviceChargeAnnualGbp: String(inputs.serviceChargeAnnualGbp),
    maintenanceAnnualGbp: String(inputs.maintenanceAnnualGbp),
    insuranceAnnualGbp: String(inputs.insuranceAnnualGbp),
    groundRentAnnualGbp: String(inputs.groundRentAnnualGbp),
    lettingFeesPctOfRent: String(inputs.lettingFeesPctOfRent),
    otherAnnualCostsGbp: String(inputs.otherAnnualCostsGbp),
    mortgageInterestAnnualGbp: String(inputs.mortgageInterestAnnualGbp),
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
  return defaultInvestmentInputs({
    marketValueGbp: num(form.marketValueGbp),
    offerPriceGbp: num(form.offerPriceGbp),
    mortgageBalanceGbp: num(form.mortgageBalanceGbp),
    rentMonthlyGbp: num(form.rentMonthlyGbp),
    voidMonthsPerYear: num(form.voidMonthsPerYear),
    serviceChargeAnnualGbp: num(form.serviceChargeAnnualGbp),
    maintenanceAnnualGbp: num(form.maintenanceAnnualGbp),
    insuranceAnnualGbp: num(form.insuranceAnnualGbp),
    groundRentAnnualGbp: num(form.groundRentAnnualGbp),
    lettingFeesPctOfRent: num(form.lettingFeesPctOfRent),
    otherAnnualCostsGbp: num(form.otherAnnualCostsGbp),
    mortgageInterestAnnualGbp: num(form.mortgageInterestAnnualGbp),
    sellingCostsPct: num(form.sellingCostsPct),
    sellingFixedGbp: num(form.sellingFixedGbp),
    capitalGrowthPctPa: num(form.capitalGrowthPctPa),
    rentGrowthPctPa: num(form.rentGrowthPctPa),
    costGrowthPctPa: num(form.costGrowthPctPa),
    alternativeReturnPctPa: num(form.alternativeReturnPctPa),
    incomeTaxRatePct: num(form.incomeTaxRatePct),
    financeCostReliefPct: num(form.financeCostReliefPct),
    horizonYears: num(form.horizonYears),
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
}: {
  flats: FlatRecord[];
  initialFlatId?: string;
}) {
  const [flatId, setFlatId] = useState(initialFlatId || flats[0]?.id || "");
  const { flat, loading, saveFlat } = useFlat(flatId || null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<FormState>(() => inputsToForm(defaultInvestmentInputs()));
  const [oneOffs, setOneOffs] = useState<FlatInvestmentOneOff[]>([]);
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);

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
    const seeded = defaultInvestmentInputs(inputsFromFlatDefaults(flat));
    setForm(inputsToForm(seeded));
    setOneOffs(seeded.oneOffs || []);
    setHydratedFor(flat.id);
  }, [flat, flatId, hydratedFor]);

  const setField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const inputs = useMemo(() => formToInputs(form, oneOffs), [form, oneOffs]);
  const result = useMemo(() => runFlatInvestmentModel(inputs), [inputs]);

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
      },
    ]);
  };

  const strategyTone = (s: FlatInvestmentStrategy) =>
    result.recommendation === s
      ? "border-primary/45 bg-primary/10"
      : "border-border/50 bg-card";

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
              Treat the flat as a to-let investment. Compare taking an offer, waiting for market value,
              holding vacant, or letting — with break-even sale price and years to win.
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
                {flats.map((f) => (
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
              <div className="mb-3 rounded-2xl border border-primary/35 bg-primary/10 px-4 py-3">
                <p className="font-display text-base font-bold text-foreground">
                  Best at {result.inputs.horizonYears} years: {result.recommendationLabel}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{result.recommendationDetail}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {(Object.keys(STRATEGY_LABELS) as FlatInvestmentStrategy[]).map((s) => (
                  <div
                    key={s}
                    className={`min-w-0 rounded-2xl border p-3 shadow-soft ${strategyTone(s)}`}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {STRATEGY_LABELS[s]}
                    </p>
                    <p className="mt-1 font-display text-lg font-bold text-foreground">
                      {fmtGbp(result.wealthAtHorizon[s])}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <StatTile
                  label="Break-even sale price"
                  value={fmtGbp(result.breakEvenSalePriceGbp)}
                  hint="Price today that matches renting to the horizon"
                  emphasise
                />
                <StatTile
                  label="Years until rent beats offer"
                  value={
                    result.yearsUntilRentBeatsOffer != null
                      ? `${result.yearsUntilRentBeatsOffer} yr`
                      : "Not within horizon"
                  }
                  hint="First year renting wealth overtakes selling at the offer"
                  emphasise
                />
                <StatTile
                  label="Break-even monthly rent"
                  value={fmtGbp(result.breakEvenMonthlyRentGbp)}
                  hint="Rent needed for letting to match the offer path"
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatTile label="Net offer proceeds" value={fmtGbp(result.netOfferProceedsGbp)} />
                <StatTile label="Net market proceeds" value={fmtGbp(result.netMarketProceedsGbp)} />
                <StatTile
                  label="Rent − offer (horizon)"
                  value={fmtGbp(result.differencesAtHorizon.rentMinusOfferGbp)}
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
                <Field
                  label="Market value"
                  value={form.marketValueGbp}
                  onChange={(v) => setField("marketValueGbp", v)}
                  suffix="£"
                />
                <Field
                  label="Current offer"
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
            </Section>

            <Section title="Rent & running costs" icon={<Calculator className="h-4 w-4" />}>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Monthly rent"
                  value={form.rentMonthlyGbp}
                  onChange={(v) => setField("rentMonthlyGbp", v)}
                  suffix="£"
                />
                <Field
                  label="Void months / yr"
                  value={form.voidMonthsPerYear}
                  onChange={(v) => setField("voidMonthsPerYear", v)}
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
              </div>
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
                Add lease extensions, deeds of variation, major works, or other one-offs and which year they
                fall in (0 = this year).
              </p>
            ) : (
              <div className="space-y-2">
                {oneOffs.map((o) => (
                  <div
                    key={o.id}
                    className="grid min-w-0 grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_5.5rem_2.5rem]"
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
                        placeholder="Lease extension, DoV…"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Amount £</Label>
                      <Input
                        type="number"
                        value={o.amountGbp}
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
                    <div className="space-y-1.5">
                      <Label className="text-xs">Year</Label>
                      <Input
                        type="number"
                        value={o.year}
                        onChange={(e) =>
                          setOneOffs((prev) =>
                            prev.map((x) =>
                              x.id === o.id
                                ? { ...x, year: Math.max(0, Math.round(num(e.target.value))) }
                                : x,
                            ),
                          )
                        }
                        className="h-10 rounded-xl"
                      />
                    </div>
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
              Sell paths invest net proceeds at the alternative return. Rent / vacant paths grow the property,
              accumulate after-tax cash (or costs), then assume a sale at year-end with the same selling costs.
              Tax is a simplified personal-landlord model (marginal rate on profit, basic-rate relief on
              interest). Not advice.
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

          <Section title="Year-by-year" icon={<Calculator className="h-4 w-4" />}>
            <div className="min-w-0 overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-xs">
                <thead>
                  <tr className="border-b border-border/50 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-2 font-semibold">Yr</th>
                    <th className="py-2 pr-2 font-semibold">Value</th>
                    <th className="py-2 pr-2 font-semibold">Net rent</th>
                    <th className="py-2 pr-2 font-semibold">Tax</th>
                    <th className="py-2 pr-2 font-semibold">Sell offer</th>
                    <th className="py-2 pr-2 font-semibold">Rent path</th>
                    <th className="py-2 font-semibold">vs offer</th>
                  </tr>
                </thead>
                <tbody>
                  {result.years.map((y) => (
                    <tr key={y.year} className="border-b border-border/30">
                      <td className="py-2 pr-2 font-semibold text-foreground">{y.year}</td>
                      <td className="py-2 pr-2 text-foreground">{fmtGbp(y.propertyValueGbp)}</td>
                      <td className="py-2 pr-2 text-foreground">{fmtGbp(y.netRentCashGbp)}</td>
                      <td className="py-2 pr-2 text-foreground">{fmtGbp(y.taxGbp)}</td>
                      <td className="py-2 pr-2 text-foreground">{fmtGbp(y.sellOfferWealthGbp)}</td>
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
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
