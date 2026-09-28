import { createHash, randomBytes, timingSafeEqual } from "crypto";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { postmarkKey } from "./notifications/scheduler";
import { sendTransactionalEmail } from "./notifications/sender";

const APP_URL = "https://hardyapp.co.uk";
const CORS = { cors: true as const, maxInstances: 10 };

function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function requireUid(auth?: { uid: string; token?: Record<string, unknown> }) {
  const uid = auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "You must be signed in.");
  if (auth?.token?.deviceId) throw new HttpsError("permission-denied", "Remote display credentials cannot use this service.");
  return uid;
}

async function requireCompanyEdit(uid: string, companyId: string) {
  const db = admin.firestore();
  const [companySnap, userSnap] = await Promise.all([
    db.doc(`companies/${companyId}`).get(),
    db.doc(`users/${uid}`).get(),
  ]);
  if (!companySnap.exists) throw new HttpsError("not-found", "Company not found.");
  const company = companySnap.data() || {};
  const user = userSnap.data() || {};
  const role = String(user.role || "").toLowerCase().replace(/[\s_-]+/g, "");
  const adminUser = role === "admin" || role === "superadmin" || user.isAdmin === true || user.isSuperAdmin === true;
  const owner = !company.ownerId || company.ownerId === uid;
  const shared = Array.isArray(company.sharedWith) && company.sharedWith.includes(uid);
  if (adminUser || owner || shared) return { company, companySnap };
  throw new HttpsError("permission-denied", "You cannot manage this company's accounts.");
}

function invoiceHtml(companyName: string, number: string, total: string, due: string): string {
  return `<p>Please find invoice <strong>${number}</strong> from ${companyName}.</p><p>Amount due: <strong>${total}</strong> by ${due}.</p>`;
}

