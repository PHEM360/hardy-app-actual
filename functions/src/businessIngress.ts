import { createHash, randomBytes } from "node:crypto";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

const KEY_PREFIX = "hbk_";
const VALID_SCOPES = new Set(["leads", "payments", "content"]);
const db = () => admin.firestore();

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function safeText(value: unknown, max = 5000) {
  return String(value ?? "").trim().slice(0, max);
}

function cleanRole(value: unknown) {
  return String(value || "").toLowerCase().replace(/[\s_-]+/g, "");
}

function requireUid(request: { auth?: { uid?: string; token?: Record<string, unknown> } }) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "You must be signed in.");
  if (request.auth?.token?.deviceId) {
    throw new HttpsError("permission-denied", "Remote display credentials cannot manage business integrations.");
  }
  return uid;
}

async function assertCompanyEdit(uid: string, companyId: string) {
  const [companySnap, userSnap] = await Promise.all([
    db().doc(`companies/${companyId}`).get(),
    db().doc(`users/${uid}`).get(),
  ]);
  if (!companySnap.exists) throw new HttpsError("not-found", "Company not found.");
  const company = companySnap.data() || {};
  const user = userSnap.data() || {};
  const role = cleanRole(user.role);
  const isAdmin =
    role === "admin" ||
    role === "superadmin" ||
    user.isAdmin === true ||
    user.isSuperAdmin === true;
  const owner = !company.ownerId || company.ownerId === uid;
  const shared = Array.isArray(company.sharedWith) && company.sharedWith.includes(uid);
  if (!isAdmin && !owner && !shared) {
    throw new HttpsError("permission-denied", "You cannot manage integrations for this company.");
  }
}

function normaliseScopes(value: unknown): string[] {
  const requested = Array.isArray(value) ? value.map((item) => String(item)) : [];
  const scopes = requested.filter((scope) => VALID_SCOPES.has(scope));
  return scopes.length ? [...new Set(scopes)] : ["leads", "payments", "content"];
}

