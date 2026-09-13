import { randomUUID } from "crypto";
import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  enabledMarketingPlatforms,
  MARKETING_MOCK_MODEL,
  MARKETING_MOCK_PROVIDER,
  mockBrandScan,
  mockContentBatch,
  mockMarketingAudit,
  mockMarketingPlan,
  mockPresenceAnalysis,
  mockScheduleSuggestion,
  type MockAnalysis,
  type MockHubInput,
  type MockPiece,
  type MockPlan,
} from "./marketingMock";
import {
  generateMarketingImageBuffer,
  generateMarketingJson,
  marketingFlagsFromSecrets,
  type MarketingLlmUsage,
  type MarketingSecretValues,
} from "./marketingProviders";
import {
  hasLiveTextKey,
  type MarketingRouteOverrides,
} from "./marketingRouter";
import {
  buildMarketingAuditInstructions,
  buildMarketingPlanInstructions,
  calculateMarketingPieceCount,
  cleanOptionalString,
  extractPublicPageHints,
  hasMeaningfulMarketingProfile,
  isSafePublicHttpUrl,
  MarketingBrandProfile,
  MarketingPlatform,
  parseApprovalVersion,
  parseMarketingAuditInput,
  parseMarketingPlanInput,
  splitCompetitorHints,
  stringList,
  ukSeasonalContext,
} from "./marketingValidation";

const openaiApiKey = defineSecret("OPENAI_API_KEY");
const geminiApiKey = defineSecret("GEMINI_API_KEY");
const xaiApiKey = defineSecret("XAI_API_KEY");
const MARKETING_AI_SECRETS = [openaiApiKey, geminiApiKey, xaiApiKey];
const TIMEZONE = "Europe/London";
const MAX_GENERATED_PIECES = 120;
const MAX_PLAN_IMAGES = 24;
const IMAGE_CONCURRENCY = 2;

interface CallableAuth {
  uid: string;
  token: Record<string, unknown>;
}

interface GeneratedPiece {
  type?: unknown;
  platform?: unknown;
  topic?: unknown;
  objective?: unknown;
  audience?: unknown;
  trendReason?: unknown;
  draft?: unknown;
  refinedDraft?: unknown;
  hashtags?: unknown;
  aiImagePrompt?: unknown;
  aiReasoning?: unknown;
  brandChecks?: unknown;
  engagementSuggestions?: unknown;
}

interface MarketingJob {
  companyId: string;
  contentId: string;
  platform: MarketingPlatform;
  approvalVersion: number;
  status: string;
  dueAt?: Timestamp;
  attempts?: number;
}

function companyWebsiteFromRecord(company: Record<string, unknown>): string | undefined {
  const contact = company.contact && typeof company.contact === "object"
    ? company.contact as Record<string, unknown>
    : {};
  const raw = cleanOptionalString(contact.website, 300);
  if (!raw) return undefined;
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function failValidation(error: unknown): never {
  const message = error instanceof Error ? error.message : "Invalid request.";
  throw new HttpsError("invalid-argument", message);
}

function requireMarketingAuth(request: { auth?: CallableAuth }): CallableAuth {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }
  if (request.auth.token.deviceId) {
    throw new HttpsError(
      "permission-denied",
      "Remote display credentials cannot use marketing services."
    );
  }
  return request.auth;
}

function requireDocumentId(value: unknown, label: string): string {
  const result = String(value || "").trim();
  if (!result || result.includes("/") || result === "." || result === "..") {
    throw new HttpsError("invalid-argument", `${label} is invalid.`);
  }
  return result;
}

