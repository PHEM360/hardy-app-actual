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
  arrayUnion,
  arrayRemove,
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
    // Query all companies — filter client-side so legacy companies (no ownerId)
    // remain visible and new companies are scoped to owner + sharedWith.
    const q = query(collection(db, "companies"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const next = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Company))
        .filter((c) =>
          !c.ownerId ||
          c.ownerId === uid ||
          (c.sharedWith ?? []).includes(uid)
        );
      setCompanies(next);
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  const addCompany = useCallback(async (company: Omit<Company, "id" | "createdAt" | "updatedAt">) => {
    if (!uid) return;
    await addDoc(collection(db, "companies"), {
      ...company,
      ownerId: uid,
      sharedWith: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }, [uid]);

  const updateCompany = useCallback(async (id: string, updates: Partial<Company>) => {
    await updateDoc(doc(db, "companies", id), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  }, []);

  const deleteCompany = useCallback(async (id: string) => {
    await deleteDoc(doc(db, "companies", id));
  }, []);

  const shareCompany = useCallback(async (companyId: string, targetUid: string) => {
    await updateDoc(doc(db, "companies", companyId), {
      sharedWith: arrayUnion(targetUid),
    });
  }, []);

  const unshareCompany = useCallback(async (companyId: string, targetUid: string) => {
    await updateDoc(doc(db, "companies", companyId), {
      sharedWith: arrayRemove(targetUid),
    });
  }, []);

  return { companies, loading, addCompany, updateCompany, deleteCompany, shareCompany, unshareCompany };
}

// ─── Logins ────────────────────────────────────────────────────────────────────

export function useCompanyLogins(companyId: string | undefined) {
  const [logins, setLogins] = useState<CompanyLogin[]>([]);

  useEffect(() => {
    if (!companyId) return;
    const q = query(collection(db, "companies", companyId, "logins"), orderBy("service"));
    return onSnapshot(q, (snap) => {
      setLogins(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CompanyLogin)));
    });
  }, [companyId]);

  const addLogin = useCallback(async (login: Omit<CompanyLogin, "id">) => {
    if (!companyId) return;
    await addDoc(collection(db, "companies", companyId, "logins"), login);
  }, [companyId]);

  const updateLogin = useCallback(async (id: string, updates: Partial<CompanyLogin>) => {
    if (!companyId) return;
    await updateDoc(doc(db, "companies", companyId, "logins", id), updates);
  }, [companyId]);

  const deleteLogin = useCallback(async (id: string) => {
    if (!companyId) return;
    await deleteDoc(doc(db, "companies", companyId, "logins", id));
  }, [companyId]);

  return { logins, addLogin, updateLogin, deleteLogin };
}

// ─── Services ──────────────────────────────────────────────────────────────────

export function useCompanyServices(companyId: string | undefined) {
  const [services, setServices] = useState<CompanyService[]>([]);

  useEffect(() => {
    if (!companyId) return;
    const q = query(collection(db, "companies", companyId, "services"), orderBy("name"));
    return onSnapshot(q, (snap) => {
      setServices(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CompanyService)));
    });
  }, [companyId]);

  const addService = useCallback(async (service: Omit<CompanyService, "id">) => {
    if (!companyId) return;
    await addDoc(collection(db, "companies", companyId, "services"), service);
  }, [companyId]);

  const updateService = useCallback(async (id: string, updates: Partial<CompanyService>) => {
    if (!companyId) return;
    await updateDoc(doc(db, "companies", companyId, "services", id), updates);
  }, [companyId]);

  const deleteService = useCallback(async (id: string) => {
    if (!companyId) return;
    await deleteDoc(doc(db, "companies", companyId, "services", id));
  }, [companyId]);

  return { services, addService, updateService, deleteService };
}

// ─── Expenses ──────────────────────────────────────────────────────────────────

