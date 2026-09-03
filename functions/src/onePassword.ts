/**
 * 1Password Connect proxy — bidirectional login sync for Hardy Hub.
 * Requires a self-hosted Connect server + access token (1Password Business
 * Secrets Automation). Personal 1Password accounts have no public sync API.
 */
import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";

interface OnePasswordConnection {
  connectUrl: string;
  accessToken: string;
  vaultId: string;
  enabled?: boolean;
}

interface LoginPayload {
  id?: string;
  title: string;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
  tags?: string[];
  updatedAt?: string;
  version?: number;
}

function requireAuth(context: { auth?: { uid: string; token: any } }) {
  const uid = context.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "You must be signed in.");
  if (context.auth?.token?.deviceId) {
    throw new HttpsError("permission-denied", "Remote display credentials cannot use this service.");
  }
  return uid;
}

function normalizeConnectUrl(raw: string) {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new HttpsError("invalid-argument", "Connect URL must start with http:// or https://");
  }
  return trimmed;
}

async function loadConnection(uid: string): Promise<OnePasswordConnection> {
  const snap = await admin.firestore().doc(`users/${uid}/integrations/onepassword`).get();
  if (!snap.exists) {
    throw new HttpsError(
      "failed-precondition",
      "1Password Connect is not configured. Add your Connect URL, token and vault in Settings.",
    );
  }
  const data = snap.data() as OnePasswordConnection;
  if (!data.connectUrl || !data.accessToken || !data.vaultId) {
    throw new HttpsError("failed-precondition", "1Password Connect settings are incomplete.");
  }
  if (data.enabled === false) {
    throw new HttpsError("failed-precondition", "1Password sync is turned off in Settings.");
  }
  return {
    connectUrl: normalizeConnectUrl(data.connectUrl),
    accessToken: String(data.accessToken).trim(),
    vaultId: String(data.vaultId).trim(),
    enabled: true,
  };
}

