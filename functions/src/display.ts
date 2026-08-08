import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

// Always-on /display kiosk pairing. A display shows a QR code, a phone scans
// it and approves, and the display then signs in permanently as that account
// via a minted custom token. All state lives in devicePairings/{id}, which
// has NO client-facing Firestore rules at all — every read/write goes through
// these Cloud Functions (Admin SDK bypasses rules), so there's no public
// surface on a collection that briefly holds a uid.

const PAIRING_TTL_MS = 5 * 60 * 1000;

function requireAuth(request: { auth?: { uid: string } }) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "You must be signed in.");
  return uid;
}

function isExpired(data: FirebaseFirestore.DocumentData): boolean {
  const expiresAtMs = data.expiresAt?.toMillis ? data.expiresAt.toMillis() : 0;
  return expiresAtMs > 0 && Date.now() > expiresAtMs;
}

export const createDevicePairing = onCall(async () => {
  const ref = admin.firestore().collection("devicePairings").doc();
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + PAIRING_TTL_MS);
  await ref.set({
    status: "pending",
    claimed: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt,
  });
  return { pairingId: ref.id, expiresAt: expiresAt.toMillis() };
});

// No auth required — deliberately returns nothing but a status string so an
// unauthenticated display polling this can never learn a uid or token.
export const getDevicePairingStatus = onCall(async (request) => {
  const pairingId = String(request.data?.pairingId || "");
  if (!pairingId) throw new HttpsError("invalid-argument", "pairingId is required.");

  const snap = await admin.firestore().doc(`devicePairings/${pairingId}`).get();
  if (!snap.exists) return { status: "not_found" };

  const data = snap.data()!;
  if (data.status === "pending" && isExpired(data)) return { status: "expired" };
  return { status: data.status as string };
});

export const approveDevicePairing = onCall(async (request) => {
  const uid = requireAuth(request);
  const pairingId = String(request.data?.pairingId || "");
  const requestedHouseholdId = request.data?.householdId ? String(request.data.householdId) : null;
  if (!pairingId) throw new HttpsError("invalid-argument", "pairingId is required.");

  // Only attach a household if the approving user is actually a member —
  // this only affects what the display later shows, but there's no reason
  // to trust an arbitrary client-supplied id.
  let householdId: string | null = null;
  if (requestedHouseholdId) {
    const hSnap = await admin.firestore().doc(`households/${requestedHouseholdId}`).get();
    const memberIds: string[] = hSnap.exists ? hSnap.data()?.memberIds || [] : [];
    if (memberIds.includes(uid)) householdId = requestedHouseholdId;
  }

  const ref = admin.firestore().doc(`devicePairings/${pairingId}`);
  await admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "This pairing code has expired or doesn't exist.");
    const data = snap.data()!;
    if (data.status !== "pending") throw new HttpsError("failed-precondition", "This pairing code was already used.");
    if (isExpired(data)) throw new HttpsError("deadline-exceeded", "This pairing code has expired.");
    tx.update(ref, {
      status: "approved",
      uid,
      householdId,
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  logger.info("approveDevicePairing: approved", { pairingId, uid, householdId });
  return { success: true };
});

export const denyDevicePairing = onCall(async (request) => {
  requireAuth(request);
  const pairingId = String(request.data?.pairingId || "");
  if (!pairingId) throw new HttpsError("invalid-argument", "pairingId is required.");

  const ref = admin.firestore().doc(`devicePairings/${pairingId}`);
  await admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "This pairing code has expired or doesn't exist.");
    if (snap.data()!.status !== "pending") throw new HttpsError("failed-precondition", "This pairing code was already used.");
    tx.update(ref, { status: "denied" });
  });

  return { success: true };
});

// No auth required — called by the still-signed-out display once it observes
// status "approved". Atomically flips claimed:false -> true so a retried/
// duplicate call (e.g. from a flaky connection) can't mint two tokens.
export const claimDevicePairing = onCall(async (request) => {
  const pairingId = String(request.data?.pairingId || "");
  if (!pairingId) throw new HttpsError("invalid-argument", "pairingId is required.");

  const ref = admin.firestore().doc(`devicePairings/${pairingId}`);
  const claim = await admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "This pairing code has expired or doesn't exist.");
    const data = snap.data()!;
    if (data.status !== "approved") throw new HttpsError("failed-precondition", "This pairing hasn't been approved yet.");
    if (data.claimed) throw new HttpsError("failed-precondition", "This pairing code has already been used.");
    if (isExpired(data)) throw new HttpsError("deadline-exceeded", "This pairing code has expired.");
    tx.update(ref, { claimed: true, claimedAt: admin.firestore.FieldValue.serverTimestamp() });
    return { uid: data.uid as string, householdId: (data.householdId as string | null) ?? null };
  });

  const deviceRef = await admin.firestore().collection("devices").add({
    uid: claim.uid,
    householdId: claim.householdId,
    label: "New Display",
    deviceType: "display",
    pairedVia: "qr",
    revoked: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
    settings: {},
  });

  // The deviceId custom claim is what lets firestore.rules enforce real,
  // near-immediate revocation for QR-paired devices (see isAuthenticated()).
  const customToken = await admin.auth().createCustomToken(claim.uid, { deviceId: deviceRef.id });

  logger.info("claimDevicePairing: claimed", { pairingId, uid: claim.uid, deviceId: deviceRef.id });
  return { customToken, deviceId: deviceRef.id, householdId: claim.householdId };
});

