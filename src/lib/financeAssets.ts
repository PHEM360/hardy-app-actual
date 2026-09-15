export type FinanceAssetKind = "property";

export interface FinanceAsset {
  id: string;
  kind: FinanceAssetKind;
  name: string;
  value: number;
  rentMonthly: number;
  expensesMonthly: number;
  primaryResidence: boolean;
  growthAssumptionPct: number;
}

export interface PropertyNetIncome {
  monthly: number;
  annual: number;
}

export function asMoney(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function propertyNetIncome(asset: Pick<FinanceAsset, "rentMonthly" | "expensesMonthly">): PropertyNetIncome | null {
  const rent = asMoney(asset.rentMonthly);
  if (rent <= 0) return null;
  const monthly = rent - asMoney(asset.expensesMonthly);
  return { monthly, annual: monthly * 12 };
}

export function propertyYieldPct(asset: Pick<FinanceAsset, "value" | "rentMonthly" | "expensesMonthly">): number | null {
  const net = propertyNetIncome(asset);
  const value = asMoney(asset.value);
  if (!net || value <= 0) return null;
  return (net.annual / value) * 100;
}

export function totalPropertyValue(assets: FinanceAsset[]): number {
  return assets.reduce((sum, asset) => sum + (asset.kind === "property" ? asMoney(asset.value) : 0), 0);
}

export function financeAssetFromDoc(id: string, data: Record<string, unknown>): FinanceAsset {
  return {
    id,
    kind: "property",
    name: String(data.name || "Property"),
    value: asMoney(data.value),
    rentMonthly: asMoney(data.rentMonthly),
    expensesMonthly: asMoney(data.expensesMonthly),
    primaryResidence: data.primaryResidence === true,
    growthAssumptionPct: asMoney(data.growthAssumptionPct),
  };
}

export function financeAssetWriteData(input: Omit<FinanceAsset, "id">): Record<string, unknown> {
  return {
    kind: "property",
    name: input.name.trim() || "Property",
    value: asMoney(input.value),
    rentMonthly: asMoney(input.rentMonthly),
    expensesMonthly: asMoney(input.expensesMonthly),
    primaryResidence: input.primaryResidence === true,
    growthAssumptionPct: asMoney(input.growthAssumptionPct),
  };
}
