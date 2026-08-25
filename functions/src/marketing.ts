import { randomUUID } from "crypto";
import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  calculateMarketingPieceCount,
  cleanOptionalString,
  hasMeaningfulMarketingProfile,
  MarketingBrandProfile,
  MarketingPlatform,
  parseApprovalVersion,
  parseMarketingPlanInput,
  parsePlatform,
  stringList,
} from "./marketingValidation";

const openaiApiKey = defineSecret("OPENAI_API_KEY");
const MODEL = "gpt-4o-mini";
const TIMEZONE = "Europe/London";
const MAX_GENERATED_PIECES = 40;

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

interface OpenAiChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

interface OpenAiImageResponse {
  data?: Array<{ b64_json?: string; revised_prompt?: string }>;
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

function completeContentPiece(
  raw: GeneratedPiece,
  platform: MarketingPlatform,
  campaignId: string,
  scheduledFor: string,
  actor: string
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
    aiProvider: "openai",
    aiModel: MODEL,
    aiReasoning: String(raw.aiReasoning || "Generated from the saved brand profile.").trim().slice(0, 2000),
    brandChecks: stringList(raw.brandChecks, 12, 300),
    engagementSuggestions: stringList(raw.engagementSuggestions, 12, 300),
    revisions: [],
    generatedBy: actor,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

async function requestJsonFromOpenAi(
  systemPrompt: string,
  userPrompt: string,
  pieceCount: number
): Promise<GeneratedPiece[]> {
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey.value()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.5,
        max_tokens: 12000,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "marketing_plan",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["pieces"],
              properties: {
                pieces: {
                  type: "array",
                  minItems: pieceCount,
                  maxItems: pieceCount,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: [
                      "type", "platform", "topic", "objective", "audience", "trendReason",
                      "draft", "refinedDraft", "hashtags", "aiImagePrompt", "aiReasoning",
                      "brandChecks", "engagementSuggestions",
                    ],
                    properties: {
                      type: { type: "string", enum: ["social_post", "article", "campaign_idea", "advert"] },
                      platform: { type: "string", enum: ["facebook", "instagram", "linkedin"] },
                      topic: { type: "string" },
                      objective: { type: "string" },
                      audience: { type: "string" },
                      trendReason: { type: "string" },
                      draft: { type: "string" },
                      refinedDraft: { type: "string" },
                      hashtags: { type: "array", items: { type: "string" } },
                      aiImagePrompt: { type: "string" },
                      aiReasoning: { type: "string" },
                      brandChecks: { type: "array", items: { type: "string" } },
                      engagementSuggestions: { type: "array", items: { type: "string" } },
                    },
                  },
                },
              },
            },
          },
        },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
  } catch (error) {
    logger.error("Marketing OpenAI request failed", { error });
    throw new HttpsError("unavailable", "Could not reach the AI service. Please try again.");
  }
  if (!response.ok) {
    const detail = await response.text();
    logger.error("Marketing OpenAI response failed", { status: response.status, detail });
    if (response.status === 401) {
      throw new HttpsError("failed-precondition", "The OpenAI API key is missing or invalid.");
    }
    throw new HttpsError("internal", "The AI service could not generate this plan.");
  }
  const body = await response.json() as OpenAiChatResponse;
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new HttpsError("internal", "The AI service returned an empty plan.");
  try {
    const parsed = JSON.parse(content) as { pieces?: GeneratedPiece[] };
    if (!Array.isArray(parsed.pieces) || parsed.pieces.length !== pieceCount) {
      throw new Error("Unexpected piece count");
    }
    const incomplete = parsed.pieces.some((piece) =>
      String(piece.topic || "").trim().length < 3 ||
      String(piece.draft || "").trim().length < 10 ||
      stringList(piece.brandChecks, 12).length === 0 ||
      stringList(piece.engagementSuggestions, 12).length === 0
    );
    if (incomplete) throw new Error("Generated content was incomplete");
    return parsed.pieces;
  } catch (error) {
    logger.error("Marketing OpenAI JSON was invalid", { error });
    throw new HttpsError("internal", "The AI service returned an invalid plan.");
  }
}

