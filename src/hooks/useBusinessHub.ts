import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase";
import { useCompanies } from "@/hooks/useCompanies";
import type { CompanyExpense, CompanyIncome, CompanyTaxReturn, ContentPiece } from "@/types/app";
import type {
  BusinessBankAccount,
  BusinessBankTransaction,
  BusinessCompanyData,
  BusinessIntegration,
  BusinessInvoice,
  BusinessInvoiceLine,
  BusinessLead,
  MilionBridgeSnapshot,
} from "@/types/businessHub";
import {
  addDays,
  dateKey,
  invoicePrefix,
  invoiceTotals,
  legalEntityForCompany,
} from "@/lib/businessHub";

type CreateInvoiceInput = {
  companyId: string;
  recipient: BusinessInvoice["recipient"];
  issueDate?: string;
  dueDate?: string;
  notes?: string;
  lineItems: BusinessInvoiceLine[];
};

function asRows<T extends { id?: string }>(snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) {
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as T));
}

function fromMilion(companyId: string, snapshot: MilionBridgeSnapshot): BusinessInvoice[] {
  return (snapshot.invoices || []).map((invoice) => ({
    id: `milion:${snapshot.orgId}:${invoice.id}`,
    externalId: invoice.id,
    companyId,
    invoiceNumber: invoice.invoiceNumber || invoice.id,
    status: (invoice.status || "issued") as BusinessInvoice["status"],
    source: "milion",
    recipient: {
      name: invoice.patientName || "Recipient",
      email: invoice.patientEmail,
    },
    lineItems: Array.isArray(invoice.lineItems)
      ? invoice.lineItems.map((line, index) => ({
          id: line.id || `milion-line-${index}`,
          description: line.description || "Item",
          quantity: Number(line.quantity) || 0,
          unitPrice: Number(line.unitPrice) || 0,
          vatRate: Number(line.vatRate) || 0,
        }))
      : [],
    currency: "GBP",
    subtotal: Number(invoice.subtotal) || Number(invoice.total) || 0,
    vatAmount: Number(invoice.vatAmount) || 0,
    total: Number(invoice.total) || 0,
    amountPaid: Number(invoice.amountPaid) || 0,
    issueDate: (invoice.issueDate || dateKey()).slice(0, 10),
    dueDate: (invoice.dueDate || invoice.issueDate || dateKey()).slice(0, 10),
    paymentMethod: invoice.paymentMethod,
    paidAt: invoice.paidAt,
    sentAt: invoice.sentAt,
  }));
}

