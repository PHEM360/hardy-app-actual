import { useCallback, useEffect, useState } from "react";
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import {
  DEFAULT_FLAT_DOCUMENT_CATEGORIES,
  DEFAULT_FLAT_EXPENSE_CATEGORIES,
  DEFAULT_FLAT_INCOME_CATEGORIES,
  FLAT_SEED,
  type FlatBalanceRecord,
  type FlatBankLink,
  type FlatDocumentMeta,
  type FlatLedgerEntry,
  type FlatNote,
  type FlatNoteComment,
  type FlatRecord,
  type FlatTaxSettings,
  type FlatTenant,
} from "@/types/flats";

function blankFlat(seed: (typeof FLAT_SEED)[number]): FlatRecord {
  return {
    id: seed.id,
    name: seed.name,
    slug: seed.slug,
    address: "",
    propertyValueGbp: null,
    mortgageBalanceGbp: null,
    mortgageRatePct: null,
    ownership: seed.ownership,
    tenant: {
      name: "",
      email: "",
      phone: "",
      contractStart: "",
      contractEnd: "",
      depositGbp: null,
      rentMonthlyGbp: null,
      notes: "",
    },
    tax: {
      ownership: seed.ownership,
      usePropertyAllowance: false,
      financeCostRestrictionPct: 100,
      companyName: "",
      companyNumber: "",
      notes: "",
    },
    bankLinks: [],
    expenseCategories: [...DEFAULT_FLAT_EXPENSE_CATEGORIES],
    incomeCategories: [...DEFAULT_FLAT_INCOME_CATEGORIES],
    documentCategories: [...DEFAULT_FLAT_DOCUMENT_CATEGORIES],
    balanceHistory: [],
    ledger: [],
  };
}

async function migrateLegacyTattersalls() {
  const tatRef = doc(db, "flats", "tattersalls");
  if ((await getDoc(tatRef)).exists()) return;

  const seed = blankFlat(FLAT_SEED[0]);
  const legacySnap = await getDoc(doc(db, "tattersalls", "shared"));
  if (legacySnap.exists()) {
    const data = legacySnap.data() as Record<string, unknown>;
    seed.balanceHistory = Array.isArray(data.balanceHistory)
      ? (data.balanceHistory as FlatBalanceRecord[])
      : [];
    if (Array.isArray(data.expenseCategories)) {
      seed.expenseCategories = data.expenseCategories as string[];
    }
    const expenses = Array.isArray(data.expenses) ? (data.expenses as Array<Record<string, unknown>>) : [];
    seed.ledger = expenses.map((e, i) => ({
      id: `legacy_exp_${i}`,
      kind: "expense" as const,
      date: String(e.date || new Date().toISOString().slice(0, 10)),
      description: String(e.desc || e.description || "Expense"),
      category: String(e.type || e.category || "Other"),
      amountGbp: Number(e.amount) || 0,
      frequency: String(e.frequency || "One-off"),
      source: "manual" as const,
    }));
  }
  await setDoc(tatRef, { ...seed, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });

  try {
    const notesSnap = await getDocs(collection(db, "tattersalls", "shared", "notes"));
    for (const n of notesSnap.docs) {
      await setDoc(doc(db, "flats", "tattersalls", "notes", n.id), n.data(), { merge: true });
    }
    const docsSnap = await getDocs(collection(db, "tattersalls", "shared", "documents"));
    for (const d of docsSnap.docs) {
      await setDoc(doc(db, "flats", "tattersalls", "documents", d.id), d.data(), { merge: true });
    }
  } catch {
    /* ignore */
  }
}

