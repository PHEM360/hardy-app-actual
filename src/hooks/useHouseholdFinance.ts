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
import { useActiveHousehold } from "@/hooks/useActiveHousehold";

export interface HouseholdFinanceAccount {
  id: string;
  name: string;
  type?: string;
  active: boolean;
  hidden: boolean;
}

export interface HouseholdFinanceEntry {
  id: string;
  accountId: string;
  date: string;
  balance: number;
}

/** Joint household accounts — scoped to the active household, visible to every member. */
export function useHouseholdFinance() {
  const { activeHouseholdId } = useActiveHousehold();
  const [accounts, setAccounts] = useState<HouseholdFinanceAccount[]>([]);
  const [entries, setEntries] = useState<HouseholdFinanceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeHouseholdId) {
      setAccounts([]);
      setEntries([]);
      setLoading(false);
      return;
    }

    setAccounts([]);
    setEntries([]);
    setLoading(true);
    const accountsRef = collection(db, "household", activeHouseholdId, "financeAccounts");
    const entriesRef = collection(db, "household", activeHouseholdId, "financeEntries");

    let accountsLoaded = false;
    let entriesLoaded = false;
    const checkDone = () => {
      if (accountsLoaded && entriesLoaded) setLoading(false);
    };

    const unsubAccounts = onSnapshot(
      query(accountsRef, orderBy("name")),
      (snap) => {
        setAccounts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<HouseholdFinanceAccount, "id">) })));
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
        setEntries(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<HouseholdFinanceEntry, "id">) })));
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
  }, [activeHouseholdId]);

  const addAccount = useCallback(
    async (name: string, type = "Other") => {
      if (!activeHouseholdId || !name.trim()) return;
      await addDoc(collection(db, "household", activeHouseholdId, "financeAccounts"), {
        name: name.trim(),
        type,
        active: true,
        hidden: false,
        createdAt: serverTimestamp(),
      });
    },
    [activeHouseholdId]
  );

  const updateAccount = useCallback(
    async (accountId: string, updates: Partial<HouseholdFinanceAccount>) => {
      if (!activeHouseholdId) return;
      await updateDoc(doc(db, "household", activeHouseholdId, "financeAccounts", accountId), updates as Record<string, unknown>);
    },
    [activeHouseholdId]
  );

  const addBalanceEntry = useCallback(
    async (accountId: string, date: string, balance: number) => {
      if (!activeHouseholdId) return;
      await addDoc(collection(db, "household", activeHouseholdId, "financeEntries"), {
        accountId,
        date,
        balance,
        createdAt: serverTimestamp(),
      });
    },
    [activeHouseholdId]
  );

  const deleteEntry = useCallback(
    async (entryId: string) => {
      if (!activeHouseholdId) return;
      await deleteDoc(doc(db, "household", activeHouseholdId, "financeEntries", entryId));
    },
    [activeHouseholdId]
  );

  return { accounts, entries, loading, addAccount, updateAccount, addBalanceEntry, deleteEntry };
}
