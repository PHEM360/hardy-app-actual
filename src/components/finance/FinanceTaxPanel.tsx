import { useMemo, useState } from "react";
import { Calculator, ChevronDown, ChevronUp, Landmark, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  CLAIM_HINTS,
  DEFAULT_TAX_INPUTS,
  computePersonalTax,
  type PersonalTaxInputs,
  type TaxEntityType,
} from "@/lib/personalTax";

const ENTITY_OPTIONS: { id: TaxEntityType; label: string }[] = [
  { id: "personal", label: "Personal" },
  { id: "sole_trader", label: "Sole trader" },
  { id: "ltd_company", label: "Ltd company" },
];

function fmt(n: number) {
  return `£${Math.round(n).toLocaleString("en-GB")}`;
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="h-10 rounded-xl"
      />
    </div>
  );
}

export default function FinanceTaxPanel({
  propertyIncomeGbp,
  propertyExpensesGbp,
  propertyFinanceCostsGbp,
}: {
  propertyIncomeGbp?: number;
  propertyExpensesGbp?: number;
  propertyFinanceCostsGbp?: number;
} = {}) {
  const [inputs, setInputs] = useState<PersonalTaxInputs>({ ...DEFAULT_TAX_INPUTS });
  const [reportOpen, setReportOpen] = useState(false);
  const result = useMemo(() => computePersonalTax(inputs), [inputs]);

  const patch = (partial: Partial<PersonalTaxInputs>) =>
    setInputs((prev) => ({ ...prev, ...partial }));

  const prefillFromFlats = () => {
    setInputs((prev) => ({
      ...prev,
      propertyIncomeGbp: propertyIncomeGbp ?? prev.propertyIncomeGbp,
      propertyExpensesGbp: propertyExpensesGbp ?? prev.propertyExpensesGbp,
      propertyFinanceCostsGbp: propertyFinanceCostsGbp ?? prev.propertyFinanceCostsGbp,
    }));
  };

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden">
      <div
        className="rounded-2xl border border-border/60 bg-card p-4 shadow-card sm:p-5"
        style={{ borderLeft: "4px solid hsl(var(--primary))" }}
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
              <Calculator className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-display text-base font-bold text-foreground">Tax calculator</h3>
              <p className="text-xs text-muted-foreground">
                Illustrative UK model for {inputs.taxYearLabel} — not advice.
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs" onClick={prefillFromFlats}>
            Prefill from flats
          </Button>
        </div>

        <div className="mb-4 flex flex-wrap gap-1.5 rounded-2xl border border-border/50 bg-muted/30 p-1.5">
          {ENTITY_OPTIONS.map((opt) => {
            const active = inputs.entityType === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => patch({ entityType: opt.id })}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  active
                    ? "border-primary/45 bg-primary/10 text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-card hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <NumField
            label="Employment income (£)"
            value={inputs.employmentIncomeGbp}
            onChange={(n) => patch({ employmentIncomeGbp: n })}
          />
          <NumField
            label="Trading profit (£)"
            value={inputs.tradingProfitGbp}
            onChange={(n) => patch({ tradingProfitGbp: n })}
          />
          <NumField
            label="Property income (£)"
            value={inputs.propertyIncomeGbp}
            onChange={(n) => patch({ propertyIncomeGbp: n })}
          />
          <NumField
            label="Property expenses (£)"
            value={inputs.propertyExpensesGbp}
            onChange={(n) => patch({ propertyExpensesGbp: n })}
          />
          <NumField
            label="Property finance costs (£)"
            value={inputs.propertyFinanceCostsGbp}
            onChange={(n) => patch({ propertyFinanceCostsGbp: n })}
          />
          <NumField
            label="Dividends (£)"
            value={inputs.dividendsGbp}
            onChange={(n) => patch({ dividendsGbp: n })}
          />
          <NumField
            label="Pension contributions (£)"
            value={inputs.pensionContributionsGbp}
            onChange={(n) => patch({ pensionContributionsGbp: n })}
          />
          <NumField
            label="Other income (£)"
            value={inputs.otherIncomeGbp}
            onChange={(n) => patch({ otherIncomeGbp: n })}
          />
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-card px-3 py-2 sm:col-span-2 lg:col-span-1">
            <div>
              <p className="text-xs font-semibold">Property allowance</p>
              <p className="text-[11px] text-muted-foreground">£1,000 instead of expenses</p>
            </div>
            <Switch
              checked={inputs.usePropertyAllowance}
              onCheckedChange={(c) => patch({ usePropertyAllowance: c })}
            />
          </div>
        </div>

        <p className="mt-4 flex items-start gap-2 text-[11px] text-muted-foreground">
          <Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Bank connect and transaction sync live under Finances → Settings.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total tax", value: fmt(result.totalTaxGbp), emphasise: true },
          { label: "Income tax", value: fmt(result.incomeTaxGbp) },
          { label: "Dividend tax", value: fmt(result.dividendTaxGbp) },
          {
            label: result.corporationTaxGbp > 0 ? "Corporation tax" : "Effective rate",
            value:
              result.corporationTaxGbp > 0
                ? fmt(result.corporationTaxGbp)
                : `${result.effectiveRatePct.toFixed(1)}%`,
          },
        ].map((tile) => (
          <div
            key={tile.label}
            className="rounded-2xl border border-border/50 p-3 shadow-card"
            style={{
              background: tile.emphasise
                ? "color-mix(in srgb, hsl(var(--primary)) 14%, hsl(var(--card)))"
                : "color-mix(in srgb, hsl(var(--primary)) 8%, hsl(var(--card)))",
            }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{tile.label}</p>
            <p className="mt-1 font-display text-lg font-bold text-foreground">{tile.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-card">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bands</h4>
          {result.bandsUsed.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tax bands used.</p>
          ) : (
            <ul className="space-y-1.5">
              {result.bandsUsed.map((b) => (
                <li key={b} className="rounded-xl bg-muted/40 px-3 py-2 text-sm text-foreground">
                  {b}
                </li>
              ))}
            </ul>
          )}
          {result.strategyNotes.length > 0 && (
            <div className="mt-3 space-y-1">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Strategy notes</h4>
              {result.strategyNotes.map((n) => (
                <p key={n} className="text-xs text-muted-foreground">
                  · {n}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-card">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Claim hints</h4>
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {(result.claimHints.length ? result.claimHints : CLAIM_HINTS.slice(0, 4)).map((h) => (
              <li key={h.id} className="rounded-xl border border-border/40 px-3 py-2">
                <p className="text-sm font-semibold text-foreground">{h.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{h.detail}</p>
                <p className="mt-1 text-[11px] font-medium text-primary">{h.typicalSavingNote}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Self-assessment boxes</h4>
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-lg text-xs gap-1.5"
            onClick={() => setReportOpen((o) => !o)}
          >
            {reportOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            Generate self-assessment report
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border/50 text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-2 font-semibold">Schedule</th>
                <th className="py-2 pr-2 font-semibold">Box</th>
                <th className="py-2 pr-2 font-semibold">Description</th>
                <th className="py-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {result.saBoxes.map((row) => (
                <tr key={`${row.schedule}-${row.box}`} className="border-b border-border/30">
                  <td className="py-2 pr-2 text-xs text-muted-foreground">{row.schedule}</td>
                  <td className="py-2 pr-2 font-medium">{row.box}</td>
                  <td className="py-2 pr-2 text-xs text-muted-foreground">{row.description}</td>
                  <td className="py-2 text-right font-semibold">{fmt(row.amountGbp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {reportOpen && (
          <div
            id="sa-tax-report"
            className="mt-4 space-y-3 rounded-xl border border-border/40 bg-background/80 p-4 print:border-0"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-display text-base font-bold">Self-assessment report</p>
                <p className="text-xs text-muted-foreground">
                  {inputs.taxYearLabel} · {ENTITY_OPTIONS.find((e) => e.id === inputs.entityType)?.label}
                </p>
              </div>
              <Button
                size="sm"
                className="h-8 rounded-lg bg-gradient-primary text-xs gap-1.5 print:hidden"
                onClick={() => window.print()}
              >
                <Printer className="h-3.5 w-3.5" />
                Print
              </Button>
            </div>
            <p className="text-sm">
              Estimated total tax <strong>{fmt(result.totalTaxGbp)}</strong> on modelled income of{" "}
              <strong>{fmt(result.totalIncomeGbp)}</strong>.
            </p>
            <ul className="space-y-1">
              {result.saBoxes.map((row) => (
                <li key={`r-${row.schedule}-${row.box}`} className="text-sm">
                  <span className="text-muted-foreground">{row.schedule}</span> — {row.box}:{" "}
                  <strong>{fmt(row.amountGbp)}</strong>
                  <span className="text-xs text-muted-foreground"> ({row.description})</span>
                </li>
              ))}
            </ul>
            {result.strategyNotes.map((n) => (
              <p key={`sn-${n}`} className="text-xs text-muted-foreground">
                {n}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
