import { randomUUID } from "node:crypto";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { parsePlatform } from "./marketingValidation";

const APP_HOST = "https://hardyhub-7b30d.web.app";
const CALLBACK = `${APP_HOST}/api/marketing/callback`;
const googleClientId = defineSecret("GOOGLE_DRIVE_CLIENT_ID");
const googleClientSecret = defineSecret("GOOGLE_DRIVE_CLIENT_SECRET");

const SECRET_OPTS = {
  secrets: [googleClientId, googleClientSecret],
};

function envSecret(...names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value && value !== "UNSET") return value;
  }
  return "";
}

function db() {
  return admin.firestore();
}

function requireUid(auth?: { uid: string; token?: Record<string, unknown> }) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "You must be signed in.");
  if (auth.token?.deviceId) {
    throw new HttpsError("permission-denied", "Remote displays cannot connect social accounts.");
  }
  return auth.uid;
}

function secretValue(secret: { value: () => string }, ...envNames: string[]) {
  try {
    const value = secret.value();
    if (value && value !== "UNSET") return value;
  } catch {
    // Secret not bound on this function.
  }
  return envSecret(...envNames);
}

async function requireCompanyEdit(uid: string, companyId: string) {
  const snap = await db().doc(`companies/${companyId}`).get();
  if (!snap.exists) throw new HttpsError("not-found", "Company not found.");
  const company = snap.data() || {};
  const user = (await db().doc(`users/${uid}`).get()).data() || {};
  const role = String(user.role || "").toLowerCase().replace(/[\s_-]+/g, "");
  const adminUser = role === "admin" || role === "superadmin" || user.isAdmin === true || user.isSuperAdmin === true;
  const owner = !company.ownerId || company.ownerId === uid;
  const shared = Array.isArray(company.sharedWith) && company.sharedWith.includes(uid);
  if (adminUser || owner || shared) return;
  throw new HttpsError("permission-denied", "You cannot edit this company's social accounts.");
}

