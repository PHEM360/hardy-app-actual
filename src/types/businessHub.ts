import type { Company, CompanyExpense, CompanyIncome, ContentPiece } from "@/types/app";

export type BusinessInvoiceStatus =
  | "draft"
  | "pending"
  | "issued"
  | "part_paid"
  | "partially_paid"
  | "sent"
  | "viewed"
  | "paid"
  | "overdue"
  | "void"
  | "written_off";

export type BusinessInvoiceSource = "hardy" | "milion" | "stripe" | "xero" | "import";

export interface BusinessInvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
}

export interface BusinessInvoiceRecipient {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface BusinessInvoice {
  id?: string;
  companyId: string;
  legalEntityCompanyId?: string;
  invoiceNumber: string;
  status: BusinessInvoiceStatus;
  source: BusinessInvoiceSource;
  recipient: BusinessInvoiceRecipient;
  lineItems: BusinessInvoiceLine[];
  currency: "GBP" | string;
  subtotal: number;
  vatAmount: number;
  total: number;
  amountPaid: number;
  issueDate: string;
  dueDate: string;
  notes?: string;
  paymentMethod?: string;
  paidAt?: string;
  sentAt?: string;
  externalId?: string;
  externalUrl?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type BusinessLeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "converted"
  | "closed"
  | "spam";

export interface BusinessLead {
  id?: string;
  companyId: string;
  name: string;
  email?: string;
  phone?: string;
  subject?: string;
  message?: string;
  source: string;
  status: BusinessLeadStatus;
  website?: string;
  externalId?: string;
  receivedAt: string;
  updatedAt?: unknown;
}

export type BusinessIntegrationProvider =
  | "milion"
  | "stripe"
  | "xero"
  | "tide"
  | "website"
  | "other";

export interface BusinessIntegration {
  id?: string;
  companyId: string;
  provider: BusinessIntegrationProvider;
  enabled: boolean;
  externalId?: string;
  label?: string;
  baseUrl?: string;
  lastSyncAt?: string;
  lastError?: string;
  capabilities?: string[];
  metadata?: Record<string, string | number | boolean | null>;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface BusinessContentItem extends ContentPiece {
  companyId: string;
  companyName: string;
}

export interface BusinessCompanyData {
  company: Company;
  income: CompanyIncome[];
  expenses: CompanyExpense[];
  invoices: BusinessInvoice[];
  leads: BusinessLead[];
  content: BusinessContentItem[];
  integrations: BusinessIntegration[];
}

export interface BusinessCompanyTotals {
  companyId: string;
  income: number;
  expenses: number;
  profit: number;
  invoiced: number;
  outstanding: number;
  overdue: number;
  openLeads: number;
}

export interface BusinessHubTotals {
  income: number;
  expenses: number;
  profit: number;
  invoiced: number;
  outstanding: number;
  overdue: number;
  openLeads: number;
}

export interface MilionBridgeSnapshot {
  orgId: string;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    status: string;
    patientName?: string;
    patientEmail?: string;
    issueDate?: string;
    dueDate?: string;
    subtotal?: number;
    vatAmount?: number;
    total?: number;
    amountPaid?: number;
    paymentMethod?: string;
    paidAt?: string;
    sentAt?: string;
    lineItems?: BusinessInvoiceLine[];
  }>;
  income: number;
  expenses: number;
  outstanding: number;
  overdue: number;
  lastUpdatedAt?: string;
}
