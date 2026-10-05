import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

export async function sendCompanyInvoiceEmail(companyId: string, invoiceId: string) {
  const call = httpsCallable<{ companyId: string; invoiceId: string }, { token: string; url: string }>(
    functions,
    "sendCompanyInvoiceEmail",
  );
  return (await call({ companyId, invoiceId })).data;
}

export async function sendCompanyReceiptEmail(companyId: string, invoiceId: string) {
  const call = httpsCallable<{ companyId: string; invoiceId: string }, { ok: boolean }>(
    functions,
    "sendCompanyReceiptEmail",
  );
  return (await call({ companyId, invoiceId })).data;
}

export async function recordCompanyInvoicePaid(input: {
  companyId: string;
  invoiceId: string;
  amount?: number;
  method?: string;
}) {
  const call = httpsCallable<typeof input, { ok: boolean }>(functions, "recordCompanyInvoicePaid");
  return (await call(input)).data;
}

export async function createCompanyIngestKey(companyId: string) {
  const call = httpsCallable<{ companyId: string }, { key: string }>(functions, "createCompanyIngestKey");
  return (await call({ companyId })).data;
}

export async function publishCompanyWebsiteArticle(input: {
  companyId: string;
  articleId: string;
}) {
  const call = httpsCallable<typeof input, { ok: boolean; url?: string }>(functions, "publishCompanyWebsiteArticle");
  return (await call(input)).data;
}

const APP_ORIGIN = "https://hardyapp.co.uk";

export function companyIngestUrl(kind: "lead" | "payment" | "invoice"): string {
  const path = kind === "lead" ? "/api/company/lead" : kind === "payment" ? "/api/company/payment" : "/api/company/million-invoice";
  return `${APP_ORIGIN}${path}`;
}

export function publicInvoiceApiUrl(companyId: string, invoiceId: string, token: string): string {
  const origin = typeof window !== "undefined" && !/localhost|127\.0\.0\.1/.test(window.location.hostname)
    ? window.location.origin
    : APP_ORIGIN;
  return `${origin}/api/company/invoice?companyId=${encodeURIComponent(companyId)}&invoiceId=${encodeURIComponent(invoiceId)}&token=${encodeURIComponent(token)}`;
}
