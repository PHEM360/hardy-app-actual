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
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import * as functionsV1 from "firebase-functions/v1";
import { PDFParse } from "pdf-parse";
import { postmarkKey } from "./notifications/scheduler";
import { sendTransactionalEmail } from "./notifications/sender";

// AI Analysis — key lives only in Secret Manager, never sent to the browser.
// Set it once with: firebase functions:secrets:set OPENAI_API_KEY
export const openaiApiKey = defineSecret("OPENAI_API_KEY");

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
	if (context.auth?.token?.deviceId) {
		throw new HttpsError("permission-denied", "Remote display credentials cannot use this service.");
	}
	return uid;
}

const OWNER_EMAIL = "chris.hardy.07@googlemail.com";

async function requireSuperAdmin(uid: string, authEmail?: string) {
	const snap = await admin.firestore().doc(`users/${uid}`).get();
	const data = snap.data() || {};
	const rawRole = String(data.role || "").toLowerCase();
	// Accept a couple of common spellings from earlier iterations
	// (e.g. "super-admin" in Firestore).
	const normalizedRole = rawRole.replace(/\s+/g, "").replace(/-/g, "");
	const role = (normalizedRole as UserRole | "") || "member";
	const isSuperAdminLegacy = data.isSuperAdmin === true;
	const profileEmail = String(data.email || "").toLowerCase();
	const tokenEmail = String(authEmail || "").toLowerCase();
	const isOwnerEmail = profileEmail === OWNER_EMAIL || tokenEmail === OWNER_EMAIL;
	// Allow superadmin, admin, or the owner email account
	if (role !== "superadmin" && role !== "admin" && !isSuperAdminLegacy && !isOwnerEmail) {
		throw new HttpsError("permission-denied", "Admin privileges required.");
	}
}

// ── Notification functions ──
export { onTaskWrite } from "./notifications/scheduler";
export { processScheduledNotifications, scheduleDailyDigests } from "./notifications/processor";

export {
	startTrueLayerConnect,
	completeTrueLayerConnect,
	listTrueLayerAccounts,
	linkTrueLayerAccount,
	unlinkTrueLayerAccount,
	syncTrueLayerBalances,
	disconnectTrueLayer,
	trueLayerCallback,
	syncAllTrueLayerBalances,
} from "./truelayer";

// ── /display kiosk pairing ──
export {
	createDevicePairing,
	getDevicePairingStatus,
	approveDevicePairing,
	denyDevicePairing,
	claimDevicePairing,
	getHouseholdCalendarEvents,
} from "./display";

export {
	beginPasskeyRegistration,
	finishPasskeyRegistration,
	beginPasskeyAuthentication,
	finishPasskeyAuthentication,
	resetUserPasskeys,
} from "./passkeys";

// ── Company marketing ──
export {
	generateMarketingPlan,
	generateMarketingAudit,
	approveMarketingContent,
	rejectMarketingContent,
	publishMarketingContentNow,
	processMarketingPublishJobs,
	startMarketingPlatformConnection,
	generateMarketingImage,
} from "./marketing";

// ── Dog tags (Pets page) ──
export { getDogTagPublicInfo, getDogTagProfileBySlug, getDogTagNotifyRecipients, reportDogTagScan } from "./dogTags";

