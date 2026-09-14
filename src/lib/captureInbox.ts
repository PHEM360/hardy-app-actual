import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { deleteObject, getBytes, getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { companyReceiptStoragePath } from "@/hooks/useCompanies";
import { uploadNoteMedia } from "@/lib/noteMedia";
import { DEFAULT_DOCUMENT_CATEGORIES, DEFAULT_SHARED_CATEGORY_SETTINGS } from "@/types/app";
import { DEFAULT_FLAT_EXPENSE_CATEGORIES } from "@/types/flats";
import type { NoteCanvasBlock } from "@/types/notes";

export type CaptureKind = "expense" | "document";
export type CaptureDestType = "unallocated" | "company" | "household" | "flat" | "pets" | "notes";

export type CaptureFileMeta = {
  url: string;
  name: string;
  mimeType: string;
  size: number;
  storagePath: string;
};

export type CaptureItem = {
  id: string;
  kind: CaptureKind;
  destType: CaptureDestType;
  destId: string;
  destLabel: string;
  name: string;
  description: string;
  amount: number | null;
  date: string;
  category: string;
  files: CaptureFileMeta[];
  createdAt?: unknown;
  createdBy: string;
};

export type CaptureDraft = {
  kind: CaptureKind;
  destType: CaptureDestType;
  destId: string;
  destLabel: string;
  name: string;
  description: string;
  amount: string;
  date: string;
  category: string;
};

export const GENERIC_EXPENSE_CATEGORIES = DEFAULT_SHARED_CATEGORY_SETTINGS.expenseCategories;

export const CAPTURE_DEST_LABELS: Record<CaptureDestType, string> = {
  unallocated: "Unallocated",
  company: "Company",
  household: "Household",
  flat: "Flat",
  pets: "Pets",
  notes: "Notes",
};

export function captureExpenseAllowed(destType: CaptureDestType) {
  return destType === "unallocated" || destType === "company" || destType === "household" || destType === "flat";
}

export function categoriesForCapture(
  destType: CaptureDestType,
  options?: { kind?: CaptureKind; expense?: string[]; document?: string[] },
) {
  const kind = options?.kind ?? "expense";
  if (kind === "document") {
    return options?.document?.length ? options.document : DEFAULT_DOCUMENT_CATEGORIES;
  }
  if (destType === "flat") return DEFAULT_FLAT_EXPENSE_CATEGORIES;
  return options?.expense?.length ? options.expense : GENERIC_EXPENSE_CATEGORIES;
}

export function todayIsoDate() {
  return new Date().toISOString().split("T")[0];
}

export function capturePagesLabel(count: number) {
  return count === 1 ? "1 page" : `${count} pages`;
}

export function inboxItemName(draft: Pick<CaptureDraft, "name">, files: { name: string }[]) {
  const fromDraft = draft.name.trim();
  if (fromDraft) return fromDraft;
  const first = files[0]?.name.replace(/\.[^.]+$/, "") || "";
  return first.trim() || files[0]?.name || "Untitled";
}

export type CaptureBundle = { id: string; files: File[] };

function newBundleId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `bundle_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function addFilesAsBundles(bundles: CaptureBundle[], files: File[]): CaptureBundle[] {
  if (!files.length) return bundles;
  return [...bundles, ...files.map((file) => ({ id: newBundleId(), files: [file] }))];
}

export function appendPagesToBundle(bundles: CaptureBundle[], bundleId: string, files: File[]): CaptureBundle[] {
  if (!files.length) return bundles;
  return bundles.map((bundle) =>
    bundle.id === bundleId ? { ...bundle, files: [...bundle.files, ...files] } : bundle,
  );
}

export function mergeBundleWithPrevious(bundles: CaptureBundle[], bundleId: string): CaptureBundle[] {
  const index = bundles.findIndex((bundle) => bundle.id === bundleId);
  if (index <= 0) return bundles;
  const merged: CaptureBundle = {
    ...bundles[index - 1],
    files: [...bundles[index - 1].files, ...bundles[index].files],
  };
  return [...bundles.slice(0, index - 1), merged, ...bundles.slice(index + 1)];
}

export function removePageFromBundle(bundles: CaptureBundle[], bundleId: string, pageIndex: number): CaptureBundle[] {
  return bundles
    .map((bundle) =>
      bundle.id === bundleId ? { ...bundle, files: bundle.files.filter((_, index) => index !== pageIndex) } : bundle,
    )
    .filter((bundle) => bundle.files.length > 0);
}

export function captureBatchCounts(bundles: CaptureBundle[]) {
  const items = bundles.filter((bundle) => bundle.files.length > 0);
  return {
    items: items.length,
    pages: items.reduce((sum, bundle) => sum + bundle.files.length, 0),
  };
}

export type CaptureProgress = {
  doneItems: number;
  totalItems: number;
  donePages: number;
  totalPages: number;
};

export function captureProgressPercent(progress: CaptureProgress) {
  if (progress.totalPages > 0) return Math.round((progress.donePages / progress.totalPages) * 100);
  if (progress.totalItems > 0) return Math.round((progress.doneItems / progress.totalItems) * 100);
  return 0;
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) || "file";
}

function parseAmount(value: string) {
  const amount = Number.parseFloat(value);
  return Number.isFinite(amount) ? amount : 0;
}

async function uploadOne(path: string, file: File): Promise<CaptureFileMeta> {
  const target = storageRef(storage, path);
  await uploadBytes(target, file, { contentType: file.type || "application/octet-stream" });
  const url = await getDownloadURL(target);
  return {
    url,
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    storagePath: path,
  };
}

export async function uploadInboxFiles(
  uid: string,
  files: File[],
  onFile?: (done: number, total: number) => void,
): Promise<CaptureFileMeta[]> {
  const out: CaptureFileMeta[] = [];
  for (const file of files) {
    const path = `captureInbox/${uid}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${safeName(file.name)}`;
    out.push(await uploadOne(path, file));
    onFile?.(out.length, files.length);
  }
  return out;
}

export async function filesFromMeta(files: CaptureFileMeta[]): Promise<File[]> {
  const out: File[] = [];
  for (const file of files) {
    const bytes = await getBytes(storageRef(storage, file.storagePath));
    out.push(new File([bytes], file.name, { type: file.mimeType || "application/octet-stream" }));
  }
  return out;
}

async function deleteStorageFiles(files: CaptureFileMeta[]) {
  await Promise.all(
    files.map(async (file) => {
      try {
        await deleteObject(storageRef(storage, file.storagePath));
      } catch {
        /* already gone */
      }
    }),
  );
}

async function saveCompanyExpense(uid: string, destId: string, draft: CaptureDraft, files: File[]) {
  const receipts: string[] = [];
  const receiptNames: string[] = [];
  for (const file of files) {
    const uploaded = await uploadOne(companyReceiptStoragePath(destId, file.name), file);
    receipts.push(uploaded.url);
    receiptNames.push(file.name);
  }
  await addDoc(collection(db, "companies", destId, "expenses"), {
    description: (draft.description || draft.name).trim() || "Expense",
    amount: parseAmount(draft.amount),
    date: draft.date || todayIsoDate(),
    category: draft.category || "Other",
    receipts,
    receiptNames,
    createdAt: serverTimestamp(),
    createdBy: uid,
  });
}

async function saveCompanyDocuments(uid: string, destId: string, draft: CaptureDraft, files: File[]) {
  const uploaded: CaptureFileMeta[] = [];
  for (const file of files) {
    const path = `companies/${destId}/documents/${Date.now()}_${safeName(file.name)}`;
    uploaded.push(await uploadOne(path, file));
  }
  await addDoc(collection(db, "companies", destId, "documents"), {
    name: (draft.name || files[0]?.name || "Document").trim(),
    category: draft.category || "Other",
    fileUrl: uploaded[0]?.url ?? "",
    fileName: uploaded[0]?.name ?? "",
    fileType: uploaded[0]?.mimeType ?? "",
    fileSize: uploaded[0]?.size ?? 0,
    fileUrls: uploaded.map((f) => f.url),
    fileNames: uploaded.map((f) => f.name),
    fileTypes: uploaded.map((f) => f.mimeType),
    createdAt: serverTimestamp(),
    createdBy: uid,
  });
}

async function saveHouseholdDocument(uid: string, destId: string, draft: CaptureDraft, files: File[], asReceipt: boolean) {
  const uploaded: CaptureFileMeta[] = [];
  for (const file of files) {
    const ext = file.name.split(".").pop() || "bin";
    const path = `household/${destId}/documents/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    uploaded.push(await uploadOne(path, file));
  }
  const amount = parseAmount(draft.amount);
  const notes = asReceipt
    ? [
        amount ? `£${amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "",
        draft.date,
        draft.category,
        draft.description,
      ]
        .filter(Boolean)
        .join(" · ")
    : draft.description;
  await addDoc(collection(db, "household", destId, "documents"), {
    name: (draft.name || draft.description || files[0]?.name || "Document").trim(),
    category: asReceipt ? "receipt" : "other",
    docCategory: draft.category || "",
    notes,
    fileUrl: uploaded[0]?.url ?? "",
    fileName: uploaded[0]?.name ?? "",
    fileType: uploaded[0]?.mimeType ?? "",
    fileSize: uploaded[0]?.size ?? 0,
    fileUrls: uploaded.map((f) => f.url),
    fileNames: uploaded.map((f) => f.name),
    fileTypes: uploaded.map((f) => f.mimeType),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: uid,
  });
}

async function saveFlatFiles(destId: string, draft: CaptureDraft, files: File[], asExpense: boolean) {
  const uploadedIds: string[] = [];
  for (const file of files) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const fileType = file.type.startsWith("image/") ? "image" : ext === "pdf" ? "pdf" : "file";
    const path = `flats/${destId}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${file.name}`;
    const uploaded = await uploadOne(path, file);
    const docRef = await addDoc(collection(db, "flats", destId, "documents"), {
      name: (draft.name || file.name).trim(),
      date: draft.date || todayIsoDate(),
      url: uploaded.url,
      storagePath: uploaded.storagePath,
      fileType,
      category: draft.category || "Other",
      year: null,
      notes: draft.description || "",
      createdAt: serverTimestamp(),
    });
    uploadedIds.push(docRef.id);
  }
  if (!asExpense) return;
  const snap = await getDoc(doc(db, "flats", destId));
  const ledger = Array.isArray(snap.data()?.ledger) ? snap.data()?.ledger : [];
  const entry = {
    id: `led_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    kind: "expense",
    date: draft.date || todayIsoDate(),
    description: (draft.description || draft.name || "Expense").trim(),
    category: draft.category || "Other",
    amountGbp: parseAmount(draft.amount),
    frequency: "One-off",
    source: "manual",
    documentId: uploadedIds[0] ?? null,
  };
  await updateDoc(doc(db, "flats", destId), {
    ledger: [...ledger, entry],
    updatedAt: serverTimestamp(),
  });
}

