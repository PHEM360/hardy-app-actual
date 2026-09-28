export type CompanyInvoiceStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "partial"
  | "paid"
  | "overdue"
  | "void"
  | "credited";

export type CompanyInvoiceSource = "hardy" | "million" | "website" | "manual";
export type CompanyInvoiceKind = "invoice" | "credit";
export type CompanyPaymentMethod = "stripe" | "bank_transfer" | "cash" | "card" | "other";
export type CompanyLeadSource = "contact_form" | "signup" | "account_request" | "website" | "million" | "manual";
export type CompanyLeadStatus = "new" | "contacted" | "qualified" | "won" | "lost";
export type CompanyAccountsHome = "hardy" | "million" | "both";

export interface CompanyInvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  accountCode?: string;
}

export interface CompanyInvoiceRepeat {
  frequency: "monthly" | "yearly";
  nextDate: string;
  active: boolean;
}

export interface CompanyInvoice {
  id?: string;
  companyId: string;
  number: string;
  status: CompanyInvoiceStatus;
  kind?: CompanyInvoiceKind;
  repeat?: CompanyInvoiceRepeat;
  source: CompanyInvoiceSource;
  creditOfInvoiceId?: string;
  externalId?: string;
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  lines: CompanyInvoiceLine[];
  subtotal: number;
  vatTotal: number;
  total: number;
  amountPaid: number;
  notes?: string;
  paymentTermsDays: number;
  paymentMethod?: CompanyPaymentMethod;
  paidAt?: string;
  sentAt?: string;
  viewedAt?: string;
  lastEmailedAt?: string;
  receiptSentAt?: string;
  incomeId?: string;
  publicTokenHash?: string;
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;
  createdBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CompanyCustomer {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  vatNumber?: string;
  notes?: string;
  kind?: "customer" | "supplier" | "both";
  source?: CompanyInvoiceSource | CompanyLeadSource;
  createdAt?: unknown;
}

export type CompanyBillStatus = "draft" | "awaiting" | "paid" | "overdue" | "void";

export interface CompanyBill {
  id?: string;
  companyId: string;
  number: string;
  status: CompanyBillStatus;
  supplierId?: string;
  supplierName: string;
  supplierEmail?: string;
  issueDate: string;
  dueDate: string;
  lines: CompanyInvoiceLine[];
  subtotal: number;
  vatTotal: number;
  total: number;
  amountPaid: number;
  category?: string;
  notes?: string;
  paidAt?: string;
  expenseId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type CompanyVatScheme = "not_registered" | "standard" | "flat_rate";

export interface CompanyLead {
  id?: string;
  companyId: string;
  source: CompanyLeadSource;
  status: CompanyLeadStatus;
  name: string;
  email?: string;
  phone?: string;
  message?: string;
  pageUrl?: string;
  companyName?: string;
  externalId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CompanyWebsiteArticle {
  id?: string;
  title: string;
  slug?: string;
  url?: string;
  status: "draft" | "scheduled" | "published";
  publishedAt?: string;
  scheduledFor?: string;
  excerpt?: string;
  body?: string;
  source: "hardy" | "website";
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CompanyBankAccount {
  id?: string;
  name: string;
  provider?: string;
  sortCode?: string;
  accountNumber?: string;
  iban?: string;
  currency: string;
  balance?: number;
  lastImportedAt?: string;
  createdAt?: unknown;
}

export interface CompanyBankTransaction {
  id?: string;
  accountId: string;
  date: string;
  description: string;
  amount: number;
  matchedInvoiceId?: string;
  matchedBillId?: string;
  importedAt?: string;
}

export interface CompanyBillingProfile {
  invoicePrefix: string;
  nextInvoiceNumber: number;
  defaultDueDays: number;
  defaultVatRate: number;
  vatRegistered: boolean;
  vatScheme: CompanyVatScheme;
  vatPeriod: "monthly" | "quarterly";
  vatStagger: 1 | 2 | 3;
  billPrefix: string;
  nextBillNumber: number;
  openingDate?: string;
  openingBank?: number;
  openingDebtors?: number;
  openingCreditors?: number;
  openingVat?: number;
  bankName?: string;
  bankAccountName?: string;
  bankSortCode?: string;
  bankAccountNumber?: string;
  bankIban?: string;
  paymentInstructions?: string;
  fromEmail?: string;
  replyToEmail?: string;
  accountsHome: CompanyAccountsHome;
  millionOrgId?: string;
  millionLabel?: string;
  websiteUrl?: string;
  websitePublishUrl?: string;
  stripeEnabled: boolean;
  footerNote?: string;
  ingestKeyIssuedAt?: string;
}

export const DEFAULT_BILLING_PROFILE: CompanyBillingProfile = {
  invoicePrefix: "INV",
  nextInvoiceNumber: 1,
  defaultDueDays: 14,
  defaultVatRate: 20,
  vatRegistered: false,
  vatScheme: "not_registered",
  vatPeriod: "quarterly",
  vatStagger: 1,
  billPrefix: "BILL",
  nextBillNumber: 1,
  accountsHome: "hardy",
  stripeEnabled: false,
  footerNote: "Thank you for your business.",
};

export const INVOICE_STATUS_LABEL: Record<CompanyInvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  partial: "Part paid",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
  credited: "Credited",
};

export const BILL_STATUS_LABEL: Record<CompanyBillStatus, string> = {
  draft: "Draft",
  awaiting: "Awaiting payment",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

export const DEFAULT_CHART_ACCOUNTS = [
  { code: "200", name: "Sales", type: "income" as const },
  { code: "210", name: "Other income", type: "income" as const },
  { code: "310", name: "Cost of sales", type: "expense" as const },
  { code: "400", name: "Software", type: "expense" as const },
  { code: "410", name: "Marketing", type: "expense" as const },
  { code: "420", name: "Travel", type: "expense" as const },
  { code: "430", name: "Insurance", type: "expense" as const },
  { code: "440", name: "Professional fees", type: "expense" as const },
  { code: "450", name: "Premises", type: "expense" as const },
  { code: "460", name: "Bank charges", type: "expense" as const },
  { code: "490", name: "Other expenses", type: "expense" as const },
];

export function isVatRegistered(profile: Pick<CompanyBillingProfile, "vatRegistered" | "vatScheme">): boolean {
  if (profile.vatScheme && profile.vatScheme !== "not_registered") return true;
  return Boolean(profile.vatRegistered);
}
