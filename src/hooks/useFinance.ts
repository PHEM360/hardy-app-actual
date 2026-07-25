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
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";

export interface Account {
  id: string;
  name: string;
  type: string;
  active: boolean;
  hidden: boolean;
}

export interface BalanceEntry {
  id: string;
  accountId: string;
  date: string;
  balance: number;
}

export function useFinance(scopeUserId?: string) {
  const { user } = useAuth();
  const uid = scopeUserId ?? user?.uid;
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
    async (name: string, type: string) => {
      if (!uid) return;
      await addDoc(collection(db, "finance", uid, "accounts"), {
        name,
        type,
        active: true,
        hidden: false,
        createdAt: serverTimestamp(),
      });
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
    async (accountId: string, date: string, balance: number) => {
      if (!uid) return;
      await addDoc(collection(db, "finance", uid, "entries"), {
        accountId,
        date,
        balance,
        createdAt: serverTimestamp(),
      });
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

  return { accounts, entries, loading, addAccount, updateAccount, addBalanceEntry, deleteEntry };
}
