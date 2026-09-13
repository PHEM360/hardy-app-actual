import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
  enabledMarketingPlatforms,
  MARKETING_MOCK_MODEL,
  MARKETING_MOCK_PROVIDER,
  mockBrandScan,
  mockContentBatch,
  mockMarketingPlan,
  mockPresenceAnalysis,
  mockScheduleSuggestion,
  type MockHubInput,
  type MockPiece,
} from "@/lib/marketingMock";
import { calculateMarketingPieceCount } from "../../functions/src/marketingValidation";
import type {
  Company,
  ContentPiece,
  MarketingAnalysis,
  MarketingPlan,
  MarketingPlanRequest,
  MarketingProfile,
  SocialPlatform,
} from "@/types/app";

export function hubInputFrom(
  company: Pick<Company, "name" | "description" | "contact"> | undefined,
  profile: Partial<MarketingProfile> | undefined,
  request?: Partial<MarketingPlanRequest>,
): MockHubInput {
  const platforms = (request?.platforms?.length
    ? request.platforms
    : enabledMarketingPlatforms({
      platforms: profile?.platforms,
      enableTikTok: profile?.enableTikTok,
      enableYouTube: profile?.enableYouTube,
    })) as MockHubInput["platforms"];
  return {
    companyName: company?.name || profile?.tradingNames?.[0] || "This brand",
    description: company?.description || profile?.currentThemes,
    website: profile?.website || company?.contact?.website,
    brandVoice: profile?.brandVoice,
    targetAudience: profile?.targetAudience,
    industry: profile?.industry,
    styleNotes: profile?.styleNotes,
    platforms,
    periodDays: request?.periodDays || profile?.defaultPlanDays || 30,
    postsPerWeek: request?.postsPerWeek || profile?.postsPerWeek || 3,
    focus: request?.focus,
    includeArticles: request?.includeArticles,
  };
}

function pieceToContent(piece: MockPiece): Omit<ContentPiece, "id" | "createdAt" | "updatedAt"> {
  return {
    type: piece.type,
    platform: piece.platform,
    topic: piece.topic,
    campaignId: "",
    objective: piece.objective,
    audience: piece.audience,
    trendReason: piece.trendReason,
    draft: piece.draft,
    refinedDraft: piece.refinedDraft,
    hashtags: piece.hashtags,
    assetIds: [],
    aiImagePrompt: piece.aiImagePrompt,
    scheduledFor: piece.scheduledFor,
    timezone: "Europe/London",
    status: "awaiting_approval",
    approvalVersion: 1,
    approvedVersion: 0,
    approvedAt: "",
    approvedBy: "",
    rejectedAt: "",
    rejectedBy: "",
    rejectionReason: "",
    publishedAt: "",
    externalPostId: "",
    externalPostUrl: "",
    publishAttempts: 0,
    publishError: "",
    aiProvider: MARKETING_MOCK_PROVIDER,
    aiModel: MARKETING_MOCK_MODEL,
    aiReasoning: piece.aiReasoning,
    brandChecks: piece.brandChecks,
    engagementSuggestions: piece.engagementSuggestions,
    revisions: [],
    editRequestNotes: "",
    publishMode: "dry_run",
  };
}

function actorUid() {
  return auth.currentUser?.uid || "operator";
}

function clean<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

