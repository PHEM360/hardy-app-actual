import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

export type LoginEventMethod =
  | "passkey"
  | "password"
  | "failed_password"
  | "failed_passkey"
  | "auto_unlock";

export interface LoginEventInput {
  uid?: string;
  email?: string;
  method: LoginEventMethod;
  success: boolean;
  detail?: string;
  userAgent?: string;
  ip?: string;
}

export async function writeLoginEvent(event: LoginEventInput) {
  await admin.firestore().collection("loginEvents").add({
    uid: event.uid || null,
    email: String(event.email || "").toLowerCase(),
    method: event.method,
    success: event.success === true,
    detail: event.detail || "",
    userAgent: String(event.userAgent || "").slice(0, 300),
    ip: event.ip || "",
    createdAt: FieldValue.serverTimestamp(),
    createdAtIso: new Date().toISOString(),
  });
}

function requestIp(request: { rawRequest?: { ip?: string; socket?: { remoteAddress?: string } } }) {
  return String(request.rawRequest?.ip || request.rawRequest?.socket?.remoteAddress || "");
}

export async function mintPasskeySessionToken(uid: string) {
  const verifiedAt = Math.floor(Date.now() / 1000);
  const user = await admin.auth().getUser(uid);
  const existing = { ...(user.customClaims || {}) } as Record<string, unknown>;
  delete existing.deviceId;
  await admin.auth().setCustomUserClaims(uid, {
    ...existing,
    authMethod: "passkey",
    passkeyVerifiedAt: verifiedAt,
  });
  return admin.auth().createCustomToken(uid, {
    authMethod: "passkey",
    passkeyVerifiedAt: verifiedAt,
  });
}

function requireUid(request: { auth?: { uid: string; token?: Record<string, unknown> } }) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "You must be signed in.");
  if (request.auth.token?.deviceId) {
    throw new HttpsError("permission-denied", "Remote display credentials cannot use this service.");
  }
  return request.auth.uid;
}

async function requireAdmin(uid: string, authEmail?: string) {
  const snap = await admin.firestore().doc(`users/${uid}`).get();
  const data = snap.data() || {};
  const rawRole = String(data.role || "").toLowerCase().replace(/\s+/g, "").replace(/-/g, "");
  const profileEmail = String(data.email || "").toLowerCase();
  const tokenEmail = String(authEmail || "").toLowerCase();
  const owner = profileEmail === "chris.hardy.07@googlemail.com" || tokenEmail === "chris.hardy.07@googlemail.com";
  if (rawRole !== "superadmin" && rawRole !== "admin" && data.isSuperAdmin !== true && !owner) {
    throw new HttpsError("permission-denied", "Admin privileges required.");
  }
}

export const recordAuthEvent = onCall(async (request) => {
  const method = String(request.data?.method || "") as LoginEventMethod;
  const allowed: LoginEventMethod[] = ["password", "failed_password", "failed_passkey", "auto_unlock"];
  if (!allowed.includes(method)) throw new HttpsError("invalid-argument", "Unknown login event.");
  const success = method === "password" || method === "auto_unlock";
  const uid = request.auth?.uid;
  await writeLoginEvent({
    uid,
    email: String(request.data?.email || request.auth?.token?.email || ""),
    method,
    success,
    detail: String(request.data?.detail || "").slice(0, 200),
    userAgent: String(request.data?.userAgent || request.rawRequest?.headers?.["user-agent"] || ""),
    ip: requestIp(request),
  });
  return { ok: true };
});

export const listLoginEvents = onCall(async (request) => {
  const uid = requireUid(request);
  await requireAdmin(uid, request.auth?.token?.email);
  const days = Math.min(90, Math.max(1, Number(request.data?.days || 7)));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const snap = await admin.firestore()
    .collection("loginEvents")
    .where("createdAtIso", ">=", since)
    .orderBy("createdAtIso", "desc")
    .limit(200)
    .get();
  return {
    events: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    count: snap.size,
  };
});

export const setUserEnabled = onCall(async (request) => {
  const adminUid = requireUid(request);
  await requireAdmin(adminUid, request.auth?.token?.email);
  const targetUid = String(request.data?.uid || "");
  const enabled = request.data?.enabled !== false;
  if (!targetUid) throw new HttpsError("invalid-argument", "A user is required.");
  if (targetUid === adminUid && !enabled) {
    throw new HttpsError("failed-precondition", "You can't suspend your own account.");
  }
  await admin.auth().updateUser(targetUid, { disabled: !enabled });
  await admin.firestore().doc(`users/${targetUid}`).set(
    { enabled, suspended: !enabled, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  if (!enabled) await admin.auth().revokeRefreshTokens(targetUid);
  return { success: true, enabled };
});
