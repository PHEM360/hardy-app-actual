import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AssetClass, FundAllocation } from "@/hooks/useFinance";
import { ASSET_CLASS_LABELS } from "@/lib/financeInsights";

const ASSET_OPTIONS: AssetClass[] = ["equity", "bond", "cash", "property", "other"];

function newHolding(): FundAllocation {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `alloc-${Date.now()}`,
    name: "",
    pct: 0,
    assetClass: "equity",
  };
}

export default function AccountHoldingsFields({
  feePct,
  ocfPct,
  annualFeeGbp,
  allocations,
  onFeePct,
  onOcfPct,
  onAnnualFeeGbp,
  onAllocations,
}: {
  feePct: string;
  ocfPct: string;
  annualFeeGbp: string;
  allocations: FundAllocation[];
  onFeePct: (value: string) => void;
  onOcfPct: (value: string) => void;
  onAnnualFeeGbp: (value: string) => void;
  onAllocations: (next: FundAllocation[]) => void;
}) {
  const allocSum = allocations.reduce((sum, row) => sum + (Number(row.pct) || 0), 0);
  const sumOk = allocations.length === 0 || Math.abs(allocSum - 100) < 0.6;

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
