import { useState } from "react";
import { Home, Plus, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatGBP } from "@/lib/financeCalculations";
import {
  propertyNetIncome,
  propertyYieldPct,
  type FinanceAsset,
} from "@/lib/financeAssets";

const EMPTY_FORM = {
  name: "",
  value: "",
  rentMonthly: "",
  expensesMonthly: "",
  primaryResidence: false,
  growthAssumptionPct: "3",
};

type AssetForm = typeof EMPTY_FORM;

function formFromAsset(asset: FinanceAsset): AssetForm {
  return {
    name: asset.name,
    value: asset.value ? String(asset.value) : "",
    rentMonthly: asset.rentMonthly ? String(asset.rentMonthly) : "",
    expensesMonthly: asset.expensesMonthly ? String(asset.expensesMonthly) : "",
    primaryResidence: asset.primaryResidence,
    growthAssumptionPct: asset.growthAssumptionPct ? String(asset.growthAssumptionPct) : "",
  };
}

function payloadFromForm(form: AssetForm): Omit<FinanceAsset, "id"> {
  return {
    kind: "property",
    name: form.name.trim() || "Property",
    value: Number(form.value) || 0,
    rentMonthly: Number(form.rentMonthly) || 0,
    expensesMonthly: Number(form.expensesMonthly) || 0,
    primaryResidence: form.primaryResidence,
    growthAssumptionPct: Number(form.growthAssumptionPct) || 0,
  };
}

