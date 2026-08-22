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
  deleteField,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { alignedReceiptNames } from "@/lib/receipts";
import { cleanCompanyPayload } from "@/lib/companyPayload";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";
import { usePageShares } from "@/hooks/usePageShares";
import {
  Company,
  CompanyLogin,
  CompanyService,
  CompanyExpense,
  CompanyExpenseHistoryEntry,
  CompanyInsurance,
  CompanyIncome,
  CompanyTaxReturn,
} from "@/types/app";

export function companyReceiptStoragePath(companyId: string, fileName: string) {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) || "receipt";
  return `companies/${companyId}/receipts/${Date.now()}_${safe}`;
}

export function expenseSaveMessage(err: unknown) {
  const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
  const message = err instanceof Error ? err.message : String(err);
  if (code.includes("permission-denied") || /permission/i.test(message)) {
    return "You don’t have permission to save expenses for this company.";
  }
  if (/undefined/i.test(message) || code.includes("invalid-argument")) {
    return "That expense couldn’t be saved because a field was missing. Check amount, date and description.";
  }
  return "Couldn't save expense. Please try again.";
}

function expenseDocPayload(expense: Omit<CompanyExpense, "id" | "createdAt">) {
  const amount = Number(expense.amount);
  return {
    description: String(expense.description ?? "").trim(),
    amount: Number.isFinite(amount) ? amount : 0,
    date: expense.date || new Date().toISOString().split("T")[0],
    category: expense.category || "Other",
    receipts: Array.isArray(expense.receipts) ? expense.receipts : [],
    receiptNames: Array.isArray(expense.receiptNames)
      ? expense.receiptNames
      : alignedReceiptNames(Array.isArray(expense.receipts) ? expense.receipts : []),
  };
}

export function canEditCompanyClient(
  company: Company,
  dataUid: string | null | undefined,
  editOwnerIds: Set<string>
) {
  if (!dataUid) return false;
  if (!company.ownerId) return true;
  if (company.ownerId === dataUid) return true;
  if ((company.sharedWith ?? []).includes(dataUid)) return true;
  return editOwnerIds.has(company.ownerId);
}