export function useCompanyExpenses(companyId: string | undefined) {
  const [expenses, setExpenses] = useState<CompanyExpense[]>([]);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    const q = query(
      collection(db, "companies", companyId, "expenses"),
      orderBy("date", "desc")
    );
    return onSnapshot(q, (snap) => {
      setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CompanyExpense)));
    });
  }, [companyId]);

  const addExpense = useCallback(async (expense: Omit<CompanyExpense, "id" | "createdAt">) => {
    if (!companyId) return undefined;
    const docRef = await addDoc(collection(db, "companies", companyId, "expenses"), {
      ...expense,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  }, [companyId]);

  const updateExpense = useCallback(async (id: string, updates: Partial<CompanyExpense>) => {
    if (!companyId) return;
    await updateDoc(doc(db, "companies", companyId, "expenses", id), updates);
  }, [companyId]);

  const deleteExpense = useCallback(async (id: string) => {
    if (!companyId) return;
    await deleteDoc(doc(db, "companies", companyId, "expenses", id));
  }, [companyId]);

  const uploadReceipt = useCallback(async (expenseId: string, file: File, currentUrls: string[]) => {
    if (!companyId) return;
    setUploadingReceipt(true);
    try {
      const storageRef = ref(storage, `companies/${companyId}/receipts/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, "companies", companyId, "expenses", expenseId), {
        receipts: [...(currentUrls || []), url],
      });
    } finally {
      setUploadingReceipt(false);
    }
  }, [companyId]);

  return { expenses, uploadingReceipt, addExpense, updateExpense, deleteExpense, uploadReceipt };
}

// ─── Insurance ─────────────────────────────────────────────────────────────────

export function useCompanyInsurance(companyId: string | undefined) {
  const [policies, setPolicies] = useState<CompanyInsurance[]>([]);

  useEffect(() => {
    if (!companyId) return;
    const q = query(
      collection(db, "companies", companyId, "insurance"),
      orderBy("renewalDate")
    );
    return onSnapshot(q, (snap) => {
      setPolicies(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CompanyInsurance)));
    });
  }, [companyId]);

  const addPolicy = useCallback(async (policy: Omit<CompanyInsurance, "id" | "createdAt">) => {
    if (!companyId) return;
    await addDoc(collection(db, "companies", companyId, "insurance"), {
      ...policy,
      createdAt: serverTimestamp(),
    });
  }, [companyId]);

  const updatePolicy = useCallback(async (id: string, updates: Partial<CompanyInsurance>) => {
    if (!companyId) return;
    await updateDoc(doc(db, "companies", companyId, "insurance", id), updates);
  }, [companyId]);

  const deletePolicy = useCallback(async (id: string) => {
    if (!companyId) return;
    await deleteDoc(doc(db, "companies", companyId, "insurance", id));
  }, [companyId]);

  return { policies, addPolicy, updatePolicy, deletePolicy };
}

// ─── Income ────────────────────────────────────────────────────────────────────

export function useCompanyIncome(companyId: string | undefined) {
  const [incomes, setIncomes] = useState<CompanyIncome[]>([]);

  useEffect(() => {
    if (!companyId) return;
    const q = query(
      collection(db, "companies", companyId, "income"),
      orderBy("date", "desc")
    );
    return onSnapshot(q, (snap) => {
      setIncomes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CompanyIncome)));
    });
  }, [companyId]);

  const addIncome = useCallback(async (income: Omit<CompanyIncome, "id" | "createdAt">) => {
    if (!companyId) return;
    await addDoc(collection(db, "companies", companyId, "income"), {
      ...income,
      createdAt: serverTimestamp(),
    });
  }, [companyId]);

  const updateIncome = useCallback(async (id: string, updates: Partial<CompanyIncome>) => {
    if (!companyId) return;
    await updateDoc(doc(db, "companies", companyId, "income", id), updates);
  }, [companyId]);

  const deleteIncome = useCallback(async (id: string) => {
    if (!companyId) return;
    await deleteDoc(doc(db, "companies", companyId, "income", id));
  }, [companyId]);

  return { incomes, addIncome, updateIncome, deleteIncome };
}

// ─── Tax Returns ───────────────────────────────────────────────────────────────

export function useCompanyTaxReturns(companyId: string | undefined) {
  const [taxReturns, setTaxReturns] = useState<CompanyTaxReturn[]>([]);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    const q = query(
      collection(db, "companies", companyId, "taxReturns"),
      orderBy("taxYear", "desc")
    );
    return onSnapshot(q, (snap) => {
      setTaxReturns(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CompanyTaxReturn)));
    });
  }, [companyId]);

  const addReturn = useCallback(async (ret: Omit<CompanyTaxReturn, "id" | "createdAt">) => {
    if (!companyId) return;
    await addDoc(collection(db, "companies", companyId, "taxReturns"), {
      ...ret,
      createdAt: serverTimestamp(),
    });
  }, [companyId]);

  const updateReturn = useCallback(async (id: string, updates: Partial<CompanyTaxReturn>) => {
    if (!companyId) return;
    await updateDoc(doc(db, "companies", companyId, "taxReturns", id), updates);
  }, [companyId]);

  const deleteReturn = useCallback(async (id: string) => {
    if (!companyId) return;
    await deleteDoc(doc(db, "companies", companyId, "taxReturns", id));
  }, [companyId]);

  const uploadPdf = useCallback(async (returnId: string, file: File) => {
    if (!companyId) return;
    setUploadingPdf(true);
    try {
      const storageRef = ref(storage, `companies/${companyId}/taxreturns/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, "companies", companyId, "taxReturns", returnId), { pdfUrl: url });
    } finally {
      setUploadingPdf(false);
    }
  }, [companyId]);

  return { taxReturns, uploadingPdf, addReturn, updateReturn, deleteReturn, uploadPdf };
}

// ─── Multi-company Finance (consolidated view) ─────────────────────────────────

export function useMultiCompanyFinance(companyIds: string[]) {
  const [data, setData] = useState<Record<string, { income: CompanyIncome[]; expenses: CompanyExpense[] }>>({});
  const idsKey = companyIds.join(",");

  useEffect(() => {
    if (companyIds.length === 0) return;
    const unsubs: (() => void)[] = [];

    companyIds.forEach((cid) => {
      const iQ = query(collection(db, "companies", cid, "income"), orderBy("date", "desc"));
      const eQ = query(collection(db, "companies", cid, "expenses"), orderBy("date", "desc"));
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
  }, [idsKey]);

  return data;
}