async function ensureSeeded() {
  await migrateLegacyTattersalls();
  for (const seed of FLAT_SEED) {
    const refDoc = doc(db, "flats", seed.id);
    if (!(await getDoc(refDoc)).exists()) {
      await setDoc(refDoc, {
        ...blankFlat(seed),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }
}

export function useFlatsList() {
  const [flats, setFlats] = useState<FlatRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub: Unsubscribe | undefined;
    let cancelled = false;
    (async () => {
      try {
        await ensureSeeded();
        if (cancelled) return;
        unsub = onSnapshot(collection(db, "flats"), (snap) => {
          const order = FLAT_SEED.map((s) => s.id);
          const rows = snap.docs.map((d) => {
            const data = d.data() as Omit<FlatRecord, "id">;
            const seed = FLAT_SEED.find((s) => s.id === d.id) || {
              id: d.id,
              name: data.name || d.id,
              slug: data.slug || d.id,
              ownership: data.ownership || ("personal" as const),
            };
            return { ...blankFlat(seed), ...data, id: d.id } as FlatRecord;
          });
          rows.sort(
            (a, b) =>
              (order.indexOf(a.id) < 0 ? 99 : order.indexOf(a.id)) -
              (order.indexOf(b.id) < 0 ? 99 : order.indexOf(b.id)),
          );
          setFlats(rows);
          setLoading(false);
        }, () => setLoading(false));
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  return { flats, loading };
}

export function useFlat(flatId: string | null) {
  const [flat, setFlat] = useState<FlatRecord | null>(null);
  const [documents, setDocuments] = useState<FlatDocumentMeta[]>([]);
  const [notes, setNotes] = useState<FlatNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  useEffect(() => {
    if (!flatId) {
      setFlat(null);
      setDocuments([]);
      setNotes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubFlat = onSnapshot(
      doc(db, "flats", flatId),
      (snap) => {
        if (!snap.exists()) {
          setFlat(null);
          setLoading(false);
          return;
        }
        const data = snap.data() as Omit<FlatRecord, "id">;
        const seed = FLAT_SEED.find((s) => s.id === flatId) || {
          id: flatId,
          name: data.name || flatId,
          slug: data.slug || flatId,
          ownership: data.ownership || ("personal" as const),
        };
        setFlat({ ...blankFlat(seed), ...data, id: flatId });
        setLoading(false);
      },
      () => setLoading(false),
    );

    const unsubDocs = onSnapshot(
      query(collection(db, "flats", flatId, "documents"), orderBy("createdAt", "desc")),
      (snap) => {
        setDocuments(
          snap.docs.map((d) => {
            const x = d.data();
            return {
              id: d.id,
              name: x.name ?? "",
              date: x.date ?? "",
              url: x.url ?? "",
              fileType: x.fileType ?? "file",
              category: x.category ?? "Other",
              notes: x.notes ?? "",
              linkedNoteId: x.linkedNoteId,
              linkedNoteType: x.linkedNoteType,
              linkedNoteText: x.linkedNoteText,
              createdAt: x.createdAt,
            };
          }),
        );
      },
    );

    const unsubNotes = onSnapshot(
      query(collection(db, "flats", flatId, "notes"), orderBy("createdAt", "desc")),
      (snap) => {
        setNotes(
          snap.docs.map((d) => {
            const x = d.data();
            return {
              id: d.id,
              text: x.text ?? "",
              author: x.author ?? "",
              authorId: x.authorId,
              done: !!x.done,
              createdAt: x.createdAt,
              type: x.type ?? "task",
              dueDate: x.dueDate,
              comments: x.comments ?? [],
            };
          }),
        );
      },
    );

    return () => {
      unsubFlat();
      unsubDocs();
      unsubNotes();
    };
  }, [flatId]);

  const saveFlat = useCallback(
    async (patch: Partial<FlatRecord>) => {
      if (!flatId) return;
      const { id: _omit, ...rest } = patch;
      await setDoc(doc(db, "flats", flatId), { ...rest, updatedAt: serverTimestamp() }, { merge: true });
    },
    [flatId],
  );

  const addBalance = useCallback(
    async (record: FlatBalanceRecord) => {
      if (!flat) return;
      await saveFlat({ balanceHistory: [...(flat.balanceHistory || []), record] });
    },
    [flat, saveFlat],
  );

  const addLedgerEntry = useCallback(
    async (entry: Omit<FlatLedgerEntry, "id">) => {
      if (!flat) return;
      const row: FlatLedgerEntry = {
        ...entry,
        id: `led_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      };
      await saveFlat({ ledger: [...(flat.ledger || []), row] });
    },
    [flat, saveFlat],
  );

  const removeLedgerEntry = useCallback(
    async (entryId: string) => {
      if (!flat) return;
      await saveFlat({ ledger: (flat.ledger || []).filter((e) => e.id !== entryId) });
    },
    [flat, saveFlat],
  );

  const saveTenant = useCallback(async (tenant: FlatTenant) => saveFlat({ tenant }), [saveFlat]);
  const saveTax = useCallback(
    async (tax: FlatTaxSettings) => saveFlat({ tax, ownership: tax.ownership }),
    [saveFlat],
  );
  const saveBankLinks = useCallback(
    async (bankLinks: FlatBankLink[]) => saveFlat({ bankLinks }),
    [saveFlat],
  );

  const uploadDocument = useCallback(
    async (
      file: File,
      meta?: {
        category?: string;
        notes?: string;
        link?: { noteId: string; type: "note" | "task"; text: string };
      },
    ) => {
      if (!flatId) return;
      setUploadingDoc(true);
      try {
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
        const fileType = file.type.startsWith("image/") ? "image" : ext === "pdf" ? "pdf" : "file";
        const storageRef = ref(storage, `flats/${flatId}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        await addDoc(collection(db, "flats", flatId, "documents"), {
          name: file.name,
          date: new Date().toISOString().slice(0, 10),
          url,
          fileType,
          category: meta?.category || "Other",
          notes: meta?.notes || "",
          createdAt: serverTimestamp(),
          ...(meta?.link
            ? {
                linkedNoteId: meta.link.noteId,
                linkedNoteType: meta.link.type,
                linkedNoteText: meta.link.text,
              }
            : {}),
        });
      } finally {
        setUploadingDoc(false);
      }
    },
    [flatId],
  );

  const updateDocument = useCallback(
    async (id: string, data: Partial<Pick<FlatDocumentMeta, "name" | "notes" | "category">>) => {
      if (!flatId) return;
      await updateDoc(doc(db, "flats", flatId, "documents", id), data as Record<string, unknown>);
    },
    [flatId],
  );

  const addNote = useCallback(
    async (text: string, author?: string, type?: "task" | "note", dueDate?: string, authorId?: string) => {
      if (!flatId) return "";
      const noteRef = await addDoc(collection(db, "flats", flatId, "notes"), {
        text,
        author: author ?? "",
        authorId: authorId ?? "",
        done: false,
        createdAt: serverTimestamp(),
        type: type ?? "task",
        comments: [],
        ...(dueDate ? { dueDate } : {}),
      });
      return noteRef.id;
    },
    [flatId],
  );

  const updateNote = useCallback(
    async (id: string, text: string) => {
      if (!flatId) return;
      await updateDoc(doc(db, "flats", flatId, "notes", id), { text });
    },
    [flatId],
  );

  const addComment = useCallback(
    async (noteId: string, text: string, authorName: string) => {
      if (!flatId) return;
      const comment: FlatNoteComment = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        text,
        authorName,
        createdAt: new Date().toISOString(),
      };
      await updateDoc(doc(db, "flats", flatId, "notes", noteId), { comments: arrayUnion(comment) });
    },
    [flatId],
  );

  const toggleNote = useCallback(
    async (id: string, done: boolean) => {
      if (!flatId) return;
      await updateDoc(doc(db, "flats", flatId, "notes", id), { done });
    },
    [flatId],
  );

  const deleteNote = useCallback(
    async (id: string) => {
      if (!flatId) return;
      await deleteDoc(doc(db, "flats", flatId, "notes", id));
    },
    [flatId],
  );

  const mergeImportedLedger = useCallback(
    async (entries: FlatLedgerEntry[]) => {
      if (!flat || !entries.length) return 0;
      const existing = new Set((flat.ledger || []).map((e) => e.bankTxId).filter(Boolean));
      const fresh = entries.filter((e) => !e.bankTxId || !existing.has(e.bankTxId));
      if (!fresh.length) return 0;
      await saveFlat({ ledger: [...(flat.ledger || []), ...fresh] });
      return fresh.length;
    },
    [flat, saveFlat],
  );

  return {
    flat,
    documents,
    notes,
    loading,
    uploadingDoc,
    saveFlat,
    addBalance,
    addLedgerEntry,
    removeLedgerEntry,
    saveTenant,
    saveTax,
    saveBankLinks,
    uploadDocument,
    updateDocument,
    addNote,
    updateNote,
    addComment,
    toggleNote,
    deleteNote,
    mergeImportedLedger,
  };
}