async function connectFetch(
  connection: OnePasswordConnection,
  path: string,
  init: RequestInit = {},
) {
  const url = `${connection.connectUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${connection.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const message =
      (body && typeof body === "object" && (body.message || body.error)) ||
      `1Password Connect error (${res.status})`;
    logger.warn("Connect request failed", { path, status: res.status, message });
    throw new HttpsError("unavailable", String(message));
  }
  return body;
}

function fieldValue(item: any, purpose: string): string {
  const fields = Array.isArray(item?.fields) ? item.fields : [];
  const match = fields.find((f: any) => f?.purpose === purpose);
  return match?.value != null ? String(match.value) : "";
}

function primaryUrl(item: any): string {
  const urls = Array.isArray(item?.urls) ? item.urls : [];
  const primary = urls.find((u: any) => u?.primary) || urls[0];
  return primary?.href ? String(primary.href) : "";
}

function toLoginPayload(item: any): LoginPayload {
  return {
    id: item?.id ? String(item.id) : undefined,
    title: String(item?.title || "Untitled login"),
    username: fieldValue(item, "USERNAME") || undefined,
    password: fieldValue(item, "PASSWORD") || undefined,
    url: primaryUrl(item) || undefined,
    notes: fieldValue(item, "NOTES") || undefined,
    tags: Array.isArray(item?.tags) ? item.tags.map(String) : [],
    updatedAt: item?.updatedAt ? String(item.updatedAt) : undefined,
    version: typeof item?.version === "number" ? item.version : undefined,
  };
}

function toFullItem(login: LoginPayload, existing?: any) {
  const fields = [
    {
      id: "username",
      type: "STRING",
      purpose: "USERNAME",
      label: "username",
      value: login.username || "",
    },
    {
      id: "password",
      type: "CONCEALED",
      purpose: "PASSWORD",
      label: "password",
      value: login.password || "",
    },
    {
      id: "notesPlain",
      type: "STRING",
      purpose: "NOTES",
      label: "notesPlain",
      value: login.notes || "",
    },
  ];
  const item: Record<string, unknown> = {
    ...(existing || {}),
    title: login.title,
    category: "LOGIN",
    fields,
    tags: login.tags || existing?.tags || ["Hardy Hub"],
  };
  if (login.url) {
    item.urls = [{ label: "website", primary: true, href: login.url }];
  } else if (existing?.urls) {
    item.urls = existing.urls;
  }
  return item;
}

export const onePasswordConnect = onCall(
  {
    timeoutSeconds: 120,
  },
  async (request) => {
    const uid = requireAuth(request);
    const action = String(request.data?.action || "").trim();

    if (action === "saveSettings") {
      const connectUrl = normalizeConnectUrl(String(request.data?.connectUrl || ""));
      const vaultId = String(request.data?.vaultId || "").trim();
      const enabled = request.data?.enabled !== false;
      const providedToken = String(request.data?.accessToken || "").trim();
      const existingSnap = await admin.firestore().doc(`users/${uid}/integrations/onepassword`).get();
      const existing = existingSnap.exists ? (existingSnap.data() as OnePasswordConnection) : null;
      const accessToken = providedToken || existing?.accessToken || "";
      if (!accessToken || !vaultId) {
        throw new HttpsError("invalid-argument", "accessToken and vaultId are required.");
      }
      await connectFetch(
        { connectUrl, accessToken, vaultId },
        `/v1/vaults/${encodeURIComponent(vaultId)}`,
      );
      await admin.firestore().doc(`users/${uid}/integrations/onepassword`).set(
        {
          connectUrl,
          accessToken,
          vaultId,
          enabled,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return { ok: true };
    }

    if (action === "getSettings") {
      const snap = await admin.firestore().doc(`users/${uid}/integrations/onepassword`).get();
      if (!snap.exists) return { configured: false };
      const data = snap.data() as OnePasswordConnection;
      return {
        configured: true,
        connectUrl: data.connectUrl || "",
        vaultId: data.vaultId || "",
        enabled: data.enabled !== false,
        hasToken: !!data.accessToken,
        tokenHint: data.accessToken ? `••••${String(data.accessToken).slice(-4)}` : "",
      };
    }

    if (action === "clearSettings") {
      await admin.firestore().doc(`users/${uid}/integrations/onepassword`).delete();
      return { ok: true };
    }

    const connection = await loadConnection(uid);

    if (action === "test") {
      const vault = await connectFetch(connection, `/v1/vaults/${encodeURIComponent(connection.vaultId)}`);
      return { ok: true, vaultName: vault?.name || connection.vaultId };
    }

    if (action === "listLogins") {
      const overview = await connectFetch(
        connection,
        `/v1/vaults/${encodeURIComponent(connection.vaultId)}/items`,
      );
      const items = Array.isArray(overview) ? overview : [];
      const loginOverviews = items.filter(
        (item: any) => String(item?.category || "").toUpperCase() === "LOGIN",
      );
      const detailed: LoginPayload[] = [];
      const chunkSize = 5;
      for (let i = 0; i < loginOverviews.length; i += chunkSize) {
        const chunk = loginOverviews.slice(i, i + chunkSize);
        const rows = await Promise.all(
          chunk.map(async (item: any) => {
            const full = await connectFetch(
              connection,
              `/v1/vaults/${encodeURIComponent(connection.vaultId)}/items/${encodeURIComponent(item.id)}`,
            );
            return toLoginPayload(full);
          }),
        );
        detailed.push(...rows);
      }
      await admin.firestore().doc(`users/${uid}/integrations/onepassword`).set(
        { lastSyncAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true },
      );
      return { logins: detailed };
    }

    if (action === "upsertLogin") {
      const login = request.data?.login as LoginPayload | undefined;
      if (!login?.title) throw new HttpsError("invalid-argument", "login.title is required.");
      if (login.id) {
        const existing = await connectFetch(
          connection,
          `/v1/vaults/${encodeURIComponent(connection.vaultId)}/items/${encodeURIComponent(login.id)}`,
        );
        const updated = await connectFetch(
          connection,
          `/v1/vaults/${encodeURIComponent(connection.vaultId)}/items/${encodeURIComponent(login.id)}`,
          { method: "PUT", body: JSON.stringify(toFullItem(login, existing)) },
        );
        return { login: toLoginPayload(updated) };
      }
      const created = await connectFetch(
        connection,
        `/v1/vaults/${encodeURIComponent(connection.vaultId)}/items`,
        { method: "POST", body: JSON.stringify(toFullItem(login)) },
      );
      return { login: toLoginPayload(created) };
    }

    if (action === "deleteLogin") {
      const itemId = String(request.data?.itemId || "").trim();
      if (!itemId) throw new HttpsError("invalid-argument", "itemId is required.");
      await connectFetch(
        connection,
        `/v1/vaults/${encodeURIComponent(connection.vaultId)}/items/${encodeURIComponent(itemId)}`,
        { method: "DELETE" },
      );
      return { ok: true };
    }

    throw new HttpsError("invalid-argument", `Unknown action: ${action}`);
  },
);
