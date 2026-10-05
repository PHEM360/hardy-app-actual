import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import {
  accountTypeInfo,
  providerInfo,
  type PlatformEntry,
  type PlatformFieldInfo,
  type PlatformFieldKey,
} from "@/lib/platformComparison";

export interface PlatformAssistResult {
  values: Partial<Record<PlatformFieldKey, number | null>>;
  notes: Partial<Record<PlatformFieldKey, string>>;
  summary: string;
  model: string;
}

interface AssistRequest {
  mode: "fill" | "extract";
  account: {
    providerName: string;
    accountTypeLabel: string;
    planLabel: string;
    balance: number;
    known: PlatformEntry["values"];
  };
  fields: Pick<PlatformFieldInfo, "key" | "label" | "unit" | "hint">[];
  documentBase64?: string;
  mimeType?: string;
}

function accountContext(entry: PlatformEntry, balance: number): AssistRequest["account"] {
  const plan = providerInfo(entry.providerId)?.plans.find((p) => p.id === entry.planId);
  return {
    providerName: entry.providerName,
    accountTypeLabel: accountTypeInfo(entry.accountType).label,
    planLabel: plan?.label ?? "",
    balance,
    known: entry.values,
  };
}

const slim = (fields: PlatformFieldInfo[]) => fields.map(({ key, label, unit, hint }) => ({ key, label, unit, hint }));

/** Asks AI for figures the user has not entered. */
export async function fillPlatformGaps(entry: PlatformEntry, fields: PlatformFieldInfo[], balance: number): Promise<PlatformAssistResult> {
  const call = httpsCallable<AssistRequest, PlatformAssistResult>(functions, "platformCompareAssist");
  const res = await call({ mode: "fill", account: accountContext(entry, balance), fields: slim(fields) });
  return res.data;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

export const PLATFORM_DOCUMENT_MAX_BYTES = 6 * 1024 * 1024;

/** Reads charges and rates out of an uploaded PDF or photo. */
export async function extractPlatformDocument(entry: PlatformEntry, fields: PlatformFieldInfo[], balance: number, file: File): Promise<PlatformAssistResult> {
  if (file.size > PLATFORM_DOCUMENT_MAX_BYTES) throw new Error("That file is too big. Keep it under 6 MB.");
  if (file.type !== "application/pdf" && !file.type.startsWith("image/")) throw new Error("Upload a PDF or a photo.");
  const call = httpsCallable<AssistRequest, PlatformAssistResult>(functions, "platformCompareAssist");
  const res = await call({
    mode: "extract",
    account: accountContext(entry, balance),
    fields: slim(fields),
    documentBase64: await fileToBase64(file),
    mimeType: file.type,
  });
  return res.data;
}
