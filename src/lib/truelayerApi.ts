import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { isNativeApp, publicWebOrigin } from "@/lib/nativeApp";

export type BankAccountSnapshot = {
  id: string;
  name: string;
  type: string;
  currency: string;
  masked: string;
  linkedAccountId: string | null;
};

const CANONICAL_BANK_CALLBACK = "https://hardyapp.co.uk/api/truelayer/callback";

export function bankRedirectUri() {
  if (isNativeApp()) {
    return `${publicWebOrigin()}/finance/bank-callback`;
  }
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return `${window.location.origin}/finance/bank-callback`;
  }
  // TrueLayer only allowlists hardyapp.co.uk. Always send that URI, then the
  // function sends the person back to the page they started from.
  return CANONICAL_BANK_CALLBACK;
}

export async function getBankConnectStatus() {
  const call = httpsCallable<Record<string, never>, {
    configured: boolean;
    sandbox: boolean;
    using?: "sandbox" | "live";
    preferred?: "sandbox" | "live";
    mismatch?: boolean;
  }>(functions, "getTrueLayerStatus");
  try {
    return (await call({})).data;
  } catch {
    return { configured: false, sandbox: true, mismatch: false };
  }
}

export async function startBankConnect(returnPath?: string) {
  const call = httpsCallable<{ redirectUri: string; returnPath?: string; returnOrigin?: string }, { authUrl: string }>(
    functions,
    "startTrueLayerConnect"
  );
  const result = await call({
    redirectUri: bankRedirectUri(),
    returnPath: returnPath || window.location.pathname,
    returnOrigin: window.location.origin,
  });
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

export type BankHistoryFrequency = "daily" | "weekly" | "monthly";

/** Which past balances to bring in: how far back, how often, and as at what UK time of day. */
export type BankHistoryOptions = {
  months: number;
  frequency: BankHistoryFrequency;
  time: string;
};

export type BankSyncResult = {
  /** How many accounts on Hardy Hub received a balance. Zero means nothing is attached yet. */
  updated: number;
  /** How many past balances were saved. */
  points: number;
  /** The oldest day a balance was saved for. */
  earliest: string | null;
};

function readSyncResult(data: Partial<BankSyncResult> & { months?: number }): BankSyncResult {
  return {
    updated: Number(data.updated || 0),
    points: Number(data.points ?? data.months ?? 0),
    earliest: data.earliest || null,
  };
}

export async function linkBankAccount(input: {
  connectionId: string;
  bankAccountId: string;
  financeAccountId?: string;
  createNew?: boolean;
  scope?: "personal" | "household";
  householdId?: string;
  history?: BankHistoryOptions;
  /** Pass false to attach without importing, when an import will follow. */
  sync?: boolean;
}) {
  const call = httpsCallable<typeof input, { financeAccountId: string; syncError?: string } & Partial<BankSyncResult>>(
    functions,
    "linkTrueLayerAccount",
  );
  const { data } = await call(input);
  return {
    financeAccountId: data.financeAccountId,
    syncError: data.syncError,
    result: data.updated == null ? null : readSyncResult(data),
  };
}

export async function unlinkBankAccount(connectionId: string, bankAccountId: string, householdId?: string) {
  const call = httpsCallable<{ connectionId: string; bankAccountId: string; householdId?: string }, { ok: boolean }>(
    functions,
    "unlinkTrueLayerAccount"
  );
  await call({ connectionId, bankAccountId, ...(householdId ? { householdId } : {}) });
}

export async function syncBankBalances(connectionId?: string, history?: BankHistoryOptions) {
  const call = httpsCallable<{ connectionId?: string; history?: BankHistoryOptions }, Partial<BankSyncResult> & { months?: number }>(
    functions,
    "syncTrueLayerBalances"
  );
  const result = await call({ ...(connectionId ? { connectionId } : {}), ...(history ? { history } : {}) });
  return readSyncResult(result.data);
}

export async function disconnectBank(connectionId: string) {
  const call = httpsCallable<{ connectionId: string }, { ok: boolean }>(functions, "disconnectTrueLayer");
  await call({ connectionId });
}

export async function importFlatBankTransactions(input: {
  flatId: string;
  connectionId: string;
  bankAccountId: string;
  days?: number;
}) {
  const call = httpsCallable<typeof input, { imported: number; scanned: number }>(
    functions,
    "importFlatBankTransactions",
  );
  const res = await call(input);
  return res.data;
}
