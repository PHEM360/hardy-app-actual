import { createHmac, randomBytes } from "node:crypto";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

const db = () => admin.firestore();

function cleanRole(value: unknown) {
  return String(value || "").toLowerCase().replace(/[\s_-]+/g, "");
}

function requireUid(request: { auth?: { uid?: string; token?: Record<string, unknown> } }) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "You must be signed in.");
  if (request.auth?.token?.deviceId) {
    throw new HttpsError("permission-denied", "Remote display credentials cannot publish business content.");
  }
  return uid;
}

async function assertCompanyEdit(uid: string, companyId: string) {
  const [companySnap, userSnap] = await Promise.all([
    db().doc(`companies/${companyId}`).get(),
    db().doc(`users/${uid}`).get(),
  ]);
  if (!companySnap.exists) throw new HttpsError("not-found", "Company not found.");
  const company = companySnap.data() || {};
  const user = userSnap.data() || {};
  const role = cleanRole(user.role);
  const isAdmin =
    role === "admin" ||
    role === "superadmin" ||
    user.isAdmin === true ||
    user.isSuperAdmin === true;
  const owner = !company.ownerId || company.ownerId === uid;
  const shared = Array.isArray(company.sharedWith) && company.sharedWith.includes(uid);
  if (!isAdmin && !owner && !shared) {
    throw new HttpsError("permission-denied", "You cannot publish for this company.");
  }
}

function safeEndpoint(value: unknown) {
  const raw = String(value || "").trim();
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpsError("invalid-argument", "The website publish endpoint is not a valid URL.");
  }
  if (url.protocol !== "https:") {
    throw new HttpsError("invalid-argument", "Website publishing requires an HTTPS endpoint.");
  }
  const host = url.hostname.toLowerCase();
  const blocked =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local") ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (blocked) throw new HttpsError("invalid-argument", "Private/internal publish endpoints are not allowed.");
  return url.toString();
}

export const createBusinessPublisherCredential = onCall(async (request) => {
  const uid = requireUid(request);
  const companyId = String(request.data?.companyId || "").trim();
  if (!companyId) throw new HttpsError("invalid-argument", "companyId is required.");
  await assertCompanyEdit(uid, companyId);

  const secret = randomBytes(40).toString("base64url");
  await db().doc(`businessOutboundSecrets/${companyId}`).set({
    companyId,
    secret,
    createdBy: uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return {
    secret,
    targetSecretName: "HARDY_PUBLISH_SECRET",
    warning: "Copy this once into the receiving website's server-side secret store. Never put it in public browser code.",
  };
});

export const publishBusinessWebsiteContent = onCall(
  { timeoutSeconds: 60, maxInstances: 5 },
  async (request) => {
    const uid = requireUid(request);
    const companyId = String(request.data?.companyId || "").trim();
    const contentId = String(request.data?.contentId || "").trim();
    if (!companyId || !contentId) {
      throw new HttpsError("invalid-argument", "companyId and contentId are required.");
    }
    await assertCompanyEdit(uid, companyId);

    const [integrationSnap, secretSnap, contentSnap, companySnap] = await Promise.all([
      db().doc(`companies/${companyId}/businessIntegrations/website`).get(),
      db().doc(`businessOutboundSecrets/${companyId}`).get(),
      db().doc(`companies/${companyId}/content/${contentId}`).get(),
      db().doc(`companies/${companyId}`).get(),
    ]);
    if (!contentSnap.exists) throw new HttpsError("not-found", "Content item not found.");
    if (!integrationSnap.exists || integrationSnap.data()?.enabled !== true) {
      throw new HttpsError("failed-precondition", "Configure an enabled website connector first.");
    }
    const endpoint = safeEndpoint(integrationSnap.data()?.baseUrl);
    const secret = String(secretSnap.data()?.secret || "");
    if (!secret) {
      throw new HttpsError("failed-precondition", "Create a website publishing credential first.");
    }

    const content = contentSnap.data() || {};
    if (content.platform !== "website" || content.type !== "article") {
      throw new HttpsError("failed-precondition", "Only website articles can use this publisher.");
    }
    if (!["approved", "scheduled"].includes(String(content.status || ""))) {
      throw new HttpsError("failed-precondition", "Approve the article before publishing it.");
    }

    const articleBody = String(content.refinedDraft || content.draft || "").trim();
    if (!articleBody) throw new HttpsError("failed-precondition", "The article body is empty.");
    if (articleBody.length > 150_000) throw new HttpsError("invalid-argument", "The article is too large to publish.");

    const company = companySnap.data() || {};
    const payload = {
      id: contentId,
      title: String(content.topic || "Untitled article").trim().slice(0, 240),
      body: articleBody,
      excerpt: String(content.trendReason || content.objective || "").trim().slice(0, 600),
      tags: Array.isArray(content.hashtags)
        ? content.hashtags.map((item: unknown) => String(item).replace(/^#/, "").trim()).filter(Boolean).slice(0, 20)
        : [],
      author: String(company.name || "Editorial team").trim().slice(0, 160),
      scheduledFor: String(content.scheduledFor || ""),
      source: "hardy-business-hub",
    };
    const raw = JSON.stringify(payload);
    const timestamp = String(Date.now());
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}.${raw}`)
      .digest("hex");

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hardy-timestamp": timestamp,
        "x-hardy-signature": signature,
      },
      body: raw,
      redirect: "error",
    });
    const responseText = await response.text();
    let result: Record<string, any> = {};
    try {
      result = responseText ? JSON.parse(responseText) : {};
    } catch {
      result = { error: responseText };
    }
    if (!response.ok) {
      await contentSnap.ref.set({
        status: "failed",
        publishError: String(result.error || `Website returned HTTP ${response.status}`).slice(0, 1000),
        publishAttempts: Number(content.publishAttempts || 0) + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      throw new HttpsError("internal", String(result.error || "The website rejected the article."));
    }

    const publishedAt = new Date().toISOString();
    await contentSnap.ref.set({
      status: "published",
      publishMode: "live",
      publishedAt,
      externalPostId: String(result.id || result.slug || contentId),
      externalPostUrl: String(result.url || ""),
      publishError: "",
      publishAttempts: Number(content.publishAttempts || 0) + 1,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return {
      ok: true,
      publishedAt,
      externalPostId: String(result.id || result.slug || contentId),
      externalPostUrl: String(result.url || ""),
    };
  },
);
