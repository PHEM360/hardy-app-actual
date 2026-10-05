import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Rocket, Info, Wallet, Repeat, TrendingUp, LineChart as LineChartIcon, BarChart3, Sparkles,
  Plus, X, Copy, Save, Landmark, Users, CalendarDays, TriangleAlert,
} from "lucide-react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fmtGbp } from "@/lib/flatFinance";
import { useBusinessSetups } from "@/hooks/useBusinessSetups";
import {
  BusinessSetup, BusinessSetupCostItem, BusinessSetupExpenseGrowth, BusinessSetupFunding, BusinessSetupIncomeStream,
  BusinessSetupStaffRole, BusinessSetupVat, ONGOING_COST_PRESETS, STARTUP_COST_PRESETS, VAT_REGISTRATION_THRESHOLD,
  incomeForYear, monthlyCashFlowYearOne, newCostItem, newIncomeStream, newStaffRole, projectBusinessSetup,
} from "@/lib/businessSetupModel";
import { analyzeBusinessSetup } from "@/lib/businessSetupAnalysisApi";
import { toast } from "sonner";

const SECTIONS = [
  { id: "basics", label: "Basics", icon: Info, color: "#17475C" },
  { id: "startup", label: "Start-up Costs", icon: Wallet, color: "#7A2E2A" },
  { id: "ongoing", label: "Ongoing Costs", icon: Repeat, color: "#4A2A52" },
  { id: "staff", label: "Staff", icon: Users, color: "#4A5D23" },
  { id: "income", label: "Income Streams", icon: TrendingUp, color: "#1F4D3A" },
  { id: "growth", label: "Cost Growth", icon: LineChartIcon, color: "#22407A" },
  { id: "funding", label: "Funding", icon: Landmark, color: "#8A6424" },
  { id: "cashflow", label: "Cash Flow", icon: CalendarDays, color: "#6E1F2F" },
  { id: "projection", label: "Projection", icon: BarChart3, color: "#3A2A5E" },
  { id: "ai", label: "AI Critique", icon: Sparkles, color: "#3B4759" },
] as const;
type SectionId = typeof SECTIONS[number]["id"];

const DIRTY_KEYS: (keyof BusinessSetup)[] = ["name", "description", "years", "taxRatePercent", "startupCosts", "ongoingCosts", "incomeStreams", "expenseGrowth", "costOfSalesPercent", "funding", "staff", "staffOnCostPercent", "staffPayRisePercent", "vat"];

// Option blocks: squared, solid when chosen. `--sec` is the current section's
// colour, set on the section card, so each section's controls match its band.
function pillClass(active: boolean) {
  return `rounded-md border px-3 py-2 text-xs font-bold transition-colors ${
    active
      ? "btn-edge border-[var(--sec)] bg-[var(--sec)] text-white"
      : "border-foreground/20 bg-card text-foreground hover:border-[var(--sec)] hover:text-[var(--sec)]"
  }`;
}

