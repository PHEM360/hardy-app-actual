export const DEFAULT_ACCOUNT_TYPES = [
  "Current",
  "Savings",
  "ISA",
  "Cash ISA",
  "LISA",
  "GIA",
  "Cash",
  "Investment",
  "Pension",
  "Other",
] as const;

/** @deprecated Use DEFAULT_ACCOUNT_TYPES — kept so existing imports keep working. */
export const ACCOUNT_TYPES = DEFAULT_ACCOUNT_TYPES;

export type AccountType = (typeof DEFAULT_ACCOUNT_TYPES)[number] | string;

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  GIA: "General Investment Account (GIA)",
};

export function accountTypeLabel(type: string) {
  return ACCOUNT_TYPE_LABELS[type] ?? type;
}

export function resolveAccountType(selected: string, custom: string) {
  if (selected !== "Other") return selected;
  const trimmed = custom.trim();
  return trimmed || "Other";
}

export function withOtherLast(types: string[]) {
  const rest = types.filter((t) => t !== "Other");
  return [...rest, "Other"];
}