export const inviteUser = onCall(async (request) => {
	const uid = requireAuth(request);
	await requireSuperAdmin(uid, request.auth?.token?.email);

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
	if (!/[A-Z]/.test(password) || !/[a-z]/.test(password)) {
		throw new HttpsError("invalid-argument", "Password must contain upper-case and lower-case letters.");
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

	const displayName = surname ? `${firstName} ${surname}` : firstName;
	const profile = {
		email,
		firstName,
		surname,
		displayName,
		role,
		enabled: true,
		createdAt: FieldValue.serverTimestamp(),
		createdBy: uid,
	};

	logger.info("inviteUser creating auth user", { email, role });

	try {
		const created = await admin.auth().createUser({ email, password, displayName });
		await admin.firestore().doc(`users/${created.uid}`).set(profile, { merge: true });
		return { uid: created.uid };
	} catch (err: any) {
		if (err?.code === "auth/email-already-exists") {
			const existing = await admin.auth().getUserByEmail(email);
			const profileSnap = await admin.firestore().doc(`users/${existing.uid}`).get();
			if (profileSnap.exists) {
				throw new HttpsError("already-exists", "This email already has an account.");
			}
			// Auth user leftover after a Firestore-only delete — restore the profile
			// and set the new temporary password so they can sign in.
			await admin.auth().updateUser(existing.uid, { password, displayName });
			await admin.firestore().doc(`users/${existing.uid}`).set(profile, { merge: true });
			logger.info("inviteUser restored leftover auth account", { email, uid: existing.uid });
			return { uid: existing.uid, restored: true };
		}
		logger.error("inviteUser failed", { email, code: err?.code, error: err?.message });
		if (err instanceof HttpsError) throw err;
		throw new HttpsError("internal", err?.message || "Failed to create user.");
	}
});

export const deleteUserAccount = onCall(async (request) => {
	const uid = requireAuth(request);
	await requireSuperAdmin(uid, request.auth?.token?.email);

	const targetUid = String(request.data?.uid || "").trim();
	if (!targetUid) {
		throw new HttpsError("invalid-argument", "uid is required.");
	}
	if (targetUid === uid) {
		throw new HttpsError("failed-precondition", "You can't delete your own account.");
	}

	try {
		await admin.auth().deleteUser(targetUid);
	} catch (err: any) {
		if (err?.code !== "auth/user-not-found") {
			logger.error("deleteUserAccount: auth delete failed", { targetUid, code: err?.code, error: err?.message });
			throw new HttpsError("internal", err?.message || "Failed to delete the login for this account.");
		}
	}

	await admin.firestore().doc(`users/${targetUid}`).delete().catch(() => undefined);
	logger.info("deleteUserAccount: deleted", { targetUid, by: uid });
	return { success: true };
});

function chunk<T>(items: T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
	return out;
}

function formatAdminRole(role: unknown, data?: admin.firestore.DocumentData): "Superadmin" | "Admin" | "Member" {
	const raw = String(role || (data?.isSuperAdmin ? "superadmin" : data?.isAdmin ? "admin" : "member"));
	const normalized = raw.toLowerCase().replace(/\s+/g, "").replace(/-/g, "");
	if (normalized === "superadmin") return "Superadmin";
	if (normalized === "admin") return "Admin";
	return "Member";
}

/** Admin user list is Auth accounts, with Firestore profile fields merged on top. */
export const listAppUsers = onCall(async (request) => {
	const uid = requireAuth(request);
	await requireSuperAdmin(uid, request.auth?.token?.email);

	const authUsers: admin.auth.UserRecord[] = [];
	let pageToken: string | undefined;
	do {
		const page = await admin.auth().listUsers(1000, pageToken);
		authUsers.push(...page.users);
		pageToken = page.pageToken;
	} while (pageToken);

	const db = admin.firestore();
	const refs = authUsers.map((u) => db.doc(`users/${u.uid}`));
	const snaps: admin.firestore.DocumentSnapshot[] = [];
	for (const group of chunk(refs, 100)) {
		snaps.push(...(await db.getAll(...group)));
	}
	const profileByUid = new Map(snaps.map((snap) => [snap.id, snap.exists ? snap.data() : null]));

	const missing = authUsers.filter((record) => !profileByUid.get(record.uid));
	await Promise.all(
		missing.map((record) => {
			const displayName = String(record.displayName || "").trim();
			const parts = displayName.split(/\s+/).filter(Boolean);
			return db.doc(`users/${record.uid}`).set(
				{
					email: record.email || "",
					firstName: parts[0] || "",
					surname: parts.slice(1).join(" ") || "",
					displayName,
					role: "member",
					enabled: !record.disabled,
					createdAt: FieldValue.serverTimestamp(),
					createdBy: "listAppUsers-backfill",
				},
				{ merge: true }
			);
		})
	);

	const users = authUsers.map((record) => {
		const data = profileByUid.get(record.uid) as admin.firestore.DocumentData | null;
		const email = String(record.email || data?.email || "");
		const displayName = String(
			data?.displayName ||
			`${data?.firstName || ""} ${data?.surname || ""}`.trim() ||
			record.displayName ||
			email ||
			record.uid
		).trim();
		const lastLoginAt = record.metadata.lastSignInTime ? new Date(record.metadata.lastSignInTime) : null;
		return {
			id: record.uid,
			name: displayName,
			email,
			role: formatAdminRole(data?.role, data || undefined),
			status: record.disabled || data?.enabled === false ? "suspended" : "active",
			lastLogin: lastLoginAt ? lastLoginAt.toLocaleString("en-GB") : "—",
			permissions: Array.isArray(data?.permissions) ? data.permissions : [],
			enabledFeatures: Array.isArray(data?.enabledFeatures) ? data.enabledFeatures : [],
			householdId: data?.householdId ?? undefined,
			householdIds: Array.isArray(data?.householdIds)
				? data.householdIds
				: (data?.householdId ? [data.householdId] : []),
		};
	});

	users.sort((a, b) => a.name.localeCompare(b.name));
	return { users };
});

/** If an Auth account is created outside Admin (console, etc.), give it a Firestore profile. */
export const onAuthUserCreated = functionsV1.auth.user().onCreate(async (user) => {
	const ref = admin.firestore().doc(`users/${user.uid}`);
	const snap = await ref.get();
	if (snap.exists) return;
	const displayName = String(user.displayName || "").trim();
	const parts = displayName.split(/\s+/).filter(Boolean);
	await ref.set(
		{
			email: user.email || "",
			firstName: parts[0] || "",
			surname: parts.slice(1).join(" ") || "",
			displayName,
			role: "member",
			enabled: !user.disabled,
			createdAt: FieldValue.serverTimestamp(),
			createdBy: "auth-onCreate",
		},
		{ merge: true }
	);
	logger.info("onAuthUserCreated: profile created", { uid: user.uid, email: user.email });
});

/** Deleting an Auth account (Admin or Firebase console) also removes the Firestore profile. */
export const onAuthUserDeleted = functionsV1.auth.user().onDelete(async (user) => {
	await admin.firestore().doc(`users/${user.uid}`).delete().catch(() => undefined);
	logger.info("onAuthUserDeleted: profile removed", { uid: user.uid, email: user.email });
});

function validatePasswordStrength(password: string) {
	if (password.length < 8) {
		throw new HttpsError("invalid-argument", "Password must be at least 8 characters.");
	}
	if (!/[A-Z]/.test(password) || !/[a-z]/.test(password)) {
		throw new HttpsError("invalid-argument", "Password must contain upper-case and lower-case letters.");
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
	await requireSuperAdmin(uid, request.auth?.token?.email);

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
		await requireSuperAdmin(uid, request.auth?.token?.email);

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
			await sendTransactionalEmail(postmarkKey.value(), email, {
				subject: "Reset your Hardy Hub password",
				heading: "Reset your Hardy Hub password",
				body_html: "<p>We received a request to reset your Hardy Hub password.</p>",
				body_text: "We received a request to reset your Hardy Hub password.",
				action: { url: link, label: "Choose a new password" },
				footer_note: "This link expires in 1 hour. If you didn't request this, you can ignore this email.",
			});
		} catch (err: any) {
			logger.error("sendPasswordResetLink: postmark send failed", { email, error: err?.message });
			throw new HttpsError("internal", "Failed to send reset email.");
		}

		logger.info("sendPasswordResetLink: email sent", { targetUid, email, by: uid });
		return { success: true };
	}
);

