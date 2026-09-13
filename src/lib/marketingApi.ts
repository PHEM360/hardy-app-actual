import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import {
  writeDemoWorkspace,
  writeDryRunApprove,
  writeDryRunPublish,
  writeEditRequest,
  writeMockAnalysis,
  writeMockBrandScan,
  writeMockPlanAndContent,
  writeMockSchedule,
} from "@/lib/marketingDemo";
import type {
  Company,
  MarketingAuditRequest,
  MarketingPlanRequest,
  MarketingProfile,
} from "@/types/app";

export interface GeneratedMarketingPlan {
  created: number;
  contentIds: string[];
  imagesCreated?: number;
  summary: string;
  source?: "openai" | "gemini" | "grok" | "mock";
  aiModel?: string;
}

export type MarketingCompanyHint = Pick<Company, "name" | "description" | "contact">;

function errorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code?: string }).code || "");
  }
  return "";
}

/** Fall back to the in-app mock when Functions are missing, down, or have no LLM key. */
export function shouldUseMarketingDemoFallback(error: unknown): boolean {
  const code = errorCode(error);
  if (code.includes("unauthenticated") || code.includes("permission-denied")) return false;
  return true;
}

async function callOrFallback<T>(
  name: string,
  payload: unknown,
  fallback: () => Promise<T>,
): Promise<T> {
  try {
    const call = httpsCallable(functions, name);
    return (await call(payload)).data as T;
  } catch (error) {
    if (!shouldUseMarketingDemoFallback(error)) throw error;
    return fallback();
  }
}

export async function generateMarketingPlan(
  companyId: string,
  request: MarketingPlanRequest,
  context?: { company?: MarketingCompanyHint; profile?: Partial<MarketingProfile> },
) {
  return callOrFallback<GeneratedMarketingPlan>(
    "generateMarketingPlan",
    { companyId, request },
    () => writeMockPlanAndContent(companyId, context?.company, context?.profile || {}, request),
  );
}

export async function generateMarketingAudit(companyId: string, request: MarketingAuditRequest) {
  const call = httpsCallable<
    { companyId: string; request: MarketingAuditRequest },
    { auditId: string; headline: string }
  >(functions, "generateMarketingAudit");
  return (await call({ companyId, request })).data;
}

export async function scanMarketingBrand(
  companyId: string,
  context?: { company?: MarketingCompanyHint; profile?: Partial<MarketingProfile> },
) {
  return callOrFallback(
    "scanMarketingBrand",
    { companyId },
    () => writeMockBrandScan(companyId, context?.company, context?.profile || {}),
  );
}

export async function analyseMarketingPresence(
  companyId: string,
  context?: { company?: MarketingCompanyHint; profile?: Partial<MarketingProfile> },
) {
  return callOrFallback(
    "analyseMarketingPresence",
    { companyId },
    () => writeMockAnalysis(companyId, context?.company, context?.profile || {}),
  );
}

export async function suggestMarketingSchedule(
  companyId: string,
  periodDays = 60,
) {
  return callOrFallback(
    "suggestMarketingSchedule",
    { companyId, periodDays },
    () => writeMockSchedule(companyId, periodDays),
  );
}

export async function requestMarketingEdits(
  companyId: string,
  contentId: string,
  approvalVersion: number,
  notes: string,
) {
  return callOrFallback(
    "requestMarketingEdits",
    { companyId, contentId, approvalVersion, notes },
    () => writeEditRequest(companyId, contentId, notes),
  );
}

export async function approveMarketingContent(companyId: string, contentId: string, approvalVersion: number) {
  return callOrFallback<{ status: "approved" | "scheduled" }>(
    "approveMarketingContent",
    { companyId, contentId, approvalVersion },
    () => writeDryRunApprove(companyId, contentId, approvalVersion),
  );
}

export async function rejectMarketingContent(
  companyId: string,
  contentId: string,
  approvalVersion: number,
  reason: string,
) {
  const call = httpsCallable<
    { companyId: string; contentId: string; approvalVersion: number; reason: string },
    { status: "rejected" }
  >(functions, "rejectMarketingContent");
  return (await call({ companyId, contentId, approvalVersion, reason })).data;
}

export async function publishMarketingContentNow(
  companyId: string,
  contentId: string,
  approvalVersion: number,
  context?: { platform?: string },
) {
  return callOrFallback(
    "publishMarketingContentNow",
    { companyId, contentId, approvalVersion, dryRun: true },
    () => writeDryRunPublish(companyId, contentId, context?.platform || "unknown"),
  );
}

export async function getMarketingConnectionUrl(companyId: string, platform: string) {
  const call = httpsCallable<
    { companyId: string; platform: string },
    { available: boolean; authUrl?: string; reason?: string }
  >(functions, "startMarketingPlatformConnection");
  return (await call({ companyId, platform })).data;
}

export async function saveMarketingSocialLink(
  companyId: string,
  platform: string,
  profileUrl: string,
  accountName?: string,
) {
  const call = httpsCallable<
    { companyId: string; platform: string; profileUrl: string; accountName?: string },
    { ok: boolean }
  >(functions, "saveMarketingSocialLink");
  return (await call({ companyId, platform, profileUrl, accountName })).data;
}

export async function bulkApproveMarketingContent(
  companyId: string,
  items: Array<{ contentId: string; approvalVersion: number }>,
) {
  return callOrFallback(
    "bulkApproveMarketingContent",
    { companyId, items },
    async () => {
      let approved = 0;
      for (const item of items) {
        await writeDryRunApprove(companyId, item.contentId, item.approvalVersion);
        approved += 1;
      }
      return { approved };
    },
  );
}

export async function generateMarketingImage(companyId: string, prompt: string) {
  const call = httpsCallable<
    { companyId: string; prompt: string },
    { assetId: string; url: string; storagePath: string }
  >(functions, "generateMarketingImage");
  return (await call({ companyId, prompt })).data;
}

export async function seedMarketingDemo(
  companyId: string,
  context?: { company?: MarketingCompanyHint; profile?: Partial<MarketingProfile> },
) {
  return callOrFallback(
    "seedMarketingDemo",
    { companyId },
    () => writeDemoWorkspace(companyId, context?.company, context?.profile || {}),
  );
}