// ── Household calendar aggregation ─────────────────────────────────────────
//
// Calendar events are stored per-uid (calendar/{uid}/events) and gated by
// per-owner pageShares in firestore.rules — household co-membership grants
// nothing there today. A /display household calendar view needs every
// member's events without each of them manually sharing their calendar with
// the display's own uid, so this runs server-side with the Admin SDK
// (which bypasses those rules) after independently verifying the caller is
// actually a member of the household they're asking about.

const CALENDAR_WINDOW_PAST_DAYS = 3;
const CALENDAR_WINDOW_FUTURE_DAYS = 45;

interface HouseholdCalendarEventOut {
  id: string;
  title: string;
  description?: string;
  location?: string;
  category: string;
  startDate: string;
  endDate: string;
  allDay?: boolean;
  ownerUid: string;
  ownerName: string;
  ownerColor: string;
}

// Mirrors canAccessHousehold() in firestore.rules: a "household" isn't always
// a formal households/{id} doc. Older data predates the multi-membership
// model and is scoped directly under the owner's own uid, or via legacy
// householdId/householdIds fields on the user doc — both still work
// everywhere else in the app (household items, documents, cameras), so the
// calendar aggregation needs to recognise them too, not just the formal doc.
async function resolveHouseholdMemberIds(uid: string, householdId: string): Promise<string[]> {
  const householdSnap = await admin.firestore().doc(`households/${householdId}`).get();
  if (householdSnap.exists) {
    const memberIds: string[] = householdSnap.data()?.memberIds || [];
    if (!memberIds.includes(uid)) {
      throw new HttpsError("permission-denied", "You're not a member of this household.");
    }
    return memberIds;
  }

  if (householdId === uid) return [uid];

  const userSnap = await admin.firestore().doc(`users/${uid}`).get();
  const userData = userSnap.exists ? userSnap.data() || {} : {};
  const legacyIds: string[] = [
    ...(Array.isArray(userData.householdIds) ? userData.householdIds : []),
    ...(userData.householdId ? [String(userData.householdId)] : []),
  ];
  if (!legacyIds.includes(householdId)) {
    throw new HttpsError("not-found", "Household not found.");
  }
  return [uid];
}

export const getHouseholdCalendarEvents = onCall(async (request) => {
  const uid = requireAuth(request);
  const householdId = String(request.data?.householdId || "");
  if (!householdId) throw new HttpsError("invalid-argument", "householdId is required.");

  const memberIds = await resolveHouseholdMemberIds(uid, householdId);

  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - CALENDAR_WINDOW_PAST_DAYS);
  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + CALENDAR_WINDOW_FUTURE_DAYS);

  const userDocs = await admin.firestore().getAll(...memberIds.map((id) => admin.firestore().doc(`users/${id}`)));
  const ownerMeta = new Map<string, { name: string; color: string }>();
  userDocs.forEach((snap, i) => {
    const data = snap.exists ? snap.data()! : {};
    const name = data.displayName || [data.firstName, data.surname].filter(Boolean).join(" ") || "Family member";
    ownerMeta.set(memberIds[i], { name, color: data.avatarBgColor || "hsl(215, 60%, 28%)" });
  });

  const eventSnapshots = await Promise.all(
    memberIds.map((memberUid) => admin.firestore().collection(`calendar/${memberUid}/events`).get())
  );

  const events: HouseholdCalendarEventOut[] = [];
  eventSnapshots.forEach((snap, i) => {
    const memberUid = memberIds[i];
    const meta = ownerMeta.get(memberUid) || { name: "Family member", color: "hsl(215, 60%, 28%)" };
    snap.docs.forEach((doc) => {
      const data = doc.data();
      const start = new Date(data.startDate);
      if (Number.isNaN(start.getTime()) || start < windowStart || start > windowEnd) return;
      events.push({
        id: doc.id,
        title: data.title || "Untitled event",
        description: data.description,
        location: data.location,
        category: data.category || "other",
        startDate: data.startDate,
        endDate: data.endDate,
        allDay: data.allDay === true,
        ownerUid: memberUid,
        ownerName: meta.name,
        ownerColor: meta.color,
      });
    });
  });

  events.sort((a, b) => a.startDate.localeCompare(b.startDate));

  return { events };
});