const EMPTY_NOTE = "rounded-lg border-l-4 border-[var(--sec)] bg-[color-mix(in_srgb,var(--sec)_14%,hsl(var(--card)))] p-4 text-sm font-medium text-foreground";
const FIELD_LABEL = "text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/70";
const ADD_LINK = "flex items-center gap-1.5 rounded-md border-2 border-[var(--sec)] px-3 py-2 text-xs font-bold text-[var(--sec)] transition-colors hover:bg-[var(--sec)] hover:text-white";

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
  const block = tone === "good" ? "bg-[#1F6B4F] text-white" : tone === "warn" ? "bg-[#C9A24A] text-[#2A2110]" : tone === "bad" ? "bg-[#9B2C2C] text-white" : "bg-[hsl(215_35%_18%)] text-white";
  return (
    <div className={`btn-edge rounded-lg p-3 ${block}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] opacity-85">{label}</p>
      <p className="mt-1 font-display text-lg font-bold tabular-nums leading-tight">{value}</p>
    </div>
  );
}

function CostSection({
  title, hint, totalLabel, items, presets, onChange, perItemGrowth = false,
}: {
  /** Ongoing costs only: lets each cost grow at its own yearly rate. */
  perItemGrowth?: boolean;
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
        <p className="text-sm font-medium text-foreground/75">{hint}</p>
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
          <p className={EMPTY_NOTE}>
            No costs added yet — tap a preset above or add your own.
          </p>
        )}
        {items.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-foreground/20 border-l-4 border-l-[var(--sec)] bg-card p-2">
            <Input
              value={item.name}
              onChange={(e) => updateItem(item.id, { name: e.target.value })}
              placeholder="Cost name"
              className="h-9 min-w-0 flex-1 basis-full rounded-lg sm:basis-0"
            />
            <div className="w-28 shrink-0">{moneyField(item.amount, (n) => updateItem(item.id, { amount: n }))}</div>
            {perItemGrowth && (
              <div className="relative w-28 shrink-0">
                <Input
                  type="number"
                  aria-label="Yearly growth for this cost"
                  value={item.growthPercent ?? ""}
                  placeholder="Plan"
                  onChange={(e) => updateItem(item.id, { growthPercent: e.target.value === "" ? null : Number(e.target.value) || 0 })}
                  className="h-9 rounded-lg pr-11"
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%/yr</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => removeItem(item.id)}
              aria-label="Remove cost"
              className="ml-auto shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      {perItemGrowth && items.length > 0 && (
        <p className="text-[11px] font-medium text-foreground/70">
          The %/yr box sets growth for that one cost. Leave it on "Plan" to follow the Cost Growth section.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onChange([...items, newCostItem("", 0)])}
          className={ADD_LINK}
        >
          <Plus className="h-3.5 w-3.5" /> Add custom cost
        </button>
        <p className="btn-edge rounded-md bg-[var(--sec)] px-3 py-2 text-sm font-bold tabular-nums text-white">{totalLabel}: {fmtGbp(total)}</p>
      </div>
    </div>
  );
}

function IncomeStreamsSection({ streams, years, onChange }: { streams: BusinessSetupIncomeStream[]; years: number; onChange: (s: BusinessSetupIncomeStream[]) => void }) {
  const update = (id: string, patch: Partial<BusinessSetupIncomeStream>) =>
    onChange(streams.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const remove = (id: string) => onChange(streams.filter((s) => s.id !== id));

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-foreground/75">Add each source of income and how you expect it to grow over the plan.</p>
      </div>
      {streams.length === 0 && (
        <p className={EMPTY_NOTE}>
          No income streams yet — add at least one to project revenue.
        </p>
      )}
      <div className="space-y-3">
        {streams.map((stream) => {
          const displayAmount = stream.period === "monthly" ? stream.amount / 12 : stream.amount;
          const setAmount = (n: number) => update(stream.id, { amount: stream.period === "monthly" ? n * 12 : n });
          return (
            <div key={stream.id} className="space-y-3 rounded-lg border border-foreground/20 border-t-4 border-t-[var(--sec)] bg-card p-3">
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

              {stream.growthMode !== "manual" && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className={FIELD_LABEL}>{stream.startYear > 1 ? `Year ${stream.startYear} amount` : "Year 1 amount"}</Label>
                  {moneyField(displayAmount, setAmount)}
                </div>
                <div className="space-y-1">
                  <Label className={FIELD_LABEL}>Per</Label>
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => update(stream.id, { period: "yearly" })} className={pillClass(stream.period === "yearly")}>Year</button>
                    <button type="button" onClick={() => update(stream.id, { period: "monthly" })} className={pillClass(stream.period === "monthly")}>Month</button>
                  </div>
                </div>
              </div>
              )}

              <div className="space-y-2">
                <Label className={FIELD_LABEL}>Growth</Label>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => update(stream.id, { growthMode: "rate" })} className={pillClass(stream.growthMode === "rate")}>
                    Steady % per year
                  </button>
                  <button type="button" onClick={() => update(stream.id, { growthMode: "toMax" })} className={pillClass(stream.growthMode === "toMax")}>
                    Grow to a cap
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      update(stream.id, {
                        growthMode: "manual",
                        // Start from what the stream already projects, so switching never loses figures.
                        manualByYear: stream.manualByYear.some((n) => n !== null)
                          ? stream.manualByYear
                          : Array.from({ length: years }, (_, i) => Math.round(incomeForYear(stream, i))),
                      })
                    }
                    className={pillClass(stream.growthMode === "manual")}
                  >
                    Enter each year
                  </button>
                </div>
              </div>

              {stream.growthMode === "manual" ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {Array.from({ length: years }).map((_, i) => {
                      const entered = stream.manualByYear[i];
                      return (
                        <div key={i} className="space-y-1">
                          <Label className={FIELD_LABEL}>Year {i + 1} income</Label>
                          <div className="relative">
                            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">£</span>
                            <Input
                              type="number"
                              min={0}
                              value={entered ?? ""}
                              placeholder={String(Math.round(incomeForYear(stream, i)))}
                              onChange={(e) => {
                                const next: (number | null)[] = Array.from({ length: Math.max(years, stream.manualByYear.length) }, (_, k) => stream.manualByYear[k] ?? null);
                                next[i] = e.target.value === "" ? null : Math.max(0, Number(e.target.value) || 0);
                                update(stream.id, { manualByYear: next });
                              }}
                              className="h-9 rounded-lg pl-5"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[11px] font-medium text-foreground/70">Yearly totals. Leave a year blank to repeat the year before it.</p>
                </div>
              ) : stream.growthMode === "rate" ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className={FIELD_LABEL}>Growth rate</Label>
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
                    <Label className={FIELD_LABEL}>Cap (optional)</Label>
                    {moneyField(stream.maxAnnualAmount, (n) => update(stream.id, { maxAnnualAmount: n }), "No cap")}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className={FIELD_LABEL}>Max annual amount</Label>
                    {moneyField(stream.maxAnnualAmount, (n) => update(stream.id, { maxAnnualAmount: n }))}
                  </div>
                  <div className="space-y-1">
                    <Label className={FIELD_LABEL}>Years to reach it</Label>
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

              {stream.growthMode !== "manual" && (
                <div className="max-w-[180px] space-y-1">
                  <Label className={FIELD_LABEL}>Starts in year</Label>
                  <Input
                    type="number"
                    min={1}
                    max={years}
                    value={stream.startYear}
                    onChange={(e) => update(stream.id, { startYear: Math.max(1, Math.min(10, Math.round(Number(e.target.value) || 1))) })}
                    className="h-9 rounded-lg"
                  />
                </div>
              )}

              <div className="space-y-1">
                <p className={FIELD_LABEL}>What this stream earns</p>
                <div className="grid grid-cols-5 gap-1">
                  {Array.from({ length: years }).map((_, i) => (
                    <div key={i} className="rounded-md bg-[color-mix(in_srgb,var(--sec)_16%,hsl(var(--card)))] px-1 py-1.5 text-center">
                      <p className="text-[9px] font-bold uppercase text-[var(--sec)]">Y{i + 1}</p>
                      <p className="truncate text-[11px] font-bold tabular-nums">{fmtGbp(Math.round(incomeForYear(stream, i)))}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onChange([...streams, newIncomeStream("")])}
        className={ADD_LINK}
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
        <p className="text-sm font-medium text-foreground/75">Should your running costs increase over time, or do you want full control year by year?</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => onChange({ ...growth, mode: "flat" })} className={pillClass(growth.mode === "flat")}>Stay flat</button>
        <button type="button" onClick={() => onChange({ ...growth, mode: "rate" })} className={pillClass(growth.mode === "rate")}>Grow % per year</button>
        <button type="button" onClick={() => onChange({ ...growth, mode: "manual" })} className={pillClass(growth.mode === "manual")}>Enter manually per year</button>
      </div>
      {growth.mode === "rate" && (
        <div className="max-w-[180px] space-y-1">
          <Label className={FIELD_LABEL}>Growth rate</Label>
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
              <Label className={FIELD_LABEL}>Year {i + 1} total</Label>
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

function StaffSection({
  setup, onChange,
}: {
  setup: BusinessSetup;
  onChange: (patch: Pick<BusinessSetup, "staff"> | Pick<BusinessSetup, "staffOnCostPercent"> | Pick<BusinessSetup, "staffPayRisePercent">) => void;
}) {
  const roles = setup.staff;
  const update = (id: string, patch: Partial<BusinessSetupStaffRole>) =>
    onChange({ staff: roles.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const projection = useMemo(() => projectBusinessSetup(setup), [setup]);

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-foreground/75">
        Add each role and when you plan to hire. Pay only starts from the hiring month.
      </p>
      {roles.length === 0 && <p className={EMPTY_NOTE}>No staff yet. Add a role, or leave this empty if it is just you.</p>}
      <div className="space-y-3">
        {roles.map((role) => (
          <div key={role.id} className="space-y-3 rounded-lg border border-foreground/20 border-t-4 border-t-[var(--sec)] bg-card p-3">
            <div className="flex items-center gap-2">
              <Input
                value={role.title}
                onChange={(e) => update(role.id, { title: e.target.value })}
                placeholder="e.g. Barista"
                className="h-9 flex-1 rounded-lg font-semibold"
              />
              <button
                type="button"
                onClick={() => onChange({ staff: roles.filter((r) => r.id !== role.id) })}
                aria-label="Remove role"
                className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="space-y-1">
                <Label className={FIELD_LABEL}>Salary each, per year</Label>
                {moneyField(role.annualSalary, (n) => update(role.id, { annualSalary: n }))}
              </div>
              <div className="space-y-1">
                <Label className={FIELD_LABEL}>How many</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={role.headcount}
                  onChange={(e) => update(role.id, { headcount: Math.max(0, Number(e.target.value) || 0) })}
                  className="h-9 rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <Label className={FIELD_LABEL}>Hired in year</Label>
                <Input
                  type="number"
                  min={1}
                  max={setup.years}
                  value={role.startYear}
                  onChange={(e) => update(role.id, { startYear: Math.max(1, Math.min(10, Math.round(Number(e.target.value) || 1))) })}
                  className="h-9 rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <Label className={FIELD_LABEL}>Month of that year</Label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={role.startMonth}
                  onChange={(e) => update(role.id, { startMonth: Math.max(1, Math.min(12, Math.round(Number(e.target.value) || 1))) })}
                  className="h-9 rounded-lg"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onChange({ staff: [...roles, newStaffRole("")] })} className={ADD_LINK}>
        <Plus className="h-3.5 w-3.5" /> Add a role
      </button>

      <div className="grid gap-3 rounded-lg border border-foreground/20 border-l-4 border-l-[var(--sec)] bg-card p-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className={FIELD_LABEL}>Employer costs on top of salary</Label>
          <div className="relative max-w-[160px]">
            <Input
              type="number"
              min={0}
              value={setup.staffOnCostPercent}
              onChange={(e) => onChange({ staffOnCostPercent: Math.max(0, Number(e.target.value) || 0) })}
              className="h-9 rounded-lg pr-8"
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
          </div>
          <p className="text-[11px] font-medium text-foreground/70">Employer National Insurance and pension. Around 18% is typical.</p>
        </div>
        <div className="space-y-1">
          <Label className={FIELD_LABEL}>Pay rise each year</Label>
          <div className="relative max-w-[160px]">
            <Input
              type="number"
              value={setup.staffPayRisePercent}
              onChange={(e) => onChange({ staffPayRisePercent: Number(e.target.value) || 0 })}
              className="h-9 rounded-lg pr-8"
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
          </div>
        </div>
      </div>

      {roles.length > 0 && (
        <div className="space-y-1">
          <p className={FIELD_LABEL}>Total staff cost</p>
          <div className="grid grid-cols-5 gap-1">
            {projection.years.map((y) => (
              <div key={y.year} className="rounded-md bg-[color-mix(in_srgb,var(--sec)_16%,hsl(var(--card)))] px-1 py-1.5 text-center">
                <p className="text-[9px] font-bold uppercase text-[var(--sec)]">Y{y.year}</p>
                <p className="truncate text-[11px] font-bold tabular-nums">{fmtGbp(y.staffCosts)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function VatSettings({ vat, onChange }: { vat: BusinessSetupVat; onChange: (vat: BusinessSetupVat) => void }) {
  return (
    <div className="space-y-3 rounded-lg border border-foreground/20 border-l-4 border-l-[var(--sec)] bg-card p-3">
      <Label className={FIELD_LABEL}>VAT</Label>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => onChange({ ...vat, registered: false })} className={pillClass(!vat.registered)}>Not VAT registered</button>
        <button type="button" onClick={() => onChange({ ...vat, registered: true })} className={pillClass(vat.registered)}>VAT registered</button>
      </div>
      {vat.registered ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className={FIELD_LABEL}>Your income figures</Label>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => onChange({ ...vat, pricesIncludeVat: true })} className={pillClass(vat.pricesIncludeVat)}>Include VAT</button>
              <button type="button" onClick={() => onChange({ ...vat, pricesIncludeVat: false })} className={pillClass(!vat.pricesIncludeVat)}>VAT is added on top</button>
            </div>
            <p className="text-[11px] font-medium text-foreground/70">
              {vat.pricesIncludeVat
                ? "Typical when selling to the public. VAT is taken out of your sales before profit."
                : "Typical when selling to businesses. VAT passes through and does not change profit."}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className={FIELD_LABEL}>VAT rate</Label>
              <div className="relative">
                <Input type="number" min={0} value={vat.ratePercent} onChange={(e) => onChange({ ...vat, ratePercent: Math.max(0, Number(e.target.value) || 0) })} className="h-9 rounded-lg pr-8" />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className={FIELD_LABEL}>Costs with VAT to claim back</Label>
              <div className="relative">
                <Input type="number" min={0} max={100} value={vat.reclaimCostsPercent} onChange={(e) => onChange({ ...vat, reclaimCostsPercent: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} className="h-9 rounded-lg pr-8" />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
              </div>
            </div>
          </div>
          <p className="text-[11px] font-medium text-foreground/70">
            Enter start-up and running costs as you pay them, with VAT. Rent, wages and insurance usually carry no VAT, so 100% is rare.
          </p>
        </div>
      ) : (
        <p className="text-[11px] font-medium text-foreground/70">
          You must register once sales pass {fmtGbp(VAT_REGISTRATION_THRESHOLD)} in a year. The projection warns you if the plan gets there.
        </p>
      )}
    </div>
  );
}

function CashFlowSection({ setup }: { setup: BusinessSetup }) {
  const flow = useMemo(() => monthlyCashFlowYearOne(setup), [setup]);
  const chartData = flow.months.map((m) => ({ name: `M${m.month}`, Balance: m.balance }));
  const yearEnd = flow.months[11]?.balance ?? 0;
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-foreground/75">
        Your bank balance month by month in year one. This shows whether the money runs out before the year does.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Money at the start" value={fmtGbp(flow.openingBalance)} />
        <StatCard label={`Lowest point, month ${flow.lowestMonth}`} value={fmtGbp(flow.lowestBalance)} tone={flow.lowestBalance < 0 ? "bad" : "good"} />
        <StatCard label="Extra cash needed" value={fmtGbp(Math.max(0, -flow.lowestBalance))} tone={flow.lowestBalance < 0 ? "warn" : "good"} />
        <StatCard label="End of year one" value={fmtGbp(yearEnd)} tone={yearEnd < 0 ? "bad" : "good"} />
      </div>
      <div className="rounded-lg border border-foreground/20 bg-card p-3">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="name" fontSize={11} />
            <YAxis fontSize={11} tickFormatter={(v) => `£${Math.round(v / 1000)}k`} />
            <Tooltip formatter={(v: number) => fmtGbp(v)} />
            <Bar dataKey="Balance" fill="#6E1F2F" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="overflow-x-auto rounded-lg border border-foreground/20">
        <table className="w-full text-xs">
          <thead className="bg-[hsl(215_35%_18%)] text-[10px] uppercase tracking-wide text-white">
            <tr>
              <th className="p-2 text-left">Month</th>
              <th className="p-2 text-right">Money in</th>
              <th className="p-2 text-right">Money out</th>
              <th className="p-2 text-right">Bank balance</th>
            </tr>
          </thead>
          <tbody>
            {flow.months.map((m) => (
              <tr key={m.month} className={`border-t border-foreground/10 ${m.month === flow.lowestMonth && flow.lowestBalance < 0 ? "bg-[#9B2C2C]/15 font-semibold" : "odd:bg-card even:bg-secondary"}`}>
                <td className="p-2 font-semibold">Month {m.month}</td>
                <td className="p-2 text-right tabular-nums">{fmtGbp(m.moneyIn)}</td>
                <td className="p-2 text-right tabular-nums">{fmtGbp(m.moneyOut)}</td>
                <td className={`p-2 text-right tabular-nums font-semibold ${m.balance >= 0 ? "text-[#1F6B4F]" : "text-[#9B2C2C]"}`}>{fmtGbp(m.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={EMPTY_NOTE}>
        Sales and running costs are spread evenly across the year. Start-up costs and funding land in month 1 and staff
        are paid from the month they are hired. Corporation tax is left out because it is paid after the year ends.
      </p>
    </div>
  );
}

function FundingSection({ funding, onChange }: { funding: BusinessSetupFunding; onChange: (f: BusinessSetupFunding) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-foreground/75">
        Money put in at the start. It goes into the bank balance, it is not income and it is not taxed.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className={FIELD_LABEL}>Your own investment</Label>
          {moneyField(funding.ownerInvestment, (n) => onChange({ ...funding, ownerInvestment: n }))}
        </div>
        <div className="space-y-1">
          <Label className={FIELD_LABEL}>Loan amount</Label>
          {moneyField(funding.loanAmount, (n) => onChange({ ...funding, loanAmount: n }))}
        </div>
        <div className="space-y-1">
          <Label className={FIELD_LABEL}>Loan interest</Label>
          <div className="relative">
            <Input
              type="number"
              min={0}
              value={funding.loanInterestPercent}
              onChange={(e) => onChange({ ...funding, loanInterestPercent: Math.max(0, Number(e.target.value) || 0) })}
              className="h-9 rounded-lg pr-10"
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%/yr</span>
          </div>
        </div>
        <div className="space-y-1">
          <Label className={FIELD_LABEL}>Repaid over (years)</Label>
          <Input
            type="number"
            min={1}
            max={30}
            value={funding.loanTermYears}
            onChange={(e) => onChange({ ...funding, loanTermYears: Math.max(1, Math.min(30, Math.round(Number(e.target.value) || 1))) })}
            className="h-9 rounded-lg"
          />
        </div>
      </div>
      <p className={EMPTY_NOTE}>
        The loan is repaid in equal yearly payments. The interest part counts as a cost and lowers profit. The rest
        pays down the loan and only lowers the bank balance.
      </p>
    </div>
  );
}

const STRESS_OPTIONS = [
  { label: "Sales 30% lower", factor: 0.7 },
  { label: "15% lower", factor: 0.85 },
  { label: "As planned", factor: 1 },
  { label: "15% higher", factor: 1.15 },
];

/** Scales every income figure, to see how the plan holds up if sales miss or beat the plan. */
function scaleIncome(setup: BusinessSetup, factor: number): BusinessSetup {
  if (factor === 1) return setup;
  return {
    ...setup,
    incomeStreams: setup.incomeStreams.map((s) => ({
      ...s,
      amount: s.amount * factor,
      maxAnnualAmount: s.maxAnnualAmount * factor,
      manualByYear: s.manualByYear.map((n) => (n === null ? null : n * factor)),
    })),
  };
}

function ProjectionSection({ setup: plannedSetup }: { setup: BusinessSetup }) {
  const [stress, setStress] = useState(1);
  const setup = useMemo(() => scaleIncome(plannedSetup, stress), [plannedSetup, stress]);
  const projection = useMemo(() => projectBusinessSetup(setup), [setup]);
  const [chartType, setChartType] = useState<"bar" | "area">("bar");
  const chartData = projection.years.map((y) => ({ name: `Y${y.year}`, Revenue: y.revenue, Costs: y.costOfSales + y.ongoingCosts + y.staffCosts + y.startupCosts + y.loanInterest, "Net profit": y.netProfit }));
  const hasCostOfSales = projection.years.some((y) => y.costOfSales > 0);
  const hasStaff = projection.years.some((y) => y.staffCosts > 0);
  const hasVat = projection.years.some((y) => y.vatOnSales > 0 || y.vatReclaimed > 0);
  const thresholdYear = projection.years.find((y) => y.vatThresholdExceeded);
  const hasLoan = projection.years.some((y) => y.loanInterest > 0 || y.loanRepayment > 0);
  const lastYear = projection.years[projection.years.length - 1];

  const copySummary = async () => {
    const lines = [
      `${setup.name || "Business idea"} — ${setup.years}-year plan`,
      `Start-up cost: ${fmtGbp(projection.totalStartupCost)}`,
      projection.breakEvenYear ? `Break-even: Year ${projection.breakEvenYear}` : `No break-even within ${setup.years} years`,
      `Peak funding needed: ${fmtGbp(projection.peakFundingNeeded)}`,
      "",
      ...projection.years.map((y) => `Year ${y.year}: revenue ${fmtGbp(y.revenue)}, costs ${fmtGbp(y.costOfSales + y.ongoingCosts + y.staffCosts + y.startupCosts + y.loanInterest)}, tax ${fmtGbp(y.tax)}, net profit ${fmtGbp(y.netProfit)}, cumulative cash ${fmtGbp(y.cumulativeCash)}`),
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
        <p className="text-sm font-medium text-foreground/75">{setup.years}-year outlook based on your assumptions.</p>
      </div>
      {thresholdYear && (
        <p className="flex items-start gap-2 rounded-lg bg-[#C9A24A] p-3 text-sm font-bold text-[#2A2110]">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Sales pass the {fmtGbp(VAT_REGISTRATION_THRESHOLD)} VAT threshold in year {thresholdYear.year}. You would have to register, so
            switch on VAT in Basics to see the effect.
          </span>
        </p>
      )}
      <div className="space-y-1.5">
        <p className={FIELD_LABEL}>Stress test</p>
        <div className="flex flex-wrap gap-1.5">
          {STRESS_OPTIONS.map((option) => (
            <button key={option.factor} type="button" onClick={() => setStress(option.factor)} className={pillClass(stress === option.factor)}>
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Start-up cost" value={fmtGbp(projection.totalStartupCost)} />
        <StatCard label="Break-even" value={projection.breakEvenYear ? `Year ${projection.breakEvenYear}` : `Not in ${setup.years}y`} tone={projection.breakEvenYear ? "good" : "warn"} />
        <StatCard label={projection.totalFunding > 0 ? "Extra funding needed" : "Funding needed"} value={fmtGbp(projection.peakFundingNeeded)} tone={projection.peakFundingNeeded > 0 ? "warn" : "good"} />
        <StatCard label={`Year ${setup.years} net profit`} value={fmtGbp(lastYear?.netProfit ?? 0)} tone={(lastYear?.netProfit ?? 0) >= 0 ? "good" : "bad"} />
        <StatCard label={`Total profit, ${setup.years} years`} value={fmtGbp(projection.totalNetProfit)} tone={projection.totalNetProfit >= 0 ? "good" : "bad"} />
        <StatCard label="Gross margin" value={projection.grossMarginPercent === null ? "No sales" : `${projection.grossMarginPercent}%`} />
        <StatCard label="Return on money in" value={projection.returnOnInvestmentPercent === null ? "n/a" : `${projection.returnOnInvestmentPercent}%`} tone={projection.returnOnInvestmentPercent === null ? undefined : projection.returnOnInvestmentPercent >= 0 ? "good" : "bad"} />
        <StatCard label={`Cash at end of year ${setup.years}`} value={fmtGbp(lastYear?.cumulativeCash ?? 0)} tone={(lastYear?.cumulativeCash ?? 0) >= 0 ? "good" : "bad"} />
      </div>

      <div className="rounded-lg border border-foreground/20 bg-card p-3">
        <div className="mb-2 flex items-center justify-end gap-1.5">
          <button type="button" onClick={() => setChartType("bar")} className={pillClass(chartType === "bar")}>Bar</button>
          <button type="button" onClick={() => setChartType("area")} className={pillClass(chartType === "area")}>Area</button>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          {chartType === "bar" ? (
            <BarChart data={chartData} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v) => `£${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v: number) => fmtGbp(v)} />
              <Bar dataKey="Revenue" fill="#2E7D5B" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Costs" fill="#B4443C" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Net profit" fill="#3D5A99" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v) => `£${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v: number) => fmtGbp(v)} />
              <Area type="monotone" dataKey="Revenue" stroke="#2E7D5B" fill="#2E7D5B33" />
              <Area type="monotone" dataKey="Costs" stroke="#B4443C" fill="#B4443C33" />
              <Area type="monotone" dataKey="Net profit" stroke="#3D5A99" fill="#3D5A9933" />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto rounded-lg border border-foreground/20">
        <table className="w-full text-xs">
          <thead className="bg-[hsl(215_35%_18%)] text-[10px] uppercase tracking-wide text-white">
            <tr>
              <th className="p-2 text-left">Year</th>
              {hasVat && <th className="p-2 text-right">Takings</th>}
              {hasVat && <th className="p-2 text-right">VAT to HMRC</th>}
              <th className="p-2 text-right">{hasVat ? "Sales after VAT" : "Revenue"}</th>
              {hasCostOfSales && <th className="p-2 text-right">Cost of sales</th>}
              {hasCostOfSales && <th className="p-2 text-right">Gross profit</th>}
              <th className="p-2 text-right">Running costs</th>
              {hasStaff && <th className="p-2 text-right">Staff</th>}
              {hasLoan && <th className="p-2 text-right">Loan interest</th>}
              <th className="p-2 text-right">Tax</th>
              <th className="p-2 text-right">Net profit</th>
              {hasLoan && <th className="p-2 text-right">Loan repaid</th>}
              <th className="p-2 text-right">Cash in bank</th>
            </tr>
          </thead>
          <tbody>
            {projection.years.map((y) => (
              <tr key={y.year} className={`border-t border-foreground/10 ${projection.breakEvenYear === y.year ? "bg-[#1F6B4F]/20 font-semibold" : "odd:bg-card even:bg-secondary"}`}>
                <td className="p-2 font-semibold">Year {y.year}</td>
                {hasVat && <td className="p-2 text-right tabular-nums">{fmtGbp(y.grossTakings)}</td>}
                {hasVat && <td className="p-2 text-right tabular-nums">{fmtGbp(y.vatOnSales - y.vatReclaimed)}</td>}
                <td className="p-2 text-right tabular-nums">{fmtGbp(y.revenue)}</td>
                {hasCostOfSales && <td className="p-2 text-right tabular-nums">{fmtGbp(y.costOfSales)}</td>}
                {hasCostOfSales && <td className="p-2 text-right tabular-nums">{fmtGbp(y.grossProfit)}</td>}
                <td className="p-2 text-right tabular-nums">{fmtGbp(y.ongoingCosts + y.startupCosts)}</td>
                {hasStaff && <td className="p-2 text-right tabular-nums">{fmtGbp(y.staffCosts)}</td>}
                {hasLoan && <td className="p-2 text-right tabular-nums">{fmtGbp(y.loanInterest)}</td>}
                <td className="p-2 text-right tabular-nums">{fmtGbp(y.tax)}</td>
                <td className={`p-2 text-right tabular-nums font-semibold ${y.netProfit >= 0 ? "text-[#1F6B4F]" : "text-[#9B2C2C]"}`}>{fmtGbp(y.netProfit)}</td>
                {hasLoan && <td className="p-2 text-right tabular-nums">{fmtGbp(y.loanRepayment)}</td>}
                <td className={`p-2 text-right tabular-nums font-semibold ${y.cumulativeCash >= 0 ? "text-[#1F6B4F]" : "text-[#9B2C2C]"}`}>{fmtGbp(y.cumulativeCash)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button type="button" onClick={() => void copySummary()} className={ADD_LINK}>
        <Copy className="h-3.5 w-3.5" /> Copy plan summary
      </button>
    </div>
  );
}

function CritiqueList({ title, items, tone }: { title: string; items: string[]; tone: "good" | "bad" | "neutral" }) {
  const band = tone === "good" ? "bg-[#1F6B4F]" : tone === "bad" ? "bg-[#9B2C2C]" : "bg-[hsl(215_35%_18%)]";
  const dot = tone === "good" ? "bg-[#1F6B4F]" : tone === "bad" ? "bg-[#9B2C2C]" : "bg-[hsl(215_35%_18%)]";
  return (
    <div className="overflow-hidden rounded-lg border border-foreground/20 bg-card">
      <p className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white ${band}`}>{title}</p>
      <ul className="space-y-2 p-3">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm leading-snug">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-sm ${dot}`} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

const VERDICT_COLOR: Record<string, string> = {
  strong: "bg-[#1F6B4F]",
  promising: "bg-[#1C4A6E]",
  risky: "bg-[#B7791F]",
  needs_work: "bg-[#9B2C2C]",
};

function AiCritiqueSection({ setup, onRun, running }: { setup: BusinessSetup; onRun: () => void; running: boolean }) {
  const critique = setup.aiCritique;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground/75">An honest second opinion on your assumptions and cashflow risk.</p>
        </div>
        <Button onClick={onRun} disabled={running} className="h-10 shrink-0 bg-[var(--sec)]">
          <Sparkles />
          {running ? "Analysing…" : critique ? "Re-analyse" : "Analyse plan"}
        </Button>
      </div>
      {!critique && !running && (
        <p className={EMPTY_NOTE}>
          No analysis yet. This saves your plan first, then asks an AI model to critique it.
        </p>
      )}
      {critique && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`btn-edge rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white ${VERDICT_COLOR[critique.verdict] || "bg-muted-foreground"}`}>
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

  const activeSection = SECTIONS.find((item) => item.id === section) ?? SECTIONS[0];

  return (
    <FeaturePageShell
      title={draft.name || "Business idea"}
      subtitle="Business setup modeller"
      icon={<Rocket className="h-5 w-5" />}
      action={
        <Button
          className="h-10"
          disabled={!dirty || saving}
          onClick={() => void save().then((ok) => ok && toast.success("Saved"))}
        >
          <Save /> {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
        </Button>
      }
    >
      <div className="flex min-w-0 gap-3">
        <aside className="hidden w-[12.5rem] shrink-0 lg:block">
          <nav className="sticky top-2 space-y-1.5">
            {SECTIONS.map((item, index) => {
              const on = section === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  style={{ ["--sec" as string]: item.color }}
                  className={`flex w-full items-center gap-2.5 rounded-lg border-2 p-1.5 text-left text-sm font-bold transition-colors ${
                    on ? "btn-edge border-[var(--sec)] bg-[var(--sec)] text-white" : "border-foreground/15 bg-card text-foreground hover:border-[var(--sec)]"
                  }`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${on ? "bg-black/20 text-white" : "bg-[var(--sec)] text-white"}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">{item.label}</span>
                  <span className={`pr-1 font-display text-xs tabular-nums ${on ? "text-white/80" : "text-foreground/40"}`}>{index + 1}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10 lg:hidden">
            {SECTIONS.map((item) => {
              const on = section === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  style={{ ["--sec" as string]: item.color }}
                  className={`flex min-w-0 flex-col items-center gap-1 rounded-lg border-2 px-1 py-2 text-[10px] font-bold leading-tight transition-colors ${
                    on ? "btn-edge border-[var(--sec)] bg-[var(--sec)] text-white" : "border-foreground/15 bg-card text-foreground"
                  }`}
                >
                  <span className={`flex h-7 w-7 items-center justify-center rounded-md ${on ? "bg-black/20 text-white" : "bg-[var(--sec)] text-white"}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="max-w-full break-words text-center">{item.label}</span>
                </button>
              );
            })}
          </div>

          <div
            className="overflow-hidden rounded-xl border border-foreground/20 bg-card shadow-card"
            style={{ ["--sec" as string]: activeSection.color }}
          >
            <div className="flex items-center gap-3 band bg-[var(--sec)] px-4 py-3 text-white">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-black/20">
                <activeSection.icon className="h-5 w-5" />
              </span>
              <p className="font-display text-lg font-bold leading-tight">{activeSection.label}</p>
              <span className="ml-auto font-display text-sm font-bold tabular-nums text-white/75">
                {SECTIONS.findIndex((item) => item.id === section) + 1} / {SECTIONS.length}
              </span>
            </div>
            <div className="p-4">
            {section === "basics" && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-foreground/75">Name the idea and choose how many years to model.</p>
                </div>
                <div className="space-y-1">
                  <Label>Business / idea name</Label>
                  <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="h-10" />
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
                  <p className="text-[11px] font-medium text-foreground/70">Applied to profit each year, after earlier losses are used up. Defaults to UK corporation tax.</p>
                </div>
                <VatSettings vat={draft.vat} onChange={(vat) => setDraft({ ...draft, vat })} />
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

            {section === "staff" && <StaffSection setup={draft} onChange={(patch) => setDraft({ ...draft, ...patch })} />}

            {section === "cashflow" && <CashFlowSection setup={draft} />}

            {section === "funding" && (
              <FundingSection funding={draft.funding} onChange={(funding) => setDraft({ ...draft, funding })} />
            )}

            {section === "ongoing" && (
              <div className="mb-4 space-y-1 rounded-lg border border-foreground/20 border-l-4 border-l-[var(--sec)] bg-card p-3">
                <Label className={FIELD_LABEL}>Cost of sales</Label>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative w-32">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={draft.costOfSalesPercent}
                      onChange={(e) => setDraft({ ...draft, costOfSalesPercent: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                      className="h-9 rounded-lg pr-8"
                    />
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </div>
                  <p className="min-w-0 flex-1 text-xs font-medium text-foreground/70">
                    Share of every pound of sales spent on stock, materials or delivery. It rises and falls with sales.
                  </p>
                </div>
              </div>
            )}

            {section === "ongoing" && (
              <CostSection
                title="Ongoing costs"
                hint="Running costs per year, before any growth assumptions are applied."
                totalLabel="Total ongoing cost (Year 1)"
                items={draft.ongoingCosts}
                presets={ONGOING_COST_PRESETS}
                perItemGrowth
                onChange={(ongoingCosts) => setDraft({ ...draft, ongoingCosts })}
              />
            )}

            {section === "income" && (
              <IncomeStreamsSection streams={draft.incomeStreams} years={draft.years} onChange={(incomeStreams) => setDraft({ ...draft, incomeStreams })} />
            )}

            {section === "growth" && (
              <ExpenseGrowthSection growth={draft.expenseGrowth} years={draft.years} onChange={(expenseGrowth) => setDraft({ ...draft, expenseGrowth })} />
            )}

            {section === "projection" && <ProjectionSection setup={draft} />}

            {section === "ai" && <AiCritiqueSection setup={draft} onRun={() => void runAnalysis()} running={analyzing} />}
            </div>
          </div>
        </div>
      </div>
    </FeaturePageShell>
  );
}
