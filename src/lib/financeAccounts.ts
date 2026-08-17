export const ACCOUNT_TYPES = [
  "Current",
  "Savings",
  "ISA",
  "LISA",
  "Cash",
  "Investment",
  "Pension",
  "Other",
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];