// A Firestore document id can't be empty, contain "/", or be exactly "." or "..",
// and must be <= 1500 bytes. Legacy household values were free-typed strings, so
// guard against anything that would make an invalid path segment.
function isValidHouseholdId(id: string): boolean {
	if (!id || id === "." || id === "..") return false;
	if (id.includes("/")) return false;
	return Buffer.byteLength(id, "utf8") <= 1500;
}

// Additive, idempotent backfill: for every user's legacy householdId/householdIds
// value, ensure a matching households/{id} doc exists with that user listed in
// memberIds. Never moves or deletes anything — existing household/{id}/... and
// cameras/{id}/... data stays exactly where it is; this only adds the membership
// metadata layer on top of ids that already exist. Safe to re-run at any time.
export const backfillHouseholds = onCall(async (request) => {
	const uid = requireAuth(request);
	await requireSuperAdmin(uid, request.auth?.token?.email);

	const usersSnap = await admin.firestore().collection("users").get();

	const membersByHousehold = new Map<string, Set<string>>();
	const skipped: string[] = [];

	usersSnap.docs.forEach((userDoc) => {
		const data = userDoc.data() || {};
		const ids = new Set<string>();
		if (Array.isArray(data.householdIds)) {
			data.householdIds.forEach((id: unknown) => {
				if (typeof id === "string" && id.trim()) ids.add(id.trim());
			});
		}
		if (typeof data.householdId === "string" && data.householdId.trim()) {
			ids.add(data.householdId.trim());
		}
		if (ids.size === 0) {
			ids.add(userDoc.id); // legacy uid-as-household fallback
		}

		ids.forEach((id) => {
			if (!isValidHouseholdId(id)) {
				skipped.push(id);
				return;
			}
			if (!membersByHousehold.has(id)) membersByHousehold.set(id, new Set());
			membersByHousehold.get(id)!.add(userDoc.id);
		});
	});

	const householdIds = Array.from(membersByHousehold.keys());
	if (householdIds.length === 0) {
		return { householdsTouched: 0, skipped };
	}

	const refs = householdIds.map((id) => admin.firestore().doc(`households/${id}`));
	const existingSnaps = await admin.firestore().getAll(...refs);

	let touched = 0;
	for (let i = 0; i < refs.length; i += 500) {
		const batch = admin.firestore().batch();
		const chunkRefs = refs.slice(i, i + 500);
		chunkRefs.forEach((ref, chunkIdx) => {
			const idx = i + chunkIdx;
			const id = householdIds[idx];
			const existing = existingSnaps[idx];
			const memberIds = Array.from(membersByHousehold.get(id)!);
			const update: Record<string, unknown> = {
				memberIds: FieldValue.arrayUnion(...memberIds),
			};
			if (!existing.exists || !existing.data()?.name) {
				update.name = id;
			}
			if (!existing.exists || !existing.data()?.createdBy) {
				update.createdBy = memberIds.slice().sort()[0];
			}
			if (!existing.exists) {
				update.createdAt = FieldValue.serverTimestamp();
			}
			batch.set(ref, update, { merge: true });
			touched += 1;
		});
		await batch.commit();
	}

	logger.info("backfillHouseholds: complete", { touched, skipped, by: uid });
	return { householdsTouched: touched, skipped };
});

