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

async function requireSuperAdmin(uid: string) {
	const snap = await admin.firestore().doc(`users/${uid}`).get();
	const data = snap.data() || {};
	const rawRole = String(data.role || "").toLowerCase();
	// Accept a couple of common spellings from earlier iterations
	// (e.g. "super-admin" in Firestore).
	const normalizedRole = rawRole.replace(/\s+/g, "").replace(/-/g, "");
	const role = (normalizedRole as UserRole | "") || "member";
	const isSuperAdminLegacy = data.isSuperAdmin === true;
	if (role !== "superadmin" && !isSuperAdminLegacy) {
		throw new HttpsError("permission-denied", "Superadmin privileges required.");
	}
}

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

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
