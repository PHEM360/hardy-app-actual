import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

export type BankAccountSnapshot = {
  id: string;
  name: string;
  type: string;
  currency: string;
  masked: string;
  linkedAccountId: string | null;
};

export function bankRedirectUri() {
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return `${window.location.origin}/finance/bank-callback`;
  }
  return `${window.location.origin}/api/truelayer/callback`;
}

export async function startBankConnect() {
  const call = httpsCallable<{ redirectUri: string }, { authUrl: string }>(functions, "startTrueLayerConnect");
  const result = await call({ redirectUri: bankRedirectUri() });
  return result.data.authUrl;
}

export async function completeBankConnect(code: string, state: string) {
  const call = httpsCallable<{ code: string; state: string }, { connectionId: string; accounts: BankAccountSnapshot[] }>(
    functions,
    "completeTrueLayerConnect"
  );
  const result = await call({ code, state });
  return result.data;
}

export async function linkBankAccount(input: {
  connectionId: string;
  bankAccountId: string;
  financeAccountId?: string;
  createNew?: boolean;
}) {
  const call = httpsCallable<typeof input, { financeAccountId: string }>(functions, "linkTrueLayerAccount");
  const result = await call(input);
  return result.data;
}

export async function unlinkBankAccount(connectionId: string, bankAccountId: string) {
  const call = httpsCallable<{ connectionId: string; bankAccountId: string }, { ok: boolean }>(
    functions,
    "unlinkTrueLayerAccount"
  );
  await call({ connectionId, bankAccountId });
}

export async function syncBankBalances(connectionId?: string, history = false) {
  const call = httpsCallable<{ connectionId?: string; history?: boolean }, { updated: number; months: number }>(
    functions,
    "syncTrueLayerBalances"
  );
  const result = await call({ ...(connectionId ? { connectionId } : {}), history });
  return result.data;
}

export async function disconnectBank(connectionId: string) {
  const call = httpsCallable<{ connectionId: string }, { ok: boolean }>(functions, "disconnectTrueLayer");
  await call({ connectionId });
}
