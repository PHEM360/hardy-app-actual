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
import {
  financeAssetFromDoc,
  financeAssetWriteData,
  type FinanceAsset,
} from "@/lib/financeAssets";
import { balanceOnOrBefore, buildTransferPlan } from "@/lib/financeTransfer";

export type { FinanceAsset } from "@/lib/financeAssets";

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
  closedOn?: string; // ISO date the account was closed and funds transferred
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

export interface FinanceTransaction {
  id: string;
  accountId: string;
  bankTransactionId?: string;
  date: string;
  amount: number;
  description: string;
  category: string;
  merchantName?: string;
  source?: "truelayer" | "manual";
}

export interface FinanceNote {
  id: string;
  text: string;
}

export interface FinanceTodo {
  id: string;
  title: string;
  done: boolean;
  assigneeUid?: string;
  assigneeName?: string;
}

export function useFinance(scopeUserId?: string) {
  const { dataUid } = useAuth();
  const uid = scopeUserId ?? dataUid;
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<BalanceEntry[]>([]);
  const [assets, setAssets] = useState<FinanceAsset[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [notes, setNotes] = useState<FinanceNote[]>([]);
  const [todos, setTodos] = useState<FinanceTodo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setAccounts([]);
      setEntries([]);
      setAssets([]);
      setTransactions([]);
      setNotes([]);
      setTodos([]);
      setLoading(false);
      return;
    }

    const accountsRef = collection(db, "finance", uid, "accounts");
    const entriesRef = collection(db, "finance", uid, "entries");
    const assetsRef = collection(db, "finance", uid, "assets");
    const transactionsRef = collection(db, "finance", uid, "transactions");
    const notesRef = collection(db, "finance", uid, "notes");
    const todosRef = collection(db, "finance", uid, "todos");

    let accountsLoaded = false;
    let entriesLoaded = false;
    let assetsLoaded = false;
    let transactionsLoaded = false;
    let notesLoaded = false;
    let todosLoaded = false;

    const checkDone = () => {
      if (accountsLoaded && entriesLoaded && assetsLoaded && transactionsLoaded && notesLoaded && todosLoaded) setLoading(false);
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

    const unsubAssets = onSnapshot(
      query(assetsRef, orderBy("name")),
      (snap) => {
        setAssets(snap.docs.map((item) => financeAssetFromDoc(item.id, item.data() as Record<string, unknown>)));
        assetsLoaded = true;
        checkDone();
      },
      (error) => {
        // #region agent log
        // #endregion
        setAssets([]);
        assetsLoaded = true;
        checkDone();
      }
    );

    const unsubTransactions = onSnapshot(
      query(transactionsRef, orderBy("date")),
      (snap) => {
        setTransactions(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FinanceTransaction, "id">) }))
        );
        transactionsLoaded = true;
        checkDone();
      },
      () => {
        setTransactions([]);
        transactionsLoaded = true;
        checkDone();
      }
    );

    const unsubNotes = onSnapshot(
      query(notesRef, orderBy("createdAt")),
      (snap) => {
        setNotes(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FinanceNote, "id">) })));
        notesLoaded = true;
        checkDone();
      },
      () => {
        setNotes([]);
        notesLoaded = true;
        checkDone();
      }
    );

    const unsubTodos = onSnapshot(
      query(todosRef, orderBy("createdAt")),
      (snap) => {
        setTodos(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FinanceTodo, "id">) })));
        todosLoaded = true;
        checkDone();
      },
      () => {
        setTodos([]);
        todosLoaded = true;
        checkDone();
      }
    );

    return () => {
      unsubAccounts();
      unsubEntries();
      unsubAssets();
      unsubTransactions();
      unsubNotes();
      unsubTodos();
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
      const created = await addDoc(collection(db, "finance", uid, "accounts"), payload);
      return created.id;
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

  const transferAndCloseAccount = useCallback(
    async (args: {
      fromId: string;
      toId?: string;
      newAccount?: { name: string; type: string; openedOn?: string };
      date: string;
    }) => {
      if (!uid) return;
      const from = accounts.find((account) => account.id === args.fromId);
      if (!from) throw new Error("Account not found");

      let toId = args.toId;
      let toName = accounts.find((account) => account.id === toId)?.name;
      if (args.newAccount?.name.trim()) {
        toId = await addAccount(args.newAccount.name, args.newAccount.type, {
          openedOn: args.newAccount.openedOn,
        });
        toName = args.newAccount.name.trim();
      }
      if (!toId || !toName) throw new Error("Choose where the money should go");
      if (toId === args.fromId) throw new Error("Choose a different account");

      const plan = buildTransferPlan({
        from: { id: from.id, name: from.name },
        to: { id: toId, name: toName },
        fromBalance: balanceOnOrBefore(from.id, entries, args.date),
        toBalance: balanceOnOrBefore(toId, entries, args.date),
        date: args.date,
      });

      const batch = writeBatch(db);
      const upsert = (accountId: string, balance: number, note: string) => {
        const existing = entries.find((entry) => entry.accountId === accountId && entry.date === plan.date);
        const payload = {
          accountId,
          date: plan.date,
          balance,
          note,
          createdAt: serverTimestamp(),
        };
        if (existing) {
          batch.update(doc(db, "finance", uid, "entries", existing.id), {
            balance,
            note,
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.set(doc(collection(db, "finance", uid, "entries")), payload);
        }
      };
      upsert(plan.fromId, plan.fromBalance, plan.fromNote);
      upsert(plan.toId, plan.toBalance, plan.toNote);
      batch.update(doc(db, "finance", uid, "accounts", plan.fromId), {
        active: false,
        closedOn: plan.date,
      });
      await batch.commit();
      return { toId, plan };
    },
    [uid, accounts, entries, addAccount]
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

  const addFinanceNote = useCallback(
    async (text: string) => {
      if (!uid) return;
      const trimmed = text.trim();
      if (!trimmed) return;
      await addDoc(collection(db, "finance", uid, "notes"), {
        text: trimmed,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },
    [uid]
  );

  const updateFinanceNote = useCallback(
    async (noteId: string, text: string) => {
      if (!uid) return;
      await updateDoc(doc(db, "finance", uid, "notes", noteId), {
        text: text.trim(),
        updatedAt: serverTimestamp(),
      });
    },
    [uid]
  );

  const deleteFinanceNote = useCallback(
    async (noteId: string) => {
      if (!uid) return;
      await deleteDoc(doc(db, "finance", uid, "notes", noteId));
    },
    [uid]
  );

  const addFinanceTodo = useCallback(
    async (input: { title: string; assigneeUid?: string; assigneeName?: string }) => {
      if (!uid) return;
      const title = input.title.trim();
      if (!title) return;
      await addDoc(collection(db, "finance", uid, "todos"), {
        title,
        done: false,
        assigneeUid: input.assigneeUid || "",
        assigneeName: input.assigneeName || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },
    [uid]
  );

  const updateFinanceTodo = useCallback(
    async (todoId: string, updates: Partial<FinanceTodo>) => {
      if (!uid) return;
      await updateDoc(doc(db, "finance", uid, "todos", todoId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    },
    [uid]
  );

  const deleteFinanceTodo = useCallback(
    async (todoId: string) => {
      if (!uid) return;
      await deleteDoc(doc(db, "finance", uid, "todos", todoId));
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

  const addAsset = useCallback(
    async (input: Omit<FinanceAsset, "id">) => {
      if (!uid) {
        // #region agent log
        // #endregion
        return;
      }
      try {
        await addDoc(collection(db, "finance", uid, "assets"), {
          ...financeAssetWriteData(input),
          createdAt: serverTimestamp(),
        });
        // #region agent log
        // #endregion
      } catch (error) {
        // #region agent log
        // #endregion
        throw error;
      }
    },
    [uid]
  );

  const updateAsset = useCallback(
    async (assetId: string, input: Omit<FinanceAsset, "id">) => {
      if (!uid) return;
      await updateDoc(doc(db, "finance", uid, "assets", assetId), {
        ...financeAssetWriteData(input),
        updatedAt: serverTimestamp(),
      });
    },
    [uid]
  );

  const deleteAsset = useCallback(
    async (assetId: string) => {
      if (!uid) return;
      await deleteDoc(doc(db, "finance", uid, "assets", assetId));
    },
    [uid]
  );

  return {
    accounts, entries, assets, transactions, notes, todos, loading,
    addAccount, updateAccount, transferAndCloseAccount, addBalanceEntry, updateEntry, deleteEntry, importEntries,
    addFinanceNote, updateFinanceNote, deleteFinanceNote,
    addFinanceTodo, updateFinanceTodo, deleteFinanceTodo,
    addAsset, updateAsset, deleteAsset,
  };
}