export function useBusinessHub() {
  const { companies, loading: companiesLoading } = useCompanies();
  const [rows, setRows] = useState<BusinessCompanyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingMilion, setSyncingMilion] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (companiesLoading) return;
    if (!companies.length) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await Promise.all(
        companies.filter((company) => company.id).map(async (company): Promise<BusinessCompanyData> => {
          const id = company.id!;
          const [
            incomeSnap,
            expenseSnap,
            invoiceSnap,
            leadSnap,
            contentSnap,
            integrationSnap,
            bankAccountSnap,
            bankTransactionSnap,
            taxReturnSnap,
          ] = await Promise.all([
            getDocs(collection(db, "companies", id, "income")),
            getDocs(collection(db, "companies", id, "expenses")),
            getDocs(collection(db, "companies", id, "invoices")),
            getDocs(collection(db, "companies", id, "leads")),
            getDocs(collection(db, "companies", id, "content")),
            getDocs(collection(db, "companies", id, "businessIntegrations")),
            getDocs(collection(db, "companies", id, "bankAccounts")),
            getDocs(collection(db, "companies", id, "bankTransactions")),
            getDocs(collection(db, "companies", id, "taxReturns")),
          ]);

          const content = asRows<ContentPiece>(contentSnap).map((item) => ({
            ...item,
            companyId: id,
            companyName: company.name,
          }));
          return {
            company,
            income: asRows<CompanyIncome>(incomeSnap),
            expenses: asRows<CompanyExpense>(expenseSnap),
            invoices: asRows<BusinessInvoice>(invoiceSnap).map((invoice) => ({ ...invoice, companyId: id })),
            leads: asRows<BusinessLead>(leadSnap).map((lead) => ({ ...lead, companyId: id })),
            content,
            integrations: asRows<BusinessIntegration>(integrationSnap).map((integration) => ({
              ...integration,
              companyId: id,
            })),
            bankAccounts: asRows<BusinessBankAccount>(bankAccountSnap).map((account) => ({
              ...account,
              companyId: id,
              provider: account.provider || "manual",
              source: account.source || "hardy",
              currency: account.currency || "GBP",
              current: Number(account.current) || 0,
            })),
            bankTransactions: asRows<BusinessBankTransaction>(bankTransactionSnap).map((tx) => ({
              ...tx,
              companyId: id,
              source: tx.source || "hardy",
              currency: tx.currency || "GBP",
              amount: Number(tx.amount) || 0,
            })),
            taxReturns: asRows<CompanyTaxReturn>(taxReturnSnap)
              .sort((a, b) => String(b.taxYear || "").localeCompare(String(a.taxYear || ""))),
          };
        }),
      );
      setRows(next);
    } catch (loadError) {
      console.error("Business hub load failed", loadError);
      setError(loadError instanceof Error ? loadError.message : "Could not load business data.");
    } finally {
      setLoading(false);
    }
  }, [companies, companiesLoading]);

  useEffect(() => {
    void load();
  }, [load]);

  const syncMilion = useCallback(async () => {
    const configured = rows.flatMap((row) =>
      row.integrations
        .filter((integration) => integration.provider === "milion" && integration.enabled && integration.externalId)
        .map((integration) => ({ row, integration })),
    );
    if (!configured.length) return;
    setSyncingMilion(true);
    try {
      const bridge = httpsCallable<
        { action: "snapshot"; companyId: string; orgId: string },
        MilionBridgeSnapshot
      >(functions, "milionBusinessBridge");
      const remote = await Promise.all(
        configured.map(async ({ row, integration }) => {
          try {
            const response = await bridge({
              action: "snapshot",
              companyId: row.company.id!,
              orgId: integration.externalId!,
            });
            const bankFeed = response.data.bankFeed;
            const bankAccounts: BusinessBankAccount[] = (bankFeed?.accounts || []).map((account) => ({
              id: `milion:${response.data.orgId}:${account.id}`,
              externalId: account.id,
              companyId: row.company.id!,
              name: account.name || "Bank account",
              type: account.type,
              currency: account.currency || "GBP",
              current: Number(account.current) || 0,
              available: account.available == null ? undefined : Number(account.available),
              provider: bankFeed?.providerName || "TrueLayer",
              source: "milion",
            }));
            const bankTransactions: BusinessBankTransaction[] = (bankFeed?.transactions || []).map((tx) => ({
              id: `milion:${response.data.orgId}:${tx.id}`,
              companyId: row.company.id!,
              accountId: tx.accountId,
              accountName: tx.accountName,
              timestamp: tx.timestamp,
              description: tx.description || "Bank transaction",
              amount: Number(tx.amount) || 0,
              currency: tx.currency || "GBP",
              type: tx.type,
              provider: bankFeed?.providerName || "TrueLayer",
              source: "milion",
            }));
            return {
              companyId: row.company.id!,
              invoices: fromMilion(row.company.id!, response.data),
              bankAccounts,
              bankTransactions,
              error: bankFeed?.error || "",
            };
          } catch (bridgeError) {
            return {
              companyId: row.company.id!,
              invoices: [] as BusinessInvoice[],
              bankAccounts: [] as BusinessBankAccount[],
              bankTransactions: [] as BusinessBankTransaction[],
              error: bridgeError instanceof Error ? bridgeError.message : "Milion sync failed",
            };
          }
        }),
      );
      setRows((current) =>
        current.map((row) => {
          const match = remote.find((item) => item.companyId === row.company.id);
          if (!match) return row;
          const native = row.invoices.filter((invoice) => invoice.source !== "milion");
          const nativeBankAccounts = row.bankAccounts.filter((account) => account.source !== "milion");
          const nativeBankTransactions = row.bankTransactions.filter((tx) => tx.source !== "milion");
          return {
            ...row,
            invoices: [...native, ...match.invoices],
            bankAccounts: [...nativeBankAccounts, ...match.bankAccounts],
            bankTransactions: [...nativeBankTransactions, ...match.bankTransactions],
            integrations: row.integrations.map((integration) =>
              integration.provider === "milion"
                ? { ...integration, lastSyncAt: new Date().toISOString(), lastError: match.error || undefined }
                : integration,
            ),
          };
        }),
      );
    } finally {
      setSyncingMilion(false);
    }
  }, [rows]);

  const createInvoice = useCallback(async (input: CreateInvoiceInput) => {
    const company = companies.find((item) => item.id === input.companyId);
    if (!company?.id) throw new Error("Company not found.");
    const milion = rows
      .find((row) => row.company.id === company.id)
      ?.integrations.find((integration) => integration.provider === "milion" && integration.enabled && integration.externalId);
    if (milion?.externalId) {
      const bridge = httpsCallable<
        {
          action: "createInvoice";
          companyId: string;
          orgId: string;
          input: CreateInvoiceInput;
        },
        Record<string, unknown>
      >(functions, "milionBusinessBridge");
      await bridge({
        action: "createInvoice",
        companyId: company.id,
        orgId: milion.externalId,
        input,
      });
      await syncMilion();
      return;
    }

    const legal = legalEntityForCompany(company, companies);
    const totals = invoiceTotals(input.lineItems);
    const issueDate = input.issueDate || dateKey();
    const dueDate = input.dueDate || addDays(issueDate, 14);
    const settingsRef = doc(db, "companies", company.id, "businessSettings", "invoicing");
    const invoiceRef = doc(collection(db, "companies", company.id, "invoices"));

    const invoice = await runTransaction(db, async (transaction) => {
      const settings = await transaction.get(settingsRef);
      const nextNumber = settings.exists() ? Math.max(1, Number(settings.data()?.nextInvoiceNumber) || 1) : 1;
      const prefix = String(settings.data()?.invoicePrefix || invoicePrefix(company));
      const invoiceNumber = `${prefix}-${issueDate.slice(0, 4)}-${String(nextNumber).padStart(4, "0")}`;
      const payload: BusinessInvoice = {
        companyId: company.id!,
        legalEntityCompanyId: legal.id || company.id,
        invoiceNumber,
        status: "draft",
        source: "hardy",
        recipient: input.recipient,
        lineItems: input.lineItems,
        currency: "GBP",
        ...totals,
        amountPaid: 0,
        issueDate,
        dueDate,
        notes: input.notes?.trim() || undefined,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      transaction.set(invoiceRef, payload);
      transaction.set(
        settingsRef,
        {
          invoicePrefix: prefix,
          nextInvoiceNumber: nextNumber + 1,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      return { ...payload, id: invoiceRef.id };
    });
    await load();
    return invoice;
  }, [companies, load, rows, syncMilion]);

  const updateInvoice = useCallback(async (invoice: BusinessInvoice, updates: Partial<BusinessInvoice>) => {
    if (!invoice.id || invoice.source === "milion") {
      if (invoice.source === "milion" && invoice.externalId) {
        const integration = rows
          .find((row) => row.company.id === invoice.companyId)
          ?.integrations.find((item) => item.provider === "milion" && item.enabled && item.externalId);
        if (!integration?.externalId) throw new Error("Milion integration is not configured.");
        const bridge = httpsCallable(functions, "milionBusinessBridge");
        const remoteUpdates = {
          ...updates,
          status: updates.status === "issued" ? "pending" : updates.status,
        };
        await bridge({
          action: "updateInvoice",
          companyId: invoice.companyId,
          orgId: integration.externalId,
          invoiceId: invoice.externalId,
          updates: remoteUpdates,
        });
        await syncMilion();
        return;
      }
      throw new Error("Invoice cannot be updated.");
    }
    await updateDoc(doc(db, "companies", invoice.companyId, "invoices", invoice.id), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    await load();
  }, [load, rows, syncMilion]);

  const markInvoicePaid = useCallback(async (invoice: BusinessInvoice) => {
    await updateInvoice(invoice, {
      status: "paid",
      amountPaid: invoice.total,
      paidAt: new Date().toISOString(),
      paymentMethod: invoice.paymentMethod || "bank_transfer",
    });
  }, [updateInvoice]);

  const saveIntegration = useCallback(async (
    companyId: string,
    provider: BusinessIntegration["provider"],
    values: Partial<BusinessIntegration>,
  ) => {
    await setDoc(
      doc(db, "companies", companyId, "businessIntegrations", provider),
      {
        companyId,
        provider,
        enabled: values.enabled ?? true,
        ...values,
        updatedAt: serverTimestamp(),
        createdAt: values.createdAt || serverTimestamp(),
      },
      { merge: true },
    );
    await load();
  }, [load]);

  const addLead = useCallback(async (
    companyId: string,
    lead: Omit<BusinessLead, "id" | "companyId" | "updatedAt">,
  ) => {
    await addDoc(collection(db, "companies", companyId, "leads"), {
      ...lead,
      companyId,
      updatedAt: serverTimestamp(),
    });
    await load();
  }, [load]);

  const updateLead = useCallback(async (lead: BusinessLead, updates: Partial<BusinessLead>) => {
    if (!lead.id) return;
    await updateDoc(doc(db, "companies", lead.companyId, "leads", lead.id), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    await load();
  }, [load]);

  const invoices = useMemo(() => rows.flatMap((row) => row.invoices), [rows]);
  const leads = useMemo(() => rows.flatMap((row) => row.leads), [rows]);
  const content = useMemo(() => rows.flatMap((row) => row.content), [rows]);
  const bankAccounts = useMemo(() => rows.flatMap((row) => row.bankAccounts), [rows]);
  const bankTransactions = useMemo(() => rows.flatMap((row) => row.bankTransactions), [rows]);

  return {
    companies,
    rows,
    invoices,
    leads,
    content,
    bankAccounts,
    bankTransactions,
    loading: loading || companiesLoading,
    error,
    reload: load,
    syncingMilion,
    syncMilion,
    createInvoice,
    updateInvoice,
    markInvoicePaid,
    saveIntegration,
    addLead,
    updateLead,
  };
}