function normalizedRole(data: admin.firestore.DocumentData | undefined): string {
  return String(data?.role || "")
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

async function requireCompanyEditPermission(uid: string, companyId: string): Promise<void> {
  const db = admin.firestore();
  const [companySnap, userSnap] = await Promise.all([
    db.doc(`companies/${companyId}`).get(),
    db.doc(`users/${uid}`).get(),
  ]);
  if (!companySnap.exists) {
    throw new HttpsError("not-found", "Company not found.");
  }
  const company = companySnap.data() || {};
  const role = normalizedRole(userSnap.data());
  const isAdmin = role === "admin" || role === "superadmin" ||
    userSnap.data()?.isAdmin === true || userSnap.data()?.isSuperAdmin === true;
  const isLegacyCompany = !company.ownerId;
  const isOwner = company.ownerId === uid;
  const isShared = Array.isArray(company.sharedWith) && company.sharedWith.includes(uid);
  if (isAdmin || isLegacyCompany || isOwner || isShared) return;

  const shares = await db.collection("pageShares").where("targetUid", "==", uid).get();
  const hasEditShare = shares.docs.some((snapshot) => {
    const share = snapshot.data();
    return share.ownerId === company.ownerId &&
      share.page === "companies" &&
      share.permission === "edit";
  });
  if (!hasEditShare) {
    throw new HttpsError("permission-denied", "You do not have edit access to this company.");
  }
}

function deterministicJobId(companyId: string, contentId: string, approvalVersion: number): string {
  return `${companyId}_${contentId}_v${approvalVersion}`;
}

function scheduledDate(index: number, count: number, periodDays: number): string {
  const start = Date.now() + 24 * 60 * 60 * 1000;
  const span = Math.max(0, periodDays - 1) * 24 * 60 * 60 * 1000;
  const offset = count <= 1 ? 0 : (span * index) / (count - 1);
  const date = new Date(start + offset);
  date.setUTCHours(index % 2 === 0 ? 9 : 14, 0, 0, 0);
  return date.toISOString();
}

function secretValue(secret: { value: () => string }): string {
  try {
    return String(secret.value() || "").trim();
  } catch {
    return "";
  }
}

function readMarketingSecrets(): MarketingSecretValues {
  return {
    openai: secretValue(openaiApiKey) || String(process.env.OPENAI_API_KEY || "").trim(),
    gemini: secretValue(geminiApiKey) || String(process.env.GEMINI_API_KEY || "").trim(),
    grok: secretValue(xaiApiKey)
      || String(process.env.XAI_API_KEY || process.env.GROK_API_KEY || "").trim(),
  };
}

function routeOverridesFromInput(input?: {
  textProvider?: string;
  textModel?: string;
  imageProvider?: string;
  imageModel?: string;
}): MarketingRouteOverrides {
  const ignoreAuto = (value?: string) => {
    const raw = String(value || "").trim();
    return !raw || raw.toLowerCase() === "auto" ? undefined : raw;
  };
  return {
    textProvider: ignoreAuto(input?.textProvider),
    textModel: ignoreAuto(input?.textModel),
    imageProvider: ignoreAuto(input?.imageProvider),
    imageModel: ignoreAuto(input?.imageModel),
  };
}

function hasLiveMarketingKey(secrets = readMarketingSecrets()): boolean {
  return hasLiveTextKey(marketingFlagsFromSecrets(secrets));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

/** Live Meta/Google/LinkedIn posting stays off until this env flag is set. */
function livePublishEnabled(): boolean {
  return process.env.MARKETING_LIVE_PUBLISH === "true";
}

function hubInputFromRecords(
  company: Record<string, unknown>,
  profile: MarketingBrandProfile,
  extras?: { periodDays?: number; postsPerWeek?: number; platforms?: string[]; focus?: string; includeArticles?: boolean },
): MockHubInput {
  const extra = extras || {};
  return {
    companyName: String(company.name || "").trim() || "This brand",
    description: String(company.description || profile.currentThemes || ""),
    website: cleanOptionalString(profile.website, 300) || companyWebsiteFromRecord(company),
    brandVoice: String(profile.brandVoice || ""),
    targetAudience: String(profile.targetAudience || ""),
    industry: String(profile.industry || ""),
    styleNotes: String((profile as { styleNotes?: unknown }).styleNotes || ""),
    platforms: (extra.platforms?.length
      ? extra.platforms
      : enabledMarketingPlatforms({
        platforms: (profile as { platforms?: string[] }).platforms,
        enableTikTok: Boolean((profile as { enableTikTok?: boolean }).enableTikTok),
        enableYouTube: Boolean((profile as { enableYouTube?: boolean }).enableYouTube),
      })) as MockHubInput["platforms"],
    periodDays: extra.periodDays || 30,
    postsPerWeek: extra.postsPerWeek || 3,
    focus: extra.focus,
    includeArticles: extra.includeArticles,
  };
}

function generatedFromMock(piece: MockPiece): GeneratedPiece {
  return {
    type: piece.type,
    platform: piece.platform,
    topic: piece.topic,
    objective: piece.objective,
    audience: piece.audience,
    trendReason: piece.trendReason,
    draft: piece.draft,
    refinedDraft: piece.refinedDraft,
    hashtags: piece.hashtags,
    aiImagePrompt: piece.aiImagePrompt,
    aiReasoning: piece.aiReasoning,
    brandChecks: piece.brandChecks,
    engagementSuggestions: piece.engagementSuggestions,
  };
}

function completeContentPiece(
  raw: GeneratedPiece,
  platform: MarketingPlatform,
  campaignId: string,
  scheduledFor: string,
  actor: string,
  provider = MARKETING_MOCK_PROVIDER,
  model = MARKETING_MOCK_MODEL,
  routeReason = "",
): Record<string, unknown> {
  const draft = String(raw.draft || "").trim().slice(0, 10000);
  const refinedDraft = String(raw.refinedDraft || draft).trim().slice(0, 10000);
  return {
    type: ["social_post", "article", "campaign_idea", "advert"].includes(String(raw.type)) ?
      String(raw.type) : "social_post",
    platform,
    topic: String(raw.topic || "Brand update").trim().slice(0, 300),
    campaignId,
    objective: String(raw.objective || "Build audience awareness").trim().slice(0, 500),
    audience: String(raw.audience || "The brand's target audience").trim().slice(0, 500),
    trendReason: String(raw.trendReason || "Relevant evergreen brand content").trim().slice(0, 1000),
    draft,
    refinedDraft,
    hashtags: stringList(raw.hashtags, 20, 100),
    assetIds: [],
    aiImagePrompt: String(raw.aiImagePrompt || "").trim().slice(0, 2000),
    scheduledFor,
    timezone: TIMEZONE,
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
    aiProvider: provider,
    aiModel: model,
    aiRouteReason: routeReason,
    publishMode: "dry_run",
    aiReasoning: String(raw.aiReasoning || "Generated from the saved brand profile.").trim().slice(0, 2000),
    brandChecks: stringList(raw.brandChecks, 12, 300),
    engagementSuggestions: stringList(raw.engagementSuggestions, 12, 300),
    revisions: [],
    generatedBy: actor,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function piecesFromLlm(value: unknown, pieceCount: number): GeneratedPiece[] | null {
  const record = asRecord(value);
  const pieces = Array.isArray(record.pieces)
    ? record.pieces
    : Array.isArray(value) ? value : null;
  if (!pieces || pieces.length !== pieceCount) return null;
  const typed = pieces as GeneratedPiece[];
  const incomplete = typed.some((piece) =>
    String(piece.topic || "").trim().length < 3 ||
    String(piece.draft || "").trim().length < 10 ||
    stringList(piece.brandChecks, 12).length === 0 ||
    stringList(piece.engagementSuggestions, 12).length === 0
  );
  return incomplete ? null : typed;
}

function planFromLlm(value: unknown, fallback: MockPlan): MockPlan {
  const raw = asRecord(asRecord(value).plan);
  const summary = String(raw.summary || "").trim();
  const objectives = stringList(raw.objectives, 8, 300);
  const budget = Number(raw.estimatedBudgetGbp);
  if (summary.length < 12 || objectives.length === 0 || !Number.isFinite(budget) || budget <= 0) {
    return fallback;
  }
  return {
    ...fallback,
    summary: summary.slice(0, 2000),
    objectives,
    estimatedBudgetGbp: Math.round(budget),
    budgetNotes: String(raw.budgetNotes || fallback.budgetNotes).trim().slice(0, 2000),
    recommendations: stringList(raw.recommendations, 8, 300).length
      ? stringList(raw.recommendations, 8, 300)
      : fallback.recommendations,
  };
}

function analysisFromLlm(value: unknown, fallback: MockAnalysis): MockAnalysis {
  const raw = asRecord(asRecord(value).analysis);
  const headline = String(raw.headline || "").trim();
  const summary = String(raw.summary || "").trim();
  const strengths = stringList(raw.strengths, 8, 300);
  const weaknesses = stringList(raw.weaknesses, 8, 300);
  if (headline.length < 8 || summary.length < 12 || !strengths.length || !weaknesses.length) {
    return fallback;
  }
  const monthly = Number(raw.estimatedMonthlyBudgetGbp);
  return {
    headline: headline.slice(0, 200),
    summary: summary.slice(0, 2000),
    strengths,
    weaknesses,
    opportunities: stringList(raw.opportunities, 8, 300).length
      ? stringList(raw.opportunities, 8, 300)
      : fallback.opportunities,
    estimatedMonthlyBudgetGbp: Number.isFinite(monthly) && monthly > 0
      ? Math.round(monthly)
      : fallback.estimatedMonthlyBudgetGbp,
  };
}

function brandScanFromLlm(value: unknown, fallback: ReturnType<typeof mockBrandScan>) {
  const raw = asRecord(value);
  const brandVoice = String(raw.brandVoice || "").trim();
  const targetAudience = String(raw.targetAudience || "").trim();
  if (brandVoice.length < 12 || targetAudience.length < 8) return fallback;
  return {
    brandVoice: brandVoice.slice(0, 2000),
    targetAudience: targetAudience.slice(0, 2000),
    styleNotes: String(raw.styleNotes || fallback.styleNotes).trim().slice(0, 2000),
    industry: String(raw.industry || fallback.industry).trim().slice(0, 200),
    objectives: stringList(raw.objectives, 8, 200).length ? stringList(raw.objectives, 8, 200) : fallback.objectives,
    keyMessages: stringList(raw.keyMessages, 8, 200).length ? stringList(raw.keyMessages, 8, 200) : fallback.keyMessages,
    preferredHashtags: stringList(raw.preferredHashtags, 16, 80).length
      ? stringList(raw.preferredHashtags, 16, 80)
      : fallback.preferredHashtags,
    website: String(raw.website || fallback.website).trim().slice(0, 300),
  };
}

function scheduleFromLlm(
  value: unknown,
  allowedIds: Set<string>,
): Array<{ id: string; scheduledFor: string }> | null {
  const record = asRecord(value);
  const rows = Array.isArray(record.items) ? record.items : Array.isArray(value) ? value : [];
  const parsed: Array<{ id: string; scheduledFor: string }> = [];
  for (const row of rows) {
    const item = row && typeof row === "object" ? row as Record<string, unknown> : {};
    const id = String(item.id || "").trim();
    const scheduledFor = String(item.scheduledFor || "").trim();
    if (!allowedIds.has(id) || Number.isNaN(new Date(scheduledFor).getTime())) continue;
    parsed.push({ id, scheduledFor: new Date(scheduledFor).toISOString() });
  }
  return parsed.length ? parsed : null;
}

async function fetchPublicPage(url: string, textLimit = 1500): Promise<{
  url: string;
  title: string;
  description: string;
  headings: string[];
  text: string;
} | null> {
  if (!isSafePublicHttpUrl(url)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "HardyHubMarketingBot/1.0" },
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) return null;
    const raw = (await response.text()).slice(0, 120_000);
    const hints = extractPublicPageHints(raw);
    return {
      url,
      title: hints.title,
      description: hints.description,
      headings: hints.headings,
      text: hints.text.slice(0, textLimit),
    };
  } catch (error) {
    logger.warn("Public page fetch skipped", { url, error });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function competitorPageSnapshots(urls: string[]): Promise<Array<{ url: string; snapshot: string }>> {
  const snapshots: Array<{ url: string; snapshot: string }> = [];
  for (const url of urls) {
    const page = await fetchPublicPage(url, 1500);
    if (page?.text) snapshots.push({ url: page.url, snapshot: page.text });
  }
  return snapshots;
}

async function recentRejectionNotes(companyId: string): Promise<string[]> {
  const snapshot = await admin.firestore()
    .collection(`companies/${companyId}/content`)
    .orderBy("updatedAt", "desc")
    .limit(24)
    .get();
  return snapshot.docs
    .map((item) => item.data())
    .filter((item) => item.status === "rejected" && String(item.rejectionReason || "").trim())
    .slice(0, 6)
    .map((item) => `${String(item.topic || "Post").slice(0, 80)}: ${String(item.rejectionReason).slice(0, 240)}`);
}

async function mapPool<T>(
  items: T[],
  size: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next++;
      await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, run));
}

async function saveGeneratedMarketingImage(
  companyId: string,
  actor: string,
  prompt: string,
  overrides?: MarketingRouteOverrides,
): Promise<{ assetId: string; url: string; storagePath: string; usage: MarketingLlmUsage }> {
  const { buffer, usage } = await generateMarketingImageBuffer({
    prompt,
    secrets: readMarketingSecrets(),
    overrides,
  });
  if (!buffer) {
    throw new HttpsError(
      "failed-precondition",
      "No image provider is configured, or image generation failed. Add GEMINI_API_KEY, OPENAI_API_KEY or XAI_API_KEY.",
    );
  }

  const assetId = randomUUID();
  const storagePath = `companies/${companyId}/marketing/${assetId}.png`;
  const downloadToken = randomUUID();
  const bucket = admin.storage().bucket();
  await bucket.file(storagePath).save(buffer, {
    contentType: "image/png",
    metadata: {
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
        generatedBy: actor,
        aiProvider: usage.provider,
        aiModel: usage.model,
      },
    },
  });
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/` +
    `${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`;
  await admin.firestore().doc(`companies/${companyId}/marketingAssets/${assetId}`).set({
    name: "AI generated marketing image",
    url,
    storagePath,
    mediaType: "image",
    source: "ai_generated",
    tags: ["ai-generated"],
    altText: prompt.slice(0, 300),
    usageNotes: prompt,
    aiProvider: usage.provider,
    aiModel: usage.model,
    aiRouteReason: usage.reason,
    createdBy: actor,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  logger.info("marketing.ai", {
    task: "image",
    companyId,
    provider: usage.provider,
    model: usage.model,
    reason: usage.reason,
  });
  return { assetId, url, storagePath, usage };
}

export const generateMarketingPlan = onCall(
  { secrets: MARKETING_AI_SECRETS, timeoutSeconds: 540, memory: "1GiB" },
  async (request) => {
    const auth = requireMarketingAuth(request);
    const companyId = requireDocumentId(request.data?.companyId, "companyId");
    await requireCompanyEditPermission(auth.uid, companyId);
    let input;
    try {
      input = parseMarketingPlanInput(request.data?.request);
    } catch (error) {
      failValidation(error);
    }

    const db = admin.firestore();
    const [companySnap, profileSnap, campaignSnap, rejectionNotes] = await Promise.all([
      db.doc(`companies/${companyId}`).get(),
      db.doc(`companies/${companyId}/marketing/profile`).get(),
      input.campaignId ? db.doc(`companies/${companyId}/campaigns/${input.campaignId}`).get() : Promise.resolve(null),
      recentRejectionNotes(companyId),
    ]);
    const profile = (profileSnap.data() || {}) as MarketingBrandProfile;
    const companyWebsite = String((companySnap.data()?.contact as { website?: string } | undefined)?.website || "");
    if (!String(profile.website || "").trim() && companyWebsite) {
      profile.website = /^https?:\/\//i.test(companyWebsite) ? companyWebsite : `https://${companyWebsite}`;
    }
    const profileReady = profileSnap.exists && hasMeaningfulMarketingProfile(profile);
    if (!profileReady && hasLiveMarketingKey()) {
      throw new HttpsError(
        "failed-precondition",
        "Complete the brand voice, audience, industry or trading name, and objectives or key messages first — or run Scan brand."
      );
    }
    if (input.campaignId && !campaignSnap?.exists) {
      throw new HttpsError("not-found", "Campaign not found.");
    }

    const count = Math.min(
      MAX_GENERATED_PIECES,
      calculateMarketingPieceCount(input.periodDays, input.postsPerWeek)
    );
    const company = companySnap.data() || {};
    const competitors = splitCompetitorHints(profile.competitors);
    const websiteUrl = cleanOptionalString(profile.website, 300) ||
      companyWebsiteFromRecord(company);
    const pageUrls = [
      ...competitors.urls,
      ...(websiteUrl && isSafePublicHttpUrl(websiteUrl) ? [websiteUrl] : []),
    ].slice(0, 3);
    const pageSnapshots = await competitorPageSnapshots(pageUrls);
    const seasonal = ukSeasonalContext(new Date());
    const systemPrompt = buildMarketingPlanInstructions(count, seasonal);
    const userPrompt = JSON.stringify({
      companyName: company.name || "",
      companyDescription: company.description || "",
      brandProfile: profile,
      cadence: (profile as { cadence?: unknown }).cadence || null,
      competitorNames: competitors.names,
      publicPageSnapshots: pageSnapshots,
      currentThemes: cleanOptionalString(profile.currentThemes, 2000) || "",
      recentRejectionFeedback: rejectionNotes,
      campaign: campaignSnap?.data() || null,
      plan: input,
      requestedPieceCount: count,
      notes: [
        "Public page snapshots are homepage text only. Do not invent Instagram or Facebook posts you have not seen.",
        "If rejection feedback is present, do not repeat those mistakes.",
        input.includeArticles ? "Include LinkedIn or long-form articles where the cadence asks for them." : "",
        input.controversialTheme ? `Include professional opinion pieces on: ${input.controversialTheme}` : "",
      ].filter(Boolean),
    });
    const hubInput = hubInputFromRecords(company, profile, {
      periodDays: input.periodDays,
      postsPerWeek: input.postsPerWeek,
      platforms: input.platforms,
      focus: input.focus,
      includeArticles: input.includeArticles,
    });
    const mockPieces = mockContentBatch(hubInput, count);
    const mockAnalysis = mockPresenceAnalysis(hubInput);
    const mockPlan = mockMarketingPlan(hubInput, mockAnalysis);
    const overrides = routeOverridesFromInput(input);
    const generatedPlan = await generateMarketingJson({
      task: "plan",
      system: systemPrompt,
      user: userPrompt,
      secrets: readMarketingSecrets(),
      overrides,
      mockGenerate: () => ({
        pieces: mockPieces,
        plan: mockPlan,
        analysis: mockAnalysis,
      }),
    });
    let generated = piecesFromLlm(generatedPlan.value, count);
    let usage = generatedPlan.usage;
    if (!generated) {
      logger.warn("Marketing plan JSON was incomplete; using demo pieces", {
        provider: usage.provider,
        model: usage.model,
      });
      generated = mockPieces.map(generatedFromMock);
      usage = {
        provider: MARKETING_MOCK_PROVIDER,
        model: MARKETING_MOCK_MODEL,
        relativeCost: 0,
        reason: "Live plan JSON was incomplete; demo pieces used",
      };
    }
    const provider = usage.provider;
    const model = usage.model;
    const analysis = analysisFromLlm(generatedPlan.value, mockAnalysis);
    const plan = planFromLlm(generatedPlan.value, mockPlan);
    logger.info("marketing.ai", {
      task: "plan",
      companyId,
      provider,
      model,
      reason: usage.reason,
      count: generated.length,
    });

    const collectionRef = db.collection(`companies/${companyId}/content`);
    const batch = db.batch();
    const created: Array<{ id: string; prompt: string }> = [];
    generated.forEach((piece, index) => {
      const ref = collectionRef.doc();
      created.push({
        id: ref.id,
        prompt: String(piece.aiImagePrompt || "").trim(),
      });
      const requestedPlatform = String(piece.platform || "").toLowerCase() as MarketingPlatform;
      const platform = input.platforms.includes(requestedPlatform) ?
        requestedPlatform : input.platforms[index % input.platforms.length];
      const scheduledFor = provider === MARKETING_MOCK_PROVIDER && mockPieces[index]
        ? mockPieces[index].scheduledFor
        : scheduledDate(index, count, input.periodDays);
      batch.set(ref, completeContentPiece(
        piece,
        platform,
        input.campaignId || "",
        scheduledFor,
        auth.uid,
        provider,
        model,
        usage.reason,
      ));
    });
    batch.set(db.doc(`companies/${companyId}/marketing/plan`), {
      ...plan,
      source: provider,
      aiProvider: provider,
      aiModel: model,
      aiRouteReason: usage.reason,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    batch.set(db.doc(`companies/${companyId}/marketing/analysis`), {
      ...analysis,
      source: provider,
      aiProvider: provider,
      aiModel: model,
      aiRouteReason: usage.reason,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await batch.commit();

    let imagesCreated = 0;
    if (input.includeImages && provider !== MARKETING_MOCK_PROVIDER) {
      await mapPool(created.slice(0, MAX_PLAN_IMAGES), IMAGE_CONCURRENCY, async (item) => {
        if (item.prompt.length < 10) return;
        try {
          const asset = await saveGeneratedMarketingImage(companyId, auth.uid, item.prompt, overrides);
          await db.doc(`companies/${companyId}/content/${item.id}`).update({
            assetIds: [asset.assetId],
            updatedAt: FieldValue.serverTimestamp(),
          });
          imagesCreated += 1;
        } catch (error) {
          logger.warn("Plan image generation failed", { contentId: item.id, error });
        }
      });
    }

    if ((profileSnap.data() as { approvalRequired?: boolean } | undefined)?.approvalRequired === false) {
      for (const item of created) {
        const pieceRef = db.doc(`companies/${companyId}/content/${item.id}`);
        const piece = (await pieceRef.get()).data() || {};
        const scheduled = new Date(String(piece.scheduledFor || "")).getTime() > Date.now();
        await pieceRef.update({
          status: scheduled ? "scheduled" : "approved",
          approvedVersion: 1,
          approvedAt: new Date().toISOString(),
          approvedBy: auth.uid,
        });
        if (scheduled) {
          await db.doc(`marketingPublishJobs/${companyId}_${item.id}_v1`).set({
            companyId,
            contentId: item.id,
            platform: piece.platform,
            approvalVersion: 1,
            status: "queued",
            dueAt: Timestamp.fromDate(new Date(String(piece.scheduledFor))),
            attempts: 0,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        }
      }
    }

    logger.info("Generated marketing plan", {
      companyId,
      uid: auth.uid,
      count: created.length,
      imagesCreated,
    });
    const imageNote = input.includeImages
      ? imagesCreated
        ? `, with ${imagesCreated} picture${imagesCreated === 1 ? "" : "s"}`
        : ". Pictures could not be attached this time"
      : "";
    const skipReview = profileSnap.data()?.approvalRequired === false;
    if (skipReview) {
      for (const item of created) {
        const pieceSnap = await db.doc(`companies/${companyId}/content/${item.id}`).get();
        const piece = pieceSnap.data() || {};
        const scheduledFor = String(piece.scheduledFor || "");
        const when = new Date(scheduledFor).getTime();
        const status = when > Date.now() ? "scheduled" : "approved";
        await pieceSnap.ref.update({
          status,
          approvedVersion: 1,
          approvedAt: new Date().toISOString(),
          approvedBy: auth.uid,
        });
        if (when > Date.now()) {
          await db.doc(`marketingPublishJobs/${companyId}_${item.id}_v1`).set({
            companyId,
            contentId: item.id,
            platform: piece.platform || input.platforms[0],
            approvalVersion: 1,
            status: "queued",
            dueAt: Timestamp.fromDate(new Date(scheduledFor)),
            attempts: 0,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        }
      }
    }

    return {
      created: created.length,
      contentIds: created.map((item) => item.id),
      imagesCreated,
      source: provider,
      summary: skipReview
        ? `Created ${created.length} posts and queued them over ${input.periodDays} days${imageNote}.`
        : `Created ${created.length} posts for review over ${input.periodDays} days${imageNote}.`,
    };
  }
);

const AUDIT_IMPACT = ["high", "medium", "low"] as const;

function stringArray(value: unknown, maximumItems: number, maximumLength: number): string[] {
  return stringList(value, maximumItems, maximumLength);
}

function suggestedBrandFromAudit(value: unknown) {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    brandVoice: String(raw.brandVoice || "").trim().slice(0, 2000),
    targetAudience: String(raw.targetAudience || "").trim().slice(0, 2000),
    industry: String(raw.industry || "").trim().slice(0, 200),
    objectives: stringArray(raw.objectives, 8, 200),
    keyMessages: stringArray(raw.keyMessages, 8, 200),
    preferredHashtags: stringArray(raw.preferredHashtags, 16, 80),
  };
}

function applySuggestedBrand(
  current: Record<string, unknown>,
  suggested: ReturnType<typeof suggestedBrandFromAudit>,
): { profile: Record<string, unknown>; filledFields: string[] } {
  const next = { ...current };
  const filledFields: string[] = [];
  const emptyString = (value: unknown) => typeof value !== "string" || value.trim().length < 3;
  const emptyList = (value: unknown) => !Array.isArray(value) || value.length === 0;
  if (emptyString(next.brandVoice) && suggested.brandVoice) { next.brandVoice = suggested.brandVoice; filledFields.push("brandVoice"); }
  if (emptyString(next.targetAudience) && suggested.targetAudience) { next.targetAudience = suggested.targetAudience; filledFields.push("targetAudience"); }
  if (emptyString(next.industry) && suggested.industry) { next.industry = suggested.industry; filledFields.push("industry"); }
  if (emptyList(next.objectives) && suggested.objectives.length) { next.objectives = suggested.objectives; filledFields.push("objectives"); }
  if (emptyList(next.keyMessages) && suggested.keyMessages.length) { next.keyMessages = suggested.keyMessages; filledFields.push("keyMessages"); }
  if (emptyList(next.preferredHashtags) && suggested.preferredHashtags.length) {
    next.preferredHashtags = suggested.preferredHashtags;
    filledFields.push("preferredHashtags");
  }
  return { profile: next, filledFields };
}

function completeMarketingAudit(
  raw: Record<string, unknown>,
  sources: string[],
  actor: string,
  usage?: MarketingLlmUsage,
) {
  const search = raw.search && typeof raw.search === "object" ? raw.search as Record<string, unknown> : {};
  const ads = raw.ads && typeof raw.ads === "object" ? raw.ads as Record<string, unknown> : {};
  const social = raw.social && typeof raw.social === "object" ? raw.social as Record<string, unknown> : {};
  const website = raw.website && typeof raw.website === "object" ? raw.website as Record<string, unknown> : {};
  const opportunities = Array.isArray(raw.opportunities) ? raw.opportunities : [];
  return {
    headline: String(raw.headline || "Weekly PR audit").trim().slice(0, 200),
    executiveSummary: String(raw.executiveSummary || "").trim().slice(0, 4000),
    search: {
      demand: String(search.demand || "").trim().slice(0, 2000),
      match: String(search.match || "").trim().slice(0, 2000),
      ranking: String(search.ranking || "").trim().slice(0, 2000),
      queries: stringArray(search.queries, 12, 120),
    },
    ads: {
      performance: String(ads.performance || "").trim().slice(0, 2000),
      caveats: String(ads.caveats || "").trim().slice(0, 2000),
    },
    social: {
      performance: String(social.performance || "").trim().slice(0, 2000),
      popularTopics: stringArray(social.popularTopics, 12, 120),
    },
    website: {
      strengths: stringArray(website.strengths, 8, 300),
      gaps: stringArray(website.gaps, 8, 300),
    },
    suggestedBrand: suggestedBrandFromAudit(raw.suggestedBrand),
    opportunities: opportunities.slice(0, 8).map((item) => {
      const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
      const impact = AUDIT_IMPACT.includes(String(row.impact) as typeof AUDIT_IMPACT[number])
        ? String(row.impact)
        : "medium";
      return {
        title: String(row.title || "Next move").trim().slice(0, 160),
        why: String(row.why || "").trim().slice(0, 800),
        action: String(row.action || "").trim().slice(0, 800),
        impact,
      };
    }),
    sources: stringArray(raw.sources, 16, 300).length ? stringArray(raw.sources, 16, 300) : sources,
    limitations: stringArray(raw.limitations, 10, 300),
    createdBy: actor,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    aiProvider: usage?.provider || MARKETING_MOCK_PROVIDER,
    aiModel: usage?.model || MARKETING_MOCK_MODEL,
    aiRouteReason: usage?.reason || "",
  };
}

function auditLooksComplete(value: unknown): value is Record<string, unknown> {
  const parsed = asRecord(value);
  return Boolean(String(parsed.executiveSummary || "").trim()) && Array.isArray(parsed.opportunities);
}

export const generateMarketingAudit = onCall(
  { secrets: MARKETING_AI_SECRETS, timeoutSeconds: 180, memory: "512MiB" },
  async (request) => {
    const auth = requireMarketingAuth(request);
    const companyId = requireDocumentId(request.data?.companyId, "companyId");
    await requireCompanyEditPermission(auth.uid, companyId);
    let input;
    try {
      input = parseMarketingAuditInput(request.data?.request);
    } catch (error) {
      failValidation(error);
    }

    const db = admin.firestore();
    const [companySnap, profileSnap, contentSnap, campaignSnap] = await Promise.all([
      db.doc(`companies/${companyId}`).get(),
      db.doc(`companies/${companyId}/marketing/profile`).get(),
      db.collection(`companies/${companyId}/content`).orderBy("updatedAt", "desc").limit(24).get(),
      db.collection(`companies/${companyId}/campaigns`).limit(20).get(),
    ]);
    const profile = (profileSnap.data() || {}) as MarketingBrandProfile;
    const websiteUrl = cleanOptionalString(profile.website, 300) ||
      companyWebsiteFromRecord(companySnap.data() || {});
    const competitors = splitCompetitorHints(profile.competitors);
    const extraNotes = [input.searchNotes, input.adsNotes, input.socialNotes, input.otherNotes]
      .some((item) => item.trim().length >= 8);
    const hasOwnerContext = Boolean(
      cleanOptionalString(profile.prStrategy, 4000) || cleanOptionalString(profile.marketingSpendSummary, 2000),
    );
    if (
      !hasMeaningfulMarketingProfile(profile) &&
      !(websiteUrl && isSafePublicHttpUrl(websiteUrl)) &&
      input.extraUrls.length === 0 &&
      !extraNotes &&
      !hasOwnerContext
    ) {
      throw new HttpsError(
        "failed-precondition",
        "Add a website, brand guidance, extra links, or pasted Search Console / ads / social notes first."
      );
    }

    const pageUrls = [
      ...(websiteUrl && isSafePublicHttpUrl(websiteUrl) ? [websiteUrl] : []),
      ...competitors.urls,
      ...input.extraUrls,
    ].filter((url, index, list) => list.indexOf(url) === index).slice(0, 6);
    const publicPages = [];
    for (const url of pageUrls) {
      const page = await fetchPublicPage(url, url === websiteUrl ? 3500 : 1500);
      if (page) publicPages.push(page);
    }

    const content = contentSnap.docs.map((item) => {
      const data = item.data();
      return {
        topic: String(data.topic || "").slice(0, 120),
        platform: String(data.platform || ""),
        status: String(data.status || ""),
        rejectionReason: String(data.rejectionReason || "").slice(0, 200),
      };
    });
    const campaigns = campaignSnap.docs.map((item) => {
      const data = item.data();
      return {
        name: String(data.name || "").slice(0, 120),
        objective: String(data.objective || "").slice(0, 200),
        status: String(data.status || ""),
        platforms: Array.isArray(data.platforms) ? data.platforms.slice(0, 6) : [],
      };
    });

    const sources = [
      publicPages.length ? `${publicPages.length} public page${publicPages.length === 1 ? "" : "s"}` : "",
      hasMeaningfulMarketingProfile(profile) ? "brand guidance" : "",
      content.length ? "Hardy Hub social posts" : "",
      extraNotes ? "pasted Search Console, ads or social notes" : "",
    ].filter(Boolean);
    const seasonal = ukSeasonalContext(new Date());
    const hubInput = hubInputFromRecords(companySnap.data() || {}, profile);
    const generatedAudit = await generateMarketingJson({
      task: "analysis",
      system: buildMarketingAuditInstructions(seasonal),
      user: JSON.stringify({
        companyName: companySnap.data()?.name || "",
        companyDescription: companySnap.data()?.description || "",
        brandProfile: profile,
        competitorNames: competitors.names,
        publicPages,
        workspaceContent: content,
        campaigns,
        suppliedNotes: {
          searchConsole: input.searchNotes,
          googleAds: input.adsNotes,
          social: input.socialNotes,
          other: input.otherNotes,
        },
        connectedLiveData: {
          googleSearchConsole: false,
          googleAds: false,
          metaOrLinkedInAnalytics: false,
        },
      }),
      secrets: readMarketingSecrets(),
      mockGenerate: () => mockMarketingAudit(hubInput),
    });
    const generated = auditLooksComplete(generatedAudit.value)
      ? asRecord(generatedAudit.value)
      : mockMarketingAudit(hubInput);
    const usage = auditLooksComplete(generatedAudit.value)
      ? generatedAudit.usage
      : {
        provider: MARKETING_MOCK_PROVIDER,
        model: MARKETING_MOCK_MODEL,
        relativeCost: 0,
        reason: "Live audit JSON was incomplete; demo audit used",
      } satisfies MarketingLlmUsage;

    const audit = completeMarketingAudit(generated, sources, auth.uid, usage);
    const ref = db.collection(`companies/${companyId}/marketingAudits`).doc();
    await ref.set(audit);
    const profileRef = db.doc(`companies/${companyId}/marketing/profile`);
    const { profile: applied, filledFields } = applySuggestedBrand(profileSnap.data() || {}, audit.suggestedBrand);
    const tradingNames = Array.isArray(applied.tradingNames) && applied.tradingNames.length
      ? applied.tradingNames
      : [String(companySnap.data()?.name || "").trim()].filter(Boolean);
    await profileRef.set({
      ...applied,
      website: websiteUrl || applied.website || "",
      tradingNames,
      aiSuggestedFields: filledFields,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    logger.info("marketing.ai", {
      task: "analysis",
      companyId,
      uid: auth.uid,
      auditId: ref.id,
      provider: usage.provider,
      model: usage.model,
      reason: usage.reason,
      filledFields,
    });
    return {
      auditId: ref.id,
      headline: audit.headline,
      brandApplied: true,
      filledFields,
      source: usage.provider,
      aiModel: usage.model,
    };
  }
);

export const approveMarketingContent = onCall(async (request) => {
  const auth = requireMarketingAuth(request);
  const companyId = requireDocumentId(request.data?.companyId, "companyId");
  const contentId = requireDocumentId(request.data?.contentId, "contentId");
  let requestedVersion: number;
  try {
    requestedVersion = parseApprovalVersion(request.data?.approvalVersion);
  } catch (error) {
    failValidation(error);
  }
  await requireCompanyEditPermission(auth.uid, companyId);
  const db = admin.firestore();
  const contentRef = db.doc(`companies/${companyId}/content/${contentId}`);
  const result = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(contentRef);
    if (!snapshot.exists) throw new HttpsError("not-found", "Content not found.");
    const content = snapshot.data() || {};
    if (content.status !== "awaiting_approval" || content.approvalVersion !== requestedVersion) {
      throw new HttpsError("failed-precondition", "This content changed after it was loaded. Review the latest version.");
    }
    const scheduled = new Date(String(content.scheduledFor || "")).getTime() > Date.now();
    const status = scheduled ? "scheduled" : "approved";
    transaction.update(contentRef, {
      status,
      approvedVersion: requestedVersion,
      approvedAt: new Date().toISOString(),
      approvedBy: auth.uid,
      publishError: "",
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (scheduled) {
      const jobId = deterministicJobId(companyId, contentId, requestedVersion);
      transaction.set(db.doc(`marketingPublishJobs/${jobId}`), {
        companyId,
        contentId,
        platform: content.platform,
        approvalVersion: requestedVersion,
        status: "queued",
        dueAt: Timestamp.fromDate(new Date(content.scheduledFor)),
        attempts: 0,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    return status;
  });
  return { status: result };
});

export const rejectMarketingContent = onCall(async (request) => {
  const auth = requireMarketingAuth(request);
  const companyId = requireDocumentId(request.data?.companyId, "companyId");
  const contentId = requireDocumentId(request.data?.contentId, "contentId");
  const reason = cleanOptionalString(request.data?.reason, 1000);
  if (!reason) throw new HttpsError("invalid-argument", "A rejection reason is required.");
  let requestedVersion: number;
  try {
    requestedVersion = parseApprovalVersion(request.data?.approvalVersion);
  } catch (error) {
    failValidation(error);
  }
  await requireCompanyEditPermission(auth.uid, companyId);
  const ref = admin.firestore().doc(`companies/${companyId}/content/${contentId}`);
  await admin.firestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new HttpsError("not-found", "Content not found.");
    const content = snapshot.data() || {};
    if (content.status !== "awaiting_approval" || content.approvalVersion !== requestedVersion) {
      throw new HttpsError("failed-precondition", "This content changed after it was loaded. Review the latest version.");
    }
    transaction.update(ref, {
      status: "rejected",
      rejectedAt: new Date().toISOString(),
      rejectedBy: auth.uid,
      rejectionReason: reason,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return { status: "rejected" as const };
});

export const publishMarketingContentNow = onCall(async (request) => {
  const auth = requireMarketingAuth(request);
  const companyId = requireDocumentId(request.data?.companyId, "companyId");
  const contentId = requireDocumentId(request.data?.contentId, "contentId");
  let requestedVersion: number;
  try {
    requestedVersion = parseApprovalVersion(request.data?.approvalVersion);
  } catch (error) {
    failValidation(error);
  }
  await requireCompanyEditPermission(auth.uid, companyId);
  const db = admin.firestore();
  const contentRef = db.doc(`companies/${companyId}/content/${contentId}`);
  const queued = await db.runTransaction(async (transaction) => {
    const jobId = deterministicJobId(companyId, contentId, requestedVersion);
    const jobRef = db.doc(`marketingPublishJobs/${jobId}`);
    const [snapshot, existingJob] = await Promise.all([
      transaction.get(contentRef),
      transaction.get(jobRef),
    ]);
    if (!snapshot.exists) throw new HttpsError("not-found", "Content not found.");
    const content = snapshot.data() || {};
    const statusAllowed = content.status === "approved" || content.status === "scheduled";
    const exactVersion = content.approvalVersion === requestedVersion &&
      content.approvedVersion === requestedVersion;
    if (!statusAllowed || !exactVersion) {
      throw new HttpsError("failed-precondition", "Only the currently approved version can be published.");
    }
    if (existingJob.data()?.status === "processing") return true;
    if (existingJob.data()?.status === "published") {
      throw new HttpsError("already-exists", "This approved version has already been published.");
    }
    transaction.set(jobRef, {
      companyId,
      contentId,
      platform: content.platform,
      approvalVersion: requestedVersion,
      status: "queued",
      dueAt: Timestamp.now(),
      requestedBy: auth.uid,
      queuedReason: "publish_now",
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return true;
  });
  return { queued };
});

async function finishBlockedJob(
  jobRef: admin.firestore.DocumentReference,
  contentRef: admin.firestore.DocumentReference,
  claimId: string,
  message: string
): Promise<void> {
  await admin.firestore().runTransaction(async (transaction) => {
    const [currentJob, currentContent] = await Promise.all([
      transaction.get(jobRef),
      transaction.get(contentRef),
    ]);
    if (currentJob.data()?.status !== "processing" || currentJob.data()?.claimId !== claimId) return;
    transaction.update(jobRef, {
      status: "blocked",
      error: message,
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (currentContent.exists) {
      transaction.update(contentRef, {
        status: "failed",
        publishError: message,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  });
}

/**
 * Phase 1 default: dry-run. Live connectors already sketched below:
 * - LinkedIn: userinfo + ugcPosts with marketingPlatformCredentials accessToken
 * - Facebook / Instagram: Graph me/accounts + page feed (Instagram still needs media)
 * - Google / YouTube / TikTok: not implemented — return a clear error once live publish is on
 * Gate: MARKETING_LIVE_PUBLISH=true on the Cloud Function.
 */
async function publishToSocialPlatform(
  platform: string,
  credential: Record<string, unknown>,
  caption: string,
): Promise<{ id: string; url: string; mode: "live" | "dry_run" }> {
  const provider = String(credential.provider || "");
  const token = String(credential.accessToken || "");
  if (!livePublishEnabled() || provider === "test" || provider === "dry_run") {
    return {
      id: `dry-run_${Date.now()}`,
      url: `https://hardy.local/dry-run/${platform}/${Date.now()}`,
      mode: "dry_run",
    };
  }
  if (!token) {
    throw new Error("This account is saved as a profile only. Tap Connect in app so Hardy Hub can post.");
  }
  if (provider === "linkedin" || platform === "linkedin") {
    const me = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const profile = await me.json() as { sub?: string };
    if (!me.ok || !profile.sub) throw new Error("LinkedIn login expired. Connect LinkedIn again.");
    const posted = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author: `urn:li:person:${profile.sub}`,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text: caption.slice(0, 3000) },
            shareMediaCategory: "NONE",
          },
        },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      }),
    });
    if (!posted.ok) throw new Error("LinkedIn did not accept that post.");
    const id = posted.headers.get("x-restli-id") || `linkedin_${Date.now()}`;
    return { id, url: `https://www.linkedin.com/feed/update/${encodeURIComponent(id)}`, mode: "live" };
  }
  if (provider === "meta" || platform === "facebook" || platform === "instagram") {
    const accounts = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${encodeURIComponent(token)}`);
    const pages = await accounts.json() as { data?: Array<{ id: string; access_token: string; instagram_business_account?: { id: string } }> };
    const page = pages.data?.[0];
    if (!accounts.ok || !page) throw new Error("No Facebook Page found on that login. Connect a Page, then try again.");
    if (platform === "instagram") {
      throw new Error("Instagram posting needs a photo on the post. Attach media, then Post now.");
    }
    const posted = await fetch(`https://graph.facebook.com/v21.0/${page.id}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: caption.slice(0, 5000), access_token: page.access_token }),
    });
    const body = await posted.json() as { id?: string; error?: { message?: string } };
    if (!posted.ok || !body.id) throw new Error(body.error?.message || "Facebook did not accept that post.");
    return { id: body.id, url: `https://www.facebook.com/${body.id}`, mode: "live" };
  }
  throw new Error(`Autopost for ${platform} is not live yet. The post is approved — copy it from the queue or connect that app.`);
}

async function processClaimedJob(
  jobRef: admin.firestore.DocumentReference,
  job: MarketingJob,
  claimId: string
): Promise<void> {
  const db = admin.firestore();
  const contentRef = db.doc(`companies/${job.companyId}/content/${job.contentId}`);
  const [contentSnap, directConnection, matchingConnections, directCredential, companyCredentials] = await Promise.all([
    contentRef.get(),
    db.doc(`companies/${job.companyId}/platformConnections/${job.platform}`).get(),
    db.collection(`companies/${job.companyId}/platformConnections`)
      .where("platform", "==", job.platform)
      .limit(10)
      .get(),
    db.doc(`marketingPlatformCredentials/${job.companyId}_${job.platform}`).get(),
    db.collection("marketingPlatformCredentials")
      .where("companyId", "==", job.companyId)
      .limit(20)
      .get(),
  ]);
  const content = contentSnap.data() || {};
  const currentApproval = content.approvalVersion === job.approvalVersion &&
    content.approvedVersion === job.approvalVersion;
  const publishable = content.status === "publishing";
  if (!contentSnap.exists || !currentApproval || !publishable) {
    await finishBlockedJob(jobRef, contentRef, claimId, "Approval is no longer current; publishing was cancelled.");
    return;
  }
  const connection = directConnection.data()?.status === "connected" ?
    directConnection.data() :
    matchingConnections.docs.find((snapshot) => snapshot.data().status === "connected")?.data();
  const credential = directCredential.exists ?
    directCredential.data() :
    companyCredentials.docs.find((snapshot) => snapshot.data().platform === job.platform)?.data();
  if (livePublishEnabled() && connection?.status !== "connected") {
    await finishBlockedJob(
      jobRef,
      contentRef,
      claimId,
      "Link this account in Social & Ads (Connect in app), then approve again."
    );
    return;
  }

  let externalPostId = "";
  let externalPostUrl = "";
  let publishMode: "live" | "dry_run" = "dry_run";
  try {
    const posted = await publishToSocialPlatform(
      String(job.platform),
      credential || { provider: "dry_run" },
      String(content.refinedDraft || content.draft || ""),
    );
    externalPostId = posted.id;
    externalPostUrl = posted.url;
    publishMode = posted.mode;
  } catch (error) {
    logger.error("Social publish failed", { jobId: jobRef.id, error });
    await finishBlockedJob(
      jobRef,
      contentRef,
      claimId,
      error instanceof Error ? error.message : "Publishing failed. No post was sent."
    );
    return;
  }
  await db.runTransaction(async (transaction) => {
    const [latestJob, latestContent] = await Promise.all([
      transaction.get(jobRef),
      transaction.get(contentRef),
    ]);
    const latest = latestContent.data() || {};
    if (latestJob.data()?.status !== "processing" || latestJob.data()?.claimId !== claimId) return;
    const stillCurrent = latest.approvalVersion === job.approvalVersion &&
      latest.approvedVersion === job.approvalVersion &&
      latest.status === "publishing";
    if (!stillCurrent) {
      transaction.update(jobRef, {
        status: "blocked",
        error: "Approval changed during publishing; no post was sent.",
        updatedAt: FieldValue.serverTimestamp(),
      });
      return;
    }
    transaction.update(jobRef, {
      status: "published",
      externalPostId,
      externalPostUrl,
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.update(contentRef, {
      status: "published",
      publishedAt: new Date().toISOString(),
      externalPostId,
      externalPostUrl,
      publishMode,
      publishAttempts: FieldValue.increment(1),
      publishError: "",
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

export async function processDueMarketingJobs(): Promise<void> {
    const db = admin.firestore();
    const now = Timestamp.now();
    const queued = await db.collection("marketingPublishJobs")
      .where("status", "==", "queued")
      .limit(100)
      .get();
    const due = queued.docs.filter((snapshot) => {
      const dueAt = snapshot.data().dueAt;
      return dueAt instanceof Timestamp && dueAt.toMillis() <= now.toMillis();
    }).slice(0, 25);

    for (const snapshot of due) {
      const claimId = randomUUID();
      const claimed = await db.runTransaction(async (transaction) => {
        const initialJob = snapshot.data() as MarketingJob;
        const contentRef = db.doc(
          `companies/${initialJob.companyId}/content/${initialJob.contentId}`
        );
        const [current, currentContent] = await Promise.all([
          transaction.get(snapshot.ref),
          transaction.get(contentRef),
        ]);
        const job = current.data() as MarketingJob | undefined;
        if (!job || job.status !== "queued" || !job.dueAt || job.dueAt.toMillis() > Date.now()) return null;
        const content = currentContent.data() || {};
        const approvalCurrent = content.approvalVersion === job.approvalVersion &&
          content.approvedVersion === job.approvalVersion;
        const statusCurrent = content.status === "approved" || content.status === "scheduled";
        if (!currentContent.exists || !approvalCurrent || !statusCurrent) {
          transaction.update(snapshot.ref, {
            status: "blocked",
            error: "Approval is no longer current; publishing was cancelled.",
            updatedAt: FieldValue.serverTimestamp(),
          });
          return null;
        }
        transaction.update(snapshot.ref, {
          status: "processing",
          claimId,
          claimedAt: FieldValue.serverTimestamp(),
          attempts: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.update(contentRef, {
          status: "publishing",
          publishError: "",
          updatedAt: FieldValue.serverTimestamp(),
        });
        return job;
      });
      if (!claimed) continue;
      try {
        await processClaimedJob(snapshot.ref, claimed, claimId);
      } catch (error) {
        logger.error("Marketing publish job failed", { jobId: snapshot.id, error });
        await finishBlockedJob(
          snapshot.ref,
          db.doc(`companies/${claimed.companyId}/content/${claimed.contentId}`),
          claimId,
          "Publishing failed safely. No successful post was recorded."
        );
      }
    }
}

export const processMarketingPublishJobs = onSchedule(
  { schedule: "every 1 minutes", timeZone: TIMEZONE, timeoutSeconds: 60 },
  processDueMarketingJobs
);

export const generateMarketingImage = onCall(
  { secrets: MARKETING_AI_SECRETS, timeoutSeconds: 180, memory: "1GiB" },
  async (request) => {
    const auth = requireMarketingAuth(request);
    const companyId = requireDocumentId(request.data?.companyId, "companyId");
    const prompt = cleanOptionalString(request.data?.prompt, 3000);
    if (!prompt || prompt.length < 10) {
      throw new HttpsError("invalid-argument", "A meaningful image prompt is required.");
    }
    await requireCompanyEditPermission(auth.uid, companyId);
    return saveGeneratedMarketingImage(
      companyId,
      auth.uid,
      prompt,
      routeOverridesFromInput(request.data),
    );
  }
);

export const scanMarketingBrand = onCall({ secrets: MARKETING_AI_SECRETS }, async (request) => {
  const auth = requireMarketingAuth(request);
  const companyId = requireDocumentId(request.data?.companyId, "companyId");
  await requireCompanyEditPermission(auth.uid, companyId);
  const db = admin.firestore();
  const [companySnap, profileSnap] = await Promise.all([
    db.doc(`companies/${companyId}`).get(),
    db.doc(`companies/${companyId}/marketing/profile`).get(),
  ]);
  const company = companySnap.data() || {};
  const profile = (profileSnap.data() || {}) as MarketingBrandProfile;
  const hubInput = hubInputFromRecords(company, profile);
  const mockScan = mockBrandScan(hubInput);
  const generated = await generateMarketingJson({
    task: "brand_scan",
    system: [
      "You infer a British brand voice from a company name, website and notes.",
      "Return JSON only: brandVoice, targetAudience, styleNotes, industry, objectives, keyMessages, preferredHashtags, website.",
      "Do not invent awards, prices or reviews. Keep copy short and specific.",
    ].join(" "),
    user: JSON.stringify(hubInput),
    secrets: readMarketingSecrets(),
    overrides: routeOverridesFromInput(request.data),
    mockGenerate: () => mockScan,
  });
  const scan = brandScanFromLlm(generated.value, mockScan);
  const usage = generated.usage;
  const emptyString = (value: unknown) => typeof value !== "string" || value.trim().length < 3;
  const emptyList = (value: unknown) => !Array.isArray(value) || value.length === 0;
  const filledFields: string[] = [];
  const next: Record<string, unknown> = { ...profile };
  if (emptyString(next.brandVoice)) { next.brandVoice = scan.brandVoice; filledFields.push("brandVoice"); }
  if (emptyString(next.targetAudience)) { next.targetAudience = scan.targetAudience; filledFields.push("targetAudience"); }
  if (emptyString(next.styleNotes)) { next.styleNotes = scan.styleNotes; filledFields.push("styleNotes"); }
  if (emptyString(next.industry)) { next.industry = scan.industry; filledFields.push("industry"); }
  if (emptyList(next.objectives)) { next.objectives = scan.objectives; filledFields.push("objectives"); }
  if (emptyList(next.keyMessages)) { next.keyMessages = scan.keyMessages; filledFields.push("keyMessages"); }
  if (emptyList(next.preferredHashtags)) { next.preferredHashtags = scan.preferredHashtags; filledFields.push("preferredHashtags"); }
  if (emptyString(next.website) && scan.website) next.website = scan.website;
  await db.doc(`companies/${companyId}/marketing/profile`).set({
    ...next,
    tradingNames: Array.isArray(next.tradingNames) && (next.tradingNames as string[]).length
      ? next.tradingNames
      : [String(company.name || "").trim()].filter(Boolean),
    aiSuggestedFields: filledFields,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await db.doc(`companies/${companyId}/marketing/scan`).set({
    ...scan,
    source: usage.provider,
    aiProvider: usage.provider,
    aiModel: usage.model,
    aiRouteReason: usage.reason,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  logger.info("marketing.ai", {
    task: "brand_scan",
    companyId,
    provider: usage.provider,
    model: usage.model,
    reason: usage.reason,
  });
  return {
    headline: `Brand scan ready for ${String(company.name || "this company")}`,
    filledFields,
    source: usage.provider,
    aiModel: usage.model,
  };
});

export const analyseMarketingPresence = onCall({ secrets: MARKETING_AI_SECRETS }, async (request) => {
  const auth = requireMarketingAuth(request);
  const companyId = requireDocumentId(request.data?.companyId, "companyId");
  await requireCompanyEditPermission(auth.uid, companyId);
  const db = admin.firestore();
  const [companySnap, profileSnap] = await Promise.all([
    db.doc(`companies/${companyId}`).get(),
    db.doc(`companies/${companyId}/marketing/profile`).get(),
  ]);
  const input = hubInputFromRecords(companySnap.data() || {}, (profileSnap.data() || {}) as MarketingBrandProfile);
  const mockAnalysis = mockPresenceAnalysis(input);
  const generated = await generateMarketingJson({
    task: "analysis",
    system: [
      "You write a short UK SWOT for a family-run brand.",
      "Return JSON: headline, summary, strengths, weaknesses, opportunities, estimatedMonthlyBudgetGbp.",
      "Budget is indicative GBP only. Do not invent live analytics.",
    ].join(" "),
    user: JSON.stringify(input),
    secrets: readMarketingSecrets(),
    overrides: routeOverridesFromInput(request.data),
    mockGenerate: () => mockAnalysis,
  });
  const analysis = analysisFromLlm({ analysis: generated.value }, mockAnalysis);
  const usage = generated.usage;
  await db.doc(`companies/${companyId}/marketing/analysis`).set({
    ...analysis,
    source: usage.provider,
    aiProvider: usage.provider,
    aiModel: usage.model,
    aiRouteReason: usage.reason,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await db.doc(`companies/${companyId}/marketing/plan`).set({
    strengths: analysis.strengths,
    weaknesses: analysis.weaknesses,
    estimatedBudgetGbp: analysis.estimatedMonthlyBudgetGbp * Math.max(1, Math.round(input.periodDays / 30)),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  logger.info("marketing.ai", {
    task: "analysis",
    companyId,
    provider: usage.provider,
    model: usage.model,
    reason: usage.reason,
  });
  return { headline: analysis.headline, source: usage.provider, aiModel: usage.model };
});

export const suggestMarketingSchedule = onCall({ secrets: MARKETING_AI_SECRETS }, async (request) => {
  const auth = requireMarketingAuth(request);
  const companyId = requireDocumentId(request.data?.companyId, "companyId");
  await requireCompanyEditPermission(auth.uid, companyId);
  const periodDays = Number(request.data?.periodDays || 60);
  if (!Number.isInteger(periodDays) || periodDays < 7 || periodDays > 90) {
    throw new HttpsError("invalid-argument", "periodDays must be a whole number from 7 to 90.");
  }
  const db = admin.firestore();
  const snap = await db.collection(`companies/${companyId}/content`).get();
  const items = snap.docs.map((item) => {
    const data = item.data();
    return {
      id: item.id,
      status: String(data.status || ""),
      platform: String(data.platform || ""),
      approvalVersion: Number(data.approvalVersion || 0),
    };
  }).filter((item) => ["awaiting_approval", "draft", "approved"].includes(item.status));
  const mockSuggestion = mockScheduleSuggestion(
    items.map((item) => ({ id: item.id, platform: String(item.platform || "") })),
    periodDays,
  );
  const allowedIds = new Set(items.map((item) => item.id));
  const generated = await generateMarketingJson({
    task: "schedule",
    system: [
      "Spread these posts across the period with sensible weekday UK times.",
      "Return JSON { items: [{ id, scheduledFor }] } using the given ids only.",
      "scheduledFor must be an ISO timestamp. Prefer mid-morning or early afternoon UK time.",
    ].join(" "),
    user: JSON.stringify({
      periodDays,
      items: items.map((item) => ({ id: item.id, platform: item.platform, status: item.status })),
    }),
    secrets: readMarketingSecrets(),
    overrides: routeOverridesFromInput(request.data),
    mockGenerate: () => ({ items: mockSuggestion }),
  });
  const parsedSchedule = scheduleFromLlm(generated.value, allowedIds);
  const suggestion = parsedSchedule || mockSuggestion;
  const usage = parsedSchedule ? generated.usage : {
    provider: MARKETING_MOCK_PROVIDER,
    model: MARKETING_MOCK_MODEL,
    relativeCost: 0,
    reason: "Live schedule JSON was unusable; demo dates used",
  } satisfies MarketingLlmUsage;
  let updated = 0;
  for (const row of suggestion) {
    const existing = items.find((item) => item.id === row.id);
    if (!existing) continue;
    const reset = existing.status === "approved" || existing.status === "scheduled"
      ? { status: "awaiting_approval", approvalVersion: Number(existing.approvalVersion || 0) + 1, approvedVersion: 0 }
      : {};
    await db.doc(`companies/${companyId}/content/${row.id}`).update({
      scheduledFor: row.scheduledFor,
      ...reset,
      updatedAt: FieldValue.serverTimestamp(),
    });
    updated += 1;
  }
  await db.doc(`companies/${companyId}/marketing/schedule`).set({
    updated,
    periodDays,
    aiProvider: usage.provider,
    aiModel: usage.model,
    aiRouteReason: usage.reason,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  logger.info("marketing.ai", {
    task: "schedule",
    companyId,
    provider: usage.provider,
    model: usage.model,
    reason: usage.reason,
    updated,
  });
  return {
    updated,
    summary: `Moved ${updated} posts across the next ${periodDays} days.`,
    source: usage.provider,
    aiModel: usage.model,
  };
});

export const requestMarketingEdits = onCall(async (request) => {
  const auth = requireMarketingAuth(request);
  const companyId = requireDocumentId(request.data?.companyId, "companyId");
  const contentId = requireDocumentId(request.data?.contentId, "contentId");
  const notes = cleanOptionalString(request.data?.notes, 1000);
  if (!notes || notes.length < 3) {
    throw new HttpsError("invalid-argument", "Add a short note so the next rewrite knows what to change.");
  }
  let requestedVersion: number;
  try {
    requestedVersion = parseApprovalVersion(request.data?.approvalVersion);
  } catch (error) {
    failValidation(error);
  }
  await requireCompanyEditPermission(auth.uid, companyId);
  const ref = admin.firestore().doc(`companies/${companyId}/content/${contentId}`);
  await admin.firestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new HttpsError("not-found", "Content not found.");
    const content = snapshot.data() || {};
    if (content.status !== "awaiting_approval" || content.approvalVersion !== requestedVersion) {
      throw new HttpsError("failed-precondition", "This content changed after it was loaded. Review the latest version.");
    }
    const revisions = Array.isArray(content.revisions) ? content.revisions : [];
    transaction.update(ref, {
      status: "draft",
      editRequestNotes: notes,
      editRequestedAt: new Date().toISOString(),
      editRequestedBy: auth.uid,
      revisions: [
        ...revisions,
        {
          id: randomUUID(),
          draft: String(content.refinedDraft || content.draft || ""),
          hashtags: content.hashtags || [],
          assetIds: content.assetIds || [],
          changedBy: auth.uid,
          reason: notes,
          createdAt: new Date().toISOString(),
        },
      ].slice(-12),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return { status: "draft" as const };
});

export const seedMarketingDemo = onCall(async (request) => {
  const auth = requireMarketingAuth(request);
  const companyId = requireDocumentId(request.data?.companyId, "companyId");
  await requireCompanyEditPermission(auth.uid, companyId);
  const db = admin.firestore();
  const companySnap = await db.doc(`companies/${companyId}`).get();
  const company = companySnap.data() || {};
  const input = hubInputFromRecords(company, {}, {
    periodDays: 60,
    postsPerWeek: 3,
    platforms: ["instagram", "facebook", "linkedin", "google"],
    focus: "Two months of useful posts the owner can approve on a Sunday",
    includeArticles: true,
  });
  const scan = mockBrandScan(input);
  const analysis = mockPresenceAnalysis(input);
  const plan = mockMarketingPlan(input, analysis);
  const pieces = mockContentBatch(input, calculateMarketingPieceCount(60, 3));
  await db.doc(`companies/${companyId}/marketing/profile`).set({
    ...scan,
    platforms: input.platforms,
    enableTikTok: false,
    enableYouTube: false,
    approvalRequired: true,
    defaultPlanDays: 60,
    postsPerWeek: 3,
    tradingNames: [String(company.name || "").trim()].filter(Boolean),
    prStrategy: "Owner reviews a weekly queue. AI drafts; nothing posts until someone taps Approve.",
    marketingSpendSummary: "Mostly time so far. Indicative next step is £600–900/month to boost the two best posts.",
    currentThemes: String(company.description || "Useful weekly proof, not slogans."),
    aiSuggestedFields: ["brandVoice", "targetAudience", "styleNotes", "objectives", "keyMessages"],
    onboardedAt: new Date().toISOString(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await db.doc(`companies/${companyId}/marketing/plan`).set({
    ...plan,
    source: "mock",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await db.doc(`companies/${companyId}/marketing/analysis`).set({
    ...analysis,
    source: "mock",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  const contentIds: string[] = [];
  const batch = db.batch();
  pieces.forEach((piece) => {
    const ref = db.collection(`companies/${companyId}/content`).doc();
    contentIds.push(ref.id);
    batch.set(ref, completeContentPiece(
      generatedFromMock(piece),
      piece.platform as MarketingPlatform,
      "",
      piece.scheduledFor,
      auth.uid,
      MARKETING_MOCK_PROVIDER,
      MARKETING_MOCK_MODEL,
    ));
  });
  await batch.commit();
  return {
    created: pieces.length,
    contentIds,
    summary: `Demo workspace: ${pieces.length} posts over 60 days, about £${plan.estimatedBudgetGbp.toLocaleString("en-GB")} indicative.`,
    source: MARKETING_MOCK_PROVIDER,
  };
});
