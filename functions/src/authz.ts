/**
 * Shared auth helpers for Cloud Functions (roles + feature gates).
 */
import * as admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v2/https";

export const OWNER_EMAIL = "chris.hardy.07@googlemail.com";

export type UserRole = "superadmin" | "admin" | "member";

export function requireUid(request: { auth?: { uid: string; token?: Record<string, unknown> } }) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "You must be signed in.");
  if (request.auth.token?.deviceId) {
    throw new HttpsError("permission-denied", "Remote display credentials cannot use this service.");
  }
  return request.auth.uid;
}

function normalizeRole(raw: unknown): UserRole {
  const normalized = String(raw || "member").toLowerCase().replace(/\s+/g, "").replace(/-/g, "");
  if (normalized === "superadmin" || normalized === "admin" || normalized === "member") {
    return normalized;
  }
  return "member";
}

export async function loadUserAuthz(uid: string, authEmail?: string) {
  const snap = await admin.firestore().doc(`users/${uid}`).get();
  const data = snap.data() || {};
  const role = normalizeRole(data.role);
  const profileEmail = String(data.email || "").toLowerCase();
  const tokenEmail = String(authEmail || "").toLowerCase();
  const isOwnerEmail = profileEmail === OWNER_EMAIL || tokenEmail === OWNER_EMAIL;
  const isSuperAdminLegacy = data.isSuperAdmin === true;
  const isAdminLegacy = data.isAdmin === true;
  const isSuperAdmin = isOwnerEmail || role === "superadmin" || isSuperAdminLegacy;
  const isAdmin = isSuperAdmin || role === "admin" || isAdminLegacy;
  const enabledFeatures = Array.isArray(data.enabledFeatures)
    ? data.enabledFeatures.map((f) => String(f || "").toLowerCase().replace(/-/g, "_"))
    : [];
  const passkeyEnrolled = data.passkeyEnrolled === true;
  return { role, isSuperAdmin, isAdmin, isOwnerEmail, enabledFeatures, passkeyEnrolled, data };
}

export async function requireAdmin(uid: string, authEmail?: string) {
  const authz = await loadUserAuthz(uid, authEmail);
  if (!authz.isAdmin) {
    throw new HttpsError("permission-denied", "Admin privileges required.");
  }
  return authz;
}

export async function requireTrueSuperAdmin(uid: string, authEmail?: string) {
  const authz = await loadUserAuthz(uid, authEmail);
  if (!authz.isSuperAdmin) {
    throw new HttpsError("permission-denied", "Superadmin privileges required.");
  }
  return authz;
}

export async function requireFeature(uid: string, feature: string, authEmail?: string) {
  const authz = await loadUserAuthz(uid, authEmail);
  if (!authz.passkeyEnrolled) {
    throw new HttpsError("failed-precondition", "Enrol a passkey first.");
  }
  const wanted = feature.toLowerCase().replace(/-/g, "_");
  if (authz.isAdmin || authz.enabledFeatures.includes(wanted)) return authz;
  throw new HttpsError("permission-denied", `The ${feature} feature is not enabled for this account.`);
}

/** Keep a public directory doc in sync (name + email only). */
export async function syncUserDirectory(uid: string, data: admin.firestore.DocumentData | undefined) {
  if (!data) {
    await admin.firestore().doc(`userDirectory/${uid}`).delete().catch(() => undefined);
    return;
  }
  const displayName = String(
    data.displayName ||
    `${data.firstName || ""} ${data.surname || ""}`.trim() ||
    data.email ||
    uid,
  ).trim();
  await admin.firestore().doc(`userDirectory/${uid}`).set(
    {
      displayName,
      email: String(data.email || ""),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}