export function useCompanies(scopeUserId?: string) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const { dataUid } = useAuth();
  const uid = scopeUserId ?? dataUid;
  const { sharedWithMe } = usePageShares("companies");
  const sharedOwnerIds = new Set(sharedWithMe.map((s) => s.ownerId));
  const editOwnerIds = new Set(
    sharedWithMe.filter((s) => s.permission === "edit").map((s) => s.ownerId)
  );

  useEffect(() => {
    if (!uid) return;
    // Query all companies — filter client-side so legacy companies (no ownerId)
    // remain visible and new companies are scoped to owner + sharedWith +
    // anyone who shared the Companies page with the signed-in user.
    const q = query(collection(db, "companies"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const next = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Company))
        .filter((c) => {
          const viewingOwn = !scopeUserId || scopeUserId === dataUid;
          if (!c.ownerId) return viewingOwn;
          if (c.ownerId === uid) return true;
          if (dataUid && (c.sharedWith ?? []).includes(dataUid) && viewingOwn) return true;
          if (viewingOwn && c.ownerId && sharedOwnerIds.has(c.ownerId)) return true;
          return false;
        });
      setCompanies(next);
      setLoading(false);
    });
    return unsub;
  }, [uid, dataUid, scopeUserId, sharedWithMe]);

  const addCompany = useCallback(async (company: Omit<Company, "id" | "createdAt" | "updatedAt">) => {
    if (!uid) return;
    await addDoc(collection(db, "companies"), {
      ...cleanCompanyPayload(company),
      ownerId: uid,
      sharedWith: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }, [uid]);

  const updateCompany = useCallback(async (id: string, updates: Partial<Company>) => {
    const cleanUpdates = cleanCompanyPayload(updates) as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(updates, "parentCompanyId") && updates.parentCompanyId === undefined) {
      cleanUpdates.parentCompanyId = deleteField();
    }
    await updateDoc(doc(db, "companies", id), {
      ...cleanUpdates,
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

  return { companies, loading, addCompany, updateCompany, deleteCompany, shareCompany, unshareCompany, editOwnerIds };
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
    return onSnapshot(
      q,
      (snap) => {
        setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CompanyExpense)));
      },
      (err) => console.error("Failed to load expenses", err)
    );
  }, [companyId]);

  const addExpense = useCallback(async (expense: Omit<CompanyExpense, "id" | "createdAt">) => {
    if (!companyId) return undefined;
    const docRef = await addDoc(collection(db, "companies", companyId, "expenses"), {
      ...expenseDocPayload(expense),
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  }, [companyId]);

  const updateExpense = useCallback(async (id: string, updates: Partial<CompanyExpense>) => {
    if (!companyId) return;
    const current = expenses.find((e) => e.id === id);
    const historyEntry: CompanyExpenseHistoryEntry | null = current
      ? {
          editedAt: new Date().toISOString(),
          description: current.description,
          amount: current.amount,
          date: current.date,
          category: current.category,
          receipts: current.receipts ?? [],
        }
      : null;
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    await updateDoc(doc(db, "companies", companyId, "expenses", id), {
      ...cleanUpdates,
      updatedAt: serverTimestamp(),
      ...(historyEntry ? { history: [...(current?.history ?? []), historyEntry] } : {}),
    });
  }, [companyId, expenses]);

  const deleteExpense = useCallback(async (id: string) => {
    if (!companyId) return;
    await deleteDoc(doc(db, "companies", companyId, "expenses", id));
  }, [companyId]);

  const writeReceipts = useCallback(async (expenseId: string, urls: string[], names: string[]) => {
    if (!companyId) return;
    await updateDoc(doc(db, "companies", companyId, "expenses", expenseId), {
      receipts: urls,
      receiptNames: names,
    });
  }, [companyId]);

  const uploadReceipt = useCallback(async (expenseId: string, file: File, currentUrls: string[]) => {
    if (!companyId) return;
    setUploadingReceipt(true);
    try {
      const current = expenses.find((e) => e.id === expenseId);
      const urls = currentUrls ?? current?.receipts ?? [];
      const names = alignedReceiptNames(urls, current?.receiptNames);
      const storageRef = ref(storage, companyReceiptStoragePath(companyId, file.name));
      await uploadBytes(storageRef, file, { contentType: file.type || "application/octet-stream" });
      const url = await getDownloadURL(storageRef);
      await writeReceipts(expenseId, [...urls, url], [...names, file.name]);
    } finally {
      setUploadingReceipt(false);
    }
  }, [companyId, expenses, writeReceipts]);

  const removeReceipt = useCallback(async (expenseId: string, url: string) => {
    const current = expenses.find((e) => e.id === expenseId);
    const urls = current?.receipts ?? [];
    const names = alignedReceiptNames(urls, current?.receiptNames);
    const idx = urls.indexOf(url);
    await writeReceipts(
      expenseId,
      urls.filter((u) => u !== url),
      names.filter((_, i) => i !== idx),
    );
  }, [expenses, writeReceipts]);

  const replaceReceipt = useCallback(async (expenseId: string, oldUrl: string, file: File) => {
    if (!companyId) return;
    setUploadingReceipt(true);
    try {
      const current = expenses.find((e) => e.id === expenseId);
      const urls = [...(current?.receipts ?? [])];
      const names = alignedReceiptNames(urls, current?.receiptNames);
      const storageRef = ref(storage, companyReceiptStoragePath(companyId, file.name));
      await uploadBytes(storageRef, file, { contentType: file.type || "application/octet-stream" });
      const url = await getDownloadURL(storageRef);
      const idx = urls.indexOf(oldUrl);
      if (idx >= 0) {
        urls[idx] = url;
        names[idx] = file.name;
      } else {
        urls.push(url);
        names.push(file.name);
      }
      await writeReceipts(expenseId, urls, names);
    } finally {
      setUploadingReceipt(false);
    }
  }, [companyId, expenses, writeReceipts]);

  const renameReceipt = useCallback(async (expenseId: string, url: string, name: string) => {
    const current = expenses.find((e) => e.id === expenseId);
    const urls = current?.receipts ?? [];
    const names = alignedReceiptNames(urls, current?.receiptNames);
    const idx = urls.indexOf(url);
    if (idx < 0) return;
    names[idx] = name.trim() || names[idx];
    await writeReceipts(expenseId, urls, names);
  }, [expenses, writeReceipts]);

  return {
    expenses,
    uploadingReceipt,
    addExpense,
    updateExpense,
    deleteExpense,
    uploadReceipt,
    removeReceipt,
    replaceReceipt,
    renameReceipt,
  };
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
