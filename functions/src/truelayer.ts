import { randomUUID } from "node:crypto";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret, defineString } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

const truelayerClientId = defineSecret("TRUELAYER_CLIENT_ID");
const truelayerClientSecret = defineSecret("TRUELAYER_CLIENT_SECRET");
const truelayerUseSandbox = defineString("TRUELAYER_USE_SANDBOX", { default: "true" });

const APP_HOST = "https://hardyhub-7b30d.web.app";
const SCOPES = "info accounts balance transactions offline_access";
const SECRET_OPTS = { secrets: [truelayerClientId, truelayerClientSecret] };
const SECRET_CALL_OPTS = { ...SECRET_OPTS, timeoutSeconds: 180 };

type TlTx = {
  transaction_id?: string;
  timestamp: string;
  amount?: number;
  description?: string;
  running_balance?: { amount?: number };
};

const ALLOWED_REDIRECTS = new Set([
  `${APP_HOST}/finance/bank-callback`,
  `${APP_HOST}/api/truelayer/callback`,
  "https://hardyhub-7b30d.firebaseapp.com/finance/bank-callback",
  "https://hardyhub-7b30d.firebaseapp.com/api/truelayer/callback",
  "http://localhost:8080/finance/bank-callback",
]);

type TlAccount = {
  account_id: string;
  account_type?: string;
  display_name?: string;
  currency?: string;
  account_number?: { number?: string; sort_code?: string; iban?: string };
};

type TlBalance = {
  currency?: string;
  current?: number;
  available?: number;
};

export type BankAccountSnapshot = {
  id: string;
  name: string;
  type: string;
  currency: string;
  masked: string;
  linkedAccountId: string | null;
};

function requireUid(auth?: { uid: string; token?: Record<string, unknown> }) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "You must be signed in.");
  if (auth.token?.deviceId) {
    throw new HttpsError("permission-denied", "Remote display credentials cannot access banking services.");
  }
  return auth.uid;
}

function isSandbox() {
  return truelayerUseSandbox.value() !== "false";
}

function authBase() {
  return isSandbox() ? "https://auth.truelayer-sandbox.com" : "https://auth.truelayer.com";
}

function apiBase() {
  return isSandbox() ? "https://api.truelayer-sandbox.com" : "https://api.truelayer.com";
}

function credentials() {
  const clientId = truelayerClientId.value();
  const clientSecret = truelayerClientSecret.value();
  if (!clientId || !clientSecret) {
    throw new HttpsError(
      "failed-precondition",
      "TrueLayer is not configured yet. Add TRUELAYER_CLIENT_ID and TRUELAYER_CLIENT_SECRET in Firebase secrets."
    );
  }
  return { clientId, clientSecret };
}

function mapAccountType(tlType?: string): string {
  const t = (tlType || "").toUpperCase();
  if (t.includes("SAVING")) return "Savings";
  if (t.includes("BUSINESS")) return "Current";
  return "Current";
}

function maskAccount(num?: { number?: string; iban?: string }) {
  const raw = num?.number || num?.iban || "";
  if (raw.length < 4) return raw ? "••••" : "";
  return `•••• ${raw.slice(-4)}`;
}

async function formPost(url: string, body: Record<string, string>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const desc = String(json.error_description || json.error || res.statusText);
    throw new HttpsError("failed-precondition", `TrueLayer token error: ${desc}`);
  }
  return json as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
}

async function tlGet<T>(path: string, accessToken: string, extraHeaders?: Record<string, string>): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, ...extraHeaders },
  });
  const json = (await res.json()) as { results?: T; error?: string; error_description?: string };
  if (!res.ok) {
    throw new HttpsError("failed-precondition", json.error_description || json.error || "TrueLayer request failed.");
  }
  return (json.results ?? json) as T;
}

function roundGbp(amount: number) {
  return Math.round(amount * 100) / 100;
}

function isoDateUtc(date: Date) {
  return date.toISOString().split("T")[0];
}

function addUtcDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDateUtc(date);
}

function lastDayOfMonth(year: number, monthIndex: number) {
  return isoDateUtc(new Date(Date.UTC(year, monthIndex + 1, 0)));
}

function txDay(timestamp: string) {
  return String(timestamp || "").slice(0, 10);
}

