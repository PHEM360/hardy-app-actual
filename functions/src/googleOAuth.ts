import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

export const googleClientId = defineSecret("GOOGLE_DRIVE_CLIENT_ID");
export const googleClientSecret = defineSecret("GOOGLE_DRIVE_CLIENT_SECRET");
export const GOOGLE_SECRET_OPTS = { secrets: [googleClientId, googleClientSecret] };

export const APP_HOST = "https://hardyhub-7b30d.web.app";
export const APP_HOSTS = [APP_HOST, "https://hardyapp.co.uk"] as const;

export const GOOGLE_REDIRECTS = [
  "/api/google-photos/callback",
  "/api/google-drive/callback",
  "/api/mail/callback",
  "/api/calendar/callback",
];

const OWNER_EMAIL = "chris.hardy.07@googlemail.com";

export function tidyGoogleValue(value: string) {
  return String(value || "").trim().replace(/^["']+|["']+$/g, "");
}

export function isGoogleWebClientId(value: string) {
  return /^[\w.-]+\.apps\.googleusercontent\.com$/.test(value);
}

export function googleAuthUrl(clientId: string, redirectUri: string, scope: string, state: string) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope,
    access_type: "offline",
    prompt: "consent",
    state,
    include_granted_scopes: "true",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function loadGoogleCredentials() {
  let clientId = tidyGoogleValue(googleClientId.value() || "");
  let clientSecret = tidyGoogleValue(googleClientSecret.value() || "");
  if (!isGoogleWebClientId(clientId) || !clientSecret || clientSecret === "UNSET") {
    const snap = await admin.firestore().doc("internalSecrets/googleOAuth").get();
    const data = snap.data() || {};
    clientId = tidyGoogleValue(String(data.clientId || clientId));
    clientSecret = tidyGoogleValue(String(data.clientSecret || clientSecret));
  }
  if (!isGoogleWebClientId(clientId) || !clientSecret || clientSecret === "UNSET") {
    throw new HttpsError(
      "failed-precondition",
      "Google login is not set up for the family yet. An admin adds one Web client in Settings. Each person then signs in with their own Google account in the app.",
    );
  }
  return { clientId, clientSecret };
}

export async function formPost(url: string, body: Record<string, string>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const data = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    throw new HttpsError("internal", String((data as { error_description?: string }).error_description || "Google did not accept that login."));
  }
  return data;
}

async function requireAdmin(uid: string, email?: string) {
  const snap = await admin.firestore().doc(`users/${uid}`).get();
  const data = snap.data() || {};
  const role = String(data.role || "").toLowerCase().replace(/[\s_-]+/g, "");
  const isOwner = String(data.email || email || "").toLowerCase() === OWNER_EMAIL;
  if (role !== "admin" && role !== "superadmin" && data.isAdmin !== true && data.isSuperAdmin !== true && !isOwner) {
    throw new HttpsError("permission-denied", "Only an admin can save the family Google login.");
  }
}

export const googleOAuthStatus = onCall(GOOGLE_SECRET_OPTS, async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "You must be signed in.");
  try {
    const { clientId } = await loadGoogleCredentials();
    return {
      configured: true,
      clientHint: clientId.slice(-18),
      redirects: GOOGLE_REDIRECTS.flatMap((path) => APP_HOSTS.map((host) => `${host}${path}`)),
    };
  } catch {
    return {
      configured: false,
      clientHint: "",
      redirects: GOOGLE_REDIRECTS.flatMap((path) => APP_HOSTS.map((host) => `${host}${path}`)),
    };
  }
});

export const saveGoogleOAuthClient = onCall(GOOGLE_SECRET_OPTS, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "You must be signed in.");
  await requireAdmin(uid, request.auth?.token?.email);
  const clientId = tidyGoogleValue(String(request.data?.clientId || ""));
  const clientSecret = tidyGoogleValue(String(request.data?.clientSecret || ""));
  if (!isGoogleWebClientId(clientId)) {
    throw new HttpsError(
      "invalid-argument",
      "That does not look like a Google Web client ID. It should end with .apps.googleusercontent.com.",
    );
  }
  if (clientSecret.length < 8) {
    throw new HttpsError("invalid-argument", "Paste the Web client secret from Google Cloud.");
  }
  await admin.firestore().doc("internalSecrets/googleOAuth").set({
    clientId,
    clientSecret,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: uid,
  }, { merge: true });
  return { ok: true, clientHint: clientId.slice(-18) };
});
