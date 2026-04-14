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

export function useFinance() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<BalanceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setAccounts([]);
      setEntries([]);
      setLoading(false);
      return;
    }

    const accountsRef = collection(db, "finance", user.uid, "accounts");
    const entriesRef = collection(db, "finance", user.uid, "entries");

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
  }, [user?.uid]);

  const addAccount = useCallback(
    async (name: string, type: string) => {
      if (!user) return;
      await addDoc(collection(db, "finance", user.uid, "accounts"), {
        name,
        type,
        active: true,
        hidden: false,
        createdAt: serverTimestamp(),
      });
    },
    [user]
  );

  const updateAccount = useCallback(
    async (accountId: string, updates: Partial<Account>) => {
      if (!user) return;
      await updateDoc(doc(db, "finance", user.uid, "accounts", accountId), updates as any);
    },
    [user]
  );

  const addBalanceEntry = useCallback(
    async (accountId: string, date: string, balance: number) => {
      if (!user) return;
      await addDoc(collection(db, "finance", user.uid, "entries"), {
        accountId,
        date,
        balance,
        createdAt: serverTimestamp(),
      });
    },
    [user]
  );

  const deleteEntry = useCallback(
    async (entryId: string) => {
      if (!user) return;
      await deleteDoc(doc(db, "finance", user.uid, "entries", entryId));
    },
    [user]
  );

  return { accounts, entries, loading, addAccount, updateAccount, addBalanceEntry, deleteEntry };
}