export const sendCompanyInvoiceEmail = onCall({ secrets: [postmarkKey] }, async (request) => {
  const uid = requireUid(request.auth);
  const companyId = String(request.data?.companyId || "");
  const invoiceId = String(request.data?.invoiceId || "");
  const { company } = await requireCompanyEdit(uid, companyId);
  const db = admin.firestore();
  const invoiceRef = db.doc(`companies/${companyId}/invoices/${invoiceId}`);
  const invoiceSnap = await invoiceRef.get();
  if (!invoiceSnap.exists) throw new HttpsError("not-found", "Invoice not found.");
  const invoice = invoiceSnap.data() || {};
  const email = String(invoice.customerEmail || "").trim();
  if (!email) throw new HttpsError("failed-precondition", "This invoice has no customer email.");
  const token = randomBytes(24).toString("hex");
  await invoiceRef.update({
    publicTokenHash: hashSecret(token),
    status: invoice.status === "draft" ? "sent" : invoice.status,
    sentAt: new Date().toISOString(),
    lastEmailedAt: new Date().toISOString(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  const url = `${APP_URL}/i/${companyId}/${invoiceId}?t=${token}`;
  const total = `£${Number(invoice.total || 0).toFixed(2)}`;
  await sendTransactionalEmail(postmarkKey.value(), email, {
    subject: `Invoice ${invoice.number} from ${company.name}`,
    heading: `Invoice ${invoice.number}`,
    body_html: invoiceHtml(String(company.name), String(invoice.number), total, String(invoice.dueDate || "")),
    body_text: `Invoice ${invoice.number} from ${company.name}. Amount due ${total}. View and pay: ${url}`,
    action: { url, label: "View invoice" },
    footer_note: "This link is private to this invoice.",
  });
  return { token, url };
});

export const sendCompanyReceiptEmail = onCall({ secrets: [postmarkKey] }, async (request) => {
  const uid = requireUid(request.auth);
  const companyId = String(request.data?.companyId || "");
  const invoiceId = String(request.data?.invoiceId || "");
  const { company } = await requireCompanyEdit(uid, companyId);
  const invoiceRef = admin.firestore().doc(`companies/${companyId}/invoices/${invoiceId}`);
  const invoiceSnap = await invoiceRef.get();
  if (!invoiceSnap.exists) throw new HttpsError("not-found", "Invoice not found.");
  const invoice = invoiceSnap.data() || {};
  const email = String(invoice.customerEmail || "").trim();
  if (!email) throw new HttpsError("failed-precondition", "This invoice has no customer email.");
  const token = randomBytes(24).toString("hex");
  await invoiceRef.update({
    publicTokenHash: hashSecret(token),
    receiptSentAt: new Date().toISOString(),
    lastEmailedAt: new Date().toISOString(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  const url = `${APP_URL}/i/${companyId}/${invoiceId}?t=${token}`;
  await sendTransactionalEmail(postmarkKey.value(), email, {
    subject: `Receipt ${invoice.number} from ${company.name}`,
    heading: `Receipt ${invoice.number}`,
    body_html: `<p>Thank you. Payment for <strong>${invoice.number}</strong> has been received.</p>`,
    body_text: `Receipt ${invoice.number} from ${company.name}. ${url}`,
    action: { url, label: "View receipt" },
  });
  return { ok: true };
});

export const recordCompanyInvoicePaid = onCall(async (request) => {
  const uid = requireUid(request.auth);
  const companyId = String(request.data?.companyId || "");
  const invoiceId = String(request.data?.invoiceId || "");
  await requireCompanyEdit(uid, companyId);
  await markInvoicePaid(companyId, invoiceId, {
    amount: Number(request.data?.amount || 0),
    method: String(request.data?.method || "bank_transfer"),
  });
  return { ok: true };
});

async function markInvoicePaid(companyId: string, invoiceId: string, opts: { amount?: number; method?: string; stripePaymentIntentId?: string }) {
  const db = admin.firestore();
  const invoiceRef = db.doc(`companies/${companyId}/invoices/${invoiceId}`);
  const snap = await invoiceRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "Invoice not found.");
  const invoice = snap.data() || {};
  const total = Number(invoice.total || 0);
  const paid = opts.amount && opts.amount > 0 ? Math.min(opts.amount, total) : total;
  const incomeRef = await db.collection(`companies/${companyId}/income`).add({
    date: new Date().toISOString().slice(0, 10),
    description: `${invoice.number} · ${invoice.customerName || "Invoice"}`,
    amount: paid,
    category: "Services",
    invoiceRef: invoice.number || "",
    createdAt: FieldValue.serverTimestamp(),
  });
  await invoiceRef.update({
    status: paid >= total ? "paid" : "partial",
    amountPaid: paid,
    paidAt: new Date().toISOString(),
    paymentMethod: opts.method || "bank_transfer",
    stripePaymentIntentId: opts.stripePaymentIntentId || invoice.stripePaymentIntentId || null,
    incomeId: incomeRef.id,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export const createCompanyIngestKey = onCall(async (request) => {
  const uid = requireUid(request.auth);
  const companyId = String(request.data?.companyId || "");
  await requireCompanyEdit(uid, companyId);
  const key = `hh_${randomBytes(24).toString("hex")}`;
  await admin.firestore().doc(`companies/${companyId}/hubSecrets/ingest`).set({
    keyHash: hashSecret(key),
    createdAt: FieldValue.serverTimestamp(),
    createdBy: uid,
  });
  await admin.firestore().doc(`companies/${companyId}/billing/profile`).set({
    ingestKeyIssuedAt: new Date().toISOString(),
  }, { merge: true });
  return { key };
});

async function companyFromIngestKey(req: { get: (name: string) => string | undefined; body?: Record<string, unknown>; query?: Record<string, unknown> }) {
  const companyId = String(req.body?.companyId || req.query?.companyId || "");
  const key = String(req.get("x-company-key") || req.body?.key || "");
  if (!companyId || !key) return null;
  const snap = await admin.firestore().doc(`companies/${companyId}/hubSecrets/ingest`).get();
  const stored = String(snap.data()?.keyHash || "");
  if (!stored || !safeEqual(stored, hashSecret(key))) return null;
  return companyId;
}

function json(res: { set: Function; status: Function }, status: number, body: unknown) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type, X-Company-Key");
  return res.status(status).json(body);
}

export const ingestCompanyLead = onRequest(CORS, async (req, res) => {
  if (req.method === "OPTIONS") return json(res, 204, {});
  if (req.method !== "POST") return json(res, 405, { error: "POST only" });
  const companyId = await companyFromIngestKey(req);
  if (!companyId) return json(res, 401, { error: "Invalid company key" });
  const body = req.body || {};
  await admin.firestore().collection(`companies/${companyId}/leads`).add({
    companyId,
    source: String(body.source || "website"),
    status: "new",
    name: String(body.name || "Website lead"),
    email: body.email || "",
    phone: body.phone || "",
    message: body.message || "",
    pageUrl: body.pageUrl || "",
    companyName: body.companyName || "",
    externalId: body.externalId || "",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return json(res, 200, { ok: true });
});

export const ingestCompanyPayment = onRequest(CORS, async (req, res) => {
  if (req.method === "OPTIONS") return json(res, 204, {});
  if (req.method !== "POST") return json(res, 405, { error: "POST only" });
  const companyId = await companyFromIngestKey(req);
  if (!companyId) return json(res, 401, { error: "Invalid company key" });
  const invoiceId = String(req.body?.invoiceId || "");
  if (!invoiceId) return json(res, 400, { error: "invoiceId required" });
  await markInvoicePaid(companyId, invoiceId, {
    amount: Number(req.body?.amount || 0),
    method: String(req.body?.method || "stripe"),
    stripePaymentIntentId: req.body?.stripePaymentIntentId ? String(req.body.stripePaymentIntentId) : undefined,
  });
  return json(res, 200, { ok: true });
});

export const ingestMillionInvoice = onRequest(CORS, async (req, res) => {
  if (req.method === "OPTIONS") return json(res, 204, {});
  if (req.method !== "POST") return json(res, 405, { error: "POST only" });
  const companyId = await companyFromIngestKey(req);
  if (!companyId) return json(res, 401, { error: "Invalid company key" });
  const body = req.body || {};
  const externalId = String(body.externalId || body.id || "");
  if (!externalId) return json(res, 400, { error: "externalId required" });
  const col = admin.firestore().collection(`companies/${companyId}/invoices`);
  const existing = await col.where("externalId", "==", externalId).limit(1).get();
  const payload = {
    companyId,
    number: String(body.invoiceNumber || body.number || externalId),
    status: String(body.status || "sent"),
    source: "million",
    externalId,
    customerName: String(body.patientName || body.customerName || "Customer"),
    customerEmail: body.patientEmail || body.customerEmail || "",
    issueDate: String(body.issueDate || new Date().toISOString().slice(0, 10)),
    dueDate: String(body.dueDate || new Date().toISOString().slice(0, 10)),
    currency: String(body.currency || "GBP"),
    lines: Array.isArray(body.lineItems || body.lines) ? (body.lineItems || body.lines) : [],
    subtotal: Number(body.subtotal || 0),
    vatTotal: Number(body.vatAmount || body.vatTotal || 0),
    total: Number(body.total || 0),
    amountPaid: Number(body.amountPaid || 0),
    paymentTermsDays: Number(body.paymentTermsDays || 14),
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (existing.empty) {
    await col.add({ ...payload, createdAt: FieldValue.serverTimestamp() });
  } else {
    await existing.docs[0].ref.set(payload, { merge: true });
  }
  return json(res, 200, { ok: true });
});

export const getPublicInvoice = onRequest(CORS, async (req, res) => {
  const companyId = String(req.query.companyId || "");
  const invoiceId = String(req.query.invoiceId || "");
  const token = String(req.query.token || "");
  if (!companyId || !invoiceId || !token) return json(res, 400, { error: "Missing invoice link details" });
  const db = admin.firestore();
  const [companySnap, invoiceSnap] = await Promise.all([
    db.doc(`companies/${companyId}`).get(),
    db.doc(`companies/${companyId}/invoices/${invoiceId}`).get(),
  ]);
  if (!companySnap.exists || !invoiceSnap.exists) return json(res, 404, { error: "Invoice not found" });
  const invoice = invoiceSnap.data() || {};
  const hash = String(invoice.publicTokenHash || "");
  if (!hash || !safeEqual(hash, hashSecret(token))) return json(res, 403, { error: "This invoice link is not valid" });
  if (!invoice.viewedAt) {
    await invoiceSnap.ref.update({ viewedAt: new Date().toISOString(), status: invoice.status === "sent" ? "viewed" : invoice.status });
  }
  const billing = (await db.doc(`companies/${companyId}/billing/profile`).get()).data() || {};
  const company = companySnap.data() || {};
  return json(res, 200, {
    company: {
      name: company.name,
      color: company.color,
      emoji: company.emoji,
      logoUrl: company.logoUrl,
      contact: company.contact || {},
    },
    billing: {
      bankName: billing.bankName || "",
      bankAccountName: billing.bankAccountName || "",
      bankSortCode: billing.bankSortCode || "",
      bankAccountNumber: billing.bankAccountNumber || "",
      bankIban: billing.bankIban || "",
      paymentInstructions: billing.paymentInstructions || "",
      footerNote: billing.footerNote || "",
      vatRegistered: !!billing.vatRegistered,
    },
    invoice: {
      number: invoice.number,
      status: invoice.status,
      customerName: invoice.customerName,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      lines: invoice.lines || [],
      subtotal: invoice.subtotal,
      vatTotal: invoice.vatTotal,
      total: invoice.total,
      amountPaid: invoice.amountPaid,
      notes: invoice.notes || "",
      paidAt: invoice.paidAt || "",
    },
  });
});

export const publishCompanyWebsiteArticle = onCall(async (request) => {
  const uid = requireUid(request.auth);
  const companyId = String(request.data?.companyId || "");
  const articleId = String(request.data?.articleId || "");
  await requireCompanyEdit(uid, companyId);
  const db = admin.firestore();
  const [articleSnap, billingSnap] = await Promise.all([
    db.doc(`companies/${companyId}/websiteContent/${articleId}`).get(),
    db.doc(`companies/${companyId}/billing/profile`).get(),
  ]);
  if (!articleSnap.exists) throw new HttpsError("not-found", "Article not found.");
  const publishUrl = String(billingSnap.data()?.websitePublishUrl || "");
  if (!publishUrl.startsWith("https://")) throw new HttpsError("failed-precondition", "Set an https website publish webhook first.");
  const article = articleSnap.data() || {};
  const response = await fetch(publishUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: article.title,
      body: article.body,
      excerpt: article.excerpt,
      status: "published",
      source: "hardy",
    }),
  });
  if (!response.ok) {
    logger.error("Website publish failed", { companyId, status: response.status });
    throw new HttpsError("unavailable", "The company website did not accept the article.");
  }
  const payload = await response.json().catch(() => ({})) as { url?: string };
  await articleSnap.ref.update({
    status: "published",
    publishedAt: new Date().toISOString(),
    url: payload.url || article.url || "",
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { ok: true, url: payload.url };
});

export const remindOverdueCompanyInvoices = onSchedule({ schedule: "0 8 * * *", timeZone: "Europe/London" }, async () => {
  const today = new Date().toISOString().slice(0, 10);
  const companies = await admin.firestore().collection("companies").get();
  for (const company of companies.docs) {
    const invoices = await company.ref.collection("invoices").where("dueDate", "<", today).get();
    for (const invoice of invoices.docs) {
      const data = invoice.data();
      if (["paid", "void", "credited", "draft"].includes(String(data.status))) continue;
      if (data.status !== "overdue") await invoice.ref.update({ status: "overdue" });
    }
  }
});
