import { useCallback, useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  CompanyBankAccount,
  CompanyBankTransaction,
  CompanyBillingProfile,
  CompanyCustomer,
  CompanyBill,
  CompanyInvoice,
  CompanyLead,
  CompanyWebsiteArticle,
} from "@/types/companyHub";
import { DEFAULT_BILLING_PROFILE } from "@/types/companyHub";
import { invoiceTotals } from "@/lib/companyInvoice";

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

export function useCompanyBilling(companyId: string | undefined) {
  const [profile, setProfile] = useState<CompanyBillingProfile>(DEFAULT_BILLING_PROFILE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    return onSnapshot(doc(db, "companies", companyId, "billing", "profile"), (snap) => {
      setProfile({ ...DEFAULT_BILLING_PROFILE, ...(snap.data() as Partial<CompanyBillingProfile> | undefined) });
      setLoading(false);
    });
  }, [companyId]);

  const saveProfile = useCallback(async (updates: Partial<CompanyBillingProfile>) => {
    if (!companyId) return;
    await setDoc(doc(db, "companies", companyId, "billing", "profile"), stripUndefined({
      ...profile,
      ...updates,
      updatedAt: serverTimestamp(),
    }), { merge: true });
  }, [companyId, profile]);

  return { profile, loading, saveProfile };
}

