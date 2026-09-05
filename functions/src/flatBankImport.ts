/**
 * Import TrueLayer transactions into a flat ledger (open-banking auto-import).
 */
import { randomUUID } from "node:crypto";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

const truelayerClientId = defineSecret("TRUELAYER_CLIENT_ID");
const truelayerClientSecret = defineSecret("TRUELAYER_CLIENT_SECRET");
const truelayerUseSandbox = defineString("TRUELAYER_USE_SANDBOX", { default: "true" });

const SECRET_CALL_OPTS = {
  secrets: [truelayerClientId, truelayerClientSecret],
  timeoutSeconds: 120,
};

function db() {
  return admin.firestore();
}

function authBase() {
  return truelayerUseSandbox.value() === "true"
    ? "https://auth.truelayer-sandbox.com"
    : "https://auth.truelayer.com";
}

function apiBase() {
  return truelayerUseSandbox.value() === "true"
    ? "https://api.truelayer-sandbox.com"
    : "https://api.truelayer.com";
}

function requireUid(auth: { uid: string } | undefined) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Sign in required.");
  return auth.uid;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function secretRef(uid: string, id: string) {
  return db().doc(`finance/${uid}/bankSecrets/${id}`);
}

async function refreshAccess(uid: string, connectionId: string) {
  const snap = await secretRef(uid, connectionId).get();
  const data = snap.data();
  if (!data?.refreshToken) {
    throw new HttpsError("failed-precondition", "Reconnect this bank in Finances first.");
  }
  const expiresAt = Number(data.accessExpiresAt || 0);
  if (data.accessToken && expiresAt > Date.now() + 60_000) {
    return String(data.accessToken);
  }
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: truelayerClientId.value(),
    client_secret: truelayerClientSecret.value(),
    refresh_token: String(data.refreshToken),
  });
  const res = await fetch(`${authBase()}/connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new HttpsError("failed-precondition", "Bank token refresh failed — reconnect in Finances.");
  }
  const token = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
  await secretRef(uid, connectionId).set(
    {
      accessToken: token.access_token,
      refreshToken: token.refresh_token || data.refreshToken,
      accessExpiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return token.access_token;
}

function guessCategory(description: string, kind: "income" | "expense") {
  const d = description.toLowerCase();
  if (kind === "income") {
    if (/rent|tenant|letting/.test(d)) return "Rent";
    return "Other income";
  }
  if (/insur/.test(d)) return "Insurance";
  if (/council|local authority/.test(d)) return "Council Tax";
  if (/electric|gas|british gas|eon|edf|octopus/.test(d)) return "Gas & Electricity";
  if (/water|thames|severn/.test(d)) return "Water";
  if (/ground rent|service charge/.test(d)) return "Ground Rent";
  if (/mortgage|interest|halifax|nationwide|santander/.test(d)) return "Mortgage Interest";
  if (/repair|screwfix|toolstation|builder/.test(d)) return "Repairs";
  if (/agent|rightmove|zoopla|openrent/.test(d)) return "Letting Fees";
  return "Other";
}

export const importFlatBankTransactions = onCall(SECRET_CALL_OPTS, async (request) => {
  const uid = requireUid(request.auth);
  const flatId = String(request.data?.flatId || "").trim();
  const connectionId = String(request.data?.connectionId || "").trim();
  const bankAccountId = String(request.data?.bankAccountId || "").trim();
  const days = Math.min(90, Math.max(7, Number(request.data?.days) || 90));
  if (!flatId || !connectionId || !bankAccountId) {
    throw new HttpsError("invalid-argument", "flatId, connectionId and bankAccountId are required.");
  }

  const flatRef = db().doc(`flats/${flatId}`);
  const flatSnap = await flatRef.get();
  if (!flatSnap.exists) throw new HttpsError("not-found", "Flat not found.");
  const flat = flatSnap.data() as {
    ledger?: Array<Record<string, unknown>>;
    bankLinks?: Array<{ connectionId: string; bankAccountId: string }>;
  };
  const linked = (flat.bankLinks || []).some(
    (l) => l.connectionId === connectionId && l.bankAccountId === bankAccountId,
  );
  if (!linked) {
    throw new HttpsError("failed-precondition", "Link this bank account to the flat first.");
  }

  const access = await refreshAccess(uid, connectionId);
  const to = new Date();
  const from = new Date(Date.now() - days * 86400000);
  const url =
    `${apiBase()}/data/v1/accounts/${encodeURIComponent(bankAccountId)}` +
    `/transactions?from=${isoDate(from)}&to=${isoDate(to)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${access}` } });
  if (!res.ok) {
    const text = await res.text();
    logger.warn("Flat TL tx fetch failed", { status: res.status, text: text.slice(0, 200) });
    throw new HttpsError("unavailable", "Could not fetch bank transactions. Try reconnecting.");
  }
  const payload = (await res.json()) as {
    results?: Array<{
      transaction_id?: string;
      timestamp?: string;
      description?: string;
      amount?: number;
    }>;
  };
  const results = Array.isArray(payload.results) ? payload.results : [];
  const existing = new Set(
    (flat.ledger || []).map((e) => String(e.bankTxId || "")).filter(Boolean),
  );
  const additions: Record<string, unknown>[] = [];
  for (const tx of results) {
    const id = String(tx.transaction_id || "");
    if (!id || existing.has(id)) continue;
    const amount = Number(tx.amount);
    if (!Number.isFinite(amount) || amount === 0) continue;
    const kind = amount > 0 ? "income" : "expense";
    const abs = Math.abs(amount);
    const description = String(tx.description || "Bank transaction").slice(0, 200);
    additions.push({
      id: `tl_${id || randomUUID()}`,
      kind,
      date: String(tx.timestamp || "").slice(0, 10) || isoDate(new Date()),
      description,
      category: guessCategory(description, kind),
      amountGbp: Math.round(abs * 100) / 100,
      frequency: "One-off",
      source: "truelayer",
      bankTxId: id,
    });
  }
  if (additions.length) {
    await flatRef.set(
      {
        ledger: [...(flat.ledger || []), ...additions],
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }
  return { imported: additions.length, scanned: results.length };
});
