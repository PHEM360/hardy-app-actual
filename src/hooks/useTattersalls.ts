import { useEffect, useState, useCallback } from "react";
import {
  doc,
  onSnapshot,
  setDoc,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot as onColSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { db, storage } from "@/lib/firebase";

export interface BalanceRecord {
  date: string;
  month: string;
  balance: number;
}

export interface Expense {
  date: string;
  desc: string;
  type: string;
  frequency: string;
  amount: number;
}

export interface TatDocument {
  id: string;
  name: string;
  date: string;
  url: string;
  fileType: string;
}

// Single shared Firestore doc for balance + expenses
const SHARED_DOC = doc(db, "tattersalls", "shared");

export function useTattersalls() {
  const [balanceHistory, setBalanceHistory] = useState<BalanceRecord[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [documents, setDocuments] = useState<TatDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Subscribe to shared doc (balance + expenses)
  useEffect(() => {
    const unsub = onSnapshot(SHARED_DOC, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setBalanceHistory(data.balanceHistory ?? []);
        setExpenses(data.expenses ?? []);
      } else {
        setBalanceHistory([]);
        setExpenses([]);
      }
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  // Subscribe to documents subcollection
  useEffect(() => {
    const q = query(
      collection(db, "tattersalls", "shared", "documents"),
      orderBy("createdAt", "desc")
    );
    const unsub = onColSnapshot(q, (snap) => {
      setDocuments(
        snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name ?? "",
          date: d.data().date ?? "",
          url: d.data().url ?? "",
          fileType: d.data().fileType ?? "file",
        }))
      );
    });
    return () => unsub();
  }, []);

  const addBalance = useCallback(async (record: BalanceRecord) => {
    const existing = await new Promise<BalanceRecord[]>((resolve) => {
      const unsub = onSnapshot(SHARED_DOC, (snap) => {
        unsub();
        resolve(snap.exists() ? (snap.data().balanceHistory ?? []) : []);
      });
    });
    await setDoc(SHARED_DOC, { balanceHistory: [...existing, record] }, { merge: true });
  }, []);

  const addExpense = useCallback(async (expense: Expense) => {
    const existing = await new Promise<Expense[]>((resolve) => {
      const unsub = onSnapshot(SHARED_DOC, (snap) => {
        unsub();
        resolve(snap.exists() ? (snap.data().expenses ?? []) : []);
      });
    });
    await setDoc(SHARED_DOC, { expenses: [...existing, expense] }, { merge: true });
  }, []);

  const uploadDocument = useCallback(async (file: File) => {
    setUploadingDoc(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const fileType = file.type.startsWith("image/") ? "image" : ext === "pdf" ? "pdf" : "file";
      const storageRef = ref(storage, `tattersalls/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await addDoc(collection(db, "tattersalls", "shared", "documents"), {
        name: file.name,
        date: new Date().toISOString().split("T")[0],
        url,
        fileType,
        createdAt: serverTimestamp(),
      });
    } finally {
      setUploadingDoc(false);
    }
  }, []);

  return {
    balanceHistory,
    expenses,
    documents,
    loading,
    uploadingDoc,
    addBalance,
    addExpense,
    uploadDocument,
  };
}
