/**
 * Privileged user admin actions that must not be done with raw client writes.
 */
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { requireUid, requireAdmin, requireTrueSuperAdmin, syncUserDirectory, type UserRole } from "./authz";

export const setUserRole = onCall(async (request) => {
  const uid = requireUid(request);
  const targetUid = String(request.data?.uid || "").trim();
  const rawRole = String(request.data?.role || "").toLowerCase().replace(/\s+/g, "").replace(/-/g, "");

  if (!targetUid) throw new HttpsError("invalid-argument", "uid is required.");
  if (rawRole !== "member" && rawRole !== "admin" && rawRole !== "superadmin") {
    throw new HttpsError("invalid-argument", "Role must be member, admin, or superadmin.");
  }
  const role = rawRole as UserRole;

  if (role === "superadmin") {
    await requireTrueSuperAdmin(uid, request.auth?.token?.email);
  } else {
    await requireAdmin(uid, request.auth?.token?.email);
  }

  if (targetUid === uid && role !== "superadmin") {
    // Allow demoting yourself only if another superadmin exists is too complex;
    // block self role changes entirely to avoid lockout tricks.
    throw new HttpsError("failed-precondition", "You cannot change your own role.");
  }

  await admin.firestore().doc(`users/${targetUid}`).set(
    {
      role,
      isAdmin: role === "admin" || role === "superadmin",
      isSuperAdmin: role === "superadmin",
      roleUpdatedAt: FieldValue.serverTimestamp(),
      roleUpdatedBy: uid,
    },
    { merge: true },
  );
  logger.info("setUserRole", { targetUid, role, by: uid });
  return { success: true, role };
});

/** Mirror name/email into userDirectory for sharing pickers (no roles/features). */
export const onUserProfileWrite = onDocumentWritten("users/{userId}", async (event) => {
  const uid = String(event.params.userId || "");
  if (!uid) return;
  const after = event.data?.after?.exists ? event.data.after.data() : undefined;
  await syncUserDirectory(uid, after);
});
