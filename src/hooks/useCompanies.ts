import { useEffect, useState, useCallback } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";
import {
  Company,
  CompanyLogin,
  CompanyService,
  CompanyExpense,
  CompanyInsurance,
  CompanyIncome,
  CompanyTaxReturn,
} from "@/types/app";

export function useCompanies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, "companies", uid, "items"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setCompanies(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Company)));
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  const addCompany = useCallback(async (company: Omit<Company, "id" | "createdAt" | "updatedAt">) => {
    if (!uid) return;
    await addDoc(collection(db, "companies", uid, "items"), {
      ...company,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }, [uid]);

  const updateCompany = useCallback(async (id: string, updates: Partial<Company>) => {
    if (!uid) return;
    await updateDoc(doc(db, "companies", uid, "items", id), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  }, [uid]);

  const deleteCompany = useCallback(async (id: string) => {
    if (!uid) return;
    await deleteDoc(doc(db, "companies", uid, "items", id));
  }, [uid]);

  return { companies, loading, addCompany, updateCompany, deleteCompany };
}

// ─── Logins ────────────────────────────────────────────────────────────────────

export function useCompanyLogins(companyId: string | undefined) {
  const [logins, setLogins] = useState<CompanyLogin[]>([]);
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid || !companyId) return;
    const q = query(collection(db, "companies", uid, "items", companyId, "logins"), orderBy("service"));
    return onSnapshot(q, (snap) => {
      setLogins(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CompanyLogin)));
    });
  }, [uid, companyId]);

  const addLogin = useCallback(async (login: Omit<CompanyLogin, "id">) => {
    if (!uid || !companyId) return;
    await addDoc(collection(db, "companies", uid, "items", companyId, "logins"), login);
  }, [uid, companyId]);

  const updateLogin = useCallback(async (id: string, updates: Partial<CompanyLogin>) => {
    if (!uid || !companyId) return;
    await updateDoc(doc(db, "companies", uid, "items", companyId, "logins", id), updates);
  }, [uid, companyId]);

  const deleteLogin = useCallback(async (id: string) => {
    if (!uid || !companyId) return;
    await deleteDoc(doc(db, "companies", uid, "items", companyId, "logins", id));
  }, [uid, companyId]);

  return { logins, addLogin, updateLogin, deleteLogin };
}

// ─── Services ──────────────────────────────────────────────────────────────────

export function useCompanyServices(companyId: string | undefined) {
  const [services, setServices] = useState<CompanyService[]>([]);
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid || !companyId) return;
    const q = query(collection(db, "companies", uid, "items", companyId, "services"), orderBy("name"));
    return onSnapshot(q, (snap) => {
      setServices(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CompanyService)));
    });
  }, [uid, companyId]);

  const addService = useCallback(async (service: Omit<CompanyService, "id">) => {
    if (!uid || !companyId) return;
    await addDoc(collection(db, "companies", uid, "items", companyId, "services"), service);
  }, [uid, companyId]);

  const updateService = useCallback(async (id: string, updates: Partial<CompanyService>) => {
    if (!uid || !companyId) return;
    await updateDoc(doc(db, "companies", uid, "items", companyId, "services", id), updates);
  }, [uid, companyId]);

  const deleteService = useCallback(async (id: string) => {
    if (!uid || !companyId) return;
    await deleteDoc(doc(db, "companies", uid, "items", companyId, "services", id));
  }, [uid, companyId]);

  return { services, addService, updateService, deleteService };
}

// ─── Expenses ──────────────────────────────────────────────────────────────────

