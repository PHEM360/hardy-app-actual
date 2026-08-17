import { useEffect, useState, useCallback } from "react";
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
  deleteField,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";

export type AssetClass = "equity" | "bond" | "cash" | "property" | "other";

export interface FundAllocation {
  id: string;
  name: string;
  pct: number;
  assetClass: AssetClass;
}

export type FeeKind = "percent" | "gbp";

export interface AccountFee {
  id: string;
  name: string;
  kind: FeeKind;
  amount: number;
}

export interface InterestRatePeriod {
  id: string;
  ratePct: number;
  from: string;
}

export interface Account {
  id: string;
  name: string;
  type: string;
  active: boolean;
  hidden: boolean;
  openedOn?: string; // ISO date the account was opened
  // Optional predictive-modelling assumptions, set per account for the "Custom" scenario.
  growthAssumptionPct?: number; // assumed annual growth rate, e.g. 5 for 5%/yr
  monthlyContribution?: number; // assumed regular monthly deposit
  feePct?: number; // assumed annual platform fee, e.g. 0.25 for 0.25%/yr
  ocfPct?: number; // ongoing charges / fund OCF, e.g. 0.2 for 0.2%/yr
  annualFeeGbp?: number; // flat annual account fee in £
  adviceFeeKind?: FeeKind;
  adviceFeeAmount?: number;
  extraFees?: AccountFee[];
  interestRates?: InterestRatePeriod[];
  allocations?: FundAllocation[];
  bankProvider?: "truelayer";
  bankConnectionId?: string;
  bankAccountId?: string;
  bankLastSyncedAt?: { toDate?: () => Date } | null;
}

export interface BalanceEntry {
  id: string;
  accountId: string;
  date: string;
  balance: number;
  note?: string;
}

export function useFinance(scopeUserId?: string) {
  const { dataUid } = useAuth();
  const uid = scopeUserId ?? dataUid;
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<BalanceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setAccounts([]);
      setEntries([]);
      setLoading(false);
      return;
    }

    const accountsRef = collection(db, "finance", uid, "accounts");
    const entriesRef = collection(db, "finance", uid, "entries");

    let accountsLoaded = false;
    let entriesLoaded = false;

    const checkDone = () => {
      if (accountsLoaded && entriesLoaded) setLoading(false);
    };

    const unsubAccounts = onSnapshot(
      query(accountsRef, orderBy("name")),
      (snap) => {
        setAccounts(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Account, "id">) }))
        );
        accountsLoaded = true;
        checkDone();
      },
      () => {
        accountsLoaded = true;
        checkDone();
      }
    );

    const unsubEntries = onSnapshot(
      query(entriesRef, orderBy("date")),
      (snap) => {
        setEntries(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BalanceEntry, "id">) }))
        );
        entriesLoaded = true;
        checkDone();
      },
      () => {
        entriesLoaded = true;
        checkDone();
      }
    );

    return () => {
      unsubAccounts();
      unsubEntries();
    };
  }, [uid]);

  const addAccount = useCallback(
    async (name: string, type: string, extras?: { openedOn?: string }) => {
      if (!uid) return;
      const payload: Record<string, unknown> = {
        name,
        type,
        active: true,
        hidden: false,
        createdAt: serverTimestamp(),
      };
      const openedOn = extras?.openedOn?.trim();
      if (openedOn) payload.openedOn = openedOn;
      await addDoc(collection(db, "finance", uid, "accounts"), payload);
    },
    [uid]
  );

  const updateAccount = useCallback(
    async (accountId: string, updates: Partial<Account>) => {
      if (!uid) return;
      await updateDoc(doc(db, "finance", uid, "accounts", accountId), updates as any);
    },
    [uid]
  );

  const addBalanceEntry = useCallback(
    async (accountId: string, date: string, balance: number, note?: string) => {
      if (!uid) return;
      const payload: Record<string, unknown> = {
        accountId,
        date,
        balance,
        createdAt: serverTimestamp(),
      };
      const trimmed = note?.trim();
      if (trimmed) payload.note = trimmed;
      await addDoc(collection(db, "finance", uid, "entries"), payload);
    },
    [uid]
  );

  const updateEntry = useCallback(
    async (entryId: string, updates: { balance?: number; date?: string; note?: string | null }) => {
      if (!uid) return;
      const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (updates.balance !== undefined) payload.balance = updates.balance;
      if (updates.date !== undefined) payload.date = updates.date;
      if (updates.note !== undefined) {
        const trimmed = updates.note?.trim() ?? "";
        payload.note = trimmed ? trimmed : deleteField();
      }
      await updateDoc(doc(db, "finance", uid, "entries", entryId), payload);
    },
    [uid]
  );

  const deleteEntry = useCallback(
    async (entryId: string) => {
      if (!uid) return;
      await deleteDoc(doc(db, "finance", uid, "entries", entryId));
    },
    [uid]
  );

  /**
   * Bulk-writes imported balance rows. Rows with `existingEntryId` overwrite that
   * entry (so re-importing corrected data updates rather than duplicates);
   * everything else is created new. Chunked to stay under Firestore's 500-write
   * batch limit.
   */
  const importEntries = useCallback(
    async (rows: { accountId: string; date: string; balance: number; existingEntryId?: string }[]) => {
      if (!uid || rows.length === 0) return;
      const CHUNK_SIZE = 400;
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        for (const row of chunk) {
          const ref = row.existingEntryId
            ? doc(db, "finance", uid, "entries", row.existingEntryId)
            : doc(collection(db, "finance", uid, "entries"));
          batch.set(
            ref,
            { accountId: row.accountId, date: row.date, balance: row.balance, createdAt: serverTimestamp() },
            { merge: true }
          );
        }
        await batch.commit();
      }
    },
    [uid]
  );

  return { accounts, entries, loading, addAccount, updateAccount, addBalanceEntry, updateEntry, deleteEntry, importEntries };
}