export function FinanceAssetsPanel({
  assets,
  canEdit,
  onAdd,
  onUpdate,
  onDelete,
}: {
  assets: FinanceAsset[];
  canEdit: boolean;
  onAdd: (asset: Omit<FinanceAsset, "id">) => Promise<void>;
  onUpdate: (id: string, asset: Omit<FinanceAsset, "id">) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AssetForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (asset: FinanceAsset) => {
    setEditingId(asset.id);
    setForm(formFromAsset(asset));
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !(Number(form.value) > 0)) {
      toast.error("Add a name and the current value");
      return;
    }
    setSaving(true);
    try {
      const payload = payloadFromForm(form);
      if (editingId) await onUpdate(editingId, payload);
      else await onAdd(payload);
      setOpen(false);
      toast.success(editingId ? "Property saved" : "Property added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save this property");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      await onDelete(editingId);
      setOpen(false);
      toast.success("Property removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove this property");
    } finally {
      setSaving(false);
    }
  };

  const preview = payloadFromForm(form);
  const previewNet = propertyNetIncome(preview);
  const previewYield = propertyYieldPct(preview);

  return (
    <section className="mb-3 sm:mb-5">
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="inline-block h-4 w-1 rounded-full bg-gradient-primary" />
          Property
        </h3>
        {canEdit && (
          <Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-lg" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" /> Add property
          </Button>
        )}
      </div>

      {assets.length === 0 ? (
        <button
          type="button"
          onClick={canEdit ? openNew : undefined}
          className="w-full rounded-2xl border-2 border-border p-4 text-left shadow-card"
          style={{ background: "color-mix(in srgb, hsl(25,62%,55%) 14%, hsl(var(--card)))" }}
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
              <Home className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="font-display text-sm font-bold text-foreground">No property added yet</p>
              <p className="mt-0.5 text-xs leading-snug text-foreground/80">
                Add a house or flat so its value sits in net worth, with rent and costs if you let it.
              </p>
            </div>
          </div>
        </button>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {assets.map((asset) => {
            const net = propertyNetIncome(asset);
            const yieldPct = propertyYieldPct(asset);
            return (
              <div
                key={asset.id}
                className="relative overflow-hidden rounded-2xl border-2 border-border bg-card shadow-card"
              >
                <span className="absolute inset-y-0 left-0 w-1.5 bg-gradient-primary" />
                <div
                  className="p-4 pl-5"
                  style={{ background: "color-mix(in srgb, hsl(25,62%,55%) 10%, hsl(var(--card)))" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-display text-sm font-bold text-foreground">{asset.name}</p>
                      <p className="mt-0.5 text-xl font-bold font-display text-foreground">{formatGBP(asset.value)}</p>
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => openEdit(asset)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-card hover:text-foreground"
                        aria-label={`Edit ${asset.name}`}
                      >
                        <Settings2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {asset.primaryResidence && (
                      <span className="rounded-lg border border-primary/30 bg-card px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-foreground">
                        Primary home
                      </span>
                    )}
                    {asset.growthAssumptionPct > 0 && (
                      <span className="rounded-lg border border-border bg-card px-2 py-0.5 text-[10px] font-semibold text-foreground">
                        {asset.growthAssumptionPct}% assumed growth
                      </span>
                    )}
                  </div>
                  {net ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-border bg-card px-2.5 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Net income</p>
                        <p className="font-display text-sm font-bold text-foreground">{formatGBP(net.annual)} / yr</p>
                        <p className="text-[11px] text-foreground/80">{formatGBP(net.monthly)} a month</p>
                      </div>
                      <div className="rounded-xl border border-border bg-card px-2.5 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Yield</p>
                        <p className="font-display text-sm font-bold text-foreground">{yieldPct === null ? "—" : `${yieldPct.toFixed(1)}%`}</p>
                        <p className="text-[11px] text-foreground/80">of current value</p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-foreground/80">No rent set — counted in net worth only.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined} className="mx-4 max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editingId ? "Edit property" : "Add property"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="asset-name">Name</Label>
              <Input
                id="asset-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="e.g. 12 Harbour Road"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="asset-value">Current value (£)</Label>
              <Input
                id="asset-value"
                type="number"
                min="0"
                step="1000"
                value={form.value}
                onChange={(event) => setForm((current) => ({ ...current, value: event.target.value }))}
                placeholder="e.g. 425000"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="asset-rent">Monthly rent (£)</Label>
                <Input
                  id="asset-rent"
                  type="number"
                  min="0"
                  step="10"
                  value={form.rentMonthly}
                  onChange={(event) => setForm((current) => ({ ...current, rentMonthly: event.target.value }))}
                  placeholder="Leave blank if none"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="asset-costs">Monthly costs (£)</Label>
                <Input
                  id="asset-costs"
                  type="number"
                  min="0"
                  step="10"
                  value={form.expensesMonthly}
                  onChange={(event) => setForm((current) => ({ ...current, expensesMonthly: event.target.value }))}
                  placeholder="Insurance, service…"
                  className="h-11 rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="asset-growth">Assumed annual growth (%)</Label>
              <Input
                id="asset-growth"
                type="number"
                min="0"
                step="0.1"
                value={form.growthAssumptionPct}
                onChange={(event) => setForm((current) => ({ ...current, growthAssumptionPct: event.target.value }))}
                placeholder="e.g. 3"
                className="h-11 rounded-xl"
              />
            </div>
            <label className="flex items-center gap-2 rounded-xl border-2 border-border bg-card px-3 py-2.5">
              <Checkbox
                checked={form.primaryResidence}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, primaryResidence: checked === true }))}
              />
              <span className="text-sm font-medium text-foreground">This is our primary home</span>
            </label>
            {previewNet && (
              <div className="rounded-xl border border-border bg-card px-3 py-2.5">
                <p className="text-xs font-semibold text-foreground">
                  Net {formatGBP(previewNet.annual)} a year ({formatGBP(previewNet.monthly)} a month)
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {previewYield === null ? "—" : `${previewYield.toFixed(1)}%`} of the current value after costs
                </p>
              </div>
            )}
            <Button onClick={() => void save()} disabled={saving} className="h-11 w-full rounded-xl bg-gradient-primary">
              {saving ? "Saving…" : editingId ? "Save property" : "Add property"}
            </Button>
            {editingId && (
              <button
                type="button"
                onClick={() => void remove()}
                disabled={saving}
                className="flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove property
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
