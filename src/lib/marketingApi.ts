import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import type { MarketingAuditRequest, MarketingPlanRequest } from "@/types/app";

export interface GeneratedMarketingPlan {
  created: number;
  contentIds: string[];
  imagesCreated?: number;
  summary: string;
}

export async function generateMarketingPlan(companyId: string, request: MarketingPlanRequest) {
  const call = httpsCallable<
    { companyId: string; request: MarketingPlanRequest },
    GeneratedMarketingPlan
  >(functions, "generateMarketingPlan");
  return (await call({ companyId, request })).data;
}

export async function generateMarketingAudit(companyId: string, request: MarketingAuditRequest) {
  const call = httpsCallable<
    { companyId: string; request: MarketingAuditRequest },
    { auditId: string; headline: string }
  >(functions, "generateMarketingAudit");
  return (await call({ companyId, request })).data;
}

export async function approveMarketingContent(companyId: string, contentId: string, approvalVersion: number) {
  const call = httpsCallable<
    { companyId: string; contentId: string; approvalVersion: number },
    { status: "approved" | "scheduled" }
  >(functions, "approveMarketingContent");
  return (await call({ companyId, contentId, approvalVersion })).data;
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
) {
  const call = httpsCallable<
    { companyId: string; contentId: string; approvalVersion: number },
    { queued: boolean }
  >(functions, "publishMarketingContentNow");
  return (await call({ companyId, contentId, approvalVersion })).data;
}

export async function getMarketingConnectionUrl(companyId: string, platform: string) {
  const call = httpsCallable<
    { companyId: string; platform: string },
    { available: boolean; authUrl?: string; reason?: string }
  >(functions, "startMarketingPlatformConnection");
  return (await call({ companyId, platform })).data;
}

export async function generateMarketingImage(companyId: string, prompt: string) {
  const call = httpsCallable<
    { companyId: string; prompt: string },
    { assetId: string; url: string; storagePath: string }
  >(functions, "generateMarketingImage");
  return (await call({ companyId, prompt })).data;
}