export function useCompanyExpenses(companyId: string | undefined) {
  const [expenses, setExpenses] = useState<CompanyExpense[]>([]);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid || !companyId) return;
    const q = query(
      collection(db, "companies", uid, "items", companyId, "expenses"),
      orderBy("date", "desc")
    );
    return onSnapshot(q, (snap) => {
      setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CompanyExpense)));
    });
  }, [uid, companyId]);

  const addExpense = useCallback(async (expense: Omit<CompanyExpense, "id" | "createdAt">) => {
    if (!uid || !companyId) return;
    await addDoc(collection(db, "companies", uid, "items", companyId, "expenses"), {
      ...expense,
      createdAt: serverTimestamp(),
    });
  }, [uid, companyId]);

  const updateExpense = useCallback(async (id: string, updates: Partial<CompanyExpense>) => {
    if (!uid || !companyId) return;
    await updateDoc(doc(db, "companies", uid, "items", companyId, "expenses", id), updates);
  }, [uid, companyId]);

  const deleteExpense = useCallback(async (id: string) => {
    if (!uid || !companyId) return;
    await deleteDoc(doc(db, "companies", uid, "items", companyId, "expenses", id));
  }, [uid, companyId]);

  const uploadReceipt = useCallback(async (expenseId: string, file: File, currentUrls: string[]) => {
    if (!uid || !companyId) return;
    setUploadingReceipt(true);
    try {
      const storageRef = ref(storage, `companies/${uid}/${companyId}/receipts/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, "companies", uid, "items", companyId, "expenses", expenseId), {
        receipts: [...(currentUrls || []), url],
      });
    } finally {
      setUploadingReceipt(false);
    }
  }, [uid, companyId]);

  return { expenses, uploadingReceipt, addExpense, updateExpense, deleteExpense, uploadReceipt };
}

// ─── Insurance ─────────────────────────────────────────────────────────────────

export function useCompanyInsurance(companyId: string | undefined) {
  const [policies, setPolicies] = useState<CompanyInsurance[]>([]);
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid || !companyId) return;
    const q = query(
      collection(db, "companies", uid, "items", companyId, "insurance"),
      orderBy("renewalDate")
    );
    return onSnapshot(q, (snap) => {
      setPolicies(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CompanyInsurance)));
    });
  }, [uid, companyId]);

  const addPolicy = useCallback(async (policy: Omit<CompanyInsurance, "id" | "createdAt">) => {
    if (!uid || !companyId) return;
    await addDoc(collection(db, "companies", uid, "items", companyId, "insurance"), {
      ...policy,
      createdAt: serverTimestamp(),
    });
  }, [uid, companyId]);

  const updatePolicy = useCallback(async (id: string, updates: Partial<CompanyInsurance>) => {
    if (!uid || !companyId) return;
    await updateDoc(doc(db, "companies", uid, "items", companyId, "insurance", id), updates);
  }, [uid, companyId]);

  const deletePolicy = useCallback(async (id: string) => {
    if (!uid || !companyId) return;
    await deleteDoc(doc(db, "companies", uid, "items", companyId, "insurance", id));
  }, [uid, companyId]);

  return { policies, addPolicy, updatePolicy, deletePolicy };
}

// ─── Income ────────────────────────────────────────────────────────────────────

export function useCompanyIncome(companyId: string | undefined) {
  const [incomes, setIncomes] = useState<CompanyIncome[]>([]);
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid || !companyId) return;
    const q = query(
      collection(db, "companies", uid, "items", companyId, "income"),
      orderBy("date", "desc")
    );
    return onSnapshot(q, (snap) => {
      setIncomes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CompanyIncome)));
    });
  }, [uid, companyId]);

  const addIncome = useCallback(async (income: Omit<CompanyIncome, "id" | "createdAt">) => {
    if (!uid || !companyId) return;
    await addDoc(collection(db, "companies", uid, "items", companyId, "income"), {
      ...income,
      createdAt: serverTimestamp(),
    });
  }, [uid, companyId]);

  const updateIncome = useCallback(async (id: string, updates: Partial<CompanyIncome>) => {
    if (!uid || !companyId) return;
    await updateDoc(doc(db, "companies", uid, "items", companyId, "income", id), updates);
  }, [uid, companyId]);

  const deleteIncome = useCallback(async (id: string) => {
    if (!uid || !companyId) return;
    await deleteDoc(doc(db, "companies", uid, "items", companyId, "income", id));
  }, [uid, companyId]);

  return { incomes, addIncome, updateIncome, deleteIncome };
}

// ─── Tax Returns ───────────────────────────────────────────────────────────────

export function useCompanyTaxReturns(companyId: string | undefined) {
  const [taxReturns, setTaxReturns] = useState<CompanyTaxReturn[]>([]);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid || !companyId) return;
    const q = query(
      collection(db, "companies", uid, "items", companyId, "taxReturns"),
      orderBy("taxYear", "desc")
    );
    return onSnapshot(q, (snap) => {
      setTaxReturns(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CompanyTaxReturn)));
    });
  }, [uid, companyId]);

  const addReturn = useCallback(async (ret: Omit<CompanyTaxReturn, "id" | "createdAt">) => {
    if (!uid || !companyId) return;
    await addDoc(collection(db, "companies", uid, "items", companyId, "taxReturns"), {
      ...ret,
      createdAt: serverTimestamp(),
    });
  }, [uid, companyId]);

  const updateReturn = useCallback(async (id: string, updates: Partial<CompanyTaxReturn>) => {
    if (!uid || !companyId) return;
    await updateDoc(doc(db, "companies", uid, "items", companyId, "taxReturns", id), updates);
  }, [uid, companyId]);

  const deleteReturn = useCallback(async (id: string) => {
    if (!uid || !companyId) return;
    await deleteDoc(doc(db, "companies", uid, "items", companyId, "taxReturns", id));
  }, [uid, companyId]);

  const uploadPdf = useCallback(async (returnId: string, file: File) => {
    if (!uid || !companyId) return;
    setUploadingPdf(true);
    try {
      const storageRef = ref(storage, `companies/${uid}/${companyId}/taxreturns/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, "companies", uid, "items", companyId, "taxReturns", returnId), { pdfUrl: url });
    } finally {
      setUploadingPdf(false);
    }
  }, [uid, companyId]);

  return { taxReturns, uploadingPdf, addReturn, updateReturn, deleteReturn, uploadPdf };
}

// ─── Multi-company Finance (consolidated view) ─────────────────────────────────

export function useMultiCompanyFinance(companyIds: string[]) {
  const [data, setData] = useState<Record<string, { income: CompanyIncome[]; expenses: CompanyExpense[] }>>({});
  const uid = auth.currentUser?.uid;
  const idsKey = companyIds.join(",");

  useEffect(() => {
    if (!uid || companyIds.length === 0) return;
    const unsubs: (() => void)[] = [];

    companyIds.forEach((cid) => {
      const iQ = query(collection(db, "companies", uid, "items", cid, "income"), orderBy("date", "desc"));
      const eQ = query(collection(db, "companies", uid, "items", cid, "expenses"), orderBy("date", "desc"));
      unsubs.push(
        onSnapshot(iQ, (snap) => {
          setData((prev) => ({
            ...prev,
            [cid]: {
              income: snap.docs.map((d) => ({ id: d.id, ...d.data() } as CompanyIncome)),
              expenses: prev[cid]?.expenses ?? [],
            },
          }));
        }),
        onSnapshot(eQ, (snap) => {
          setData((prev) => ({
            ...prev,
            [cid]: {
              income: prev[cid]?.income ?? [],
              expenses: snap.docs.map((d) => ({ id: d.id, ...d.data() } as CompanyExpense)),
            },
          }));
        })
      );
    });

    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, idsKey]);

  return data;
}