export async function writeMockBrandScan(
  companyId: string,
  company: Pick<Company, "name" | "description" | "contact"> | undefined,
  profile: Partial<MarketingProfile>,
) {
  const scan = mockBrandScan(hubInputFrom(company, profile));
  const filled = [
    !profile.brandVoice && "brandVoice",
    !profile.targetAudience && "targetAudience",
    !profile.styleNotes && "styleNotes",
    !profile.industry && "industry",
    !(profile.objectives || []).length && "objectives",
    !(profile.keyMessages || []).length && "keyMessages",
  ].filter(Boolean) as string[];
  await setDoc(doc(db, "companies", companyId, "marketing", "profile"), clean({
    brandVoice: profile.brandVoice || scan.brandVoice,
    targetAudience: profile.targetAudience || scan.targetAudience,
    styleNotes: profile.styleNotes || scan.styleNotes,
    industry: profile.industry || scan.industry,
    objectives: (profile.objectives || []).length ? profile.objectives : scan.objectives,
    keyMessages: (profile.keyMessages || []).length ? profile.keyMessages : scan.keyMessages,
    preferredHashtags: (profile.preferredHashtags || []).length ? profile.preferredHashtags : scan.preferredHashtags,
    website: profile.website || scan.website,
    tradingNames: (profile.tradingNames || []).length ? profile.tradingNames : [company?.name].filter(Boolean),
    aiSuggestedFields: filled,
    updatedAt: serverTimestamp(),
  }), { merge: true });
  await setDoc(doc(db, "companies", companyId, "marketing", "scan"), {
    ...scan,
    source: MARKETING_MOCK_PROVIDER,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return { headline: `Brand scan ready for ${company?.name || "this company"}`, filledFields: filled, source: "mock" as const };
}

export async function writeMockAnalysis(
  companyId: string,
  company: Pick<Company, "name" | "description" | "contact"> | undefined,
  profile: Partial<MarketingProfile>,
) {
  const input = hubInputFrom(company, profile);
  const analysis = mockPresenceAnalysis(input);
  const record: MarketingAnalysis = {
    ...analysis,
    source: "mock",
  };
  await setDoc(doc(db, "companies", companyId, "marketing", "analysis"), {
    ...record,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  await setDoc(doc(db, "companies", companyId, "marketing", "plan"), {
    strengths: analysis.strengths,
    weaknesses: analysis.weaknesses,
    estimatedBudgetGbp: analysis.estimatedMonthlyBudgetGbp * Math.max(1, Math.round(input.periodDays / 30)),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return { headline: analysis.headline, source: "mock" as const };
}

export async function writeMockPlanAndContent(
  companyId: string,
  company: Pick<Company, "name" | "description" | "contact"> | undefined,
  profile: Partial<MarketingProfile>,
  request: MarketingPlanRequest,
) {
  const input = hubInputFrom(company, profile, request);
  const analysis = mockPresenceAnalysis(input);
  const plan = mockMarketingPlan(input, analysis);
  const count = calculateMarketingPieceCount(input.periodDays, input.postsPerWeek);
  const pieces = mockContentBatch(input, count);
  const contentIds: string[] = [];
  for (const piece of pieces) {
    const ref = await addDoc(collection(db, "companies", companyId, "content"), {
      ...pieceToContent(piece),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    contentIds.push(ref.id);
  }
  const record: MarketingPlan = {
    ...plan,
    platforms: plan.platforms.filter((item): item is SocialPlatform => item !== "website"),
    source: "mock",
  };
  await setDoc(doc(db, "companies", companyId, "marketing", "plan"), {
    ...record,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  await setDoc(doc(db, "companies", companyId, "marketing", "analysis"), {
    ...analysis,
    source: MARKETING_MOCK_PROVIDER,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return {
    created: pieces.length,
    contentIds,
    imagesCreated: 0,
    summary: `Demo plan: ${pieces.length} posts over ${input.periodDays} days, about £${plan.estimatedBudgetGbp.toLocaleString("en-GB")} indicative. They are waiting in the queue.`,
    source: "mock" as const,
  };
}

export async function writeMockSchedule(
  companyId: string,
  periodDays: number,
) {
  const snap = await getDocs(query(collection(db, "companies", companyId, "content")));
  const items = snap.docs
    .map((item) => ({ id: item.id, ...item.data() } as ContentPiece))
    .filter((item) => item.status === "awaiting_approval" || item.status === "draft" || item.status === "approved");
  const suggestion = mockScheduleSuggestion(items.map((item) => ({ id: item.id || "", platform: String(item.platform) })), periodDays);
  let updated = 0;
  for (const row of suggestion) {
    const existing = items.find((item) => item.id === row.id);
    if (!existing) continue;
    const versionBump = existing.status === "approved" || existing.status === "scheduled"
      ? { status: "awaiting_approval" as const, approvalVersion: (existing.approvalVersion || 0) + 1, approvedVersion: 0 }
      : {};
    await updateDoc(doc(db, "companies", companyId, "content", row.id), {
      scheduledFor: row.scheduledFor,
      ...versionBump,
      updatedAt: serverTimestamp(),
    });
    updated += 1;
  }
  return { updated, summary: `Moved ${updated} posts across the next ${periodDays} days.` };
}

export async function writeEditRequest(
  companyId: string,
  contentId: string,
  notes: string,
  actor = "operator",
) {
  const reason = notes.trim();
  if (reason.length < 3) throw new Error("Add a short note so the next rewrite knows what to change.");
  await updateDoc(doc(db, "companies", companyId, "content", contentId), {
    status: "draft",
    editRequestNotes: reason.slice(0, 1000),
    editRequestedAt: new Date().toISOString(),
    editRequestedBy: actor === "operator" ? actorUid() : actor,
    updatedAt: serverTimestamp(),
  });
  return { status: "draft" as const };
}

export async function writeDryRunApprove(
  companyId: string,
  contentId: string,
  approvalVersion: number,
  actor = "operator",
) {
  const snap = await getDoc(doc(db, "companies", companyId, "content", contentId));
  const scheduledFor = String(snap.data()?.scheduledFor || "");
  const status = new Date(scheduledFor).getTime() > Date.now() ? "scheduled" : "approved";
  await updateDoc(doc(db, "companies", companyId, "content", contentId), {
    status,
    approvedVersion: approvalVersion,
    approvedAt: new Date().toISOString(),
    approvedBy: actor === "operator" ? actorUid() : actor,
    publishError: "",
    updatedAt: serverTimestamp(),
  });
  return { status: status as "approved" | "scheduled", scheduledFor };
}

export async function writeDryRunPublish(
  companyId: string,
  contentId: string,
  platform: string,
) {
  const token = `dry-run_${Date.now()}`;
  await updateDoc(doc(db, "companies", companyId, "content", contentId), {
    status: "published",
    publishedAt: new Date().toISOString(),
    externalPostId: token,
    externalPostUrl: `https://hardy.local/dry-run/${companyId}/${contentId}`,
    publishMode: "dry_run",
    publishError: "",
    publishAttempts: 1,
    updatedAt: serverTimestamp(),
  });
  await setDoc(doc(db, "companies", companyId, "marketing", "publishLog"), {
    lastJob: {
      contentId,
      platform,
      mode: "dry_run",
      externalPostId: token,
      intendedAction: `Would post to ${platform} once OAuth for that network is connected.`,
      at: new Date().toISOString(),
    },
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return { queued: true, mode: "dry_run" as const, externalPostId: token };
}

export async function writeDemoWorkspace(
  companyId: string,
  company: Pick<Company, "name" | "description" | "contact"> | undefined,
  profile: Partial<MarketingProfile>,
) {
  const input = hubInputFrom(company, {
    ...profile,
    platforms: profile.platforms?.length ? profile.platforms : ["instagram", "facebook", "linkedin", "google"],
    defaultPlanDays: 60,
    postsPerWeek: 3,
  }, { periodDays: 60, postsPerWeek: 3, platforms: ["instagram", "facebook", "linkedin", "google"] });
  const scan = mockBrandScan(input);
  await setDoc(doc(db, "companies", companyId, "marketing", "profile"), {
    ...scan,
    platforms: input.platforms,
    enableTikTok: false,
    enableYouTube: false,
    approvalRequired: true,
    defaultPlanDays: 60,
    postsPerWeek: 3,
    tradingNames: [company?.name].filter(Boolean),
    prStrategy: "Owner reviews a weekly queue. AI drafts; nothing posts until someone taps Approve.",
    marketingSpendSummary: "Mostly time so far. Indicative next step is £600–900/month to boost the two best posts.",
    currentThemes: company?.description || "Useful weekly proof, not slogans.",
    aiSuggestedFields: ["brandVoice", "targetAudience", "styleNotes", "objectives", "keyMessages"],
    onboardedAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return writeMockPlanAndContent(companyId, company, { ...profile, ...scan, platforms: input.platforms as SocialPlatform[] }, {
    periodDays: 60,
    postsPerWeek: 3,
    platforms: input.platforms as SocialPlatform[],
    includeArticles: true,
    includeImages: false,
    focus: "Two months of useful posts the owner can approve on a Sunday",
  });
}