function monthEndDates(fromDay: string, today: string) {
  const start = new Date(`${fromDay}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return [];
  const dates: string[] = [];
  let year = start.getUTCFullYear();
  let month = start.getUTCMonth();
  for (let i = 0; i < 240; i += 1) {
    const eom = lastDayOfMonth(year, month);
    if (eom >= fromDay && eom <= today) dates.push(eom);
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    if (`${year}-${String(month + 1).padStart(2, "0")}-01` > today) break;
  }
  return dates;
}

function monthEndBalance(eom: string, current: number, txs: TlTx[]) {
  const withRunning = txs
    .filter((tx) => txDay(tx.timestamp) <= eom && Number.isFinite(Number(tx.running_balance?.amount)))
    .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
  if (withRunning.length > 0) {
    return roundGbp(Number(withRunning[withRunning.length - 1].running_balance?.amount));
  }
  const after = txs
    .filter((tx) => txDay(tx.timestamp) > eom)
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  return roundGbp(current - after);
}

async function fetchTransactions(accountId: string, access: string, today: string, extraHeaders?: Record<string, string>) {
  const byId = new Map<string, TlTx>();
  let to = today;
  for (let i = 0; i < 40; i += 1) {
    const from = addUtcDays(to, -89);
    try {
      const chunk = await tlGet<TlTx[]>(
        `/data/v1/accounts/${encodeURIComponent(accountId)}/transactions?from=${from}&to=${to}`,
        access,
        extraHeaders
      );
      const list = Array.isArray(chunk) ? chunk : [];
      if (list.length === 0) break;
      for (const tx of list) {
        const key = tx.transaction_id || `${tx.timestamp}-${tx.amount}-${tx.description || ""}`;
        byId.set(key, tx);
      }
      to = addUtcDays(from, -1);
    } catch (err) {
      logger.warn("TrueLayer transaction history stopped", {
        accountId,
        from,
        to,
        error: err instanceof Error ? err.message : String(err),
      });
      break;
    }
  }
  return [...byId.values()];
}

function db() {
  return admin.firestore();
}

function connectionRef(uid: string, id: string) {
  return db().doc(`finance/${uid}/bankConnections/${id}`);
}

function secretRef(uid: string, id: string) {
  return db().doc(`finance/${uid}/bankSecrets/${id}`);
}

async function refreshAccess(uid: string, connectionId: string) {
  const snap = await secretRef(uid, connectionId).get();
  const data = snap.data();
  if (!data?.refreshToken) {
    throw new HttpsError("failed-precondition", "This bank connection needs to be linked again.");
  }
  const { clientId, clientSecret } = credentials();
  const expiresAt = Number(data.accessExpiresAt || 0);
  if (data.accessToken && expiresAt > Date.now() + 60_000) {
    return String(data.accessToken);
  }
  try {
    const token = await formPost(`${authBase()}/connect/token`, {
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: String(data.refreshToken),
    });
    await secretRef(uid, connectionId).set(
      {
        accessToken: token.access_token,
        refreshToken: token.refresh_token || data.refreshToken,
        accessExpiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return token.access_token;
  } catch (err) {
    await connectionRef(uid, connectionId).set(
      { status: "needs_reauth", lastError: err instanceof Error ? err.message : "Token refresh failed" },
      { merge: true }
    );
    throw err;
  }
}

function snapshotAccounts(accounts: TlAccount[], mappings: Record<string, string>): BankAccountSnapshot[] {
  return accounts.map((a) => ({
    id: a.account_id,
    name: a.display_name || "Bank account",
    type: mapAccountType(a.account_type),
    currency: a.currency || "GBP",
    masked: maskAccount(a.account_number),
    linkedAccountId: mappings[a.account_id] || null,
  }));
}

async function loadRemoteAccounts(uid: string, connectionId: string) {
  const access = await refreshAccess(uid, connectionId);
  const accounts = await tlGet<TlAccount[]>("/data/v1/accounts", access);
  const list = Array.isArray(accounts) ? accounts : [];
  const conn = await connectionRef(uid, connectionId).get();
  const mappings = (conn.data()?.mappings || {}) as Record<string, string>;
  const snapshots = snapshotAccounts(list, mappings);
  await connectionRef(uid, connectionId).set(
    { accounts: snapshots, lastError: admin.firestore.FieldValue.delete() },
    { merge: true }
  );
  return { access, accounts: snapshots };
}

async function writeBalances(
  uid: string,
  rows: { financeAccountId: string; amount: number; date: string }[]
) {
  for (let i = 0; i < rows.length; i += 400) {
    const batch = db().batch();
    for (const row of rows.slice(i, i + 400)) {
      batch.set(
        db().doc(`finance/${uid}/entries/bank_${row.financeAccountId}_${row.date}`),
        {
          accountId: row.financeAccountId,
          date: row.date,
          balance: row.amount,
          source: "truelayer",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
    await batch.commit();
  }
}

async function syncConnection(
  uid: string,
  connectionId: string,
  opts: { history?: boolean; extraHeaders?: Record<string, string> } = {}
) {
  const { access, accounts } = await loadRemoteAccounts(uid, connectionId);
  const conn = await connectionRef(uid, connectionId).get();
  const mappings = (conn.data()?.mappings || {}) as Record<string, string>;
  const today = isoDateUtc(new Date());
  const rows: { financeAccountId: string; amount: number; date: string }[] = [];
  let updated = 0;
  let months = 0;

  for (const account of accounts) {
    const financeId = mappings[account.id];
    if (!financeId) continue;
    const balances = await tlGet<TlBalance[]>(
      `/data/v1/accounts/${encodeURIComponent(account.id)}/balance`,
      access,
      opts.extraHeaders
    );
    const row = Array.isArray(balances) ? balances[0] : undefined;
    const amount = Number(row?.current ?? row?.available);
    if (!Number.isFinite(amount)) continue;
    rows.push({ financeAccountId: financeId, amount: roundGbp(amount), date: today });
    updated += 1;

    if (opts.history) {
      const txs = await fetchTransactions(account.id, access, today, opts.extraHeaders);
      const firstDay = txs.map((tx) => txDay(tx.timestamp)).filter(Boolean).sort()[0];
      if (firstDay) {
        for (const eom of monthEndDates(firstDay, today)) {
          if (eom === today) continue;
          rows.push({
            financeAccountId: financeId,
            amount: monthEndBalance(eom, amount, txs),
            date: eom,
          });
          months += 1;
        }
      }
    }

    await db().doc(`finance/${uid}/accounts/${financeId}`).set(
      {
        bankProvider: "truelayer",
        bankConnectionId: connectionId,
        bankAccountId: account.id,
        bankLastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  await writeBalances(uid, rows);
  await connectionRef(uid, connectionId).set(
    {
      status: "active",
      lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastError: admin.firestore.FieldValue.delete(),
      ...(opts.history ? { historyBackfilledAt: admin.firestore.FieldValue.serverTimestamp(), historyMonths: months } : {}),
    },
    { merge: true }
  );
  return { updated, months };
}

export const startTrueLayerConnect = onCall(SECRET_CALL_OPTS, async (request) => {
  const uid = requireUid(request.auth);
  const { clientId } = credentials();
  const redirectUri = String(request.data?.redirectUri || `${APP_HOST}/finance/bank-callback`);
  if (!ALLOWED_REDIRECTS.has(redirectUri)) {
    throw new HttpsError("invalid-argument", "That redirect URI is not allowed.");
  }
  const state = randomUUID();
  await db().doc(`trueLayerOAuth/${state}`).set({
    uid,
    redirectUri,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: Date.now() + 15 * 60 * 1000,
  });
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
    providers: "uk-ob-all uk-oauth-all",
  });
  if (isSandbox()) params.set("enable_mock", "true");
  return { authUrl: `${authBase()}/?${params.toString()}` };
});

async function finishConnect(uid: string, code: string, redirectUri: string) {
  const { clientId, clientSecret } = credentials();
  const token = await formPost(`${authBase()}/connect/token`, {
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });

  const connectionId = randomUUID();
  const consentExpiresAt = Date.now() + 90 * 24 * 60 * 60 * 1000;
  await secretRef(uid, connectionId).set({
    accessToken: token.access_token,
    refreshToken: token.refresh_token || null,
    accessExpiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await connectionRef(uid, connectionId).set({
    ownerId: uid,
    provider: "truelayer",
    status: "active",
    sandbox: isSandbox(),
    mappings: {},
    accounts: [],
    consentExpiresAt,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  const { accounts } = await loadRemoteAccounts(uid, connectionId);
  return { connectionId, accounts };
}

export const completeTrueLayerConnect = onCall(SECRET_CALL_OPTS, async (request) => {
  const uid = requireUid(request.auth);
  const code = String(request.data?.code || "").trim();
  const state = String(request.data?.state || "").trim();
  if (!code || !state) throw new HttpsError("invalid-argument", "code and state are required.");

  const stateSnap = await db().doc(`trueLayerOAuth/${state}`).get();
  const stateData = stateSnap.data();
  if (!stateSnap.exists || !stateData) throw new HttpsError("permission-denied", "This bank link has expired. Try connecting again.");
  if (stateData.uid !== uid) throw new HttpsError("permission-denied", "This bank link belongs to a different user.");
  if (Number(stateData.expiresAt || 0) < Date.now()) {
    await stateSnap.ref.delete();
    throw new HttpsError("deadline-exceeded", "This bank link has expired. Try connecting again.");
  }
  await stateSnap.ref.delete();
  return finishConnect(uid, code, String(stateData.redirectUri));
});

export const listTrueLayerAccounts = onCall(SECRET_CALL_OPTS, async (request) => {
  const uid = requireUid(request.auth);
  const connectionId = String(request.data?.connectionId || "").trim();
  if (!connectionId) throw new HttpsError("invalid-argument", "connectionId is required.");
  const { accounts } = await loadRemoteAccounts(uid, connectionId);
  return { accounts };
});

function psuHeaders(request: { rawRequest?: { ip?: string; headers?: { [key: string]: unknown } } }) {
  const forwarded = request.rawRequest?.headers?.["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const ip = (typeof raw === "string" ? raw.split(",")[0].trim() : "") || request.rawRequest?.ip || "";
  return ip ? { "X-PSU-IP": ip } : undefined;
}

export const linkTrueLayerAccount = onCall(SECRET_CALL_OPTS, async (request) => {
  const uid = requireUid(request.auth);
  const connectionId = String(request.data?.connectionId || "").trim();
  const bankAccountId = String(request.data?.bankAccountId || "").trim();
  const financeAccountId = String(request.data?.financeAccountId || "").trim();
  const createNew = request.data?.createNew === true;
  if (!connectionId || !bankAccountId) {
    throw new HttpsError("invalid-argument", "connectionId and bankAccountId are required.");
  }

  const connSnap = await connectionRef(uid, connectionId).get();
  if (!connSnap.exists) throw new HttpsError("not-found", "Bank connection not found.");
  const accounts = (connSnap.data()?.accounts || []) as BankAccountSnapshot[];
  const bank = accounts.find((a) => a.id === bankAccountId);
  if (!bank) throw new HttpsError("not-found", "That bank account is not on this connection.");

  let targetId = financeAccountId;
  if (createNew) {
    const created = await db().collection(`finance/${uid}/accounts`).add({
      name: bank.name,
      type: bank.type,
      active: true,
      hidden: false,
      bankProvider: "truelayer",
      bankConnectionId: connectionId,
      bankAccountId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    targetId = created.id;
  } else if (!targetId) {
    throw new HttpsError("invalid-argument", "Pick an existing account or create a new one.");
  }

  const mappings = { ...(connSnap.data()?.mappings || {}), [bankAccountId]: targetId };
  const nextAccounts = accounts.map((a) => (a.id === bankAccountId ? { ...a, linkedAccountId: targetId } : a));
  await connectionRef(uid, connectionId).set({ mappings, accounts: nextAccounts }, { merge: true });
  await db().doc(`finance/${uid}/accounts/${targetId}`).set(
    {
      bankProvider: "truelayer",
      bankConnectionId: connectionId,
      bankAccountId,
    },
    { merge: true }
  );
  try {
    await syncConnection(uid, connectionId, { history: true, extraHeaders: psuHeaders(request) });
  } catch (err) {
    logger.warn("TrueLayer sync after link failed", {
      uid,
      connectionId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return { financeAccountId: targetId };
});

export const unlinkTrueLayerAccount = onCall(async (request) => {
  const uid = requireUid(request.auth);
  const connectionId = String(request.data?.connectionId || "").trim();
  const bankAccountId = String(request.data?.bankAccountId || "").trim();
  if (!connectionId || !bankAccountId) throw new HttpsError("invalid-argument", "connectionId and bankAccountId are required.");
  const connSnap = await connectionRef(uid, connectionId).get();
  if (!connSnap.exists) return { ok: true };
  const mappings = { ...(connSnap.data()?.mappings || {}) } as Record<string, string>;
  const financeId = mappings[bankAccountId];
  delete mappings[bankAccountId];
  const accounts = ((connSnap.data()?.accounts || []) as BankAccountSnapshot[]).map((a) =>
    a.id === bankAccountId ? { ...a, linkedAccountId: null } : a
  );
  await connectionRef(uid, connectionId).set({ mappings, accounts }, { merge: true });
  if (financeId) {
    await db().doc(`finance/${uid}/accounts/${financeId}`).set(
      {
        bankProvider: admin.firestore.FieldValue.delete(),
        bankConnectionId: admin.firestore.FieldValue.delete(),
        bankAccountId: admin.firestore.FieldValue.delete(),
      },
      { merge: true }
    );
  }
  return { ok: true };
});

export const syncTrueLayerBalances = onCall(SECRET_CALL_OPTS, async (request) => {
  const uid = requireUid(request.auth);
  const connectionId = String(request.data?.connectionId || "").trim();
  const history = request.data?.history === true;
  const extraHeaders = psuHeaders(request);
  if (connectionId) {
    return syncConnection(uid, connectionId, { history, extraHeaders });
  }
  const snap = await db().collection(`finance/${uid}/bankConnections`).where("status", "in", ["active", "needs_reauth"]).get();
  let updated = 0;
  let months = 0;
  for (const docSnap of snap.docs) {
    if (docSnap.data().status !== "active") continue;
    const result = await syncConnection(uid, docSnap.id, { history, extraHeaders });
    updated += result.updated;
    months += result.months;
  }
  return { updated, months };
});

export const disconnectTrueLayer = onCall(async (request) => {
  const uid = requireUid(request.auth);
  const connectionId = String(request.data?.connectionId || "").trim();
  if (!connectionId) throw new HttpsError("invalid-argument", "connectionId is required.");
  const connSnap = await connectionRef(uid, connectionId).get();
  const mappings = (connSnap.data()?.mappings || {}) as Record<string, string>;
  const batch = db().batch();
  for (const financeId of Object.values(mappings)) {
    batch.set(
      db().doc(`finance/${uid}/accounts/${financeId}`),
      {
        bankProvider: admin.firestore.FieldValue.delete(),
        bankConnectionId: admin.firestore.FieldValue.delete(),
        bankAccountId: admin.firestore.FieldValue.delete(),
      },
      { merge: true }
    );
  }
  batch.delete(connectionRef(uid, connectionId));
  batch.delete(secretRef(uid, connectionId));
  await batch.commit();
  return { ok: true };
});

export const trueLayerCallback = onRequest(
  { ...SECRET_OPTS, cors: false, invoker: "public" },
  async (req, res) => {
  const code = String(req.query.code || "");
  const state = String(req.query.state || "");
  const error = String(req.query.error || "");
  const fallback = `${APP_HOST}/finance?bank=error`;
  if (error || !code || !state) {
    res.redirect(302, `${APP_HOST}/finance?bank=${encodeURIComponent(error || "cancelled")}`);
    return;
  }
  try {
    const stateSnap = await db().doc(`trueLayerOAuth/${state}`).get();
    const stateData = stateSnap.data();
    if (!stateSnap.exists || !stateData) throw new Error("expired");
    if (Number(stateData.expiresAt || 0) < Date.now()) throw new Error("expired");
    await stateSnap.ref.delete();
    await finishConnect(String(stateData.uid), code, String(stateData.redirectUri));
    res.redirect(302, `${APP_HOST}/finance?bank=connected`);
  } catch (err) {
    logger.warn("TrueLayer callback failed", { error: err instanceof Error ? err.message : String(err) });
    res.redirect(302, fallback);
  }
  }
);

export const syncAllTrueLayerBalances = onSchedule(
  {
    schedule: "every 6 hours",
    timeZone: "Europe/London",
    secrets: [truelayerClientId, truelayerClientSecret],
    timeoutSeconds: 300,
  },
  async () => {
    const snap = await db().collectionGroup("bankConnections").where("status", "==", "active").get();
    let ok = 0;
    let failed = 0;
    for (const docSnap of snap.docs) {
      const uid = docSnap.ref.parent.parent?.id;
      if (!uid) continue;
      try {
        await syncConnection(uid, docSnap.id);
        ok += 1;
      } catch (err) {
        failed += 1;
        logger.warn("TrueLayer scheduled sync failed", {
          uid,
          connectionId: docSnap.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    logger.info("TrueLayer scheduled sync finished", { ok, failed });
  }
);