// ── AI Analysis ──────────────────────────────────────────────────────────────

const AI_MAX_DOCUMENTS = 5;
const AI_MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB
const AI_MAX_EXTRACTED_CHARS = 40000;

interface AiDocumentInput {
	storagePath: string;
	mimeType: string;
}

type AiContentPart =
	| { type: "text"; text: string }
	| { type: "image_url"; image_url: { url: string } };

// Analyzes one or more of the caller's own uploaded documents against a question,
// using GPT-4o-mini. PDFs are text-extracted server-side; images are sent directly
// as vision input. The OpenAI key is a Secret Manager value — it never reaches the
// client, unlike the existing client-side Gemini/OpenAI key used by the Health
// AI feature.
export const analyzeDocuments = onCall(
	{ secrets: [openaiApiKey], timeoutSeconds: 120, memory: "512MiB" },
	async (request) => {
		const uid = requireAuth(request);

		const documents = Array.isArray(request.data?.documents) ? (request.data.documents as AiDocumentInput[]) : [];
		const question = String(request.data?.question || "").trim();

		if (documents.length === 0) throw new HttpsError("invalid-argument", "At least one document is required.");
		if (documents.length > AI_MAX_DOCUMENTS) {
			throw new HttpsError("invalid-argument", `No more than ${AI_MAX_DOCUMENTS} documents per request.`);
		}
		if (!question) throw new HttpsError("invalid-argument", "A question is required.");

		for (const d of documents) {
			if (!d.storagePath || !d.storagePath.startsWith(`aiAnalysis/${uid}/`)) {
				throw new HttpsError("permission-denied", "You can only analyze your own uploaded documents.");
			}
		}

		const bucket = admin.storage().bucket();
		const contentParts: AiContentPart[] = [];

		for (const d of documents) {
			const file = bucket.file(d.storagePath);
			const [metadata] = await file.getMetadata();
			const size = Number(metadata.size || 0);
			if (size > AI_MAX_FILE_BYTES) {
				throw new HttpsError("invalid-argument", `${d.storagePath.split("/").pop()} is too large (max 15MB).`);
			}
			const [buffer] = await file.download();
			const label = d.storagePath.split("/").pop() ?? "document";

			if (d.mimeType === "application/pdf") {
				const parser = new PDFParse({ data: buffer });
				try {
					const result = await parser.getText();
					const text = result.text.slice(0, AI_MAX_EXTRACTED_CHARS);
					contentParts.push({ type: "text", text: `--- Document: ${label} ---\n${text}` });
				} finally {
					await parser.destroy();
				}
			} else if (d.mimeType.startsWith("image/")) {
				const base64 = buffer.toString("base64");
				contentParts.push({ type: "image_url", image_url: { url: `data:${d.mimeType};base64,${base64}` } });
			} else {
				throw new HttpsError("invalid-argument", `Unsupported file type: ${d.mimeType}`);
			}
		}

		const systemPrompt = "You are a careful document analyst helping a family member understand a personal " +
			"document (e.g. a bill, statement, insurance policy, or tax document). Answer the user's question using " +
			"ONLY the content of the provided document(s). If the answer isn't in the document, say so clearly " +
			"rather than guessing. Be concise and specific — cite figures, dates, and reference numbers exactly as " +
			"they appear. Use plain, friendly English, with short paragraphs or a bullet list where that's clearer " +
			"than prose.";

		let response: Response;
		try {
			response = await fetch("https://api.openai.com/v1/chat/completions", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${openaiApiKey.value()}`,
				},
				body: JSON.stringify({
					model: "gpt-4o-mini",
					messages: [
						{ role: "system", content: systemPrompt },
						{ role: "user", content: [...contentParts, { type: "text", text: `Question: ${question}` }] },
					],
					max_tokens: 1200,
					temperature: 0.2,
				}),
			});
		} catch (err) {
			logger.error("analyzeDocuments: fetch to OpenAI failed", { error: (err as Error).message });
			throw new HttpsError("internal", "Could not reach the AI service. Please try again.");
		}

		if (!response.ok) {
			const errText = await response.text();
			logger.error("analyzeDocuments: OpenAI request failed", { status: response.status, errText });
			if (response.status === 401) {
				throw new HttpsError("failed-precondition", "The OpenAI API key is missing or invalid.");
			}
			throw new HttpsError("internal", "The AI service could not process this request.");
		}

		const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
		const answer = data.choices?.[0]?.message?.content;
		if (!answer) throw new HttpsError("internal", "No answer was returned.");

		logger.info("analyzeDocuments: success", { uid, documentCount: documents.length });
		return { answer };
	}
);

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
