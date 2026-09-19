import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

const milionBridgeUrl = defineSecret("MILION_BUSINESS_BRIDGE_URL");
const milionBridgeSecret = defineSecret("MILION_BUSINESS_BRIDGE_SECRET");

function cleanRole(value: unknown) {
  return String(value || "").toLowerCase().replace(/[\s_-]+/g, "");
}

async function assertCompanyAccess(uid: string, companyId: string) {
  const db = admin.firestore();
  const [companySnap, userSnap] = await Promise.all([
    db.doc(`companies/${companyId}`).get(),
    db.doc(`users/${uid}`).get(),
  ]);
  if (!companySnap.exists) throw new HttpsError("not-found", "Company not found.");
  const company = companySnap.data() || {};
  const user = userSnap.data() || {};
  const role = cleanRole(user.role);
  const isAdmin = role === "admin" || role === "superadmin" || user.isAdmin === true || user.isSuperAdmin === true;
  const owner = !company.ownerId || company.ownerId === uid;
  const shared = Array.isArray(company.sharedWith) && company.sharedWith.includes(uid);
  if (!isAdmin && !owner && !shared) {
    throw new HttpsError("permission-denied", "You do not have access to this company.");
  }
  return company;
}

async function callMilion(body: Record<string, unknown>) {
  const url = milionBridgeUrl.value();
  const secret = milionBridgeSecret.value();
  if (!url || !secret) {
    throw new HttpsError("failed-precondition", "Milion bridge secrets are not configured.");
  }
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let payload: any = null;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { error: text || "Invalid Milion response" };
  }
  if (!response.ok) {
    throw new HttpsError("internal", String(payload?.error || `Milion bridge returned ${response.status}`));
  }
  return payload;
}

export const milionBusinessBridge = onCall(
  { secrets: [milionBridgeUrl, milionBridgeSecret], maxInstances: 5 },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in to use business integrations.");
    if (request.auth?.token?.deviceId) {
      throw new HttpsError("permission-denied", "Remote displays cannot access business integrations.");
    }

    const data = (request.data || {}) as Record<string, any>;
    const action = String(data.action || "");
    const companyId = String(data.companyId || "");
    const orgId = String(data.orgId || "");
    if (!companyId || !orgId) throw new HttpsError("invalid-argument", "companyId and orgId are required.");
    if (!["snapshot", "createInvoice", "updateInvoice"].includes(action)) {
      throw new HttpsError("invalid-argument", "Unsupported Milion bridge action.");
    }

    await assertCompanyAccess(uid, companyId);
    const integrationSnap = await admin.firestore()
      .doc(`companies/${companyId}/businessIntegrations/milion`)
      .get();
    const integration = integrationSnap.data() || {};
    if (!integrationSnap.exists || integration.enabled !== true || String(integration.externalId || "") !== orgId) {
      throw new HttpsError("failed-precondition", "This company is not linked to that Milion organisation.");
    }

    const result = await callMilion({
      action,
      orgId,
      invoiceId: data.invoiceId,
      updates: data.updates,
      input: data.input,
      actor: { uid },
    });

    await integrationSnap.ref.set({
      lastSyncAt: new Date().toISOString(),
      lastError: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return result;
  },
);
