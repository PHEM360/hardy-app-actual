import { useEffect, useMemo, useState } from "react";
import { Landmark, Plus, Scale, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Account, BalanceEntry } from "@/hooks/useFinance";
import { formatGBP } from "@/lib/financeCalculations";
import {
  UK_PENSION_RULES,
  comparePensionScenarios,
  defaultPensionModel,
  growthToDateGbp,
  paidInFromContributions,
  pensionId,
  type PensionContribution,
  type PensionModelDoc,
  type PensionScenario,
  type PensionTaxRelief,
} from "@/lib/pensionModel";

const ACCENT = "hsl(var(--primary))";

function tint(pct = 14) {
  return `color-mix(in srgb, ${ACCENT} ${pct}%, hsl(var(--card)))`;
}

function money(n: number) {
  return formatGBP(n, { decimals: 0 });
}

function Num({
  label,
  value,
  onChange,
  suffix,
  step = "1",
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
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
          value={Number.isFinite(value) && value !== 0 ? value : value === 0 ? 0 : ""}
          onChange={(event) => onChange(Number(event.target.value) || 0)}
          className="h-10 rounded-xl bg-card"
        />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

function latestBalance(accountId: string, entries: BalanceEntry[]): number {
  const sorted = entries.filter((entry) => entry.accountId === accountId).sort((a, b) => a.date.localeCompare(b.date));
  return sorted.at(-1)?.balance ?? 0;
}

export default function PensionModellerPanel({
  accounts,
  entries,
  model,
  canEdit,
  onSave,
}: {
  accounts: Account[];
  entries: BalanceEntry[];
  model: PensionModelDoc;
  canEdit: boolean;
  onSave: (next: PensionModelDoc) => Promise<void>;
}) {
  const [draft, setDraft] = useState<PensionModelDoc>(model);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(model);
  }, [model]);

  const [a, b] = draft.scenarios.length >= 2
    ? draft.scenarios
    : defaultPensionModel().scenarios;
  const compared = useMemo(() => comparePensionScenarios(a, b), [a, b]);
  const impliedGrowth = growthToDateGbp(a);
  const pensionAccounts = accounts.filter((account) => account.type.toLowerCase().includes("pension") && account.active && !account.hidden);

  const patchShared = (patch: Partial<PensionScenario>) => {
    setDraft((current) => ({
      ...current,
      scenarios: current.scenarios.map((scenario) => ({ ...scenario, ...patch })),
    }));
  };

  const patchScenario = (id: string, patch: Partial<PensionScenario>) => {
    setDraft((current) => ({
      ...current,
      scenarios: current.scenarios.map((scenario) => scenario.id === id ? { ...scenario, ...patch } : scenario),
    }));
  };

  const addContribution = () => {
    const item: PensionContribution = {
      id: pensionId("c"),
      date: new Date().toISOString().slice(0, 7),
      amountGbp: 0,
      source: "personal",
    };
    setDraft((current) => ({ ...current, contributions: [...current.contributions, item] }));
  };

  const chart = compared.a.points.map((point, index) => ({
    year: point.year,
    keep: point.potGbp,
    transfer: compared.b.points[index]?.potGbp ?? compared.b.points.at(-1)?.potGbp ?? 0,
  }));

  const save = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      toast.success("Pension model saved");
    } catch {
      toast.error("Couldn’t save the pension model");
    } finally {
      setSaving(false);
    }
  };

  const fillFromAccounts = () => {
    const pot = pensionAccounts.reduce((sum, account) => sum + latestBalance(account.id, entries), 0);
    const paidIn = paidInFromContributions(draft.contributions);
    patchShared({
      currentPotGbp: pot,
      paidInGbp: paidIn || a.paidInGbp,
      provider: pensionAccounts[0]?.name || a.provider,
      annualGrowthPct: pensionAccounts[0]?.growthAssumptionPct ?? a.annualGrowthPct,
      annualFeePct: (pensionAccounts[0]?.feePct ?? 0) + (pensionAccounts[0]?.ocfPct ?? 0) || a.annualFeePct,
      monthlyPersonalGbp: pensionAccounts[0]?.monthlyContribution ?? a.monthlyPersonalGbp,
    });
    toast.message(pot ? `Filled from ${money(pot)} in pension accounts` : "No pension account balances found yet");
  };

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden">
      <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-card sm:p-5" style={{ borderLeft: "4px solid hsl(var(--primary))" }}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
              <Landmark className="h-4 w-4" />
            </span>
            <div>
              <p className="font-display text-lg font-bold">Pension modeller</p>
              <p className="text-xs text-muted-foreground">UK {UK_PENSION_RULES.taxYear} rules. Illustrative only — not advice.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {pensionAccounts.length > 0 && (
              <Button type="button" variant="outline" className="h-9 rounded-xl" onClick={fillFromAccounts} disabled={!canEdit}>
                Use my pension accounts
              </Button>
            )}
            {canEdit && (
              <Button type="button" className="h-9 rounded-xl bg-gradient-primary" onClick={() => void save()} disabled={saving}>
                {saving ? "Saving…" : "Save model"}
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Num label="Pot today" value={a.currentPotGbp} onChange={(n) => patchShared({ currentPotGbp: n })} suffix="£" />
          <Num label="Paid in so far" value={a.paidInGbp} onChange={(n) => patchShared({ paidInGbp: n })} suffix="£" />
          <Num label="Fees paid so far" value={a.feesPaidToDateGbp} onChange={(n) => patchShared({ feesPaidToDateGbp: n })} suffix="£" />
          <div className="rounded-xl border border-border/50 p-3" style={{ background: tint(12) }}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Investment return so far</p>
            <p className="mt-1 font-display text-xl font-bold tabular-nums">{money(impliedGrowth)}</p>
            <p className="text-[11px] text-muted-foreground">Pot minus what you paid in</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
        <p className="mb-3 text-sm font-semibold">Paid-in history</p>
        <p className="mb-3 text-[11px] text-muted-foreground">Optional. Totals help you see how much of today’s pot is contributions vs growth.</p>
        <div className="space-y-2">
          {draft.contributions.map((item) => (
            <div key={item.id} className="grid grid-cols-[7rem_1fr_8rem_2rem] items-center gap-2">
              <Input type="month" value={item.date} disabled={!canEdit} onChange={(event) => setDraft((current) => ({
                ...current,
                contributions: current.contributions.map((entry) => entry.id === item.id ? { ...entry, date: event.target.value } : entry),
              }))} className="h-9 rounded-xl" />
              <Select value={item.source} onValueChange={(value: PensionContribution["source"]) => setDraft((current) => ({
                ...current,
                contributions: current.contributions.map((entry) => entry.id === item.id ? { ...entry, source: value } : entry),
              }))}>
                <SelectTrigger className="h-9 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">You</SelectItem>
                  <SelectItem value="employer">Employer</SelectItem>
                  <SelectItem value="tax_relief">Tax relief</SelectItem>
                </SelectContent>
              </Select>
              <Input type="number" value={item.amountGbp || ""} disabled={!canEdit} onChange={(event) => setDraft((current) => ({
                ...current,
                contributions: current.contributions.map((entry) => entry.id === item.id ? { ...entry, amountGbp: Number(event.target.value) || 0 } : entry),
              }))} className="h-9 rounded-xl" />
              {canEdit && (
                <button type="button" aria-label="Remove contribution" onClick={() => setDraft((current) => ({
                  ...current,
                  contributions: current.contributions.filter((entry) => entry.id !== item.id),
                }))}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
          ))}
        </div>
        {canEdit && (
          <Button type="button" variant="outline" size="sm" className="mt-3 h-8 rounded-xl" onClick={addContribution}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add payment
          </Button>
        )}
        {draft.contributions.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">History total {money(paidInFromContributions(draft.contributions))}.</p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Num label="Your age now" value={a.currentAge} onChange={(n) => patchShared({ currentAge: n })} />
        <Num label="Years to project" value={a.years} onChange={(n) => patchShared({ years: n })} />
        <Num label="Drawdown rate" value={a.drawdownRatePct} onChange={(n) => patchShared({ drawdownRatePct: n })} suffix="%" step="0.1" />
        <Num label="Unused lump-sum allowance" value={a.remainingLsaGbp} onChange={(n) => patchShared({ remainingLsaGbp: n })} suffix="£" />
        <Num label="Relevant UK earnings" value={a.relevantEarningsGbp} onChange={(n) => patchShared({ relevantEarningsGbp: n })} suffix="£" />
        <Num label="Threshold income" value={a.thresholdIncomeGbp} onChange={(n) => patchShared({ thresholdIncomeGbp: n })} suffix="£" />
        <Num label="Adjusted income" value={a.adjustedIncomeGbp} onChange={(n) => patchShared({ adjustedIncomeGbp: n })} suffix="£" />
        <Num label="NI qualifying years" value={a.niQualifyingYears} onChange={(n) => patchShared({ niQualifyingYears: n })} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-card">
          <div>
            <p className="text-sm font-medium">Take 25% tax-free cash</p>
            <p className="text-[11px] text-muted-foreground">Capped by the £{UK_PENSION_RULES.lumpSumAllowanceGbp.toLocaleString("en-GB")} lump sum allowance</p>
          </div>
          <Switch checked={a.takeTaxFreeLumpSum} disabled={!canEdit} onCheckedChange={(value) => patchShared({ takeTaxFreeLumpSum: value })} />
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-card">
          <div>
            <p className="text-sm font-medium">Add new State Pension</p>
            <p className="text-[11px] text-muted-foreground">Full rate is £{UK_PENSION_RULES.newStatePensionWeeklyGbp.toFixed(2)} a week in {UK_PENSION_RULES.taxYear}</p>
          </div>
          <Switch checked={a.includeStatePension} disabled={!canEdit} onCheckedChange={(value) => patchShared({ includeStatePension: value })} />
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-card">
          <div>
            <p className="text-sm font-medium">Already flexibly accessed</p>
            <p className="text-[11px] text-muted-foreground">Money purchase annual allowance £{UK_PENSION_RULES.moneyPurchaseAnnualAllowanceGbp.toLocaleString("en-GB")}</p>
          </div>
          <Switch checked={a.flexiblyAccessed} disabled={!canEdit} onCheckedChange={(value) => patchShared({ flexiblyAccessed: value })} />
        </div>
        <div className="space-y-1.5 rounded-2xl border border-border/60 bg-card p-3 shadow-card">
          <Label className="text-xs">Tax relief on your payments</Label>
          <Select value={a.taxRelief} onValueChange={(value: PensionTaxRelief) => patchShared({ taxRelief: value })}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="relief_at_source">Relief at source (20% added to the pot)</SelectItem>
              <SelectItem value="net_pay">Net pay / salary sacrifice (gross already in)</SelectItem>
              <SelectItem value="salary_sacrifice">Salary sacrifice</SelectItem>
              <SelectItem value="none">None</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {[a, b].map((scenario, index) => {
          const result = index === 0 ? compared.a : compared.b;
          return (
            <div key={scenario.id} className="rounded-2xl border border-border/60 bg-card p-4 shadow-card" style={{ background: tint(index === 0 ? 10 : 16) }}>
              <p className="mb-3 font-display text-base font-bold">{index === 0 ? "Keep" : "Compare"}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Name</Label>
                  <Input value={scenario.name} disabled={!canEdit} onChange={(event) => patchScenario(scenario.id, { name: event.target.value })} className="h-10 rounded-xl bg-card" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Provider</Label>
                  <Input value={scenario.provider} disabled={!canEdit} onChange={(event) => patchScenario(scenario.id, { provider: event.target.value })} className="h-10 rounded-xl bg-card" />
                </div>
                <Num label="Assumed growth" value={scenario.annualGrowthPct} onChange={(n) => patchScenario(scenario.id, { annualGrowthPct: n })} suffix="% / yr" step="0.1" />
                <Num label="Annual fees" value={scenario.annualFeePct} onChange={(n) => patchScenario(scenario.id, { annualFeePct: n })} suffix="% AMC" step="0.05" />
                <Num label="You pay each month" value={scenario.monthlyPersonalGbp} onChange={(n) => patchScenario(scenario.id, { monthlyPersonalGbp: n })} suffix="£" />
                <Num label="Employer each month" value={scenario.monthlyEmployerGbp} onChange={(n) => patchScenario(scenario.id, { monthlyEmployerGbp: n })} suffix="£" />
                {index === 1 && (
                  <>
                    <Num label="Transfer fee" value={scenario.transferOutFeeGbp} onChange={(n) => patchScenario(scenario.id, { transferOutFeeGbp: n })} suffix="£" />
                    <Num label="Transfer fee" value={scenario.transferOutFeePct} onChange={(n) => patchScenario(scenario.id, { transferOutFeePct: n })} suffix="%" step="0.1" />
                  </>
                )}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-card/80 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pot in {scenario.years} years</p>
                  <p className="font-display text-lg font-bold tabular-nums">{money(result.potAtHorizonGbp)}</p>
                </div>
                <div className="rounded-xl bg-card/80 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Monthly from pot</p>
                  <p className="font-display text-lg font-bold tabular-nums">{money(result.monthlyDrawdownGbp)}</p>
                </div>
                <div className="rounded-xl bg-card/80 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tax-free lump sum</p>
                  <p className="font-display text-lg font-bold tabular-nums">{money(result.taxFreeLumpSumGbp)}</p>
                </div>
                <div className="rounded-xl bg-card/80 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">With State Pension</p>
                  <p className="font-display text-lg font-bold tabular-nums">{money(result.totalMonthlyGbp)}</p>
                </div>
              </div>
              {result.annualAllowanceBreaches > 0 && (
                <p className="mt-2 text-xs text-amber-800">This path exceeds the £{result.annualAllowanceGbp.toLocaleString("en-GB")} annual allowance in {result.annualAllowanceBreaches} year{result.annualAllowanceBreaches === 1 ? "" : "s"}.</p>
              )}
              {!result.canAccessAtHorizon && (
                <p className="mt-2 text-xs text-amber-800">You’d be {Math.round(result.accessAge)}, before the minimum pension age of {result.minAccessAge}.</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-card" style={{ background: tint(18) }}>
        <p className="mb-1 flex items-center gap-1.5 font-display text-base font-bold"><Scale className="h-4 w-4" /> Difference</p>
        <p className="text-sm">
          {compared.potDeltaGbp >= 0 ? "The compare path is ahead by " : "Keeping this pension is ahead by "}
          <strong>{money(Math.abs(compared.potDeltaGbp))}</strong>
          {" at the horizon, and "}
          <strong>{money(Math.abs(compared.monthlyDeltaGbp))}</strong>
          {compared.monthlyDeltaGbp >= 0 ? " more" : " less"} a month from the pot.
        </p>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
        <p className="mb-3 text-sm font-semibold">Projected pot</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(value) => `£${Math.round(Number(value) / 1000)}k`} tick={{ fontSize: 11 }} width={48} />
              <Tooltip formatter={(value: number) => money(Number(value))} />
              <Legend />
              <Line type="monotone" dataKey="keep" name={a.name || "Keep"} stroke="hsl(var(--primary))" strokeWidth={2.4} dot={false} />
              <Line type="monotone" dataKey="transfer" name={b.name || "Compare"} stroke="#c8961e" strokeWidth={2.4} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border/50 bg-card p-4 text-xs leading-relaxed text-muted-foreground shadow-card">
        <p className="mb-1 font-semibold text-foreground">UK rules used ({UK_PENSION_RULES.taxYear})</p>
        <p>
          Annual allowance £{UK_PENSION_RULES.annualAllowanceGbp.toLocaleString("en-GB")}, tapering by £1 for every £2 of adjusted income over £{UK_PENSION_RULES.adjustedIncomeGbp.toLocaleString("en-GB")} down to £{UK_PENSION_RULES.taperedMinimumGbp.toLocaleString("en-GB")} if threshold income is also over £{UK_PENSION_RULES.thresholdIncomeGbp.toLocaleString("en-GB")}.
          Tax-free cash is usually 25%, capped by the lump sum allowance of £{UK_PENSION_RULES.lumpSumAllowanceGbp.toLocaleString("en-GB")}.
          The lifetime allowance is abolished. Access from age {UK_PENSION_RULES.minPensionAge}, rising to {UK_PENSION_RULES.minPensionAgeAfter} from April 2028.
          Growth inside the pot is not taxed; withdrawals after the tax-free lump sum are taxed as income. Monthly income here is a {a.drawdownRatePct}% guideline of the remaining pot, not a guaranteed annuity. Not personal advice.
        </p>
      </motion.div>
    </div>
  );
}
