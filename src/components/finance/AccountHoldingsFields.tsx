import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AccountFee, AssetClass, FeeKind, FundAllocation, InterestRatePeriod } from "@/hooks/useFinance";
import { ASSET_CLASS_LABELS } from "@/lib/financeInsights";

const ASSET_OPTIONS: AssetClass[] = ["equity", "bond", "cash", "property", "other"];

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function newHolding(): FundAllocation {
  return { id: newId(), name: "", pct: 0, assetClass: "equity" };
}

function newFee(): AccountFee {
  return { id: newId(), name: "", kind: "percent", amount: 0 };
}

function newRate(): InterestRatePeriod {
  return { id: newId(), ratePct: 0, from: new Date().toISOString().split("T")[0] };
}

function KindSelect({ value, onChange }: { value: FeeKind; onChange: (kind: FeeKind) => void }) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as FeeKind)}>
      <SelectTrigger className="h-9 rounded-lg text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="percent">%/yr</SelectItem>
        <SelectItem value="gbp">£/yr</SelectItem>
      </SelectContent>
    </Select>
  );
}

export default function AccountHoldingsFields({
  feePct,
  ocfPct,
  annualFeeGbp,
  adviceFeeAmount,
  adviceFeeKind,
  extraFees,
  interestRates,
  allocations,
  onFeePct,
  onOcfPct,
  onAnnualFeeGbp,
  onAdviceFeeAmount,
  onAdviceFeeKind,
  onExtraFees,
  onInterestRates,
  onAllocations,
}: {
  feePct: string;
  ocfPct: string;
  annualFeeGbp: string;
  adviceFeeAmount: string;
  adviceFeeKind: FeeKind;
  extraFees: AccountFee[];
  interestRates: InterestRatePeriod[];
  allocations: FundAllocation[];
  onFeePct: (value: string) => void;
  onOcfPct: (value: string) => void;
  onAnnualFeeGbp: (value: string) => void;
  onAdviceFeeAmount: (value: string) => void;
  onAdviceFeeKind: (value: FeeKind) => void;
  onExtraFees: (next: AccountFee[]) => void;
  onInterestRates: (next: InterestRatePeriod[]) => void;
  onAllocations: (next: FundAllocation[]) => void;
}) {
  const allocSum = allocations.reduce((sum, row) => sum + (Number(row.pct) || 0), 0);
  const sumOk = allocations.length === 0 || Math.abs(allocSum - 100) < 0.6;
  const sortedRates = [...interestRates].sort((a, b) => a.from.localeCompare(b.from));

  return (
    <div className="space-y-3">
      <div className="space-y-2 p-3 rounded-xl bg-muted/50 border border-border">
        <Label className="text-xs">Account fees</Label>
        <p className="text-[11px] text-muted-foreground -mt-1">
          Used in Summary and projections. Leave blank if you don’t know yet.
        </p>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Platform %/yr</Label>
            <Input type="number" step="0.01" placeholder="0.25" value={feePct} onChange={(e) => onFeePct(e.target.value)} className="h-9 rounded-lg text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Fund OCF %/yr</Label>
            <Input type="number" step="0.01" placeholder="0.20" value={ocfPct} onChange={(e) => onOcfPct(e.target.value)} className="h-9 rounded-lg text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Flat fee £/yr</Label>
            <Input type="number" step="1" placeholder="0" value={annualFeeGbp} onChange={(e) => onAnnualFeeGbp(e.target.value)} className="h-9 rounded-lg text-xs" />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Ongoing advice fee</Label>
          <div className="grid grid-cols-[1fr_5.5rem] gap-1.5">
            <Input
              type="number"
              step="0.01"
              placeholder={adviceFeeKind === "gbp" ? "e.g. 240" : "e.g. 0.5"}
              value={adviceFeeAmount}
              onChange={(e) => onAdviceFeeAmount(e.target.value)}
              className="h-9 rounded-lg text-xs"
            />
            <KindSelect value={adviceFeeKind} onChange={onAdviceFeeKind} />
          </div>
        </div>
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-[10px] text-muted-foreground">Other fees</Label>
            <Button type="button" size="sm" variant="outline" className="h-7 rounded-lg text-xs gap-1" onClick={() => onExtraFees([...extraFees, newFee()])}>
              <Plus className="w-3 h-3" /> Add fee
            </Button>
          </div>
          {extraFees.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">Add named fees such as wrapper, transfer or adviser charges.</p>
          ) : (
            extraFees.map((row) => (
              <div key={row.id} className="space-y-1.5 rounded-lg border border-border bg-background p-2">
                <Input
                  placeholder="Fee name, e.g. Wrapper charge"
                  value={row.name}
                  onChange={(e) =>
                    onExtraFees(extraFees.map((item) => (item.id === row.id ? { ...item, name: e.target.value } : item)))
                  }
                  className="h-9 rounded-lg text-xs"
                />
                <div className="grid grid-cols-[1fr_5.5rem_2rem] gap-1.5 items-center">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder={row.kind === "gbp" ? "£/yr" : "%/yr"}
                    value={row.amount || ""}
                    onChange={(e) =>
                      onExtraFees(
                        extraFees.map((item) =>
                          item.id === row.id ? { ...item, amount: parseFloat(e.target.value) || 0 } : item
                        )
                      )
                    }
                    className="h-9 rounded-lg text-xs"
                  />
                  <KindSelect
                    value={row.kind}
                    onChange={(kind) =>
                      onExtraFees(extraFees.map((item) => (item.id === row.id ? { ...item, kind } : item)))
                    }
                  />
                  <button
                    type="button"
                    className="h-9 w-8 flex items-center justify-center text-muted-foreground hover:text-destructive"
                    onClick={() => onExtraFees(extraFees.filter((item) => item.id !== row.id))}
                    aria-label="Remove fee"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="space-y-2 p-3 rounded-xl bg-muted/50 border border-border">
        <div className="flex items-center justify-between gap-2">
          <div>
            <Label className="text-xs">Interest rates</Label>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Each rate applies from that date until the next one starts.
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg text-xs gap-1" onClick={() => onInterestRates([...interestRates, newRate()])}>
            <Plus className="w-3 h-3" /> Add
          </Button>
        </div>
        {sortedRates.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">Useful for savings and cash ISAs when the rate has changed.</p>
        ) : (
          <div className="space-y-1.5">
            {sortedRates.map((row) => (
              <div key={row.id} className="grid grid-cols-[1fr_1fr_2rem] gap-1.5 items-center">
                <Input
                  type="number"
                  step="0.01"
                  placeholder="% AER"
                  value={row.ratePct || ""}
                  onChange={(e) =>
                    onInterestRates(
                      interestRates.map((item) =>
                        item.id === row.id ? { ...item, ratePct: parseFloat(e.target.value) || 0 } : item
                      )
                    )
                  }
                  className="h-9 rounded-lg text-xs"
                />
                <Input
                  type="date"
                  value={row.from}
                  onChange={(e) =>
                    onInterestRates(interestRates.map((item) => (item.id === row.id ? { ...item, from: e.target.value } : item)))
                  }
                  className="h-9 rounded-lg text-xs"
                />
                <button
                  type="button"
                  className="h-9 w-8 flex items-center justify-center text-muted-foreground hover:text-destructive"
                  onClick={() => onInterestRates(interestRates.filter((item) => item.id !== row.id))}
                  aria-label="Remove rate"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2 p-3 rounded-xl bg-muted/50 border border-border">
        <div className="flex items-center justify-between gap-2">
          <div>
            <Label className="text-xs">Fund allocation</Label>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Split this account into holdings. Cash accounts can be left empty.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 rounded-lg text-xs gap-1"
            onClick={() => onAllocations([...allocations, newHolding()])}
          >
            <Plus className="w-3 h-3" /> Add
          </Button>
        </div>
        {allocations.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No holdings yet. Summary will treat current/savings as cash.</p>
        ) : (
          <div className="space-y-2">
            {allocations.map((row) => (
              <div key={row.id} className="grid grid-cols-[1fr_4.5rem_7rem_2rem] gap-1.5 items-center">
                <Input
                  placeholder="e.g. Global equity"
                  value={row.name}
                  onChange={(e) =>
                    onAllocations(allocations.map((item) => (item.id === row.id ? { ...item, name: e.target.value } : item)))
                  }
                  className="h-9 rounded-lg text-xs"
                />
                <Input
                  type="number"
                  step="0.1"
                  placeholder="%"
                  value={row.pct || ""}
                  onChange={(e) =>
                    onAllocations(
                      allocations.map((item) =>
                        item.id === row.id ? { ...item, pct: parseFloat(e.target.value) || 0 } : item
                      )
                    )
                  }
                  className="h-9 rounded-lg text-xs"
                />
                <Select
                  value={row.assetClass}
                  onValueChange={(value) =>
                    onAllocations(
                      allocations.map((item) =>
                        item.id === row.id ? { ...item, assetClass: value as AssetClass } : item
                      )
                    )
                  }
                >
                  <SelectTrigger className="h-9 rounded-lg text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ASSET_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>{ASSET_CLASS_LABELS[option]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  className="h-9 w-8 flex items-center justify-center text-muted-foreground hover:text-destructive"
                  onClick={() => onAllocations(allocations.filter((item) => item.id !== row.id))}
                  aria-label="Remove holding"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <p className={`text-[11px] font-medium ${sumOk ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400"}`}>
              Allocated {allocSum.toFixed(0)}%{sumOk ? "" : " — should total 100%"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