export const createBusinessWebsiteKey = onCall(async (request) => {
  const uid = requireUid(request);
  const companyId = safeText(request.data?.companyId, 128);
  const label = safeText(request.data?.label, 120) || "Website connector";
  if (!companyId) throw new HttpsError("invalid-argument", "companyId is required.");
  await assertCompanyEdit(uid, companyId);

  const scopes = normaliseScopes(request.data?.scopes);
  const token = `${KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  const id = hashToken(token);
  await db().doc(`businessApiKeys/${id}`).set({
    companyId,
    label,
    scopes,
    active: true,
    tokenPrefix: token.slice(0, 12),
    createdBy: uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastUsedAt: null,
  });

  return {
    id,
    token,
    tokenPrefix: token.slice(0, 12),
    scopes,
    functionName: "businessWebsiteIngress",
    warning: "This token is shown once. Store it in the website backend secret store, never in browser JavaScript.",
  };
});

export const listBusinessWebsiteKeys = onCall(async (request) => {
  const uid = requireUid(request);
  const companyId = safeText(request.data?.companyId, 128);
  if (!companyId) throw new HttpsError("invalid-argument", "companyId is required.");
  await assertCompanyEdit(uid, companyId);

  const snap = await db().collection("businessApiKeys").where("companyId", "==", companyId).get();
  return {
    keys: snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .map((row: any) => ({
        id: row.id,
        label: row.label || "Website connector",
        scopes: Array.isArray(row.scopes) ? row.scopes : [],
        active: row.active === true,
        tokenPrefix: row.tokenPrefix || "",
        createdAt: row.createdAt?.toDate?.()?.toISOString?.() || null,
        lastUsedAt: row.lastUsedAt?.toDate?.()?.toISOString?.() || null,
      }))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))),
  };
});

export const revokeBusinessWebsiteKey = onCall(async (request) => {
  const uid = requireUid(request);
  const keyId = safeText(request.data?.keyId, 128);
  if (!keyId) throw new HttpsError("invalid-argument", "keyId is required.");
  const ref = db().doc(`businessApiKeys/${keyId}`);
  const snap = await ref.get();
  if (!snap.exists) return { ok: true };
  const companyId = safeText(snap.data()?.companyId, 128);
  await assertCompanyEdit(uid, companyId);
  await ref.set({
    active: false,
    revokedAt: admin.firestore.FieldValue.serverTimestamp(),
    revokedBy: uid,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  return { ok: true };
});

function bearer(req: any) {
  return safeText(req.headers?.authorization, 512).replace(/^Bearer\s+/i, "");
}

async function authenticateWebsite(req: any) {
  const token = bearer(req);
  if (!token.startsWith(KEY_PREFIX) || token.length < 30) return null;
  const ref = db().doc(`businessApiKeys/${hashToken(token)}`);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.active !== true) return null;
  return { ref, key: snap.data() as Record<string, any> };
}

function eventDocId(companyId: string, eventId: string) {
  return hashToken(`${companyId}:${eventId}`);
}

async function reserveEvent(companyId: string, eventId: string, type: string) {
  if (!eventId) return null;
  const ref = db().doc(`businessIngressEvents/${eventDocId(companyId, eventId)}`);
  const reserved = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) return false;
    tx.set(ref, {
      companyId,
      eventId,
      type,
      receivedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return true;
  });
  return reserved ? ref : false;
}

async function ingestLead(companyId: string, body: Record<string, any>) {
  const kind = body.type === "signup" ? "signup" : "contact";
  const email = safeText(body.email, 320);
  const name = safeText(body.name, 240) || email || "Website enquiry";
  const ref = await db().collection(`companies/${companyId}/leads`).add({
    companyId,
    name,
    email: email || null,
    phone: safeText(body.phone, 80) || null,
    subject: safeText(body.subject, 300) || (kind === "signup" ? "Website sign-up" : "Website enquiry"),
    message: safeText(body.message, 10000) || null,
    source: safeText(body.source, 120) || `website:${kind}`,
    website: safeText(body.website, 500) || null,
    externalId: safeText(body.externalId || body.eventId, 240) || null,
    status: "new",
    receivedAt: new Date().toISOString(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { leadId: ref.id };
}

async function findNativeInvoice(companyId: string, body: Record<string, any>) {
  const invoiceId = safeText(body.invoiceId, 160);
  if (invoiceId) {
    const ref = db().doc(`companies/${companyId}/invoices/${invoiceId}`);
    const snap = await ref.get();
    if (snap.exists) return { ref, data: snap.data() || {} };
  }
  const number = safeText(body.invoiceNumber, 160);
  if (!number) return null;
  const snap = await db()
    .collection(`companies/${companyId}/invoices`)
    .where("invoiceNumber", "==", number)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return { ref: snap.docs[0].ref, data: snap.docs[0].data() };
}

async function ingestPayment(companyId: string, body: Record<string, any>, eventId: string) {
  const amount = Math.round((Number(body.amount) || 0) * 100) / 100;
  if (!(amount > 0)) throw new Error("A positive payment amount is required.");

  const milion = await db().doc(`companies/${companyId}/businessIntegrations/milion`).get();
  if (milion.exists && milion.data()?.enabled === true) {
    throw new Error("Payments for a Milion-linked business must be sent to Milion so there is only one accounts ledger.");
  }

  const invoice = await findNativeInvoice(companyId, body);
  const date = safeText(body.date, 10) || new Date().toISOString().slice(0, 10);
  const paymentId = safeText(body.paymentId || body.externalId || eventId, 240) || randomBytes(12).toString("hex");
  const incomeRef = db().doc(`companies/${companyId}/income/web_${hashToken(paymentId).slice(0, 32)}`);

  await db().runTransaction(async (tx) => {
    const incomeSnap = await tx.get(incomeRef);
    if (incomeSnap.exists) return;

    tx.set(incomeRef, {
      date,
      description: safeText(body.description, 500) || `Website payment${invoice?.data?.invoiceNumber ? ` — ${invoice.data.invoiceNumber}` : ""}`,
      amount,
      category: safeText(body.category, 120) || "Sales",
      invoiceRef: invoice?.data?.invoiceNumber || safeText(body.invoiceNumber, 160) || null,
      source: safeText(body.source, 120) || "website",
      externalId: paymentId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (invoice) {
      const currentPaid = Number(invoice.data.amountPaid) || 0;
      const total = Number(invoice.data.total) || 0;
      const paid = Math.min(total || currentPaid + amount, currentPaid + amount);
      tx.update(invoice.ref, {
        amountPaid: paid,
        status: total > 0 && paid >= total ? "paid" : "part_paid",
        paidAt: total > 0 && paid >= total ? new Date().toISOString() : invoice.data.paidAt || null,
        paymentMethod: safeText(body.paymentMethod, 80) || invoice.data.paymentMethod || "online",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

  return { invoiceId: invoice?.ref.id || null, incomeId: incomeRef.id };
}

async function ingestContent(companyId: string, body: Record<string, any>) {
  const contentId = safeText(body.contentId, 160);
  if (!contentId) throw new Error("contentId is required for content events.");
  const ref = db().doc(`companies/${companyId}/content/${contentId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Content item not found.");
  await ref.set({
    status: "published",
    externalPostId: safeText(body.externalPostId, 500) || snap.data()?.externalPostId || null,
    externalUrl: safeText(body.externalUrl, 1000) || null,
    publishedAt: safeText(body.publishedAt, 80) || new Date().toISOString(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  return { contentId };
}

export const businessWebsiteIngress = onRequest(
  { cors: false, invoker: "public", maxInstances: 10 },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "POST required" });
      return;
    }

    const auth = await authenticateWebsite(req);
    if (!auth) {
      res.status(401).json({ error: "Invalid or revoked connector key" });
      return;
    }

    const body = (req.body || {}) as Record<string, any>;
    const companyId = safeText(auth.key.companyId, 128);
    const type = safeText(body.type, 40).toLowerCase();
    const eventId = safeText(body.eventId || req.headers?.["x-event-id"], 240);
    const scopes = new Set(Array.isArray(auth.key.scopes) ? auth.key.scopes.map(String) : []);

    const requiredScope =
      type === "contact" || type === "signup" ? "leads" :
      type === "payment" ? "payments" :
      type === "content_published" ? "content" :
      "";

    if (!requiredScope || !scopes.has(requiredScope)) {
      res.status(403).json({ error: "This connector is not permitted to submit that event type" });
      return;
    }

    const reservation = await reserveEvent(companyId, eventId, type);
    if (reservation === false) {
      res.status(200).json({ ok: true, duplicate: true });
      return;
    }

    try {
      let result: Record<string, unknown> = {};
      if (type === "contact" || type === "signup") result = await ingestLead(companyId, body);
      if (type === "payment") result = await ingestPayment(companyId, body, eventId);
      if (type === "content_published") result = await ingestContent(companyId, body);

      await auth.ref.set({
        lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      if (reservation && reservation !== false) {
        await reservation.set({ processedAt: admin.firestore.FieldValue.serverTimestamp(), result }, { merge: true });
      }
      res.status(200).json({ ok: true, ...result });
    } catch (error) {
      if (reservation && reservation !== false) {
        await reservation.set({
          failedAt: admin.firestore.FieldValue.serverTimestamp(),
          error: error instanceof Error ? error.message : "Ingress failed",
        }, { merge: true });
      }
      res.status(400).json({ error: error instanceof Error ? error.message : "Ingress failed" });
    }
  },
);