export const generateMarketingPlan = onCall(
  { secrets: [openaiApiKey], timeoutSeconds: 180, memory: "512MiB" },
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
    const [companySnap, profileSnap, campaignSnap] = await Promise.all([
      db.doc(`companies/${companyId}`).get(),
      db.doc(`companies/${companyId}/marketing/profile`).get(),
      input.campaignId ? db.doc(`companies/${companyId}/campaigns/${input.campaignId}`).get() : Promise.resolve(null),
    ]);
    const profile = (profileSnap.data() || {}) as MarketingBrandProfile;
    if (!profileSnap.exists || !hasMeaningfulMarketingProfile(profile)) {
      throw new HttpsError(
        "failed-precondition",
        "Complete the brand voice, audience, industry or trading name, and objectives or key messages first."
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
    const systemPrompt = [
      "You are a senior UK social media strategist.",
      "Create polished, concrete, ready-to-review content; never use placeholders.",
      "Respect every required phrase, banned phrase and disclaimer.",
      "Use British English. Do not make unsupported factual or legal claims.",
      `Return exactly ${count} pieces and only use the requested platforms.`,
    ].join(" ");
    const userPrompt = JSON.stringify({
      companyName: company.name || "",
      companyDescription: company.description || "",
      brandProfile: profile,
      campaign: campaignSnap?.data() || null,
      plan: input,
      requestedPieceCount: count,
    });
    const generated = await requestJsonFromOpenAi(systemPrompt, userPrompt, count);

    const collection = db.collection(`companies/${companyId}/content`);
    const batch = db.batch();
    const ids: string[] = [];
    generated.forEach((piece, index) => {
      const ref = collection.doc();
      ids.push(ref.id);
      const requestedPlatform = String(piece.platform || "").toLowerCase() as MarketingPlatform;
      const platform = input.platforms.includes(requestedPlatform) ?
        requestedPlatform : input.platforms[index % input.platforms.length];
      batch.set(ref, completeContentPiece(
        piece,
        platform,
        input.campaignId || "",
        scheduledDate(index, count, input.periodDays),
        auth.uid
      ));
    });
    await batch.commit();
    logger.info("Generated marketing plan", { companyId, uid: auth.uid, count });
    return {
      created: ids.length,
      contentIds: ids,
      summary: `Created ${ids.length} posts for review over ${input.periodDays} days.`,
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
  if (connection?.status !== "connected" || !credential) {
    await finishBlockedJob(
      jobRef,
      contentRef,
      claimId,
      "No connected account or server-side credential is configured for this platform."
    );
    return;
  }
  if (credential.provider !== "test") {
    await finishBlockedJob(
      jobRef,
      contentRef,
      claimId,
      "Publishing for this provider is not configured. No post was sent."
    );
    return;
  }

  const externalPostId = `test_${jobRef.id}`;
  const externalPostUrl = `https://example.invalid/marketing/${encodeURIComponent(externalPostId)}`;
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

export const startMarketingPlatformConnection = onCall(async (request) => {
  const auth = requireMarketingAuth(request);
  const companyId = requireDocumentId(request.data?.companyId, "companyId");
  try {
    parsePlatform(request.data?.platform);
  } catch (error) {
    failValidation(error);
  }
  await requireCompanyEditPermission(auth.uid, companyId);
  return {
    available: false,
    reason: "Social publishing is not available until Meta or LinkedIn OAuth credentials are configured.",
  };
});

export const generateMarketingImage = onCall(
  { secrets: [openaiApiKey], timeoutSeconds: 180, memory: "1GiB" },
  async (request) => {
    const auth = requireMarketingAuth(request);
    const companyId = requireDocumentId(request.data?.companyId, "companyId");
    const prompt = cleanOptionalString(request.data?.prompt, 3000);
    if (!prompt || prompt.length < 10) {
      throw new HttpsError("invalid-argument", "A meaningful image prompt is required.");
    }
    await requireCompanyEditPermission(auth.uid, companyId);
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey.value()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size: "1024x1024",
        quality: "medium",
        output_format: "png",
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      logger.error("Marketing image generation failed", { status: response.status, detail });
      throw new HttpsError("internal", "The AI service could not generate this image.");
    }
    const result = await response.json() as OpenAiImageResponse;
    const encoded = result.data?.[0]?.b64_json;
    if (!encoded) throw new HttpsError("internal", "The AI service returned no image.");

    const assetId = randomUUID();
    const storagePath = `companies/${companyId}/marketing/${assetId}.png`;
    const downloadToken = randomUUID();
    const bucket = admin.storage().bucket();
    await bucket.file(storagePath).save(Buffer.from(encoded, "base64"), {
      contentType: "image/png",
      metadata: {
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
          generatedBy: auth.uid,
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
      usageNotes: result.data?.[0]?.revised_prompt || prompt,
      aiProvider: "openai",
      aiModel: "gpt-image-1",
      createdBy: auth.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { assetId, url, storagePath };
  }
);
