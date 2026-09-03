import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import type { PlainCredential } from "@/lib/passwordVaultCrypto";

export interface OnePasswordSettingsView {
  configured: boolean;
  connectUrl?: string;
  vaultId?: string;
  enabled?: boolean;
  hasToken?: boolean;
  tokenHint?: string;
}

export interface OnePasswordLogin {
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

type Action =
  | "saveSettings"
  | "getSettings"
  | "clearSettings"
  | "test"
  | "listLogins"
  | "upsertLogin"
  | "deleteLogin";

async function callConnect<T>(action: Action, data: Record<string, unknown> = {}) {
  const fn = httpsCallable<Record<string, unknown>, T>(functions, "onePasswordConnect");
  const res = await fn({ action, ...data });
  return res.data;
}

export function saveOnePasswordSettings(input: {
  connectUrl: string;
  accessToken: string;
  vaultId: string;
  enabled?: boolean;
}) {
  return callConnect<{ ok: true }>("saveSettings", input);
}

export function getOnePasswordSettings() {
  return callConnect<OnePasswordSettingsView>("getSettings");
}

export function clearOnePasswordSettings() {
  return callConnect<{ ok: true }>("clearSettings");
}

export function testOnePasswordConnection() {
  return callConnect<{ ok: true; vaultName?: string }>("test");
}

export function listOnePasswordLogins() {
  return callConnect<{ logins: OnePasswordLogin[] }>("listLogins");
}

export function upsertOnePasswordLogin(login: OnePasswordLogin) {
  return callConnect<{ login: OnePasswordLogin }>("upsertLogin", { login });
}

export function deleteOnePasswordLogin(itemId: string) {
  return callConnect<{ ok: true }>("deleteLogin", { itemId });
}

export function onePasswordLoginToCredential(login: OnePasswordLogin): PlainCredential {
  const username = login.username || "";
  const password = login.password || "";
  const url = login.url || "";
  return {
    name: login.title || "1Password login",
    username: username || undefined,
    password: password || undefined,
    url: url || undefined,
    notes: login.notes || undefined,
    category: (login.tags && login.tags[0]) || "1Password",
    fields: [
      ...(username
        ? [{ id: crypto.randomUUID(), type: "username" as const, label: "Username", value: username }]
        : []),
      ...(password
        ? [{ id: crypto.randomUUID(), type: "password" as const, label: "Password", value: password }]
        : []),
      ...(url
        ? [{ id: crypto.randomUUID(), type: "website" as const, label: "Website", value: url }]
        : []),
    ],
  };
}

export function credentialToOnePasswordLogin(input: {
  onePasswordItemId?: string | null;
  name: string;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
  category?: string;
}): OnePasswordLogin {
  return {
    id: input.onePasswordItemId || undefined,
    title: input.name,
    username: input.username,
    password: input.password,
    url: input.url,
    notes: input.notes,
    tags: input.category ? [input.category, "Hardy Hub"] : ["Hardy Hub"],
  };
}

export function sameLoginContent(a: {
  name?: string;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
}, b: {
  title?: string;
  name?: string;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
}) {
  const title = (b.title || b.name || "").trim();
  return (
    (a.name || "").trim() === title &&
    (a.username || "").trim() === (b.username || "").trim() &&
    (a.password || "") === (b.password || "") &&
    (a.url || "").trim() === (b.url || "").trim() &&
    (a.notes || "").trim() === (b.notes || "").trim()
  );
}
