/** Multi-flat property management (Flats page — formerly Tattersalls). */

export type FlatOwnership = "personal" | "sole_trader" | "ltd_company";

export type FlatLedgerKind = "income" | "expense";

export interface FlatTenant {
  name: string;
  email?: string;
  phone?: string;
  contractStart?: string;
  contractEnd?: string;
  depositGbp?: number | null;
  rentMonthlyGbp?: number | null;
  notes?: string;
}

export interface FlatBankLink {
  connectionId: string;
  bankAccountId: string;
  financeAccountId?: string | null;
  label?: string;
}

export interface FlatBalanceRecord {
  date: string;
  month: string;
  balance: number;
}

export interface FlatLedgerEntry {
  id: string;
  kind: FlatLedgerKind;
  date: string;
  description: string;
  category: string;
  amountGbp: number;
  frequency?: string;
  source?: "manual" | "truelayer";
  bankTxId?: string | null;
  notes?: string;
}

export interface FlatDocumentMeta {
  id: string;
  name: string;
  date: string;
  url: string;
  fileType: string;
  category?: string;
  notes?: string;
  linkedNoteId?: string;
  linkedNoteType?: "note" | "task";
  linkedNoteText?: string;
  createdAt?: unknown;
}

/** @deprecated alias */
export type FlatDocumentMetaAlias = FlatDocumentMeta;

export interface FlatNoteComment {
  id: string;
  text: string;
  authorName: string;
  createdAt?: string;
}

export interface FlatNote {
  id: string;
  text: string;
  author?: string;
  authorId?: string;
  done: boolean;
  createdAt?: unknown;
  type?: "task" | "note";
  dueDate?: string;
  comments?: FlatNoteComment[];
}

export interface FlatTaxSettings {
  ownership: FlatOwnership;
  companyName?: string;
  companyNumber?: string;
  usePropertyAllowance?: boolean;
  financeCostRestrictionPct?: number;
  notes?: string;
}

export interface FlatRecord {
  id: string;
  name: string;
  slug: string;
  address?: string;
  propertyValueGbp?: number | null;
  mortgageBalanceGbp?: number | null;
  mortgageRatePct?: number | null;
  ownership: FlatOwnership;
  tenant: FlatTenant;
  tax: FlatTaxSettings;
  bankLinks: FlatBankLink[];
  expenseCategories: string[];
  incomeCategories: string[];
  documentCategories: string[];
  balanceHistory: FlatBalanceRecord[];
  ledger: FlatLedgerEntry[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export const DEFAULT_FLAT_EXPENSE_CATEGORIES = [
  "Insurance",
  "Council Tax",
  "Gas & Electricity",
  "Water",
  "Ground Rent",
  "Service Charge",
  "Maintenance",
  "Mortgage Interest",
  "Letting Fees",
  "Repairs",
  "Other",
];

export const DEFAULT_FLAT_INCOME_CATEGORIES = ["Rent", "Deposit retained", "Other income"];

export const DEFAULT_FLAT_DOCUMENT_CATEGORIES = [
  "Tenancy",
  "Insurance",
  "Certificates",
  "Mortgage",
  "Statements",
  "Tax",
  "Other",
];

export const FLAT_SEED: Array<Pick<FlatRecord, "id" | "name" | "slug" | "ownership">> = [
  { id: "tattersalls", name: "Tattersalls", slug: "tattersalls", ownership: "personal" },
  { id: "mums-flat", name: "Mum's Flat", slug: "mums-flat", ownership: "personal" },
];

export const OWNERSHIP_LABELS: Record<FlatOwnership, string> = {
  personal: "Personal income (not a company)",
  sole_trader: "Sole trader",
  ltd_company: "Limited company",
};
