/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { setGlobalOptions } from "firebase-functions";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import * as postmark from "postmark";
import { postmarkKey } from "./notifications/scheduler";
import { FROM_EMAIL } from "./notifications/sender";

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

admin.initializeApp();

type UserRole = "superadmin" | "admin" | "member";

function requireAuth(context: { auth?: { uid: string; token: any } }) {
	const uid = context.auth?.uid;
	if (!uid) throw new HttpsError("unauthenticated", "You must be signed in.");
	return uid;
}

const OWNER_EMAIL = "chris.hardy.07@googlemail.com";

async function requireSuperAdmin(uid: string) {
	const snap = await admin.firestore().doc(`users/${uid}`).get();
	const data = snap.data() || {};
	const rawRole = String(data.role || "").toLowerCase();
	// Accept a couple of common spellings from earlier iterations
	// (e.g. "super-admin" in Firestore).
	const normalizedRole = rawRole.replace(/\s+/g, "").replace(/-/g, "");
	const role = (normalizedRole as UserRole | "") || "member";
	const isSuperAdminLegacy = data.isSuperAdmin === true;
	const isOwnerEmail = String(data.email || "").toLowerCase() === OWNER_EMAIL;
	// Allow superadmin, admin, or the owner email account
	if (role !== "superadmin" && role !== "admin" && !isSuperAdminLegacy && !isOwnerEmail) {
		throw new HttpsError("permission-denied", "Admin privileges required.");
	}
}

// ── Notification functions ──
export { onTaskWrite } from "./notifications/scheduler";
export { processScheduledNotifications, scheduleDailyDigests } from "./notifications/processor";

export const inviteUser = onCall(async (request) => {
	const uid = requireAuth(request);
	await requireSuperAdmin(uid);

	const firstName = String(request.data?.firstName || "").trim();
	const surname = String(request.data?.surname || "").trim();
	const email = String(request.data?.email || "").trim().toLowerCase();
	const password = String(request.data?.password || "");
	const role = (String(request.data?.role || "member") as UserRole) || "member";

	if (!firstName || !email || !password) {
		throw new HttpsError("invalid-argument", "firstName, email, and password are required.");
	}
	if (password.length < 8) {
		throw new HttpsError("invalid-argument", "Password must be at least 8 characters.");
	}
	if (!/[0-9]/.test(password)) {
		throw new HttpsError("invalid-argument", "Password must contain at least one number (0–9).");
	}
	if (!/[^a-zA-Z0-9]/.test(password)) {
		throw new HttpsError("invalid-argument", "Password must contain at least one special character (e.g. ! @ # $).");
	}
	if (!email.includes("@")) {
		throw new HttpsError("invalid-argument", "Email address is invalid.");
	}

	logger.info("inviteUser creating auth user", { email, role });

	// Create Auth user
	const created = await admin.auth().createUser({
		email,
		password,
		displayName: surname ? `${firstName} ${surname}` : firstName,
	});

	// Store profile in Firestore
	await admin.firestore().doc(`users/${created.uid}`).set(
		{
			email,
			firstName,
			surname,
			displayName: surname ? `${firstName} ${surname}` : firstName,
			role,
			enabled: true,
			createdAt: admin.firestore.FieldValue.serverTimestamp(),
			createdBy: uid,
		},
		{ merge: true }
	);

	// Optional: force password change on first login could be enforced by UI.
	// Firebase Auth doesn't support an explicit "must change password" flag.

	return { uid: created.uid };
});

function validatePasswordStrength(password: string) {
	if (password.length < 8) {
		throw new HttpsError("invalid-argument", "Password must be at least 8 characters.");
	}
	if (!/[0-9]/.test(password)) {
		throw new HttpsError("invalid-argument", "Password must contain at least one number (0–9).");
	}
	if (!/[^a-zA-Z0-9]/.test(password)) {
		throw new HttpsError("invalid-argument", "Password must contain at least one special character (e.g. ! @ # $).");
	}
}

// Directly set a user's password (admin action) — used for both the
// "Set Temporary" reset-password flow and any other admin-initiated
// password change.
export const resetUserPassword = onCall(async (request) => {
	const uid = requireAuth(request);
	await requireSuperAdmin(uid);

	const targetUid = String(request.data?.uid || "");
	const newPassword = String(request.data?.newPassword || "");

	if (!targetUid || !newPassword) {
		throw new HttpsError("invalid-argument", "uid and newPassword are required.");
	}
	validatePasswordStrength(newPassword);

	try {
		await admin.auth().updateUser(targetUid, { password: newPassword });
	} catch (err: any) {
		logger.error("resetUserPassword: updateUser failed", { targetUid, error: err?.message });
		throw new HttpsError("internal", err?.message || "Failed to set password.");
	}

	logger.info("resetUserPassword: password updated", { targetUid, by: uid });
	return { success: true };
});

// Generate a Firebase Auth password reset link and email it via Postmark
// (Firebase's own default Auth mailer isn't configured for this project).
export const sendPasswordResetLink = onCall(
	{ secrets: [postmarkKey] },
	async (request) => {
		const uid = requireAuth(request);
		await requireSuperAdmin(uid);

		const targetUid = String(request.data?.uid || "");
		if (!targetUid) {
			throw new HttpsError("invalid-argument", "uid is required.");
		}

		const userRecord = await admin.auth().getUser(targetUid);
		const email = userRecord.email;
		if (!email) {
			throw new HttpsError("failed-precondition", "This user has no email address on file.");
		}

		let link: string;
		try {
			link = await admin.auth().generatePasswordResetLink(email);
		} catch (err: any) {
			logger.error("sendPasswordResetLink: generatePasswordResetLink failed", { email, error: err?.message });
			throw new HttpsError("internal", "Failed to generate reset link.");
		}

		try {
			const client = new postmark.ServerClient(postmarkKey.value());
			await client.sendEmail({
				From: FROM_EMAIL,
				To: email,
				Subject: "Reset your Hardy Hub password",
				TextBody: `We received a request to reset your Hardy Hub password.\n\nClick the link below to choose a new password:\n${link}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore this email.`,
				HtmlBody: `<p>We received a request to reset your Hardy Hub password.</p><p><a href="${link}">Click here to choose a new password</a>.</p><p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>`,
				MessageStream: "outbound",
			});
		} catch (err: any) {
			logger.error("sendPasswordResetLink: postmark send failed", { email, error: err?.message });
			throw new HttpsError("internal", "Failed to send reset email.");
		}

		logger.info("sendPasswordResetLink: email sent", { targetUid, email, by: uid });
		return { success: true };
	}
);

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