export function useCompanyInvoices(companyId: string | undefined) {
  const [invoices, setInvoices] = useState<CompanyInvoice[]>([]);

  useEffect(() => {
    if (!companyId) return;
    const q = query(collection(db, "companies", companyId, "invoices"), orderBy("issueDate", "desc"));
    return onSnapshot(q, (snap) => {
      setInvoices(snap.docs.map((item) => ({ id: item.id, companyId, ...item.data() } as CompanyInvoice)));
    });
  }, [companyId]);

  const addInvoice = useCallback(async (invoice: Omit<CompanyInvoice, "id" | "createdAt" | "companyId">) => {
    if (!companyId) return "";
    const totals = invoiceTotals(invoice.lines || []);
    const ref = await addDoc(collection(db, "companies", companyId, "invoices"), stripUndefined({
      ...invoice,
      ...totals,
      companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
    return ref.id;
  }, [companyId]);

  const updateInvoice = useCallback(async (id: string, updates: Partial<CompanyInvoice>) => {
    if (!companyId) return;
    const { id: _id, companyId: _companyId, createdAt: _created, ...rest } = updates;
    const totals = rest.lines ? invoiceTotals(rest.lines) : {};
    await updateDoc(doc(db, "companies", companyId, "invoices", id), stripUndefined({
      ...rest,
      ...totals,
      updatedAt: serverTimestamp(),
    } as Record<string, unknown>));
  }, [companyId]);

  const deleteInvoice = useCallback(async (id: string) => {
    if (!companyId) return;
    await deleteDoc(doc(db, "companies", companyId, "invoices", id));
  }, [companyId]);

  return { invoices, addInvoice, updateInvoice, deleteInvoice };
}

export function useCompanyBills(companyId: string | undefined) {
  const [bills, setBills] = useState<CompanyBill[]>([]);

  useEffect(() => {
    if (!companyId) return;
    const q = query(collection(db, "companies", companyId, "bills"), orderBy("issueDate", "desc"));
    return onSnapshot(q, (snap) => {
      setBills(snap.docs.map((item) => ({ id: item.id, companyId, ...item.data() } as CompanyBill)));
    });
  }, [companyId]);

  const addBill = useCallback(async (bill: Omit<CompanyBill, "id" | "createdAt" | "companyId">) => {
    if (!companyId) return "";
    const totals = invoiceTotals(bill.lines || []);
    const ref = await addDoc(collection(db, "companies", companyId, "bills"), stripUndefined({
      ...bill,
      ...totals,
      companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
    return ref.id;
  }, [companyId]);

  const updateBill = useCallback(async (id: string, updates: Partial<CompanyBill>) => {
    if (!companyId) return;
    const { id: _id, companyId: _companyId, createdAt: _created, ...rest } = updates;
    const totals = rest.lines ? invoiceTotals(rest.lines) : {};
    await updateDoc(doc(db, "companies", companyId, "bills", id), stripUndefined({
      ...rest,
      ...totals,
      updatedAt: serverTimestamp(),
    } as Record<string, unknown>));
  }, [companyId]);

  const deleteBill = useCallback(async (id: string) => {
    if (!companyId) return;
    await deleteDoc(doc(db, "companies", companyId, "bills", id));
  }, [companyId]);

  return { bills, addBill, updateBill, deleteBill };
}

export function useCompanyCustomers(companyId: string | undefined) {
  const [customers, setCustomers] = useState<CompanyCustomer[]>([]);

  useEffect(() => {
    if (!companyId) return;
    const q = query(collection(db, "companies", companyId, "customers"), orderBy("name", "asc"));
    return onSnapshot(q, (snap) => {
      setCustomers(snap.docs.map((item) => ({ id: item.id, ...item.data() } as CompanyCustomer)));
    });
  }, [companyId]);

  const addCustomer = useCallback(async (customer: Omit<CompanyCustomer, "id" | "createdAt">) => {
    if (!companyId) return "";
    const ref = await addDoc(collection(db, "companies", companyId, "customers"), {
      ...stripUndefined(customer as Record<string, unknown>),
      createdAt: serverTimestamp(),
    });
    return ref.id;
  }, [companyId]);

  const updateCustomer = useCallback(async (id: string, updates: Partial<CompanyCustomer>) => {
    if (!companyId) return;
    await updateDoc(doc(db, "companies", companyId, "customers", id), stripUndefined(updates as Record<string, unknown>));
  }, [companyId]);

  const deleteCustomer = useCallback(async (id: string) => {
    if (!companyId) return;
    await deleteDoc(doc(db, "companies", companyId, "customers", id));
  }, [companyId]);

  return { customers, addCustomer, updateCustomer, deleteCustomer };
}

export function useCompanyLeads(companyId: string | undefined) {
  const [leads, setLeads] = useState<CompanyLead[]>([]);

  useEffect(() => {
    if (!companyId) return;
    const q = query(collection(db, "companies", companyId, "leads"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setLeads(snap.docs.map((item) => ({ id: item.id, companyId, ...item.data() } as CompanyLead)));
    });
  }, [companyId]);

  const addLead = useCallback(async (lead: Omit<CompanyLead, "id" | "createdAt" | "companyId">) => {
    if (!companyId) return;
    await addDoc(collection(db, "companies", companyId, "leads"), {
      ...stripUndefined(lead as Record<string, unknown>),
      companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }, [companyId]);

  const updateLead = useCallback(async (id: string, updates: Partial<CompanyLead>) => {
    if (!companyId) return;
    await updateDoc(doc(db, "companies", companyId, "leads", id), {
      ...stripUndefined(updates as Record<string, unknown>),
      updatedAt: serverTimestamp(),
    });
  }, [companyId]);

  const deleteLead = useCallback(async (id: string) => {
    if (!companyId) return;
    await deleteDoc(doc(db, "companies", companyId, "leads", id));
  }, [companyId]);

  return { leads, addLead, updateLead, deleteLead };
}

export function useCompanyWebsiteArticles(companyId: string | undefined) {
  const [articles, setArticles] = useState<CompanyWebsiteArticle[]>([]);

  useEffect(() => {
    if (!companyId) return;
    const q = query(collection(db, "companies", companyId, "websiteContent"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setArticles(snap.docs.map((item) => ({ id: item.id, ...item.data() } as CompanyWebsiteArticle)));
    });
  }, [companyId]);

  const addArticle = useCallback(async (article: Omit<CompanyWebsiteArticle, "id" | "createdAt">) => {
    if (!companyId) return "";
    const ref = await addDoc(collection(db, "companies", companyId, "websiteContent"), {
      ...stripUndefined(article as Record<string, unknown>),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  }, [companyId]);

  const updateArticle = useCallback(async (id: string, updates: Partial<CompanyWebsiteArticle>) => {
    if (!companyId) return;
    await updateDoc(doc(db, "companies", companyId, "websiteContent", id), {
      ...stripUndefined(updates as Record<string, unknown>),
      updatedAt: serverTimestamp(),
    });
  }, [companyId]);

  const deleteArticle = useCallback(async (id: string) => {
    if (!companyId) return;
    await deleteDoc(doc(db, "companies", companyId, "websiteContent", id));
  }, [companyId]);

  return { articles, addArticle, updateArticle, deleteArticle };
}

export function useCompanyBank(companyId: string | undefined) {
  const [accounts, setAccounts] = useState<CompanyBankAccount[]>([]);
  const [transactions, setTransactions] = useState<CompanyBankTransaction[]>([]);

  useEffect(() => {
    if (!companyId) return;
    const unsubAccounts = onSnapshot(
      query(collection(db, "companies", companyId, "bankAccounts"), orderBy("name", "asc")),
      (snap) => setAccounts(snap.docs.map((item) => ({ id: item.id, ...item.data() } as CompanyBankAccount))),
    );
    const unsubTx = onSnapshot(
      query(collection(db, "companies", companyId, "bankTransactions"), orderBy("date", "desc")),
      (snap) => setTransactions(snap.docs.map((item) => ({ id: item.id, ...item.data() } as CompanyBankTransaction))),
    );
    return () => {
      unsubAccounts();
      unsubTx();
    };
  }, [companyId]);

  const addAccount = useCallback(async (account: Omit<CompanyBankAccount, "id" | "createdAt">) => {
    if (!companyId) return "";
    const ref = await addDoc(collection(db, "companies", companyId, "bankAccounts"), {
      ...stripUndefined(account as Record<string, unknown>),
      createdAt: serverTimestamp(),
    });
    return ref.id;
  }, [companyId]);

  const addTransactions = useCallback(async (rows: Omit<CompanyBankTransaction, "id">[]) => {
    if (!companyId) return;
    await Promise.all(rows.map((row) => addDoc(collection(db, "companies", companyId, "bankTransactions"), {
      ...row,
      importedAt: new Date().toISOString(),
    })));
  }, [companyId]);

  const matchTransaction = useCallback(async (id: string, updates: Partial<CompanyBankTransaction>) => {
    if (!companyId) return;
    await updateDoc(doc(db, "companies", companyId, "bankTransactions", id), stripUndefined(updates as Record<string, unknown>));
  }, [companyId]);

  return { accounts, transactions, addAccount, addTransactions, matchTransaction };
}

export function useAllCompanyInvoices(companyIds: string[]) {
  const [data, setData] = useState<Record<string, CompanyInvoice[]>>({});
  const key = companyIds.join(",");

  useEffect(() => {
    if (!companyIds.length) {
      setData({});
      return;
    }
    const unsubs = companyIds.map((id) =>
      onSnapshot(query(collection(db, "companies", id, "invoices"), orderBy("issueDate", "desc")), (snap) => {
        setData((current) => ({
          ...current,
          [id]: snap.docs.map((item) => ({ id: item.id, companyId: id, ...item.data() } as CompanyInvoice)),
        }));
      }),
    );
    return () => unsubs.forEach((unsub) => unsub());
  }, [key]);

  return data;
}

export function useAllCompanyBills(companyIds: string[]) {
  const [data, setData] = useState<Record<string, CompanyBill[]>>({});
  const key = companyIds.join(",");

  useEffect(() => {
    if (!companyIds.length) {
      setData({});
      return;
    }
    const unsubs = companyIds.map((id) =>
      onSnapshot(query(collection(db, "companies", id, "bills"), orderBy("issueDate", "desc")), (snap) => {
        setData((current) => ({
          ...current,
          [id]: snap.docs.map((item) => ({ id: item.id, companyId: id, ...item.data() } as CompanyBill)),
        }));
      }),
    );
    return () => unsubs.forEach((unsub) => unsub());
  }, [key]);

  return data;
}

export function useAllCompanyBank(companyIds: string[]) {
  const [data, setData] = useState<Record<string, CompanyBankTransaction[]>>({});
  const key = companyIds.join(",");

  useEffect(() => {
    if (!companyIds.length) {
      setData({});
      return;
    }
    const unsubs = companyIds.map((id) =>
      onSnapshot(query(collection(db, "companies", id, "bankTransactions"), orderBy("date", "desc")), (snap) => {
        setData((current) => ({
          ...current,
          [id]: snap.docs.map((item) => ({ id: item.id, ...item.data() } as CompanyBankTransaction)),
        }));
      }),
    );
    return () => unsubs.forEach((unsub) => unsub());
  }, [key]);

  return data;
}

export function useAllCompanyLeads(companyIds: string[]) {
  const [data, setData] = useState<Record<string, CompanyLead[]>>({});
  const key = companyIds.join(",");

  useEffect(() => {
    if (!companyIds.length) {
      setData({});
      return;
    }
    const unsubs = companyIds.map((id) =>
      onSnapshot(query(collection(db, "companies", id, "leads"), orderBy("createdAt", "desc")), (snap) => {
        setData((current) => ({
          ...current,
          [id]: snap.docs.map((item) => ({ id: item.id, companyId: id, ...item.data() } as CompanyLead)),
        }));
      }),
    );
    return () => unsubs.forEach((unsub) => unsub());
  }, [key]);

  return data;
}