async function savePetDocuments(uid: string, destId: string, draft: CaptureDraft, files: File[]) {
  const petIds = destId ? [destId] : [];
  for (const file of files) {
    const path = `petDocuments/${uid}/${Date.now()}_${file.name}`;
    const uploaded = await uploadOne(path, file);
    await addDoc(collection(db, "petDocuments", uid, "docs"), {
      title: (draft.name || file.name).trim(),
      url: uploaded.url,
      storagePath: uploaded.storagePath,
      petIds,
      fileType: file.type,
      uploadedAt: serverTimestamp(),
    });
  }
}

async function saveNote(uid: string, draft: CaptureDraft, files: File[]) {
  if (!files.some((file) => file.type.startsWith("image/") || file.type.startsWith("video/"))) {
    throw new Error("Notes keep photos. Save PDFs to a household, flat or company.");
  }
  const noteRef = await addDoc(collection(db, "hubNotes", uid, "items"), {
    folderId: null,
    kind: "note",
    title: (draft.name || files[0]?.name || "Document").trim(),
    body: draft.description || "",
    color: "amber",
    category: "other",
    pinned: false,
    archived: false,
    tags: [],
    checklist: [],
    diagram: null,
    canvas: null,
    dueDate: null,
    calendarEventId: null,
    addToCalendar: false,
    locked: false,
    cipher: null,
    sharedWith: [],
    sharePermission: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const blocks: NoteCanvasBlock[] = [];
  const extras: string[] = [];
  let y = 16;
  for (const file of files) {
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) {
      extras.push(file.name);
      continue;
    }
    const url = await uploadNoteMedia(uid, noteRef.id, file, file.name);
    blocks.push({
      id: crypto.randomUUID(),
      type: "media",
      x: 16,
      y,
      width: 280,
      height: isImage ? 200 : 72,
      mediaType: isImage ? "image" : "video",
      url,
      name: file.name,
    });
    y += isImage ? 216 : 88;
  }
  await updateDoc(noteRef, {
    body: [draft.description, extras.length ? extras.join(", ") : ""].filter(Boolean).join("\n"),
    canvas: blocks.length ? { version: 1, height: Math.max(320, y + 24), blocks } : null,
    updatedAt: serverTimestamp(),
  });
}

export async function placeCapture(
  uid: string,
  draft: CaptureDraft,
  files: File[],
  options?: { onFile?: (done: number, total: number) => void },
) {
  if (!uid) throw new Error("Sign in to save.");
  if (files.length === 0) throw new Error("Add at least one photo or file.");
  const kind: CaptureKind = draft.kind === "expense" && captureExpenseAllowed(draft.destType) ? "expense" : "document";

  if (draft.destType === "unallocated") {
    const uploaded = await uploadInboxFiles(uid, files, options?.onFile);
    const base = {
      kind,
      destType: "unallocated" as const,
      destId: "",
      destLabel: "Unallocated",
      description: draft.description.trim(),
      amount: kind === "expense" && draft.amount.trim() ? parseAmount(draft.amount) : null,
      date: draft.date || todayIsoDate(),
      category: draft.category || "Other",
      createdAt: serverTimestamp(),
      createdBy: uid,
    };
    await addDoc(collection(db, "captureInbox", uid, "items"), {
      ...base,
      name: inboxItemName(draft, uploaded),
      files: uploaded,
    });
    return { count: 1, pages: uploaded.length, unallocated: true };
  }

  if (!draft.destId && draft.destType !== "pets" && draft.destType !== "notes") {
    throw new Error("Pick where this should go.");
  }
  if (kind === "expense" && draft.destType !== "unallocated") {
    if (!draft.description.trim() && !draft.name.trim()) throw new Error("Add a description.");
    if (draft.destType === "company" && !draft.amount.trim()) throw new Error("Add an amount.");
  }
  if (kind === "document" && !draft.name.trim()) throw new Error("Name the file.");

  if (draft.destType === "company" && kind === "expense") await saveCompanyExpense(uid, draft.destId, draft, files);
  else if (draft.destType === "company") await saveCompanyDocuments(uid, draft.destId, draft, files);
  else if (draft.destType === "household") await saveHouseholdDocument(uid, draft.destId, draft, files, kind === "expense");
  else if (draft.destType === "flat") await saveFlatFiles(draft.destId, draft, files, kind === "expense");
  else if (draft.destType === "pets") await savePetDocuments(uid, draft.destId, draft, files);
  else if (draft.destType === "notes") await saveNote(uid, draft, files);

  return { count: 1, pages: files.length, unallocated: false };
}

export async function placeCaptureBatch(
  uid: string,
  draft: CaptureDraft,
  groups: File[][],
  onProgress?: (progress: CaptureProgress) => void,
) {
  const bundles = groups.filter((files) => files.length > 0);
  if (bundles.length === 0) throw new Error("Add at least one photo or file.");
  if (bundles.length > 1 && draft.destType !== "unallocated") {
    throw new Error("A pile of receipts goes to Unallocated. File each one after, or keep a single receipt here.");
  }
  const totalPages = bundles.reduce((sum, files) => sum + files.length, 0);
  let pages = 0;
  onProgress?.({ doneItems: 0, totalItems: bundles.length, donePages: 0, totalPages });
  for (let index = 0; index < bundles.length; index += 1) {
    const files = bundles[index];
    const itemDraft = bundles.length === 1 ? draft : { ...draft, name: "", description: "", amount: "" };
    const result = await placeCapture(uid, itemDraft, files, {
      onFile: (done) => {
        onProgress?.({
          doneItems: index,
          totalItems: bundles.length,
          donePages: pages + done,
          totalPages,
        });
      },
    });
    pages += result.pages;
    onProgress?.({ doneItems: index + 1, totalItems: bundles.length, donePages: pages, totalPages });
  }
  return { count: bundles.length, pages, unallocated: draft.destType === "unallocated" };
}

export async function allocateInboxItem(uid: string, item: CaptureItem, draft: CaptureDraft) {
  if (draft.destType === "unallocated") throw new Error("Pick a home for this, or leave it in Unallocated.");
  const files = await filesFromMeta(item.files || []);
  const result = await placeCapture(uid, draft, files);
  if (item.id) await deleteDoc(doc(db, "captureInbox", uid, "items", item.id));
  await deleteStorageFiles(item.files || []);
  return result;
}

export async function deleteInboxItem(uid: string, item: CaptureItem) {
  if (item.id) await deleteDoc(doc(db, "captureInbox", uid, "items", item.id));
  await deleteStorageFiles(item.files || []);
}

export function captureItemThumb(item: CaptureItem) {
  const file = item.files?.[0];
  if (!file) return null;
  if ((file.mimeType || "").startsWith("image/")) return file.url;
  return null;
}