function oauthConfig(platform: string) {
  if (platform === "facebook" || platform === "instagram") {
    const clientId = envSecret("META_APP_ID");
    const clientSecret = envSecret("META_APP_SECRET");
    if (!clientId || !clientSecret) return null;
    const scope = platform === "instagram"
      ? "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,business_management"
      : "pages_manage_posts,pages_show_list,pages_read_engagement,business_management";
    return {
      provider: "meta",
      authUrl: `https://www.facebook.com/v21.0/dialog/oauth?${new URLSearchParams({
        client_id: clientId,
        redirect_uri: CALLBACK,
        response_type: "code",
        scope,
        state: "",
      })}`,
      tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
      clientId,
      clientSecret,
    };
  }
  if (platform === "linkedin") {
    const clientId = envSecret("LINKEDIN_CLIENT_ID");
    const clientSecret = envSecret("LINKEDIN_CLIENT_SECRET");
    if (!clientId || !clientSecret) return null;
    return {
      provider: "linkedin",
      authUrl: `https://www.linkedin.com/oauth/v2/authorization?${new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: CALLBACK,
        scope: "w_member_social r_liteprofile r_organization_social w_organization_social",
        state: "",
      })}`,
      tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
      clientId,
      clientSecret,
    };
  }
  if (platform === "google" || platform === "youtube") {
    const clientId = secretValue(googleClientId, "GOOGLE_DRIVE_CLIENT_ID");
    const clientSecret = secretValue(googleClientSecret, "GOOGLE_DRIVE_CLIENT_SECRET");
    if (!clientId || !clientSecret) return null;
    return {
      provider: "google",
      authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
        client_id: clientId,
        redirect_uri: CALLBACK,
        response_type: "code",
        access_type: "offline",
        prompt: "consent",
        scope: "https://www.googleapis.com/auth/business.manage https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/userinfo.email",
        state: "",
      })}`,
      tokenUrl: "https://oauth2.googleapis.com/token",
      clientId,
      clientSecret,
    };
  }
  return null;
}

export const startMarketingPlatformConnection = onCall(SECRET_OPTS, async (request) => {
  const uid = requireUid(request.auth);
  const companyId = String(request.data?.companyId || "").trim();
  const platform = parsePlatform(request.data?.platform);
  await requireCompanyEdit(uid, companyId);
  const config = oauthConfig(platform);
  if (!config) {
    return {
      available: false,
      reason: `Connect ${platform} in the app by saving the public profile URL below. Autopost for this channel needs the family ${platform} app switched on once.`,
    };
  }
  const state = randomUUID();
  await db().doc(`marketingOAuth/${state}`).set({
    uid,
    companyId,
    platform,
    provider: config.provider,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Date.now() + 15 * 60 * 1000,
  });
  const authUrl = config.authUrl.replace("state=", `state=${encodeURIComponent(state)}`);
  return { available: true, authUrl };
});

export const marketingConnectCallback = onRequest(SECRET_OPTS, async (req, res) => {
  const code = String(req.query.code || "");
  const state = String(req.query.state || "");
  const fail = (reason: string) => res.redirect(`${APP_HOST}/companies/social?connect=error&reason=${encodeURIComponent(reason)}`);
  if (!code || !state) {
    fail("missing");
    return;
  }
  const stateSnap = await db().doc(`marketingOAuth/${state}`).get();
  const stateData = stateSnap.data();
  if (!stateSnap.exists || !stateData || Number(stateData.expiresAt || 0) < Date.now()) {
    fail("expired");
    return;
  }
  const platform = String(stateData.platform || "");
  const config = oauthConfig(platform);
  if (!config) {
    fail("setup");
    return;
  }
  try {
    const body = new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: CALLBACK,
      grant_type: "authorization_code",
    });
    const tokenRes = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const token = await tokenRes.json() as Record<string, unknown>;
    if (!tokenRes.ok || !token.access_token) {
      logger.error("Marketing OAuth token failed", { platform, token });
      fail("token");
      return;
    }
    await db().doc(`marketingPlatformCredentials/${stateData.companyId}_${platform}`).set({
      companyId: stateData.companyId,
      platform,
      provider: config.provider,
      accessToken: String(token.access_token),
      refreshToken: token.refresh_token || null,
      expiresAt: Date.now() + Number(token.expires_in || 3600) * 1000,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await db().doc(`companies/${stateData.companyId}/platformConnections/${platform}`).set({
      platform,
      accountName: platform,
      accountId: "",
      kind: "oauth",
      status: "connected",
      capabilities: ["publish"],
      lastCheckedAt: new Date().toISOString(),
      error: "",
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await stateSnap.ref.delete();
    res.redirect(`${APP_HOST}/companies/social?connect=ok&platform=${encodeURIComponent(platform)}&company=${encodeURIComponent(String(stateData.companyId))}`);
  } catch (err) {
    logger.error("marketingConnectCallback failed", err);
    fail("token");
  }
});

export const saveMarketingSocialLink = onCall(async (request) => {
  const uid = requireUid(request.auth);
  const companyId = String(request.data?.companyId || "").trim();
  const platform = parsePlatform(request.data?.platform);
  const profileUrl = String(request.data?.profileUrl || "").trim();
  const accountName = String(request.data?.accountName || "").trim();
  await requireCompanyEdit(uid, companyId);
  if (!profileUrl && !accountName) {
    throw new HttpsError("invalid-argument", "Add the profile URL or @handle.");
  }
  await db().doc(`companies/${companyId}/platformConnections/${platform}`).set({
    platform,
    accountName: accountName || profileUrl,
    accountId: accountName,
    profileUrl,
    kind: "profile",
    status: "connected",
    capabilities: ["scan"],
    lastCheckedAt: new Date().toISOString(),
    error: "",
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  const profileRef = db().doc(`companies/${companyId}/marketing/profile`);
  await profileRef.set({
    [`socialUrls.${platform}`]: profileUrl,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return { ok: true };
});

export const bulkApproveMarketingContent = onCall(async (request) => {
  const uid = requireUid(request.auth);
  const companyId = String(request.data?.companyId || "").trim();
  const items = Array.isArray(request.data?.items) ? request.data.items as Array<{ contentId: string; approvalVersion: number }> : [];
  await requireCompanyEdit(uid, companyId);
  if (!items.length) throw new HttpsError("invalid-argument", "Pick posts to approve.");
  let approved = 0;
  for (const item of items.slice(0, 120)) {
    const contentId = String(item.contentId || "");
    const version = Number(item.approvalVersion || 0);
    if (!contentId || !version) continue;
    const ref = db().doc(`companies/${companyId}/content/${contentId}`);
    const snap = await ref.get();
    const data = snap.data();
    if (!snap.exists || data?.status !== "awaiting_approval" || data.approvalVersion !== version) continue;
    const scheduled = new Date(String(data.scheduledFor || "")).getTime() > Date.now();
    const status = scheduled ? "scheduled" : "approved";
    await ref.update({
      status,
      approvedVersion: version,
      approvedAt: new Date().toISOString(),
      approvedBy: uid,
      publishError: "",
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (scheduled) {
      const jobId = `${companyId}_${contentId}_v${version}`;
      await db().doc(`marketingPublishJobs/${jobId}`).set({
        companyId,
        contentId,
        platform: data.platform,
        approvalVersion: version,
        status: "queued",
        dueAt: admin.firestore.Timestamp.fromDate(new Date(data.scheduledFor)),
        attempts: 0,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    approved += 1;
  }
  return { approved };
});
