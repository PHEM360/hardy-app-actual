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
