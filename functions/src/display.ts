import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { hasFreshPasskey, passkeyFreshnessDays } from "./securityPolicy";

// Always-on /display kiosk pairing. A display shows a QR code, a phone scans
// it and approves, and the display then signs in permanently as that account
// via a minted custom token. All state lives in devicePairings/{id}, which
// has NO client-facing Firestore rules at all — every read/write goes through
// these Cloud Functions (Admin SDK bypasses rules), so there's no public
// surface on a collection that briefly holds a uid.

const PAIRING_TTL_MS = 5 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const PAIRING_ID_PATTERN = /^[A-Za-z0-9_-]{10,128}$/;

function pairingIdFrom(request: { data?: unknown }): string {
  const data = request.data as { pairingId?: unknown } | undefined;
  const pairingId = String(data?.pairingId || "");
  if (!PAIRING_ID_PATTERN.test(pairingId)) {
    throw new HttpsError("invalid-argument", "A valid pairingId is required.");
  }
  return pairingId;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function secretsMatch(value: string, expectedHash: string): boolean {
  const actual = Buffer.from(sha256(value), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function enforceAnonymousRateLimit(
  request: { rawRequest: { ip?: string; socket?: { remoteAddress?: string } } },
  action: "create" | "claim",
  maxAttempts: number
): Promise<void> {
  const address = request.rawRequest.ip || request.rawRequest.socket?.remoteAddress || "unknown";
  const window = Math.floor(Date.now() / RATE_LIMIT_WINDOW_MS);
  const key = sha256(`${action}:${address}:${window}`);
  const ref = admin.firestore().doc(`functionRateLimits/${key}`);

  await admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = snap.exists ? Number(snap.data()?.count || 0) : 0;
    if (count >= maxAttempts) {
      throw new HttpsError("resource-exhausted", "Too many pairing attempts. Please wait a few minutes.");
    }
    tx.set(ref, {
      action,
      count: count + 1,
      expiresAt: Timestamp.fromMillis((window + 2) * RATE_LIMIT_WINDOW_MS),
    });
  });
}

function requireAuth(request: { auth?: { uid: string } }) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "You must be signed in.");
  return uid;
}

async function requireAccountAuth(request: { auth?: { uid: string; token?: Record<string, unknown> } }) {
  const uid = requireAuth(request);
  if (request.auth?.token?.deviceId) {
    throw new HttpsError("permission-denied", "Pairing must be approved from your phone or computer.");
  }
  const days = await passkeyFreshnessDays(uid);
  if (!hasFreshPasskey(request.auth?.token, days)) {
    throw new HttpsError("failed-precondition", "Confirm your passkey before linking a remote display.");
  }
  return uid;
}

function isExpired(data: FirebaseFirestore.DocumentData): boolean {
  const expiresAtMs = data.expiresAt?.toMillis ? data.expiresAt.toMillis() : 0;
  return expiresAtMs > 0 && Date.now() > expiresAtMs;
}

export const createDevicePairing = onCall(async (request) => {
  await enforceAnonymousRateLimit(request, "create", 8);
  const ref = admin.firestore().collection("devicePairings").doc();
  const expiresAt = Timestamp.fromMillis(Date.now() + PAIRING_TTL_MS);
  const claimSecret = randomBytes(32).toString("base64url");
  await ref.set({
    status: "pending",
    claimed: false,
    claimSecretHash: sha256(claimSecret),
    createdAt: FieldValue.serverTimestamp(),
    expiresAt,
  });
  return { pairingId: ref.id, claimSecret, expiresAt: expiresAt.toMillis() };
});

// No auth required — deliberately returns nothing but a status string so an
// unauthenticated display polling this can never learn a uid or token.
export const getDevicePairingStatus = onCall(async (request) => {
  const pairingId = pairingIdFrom(request);

  const snap = await admin.firestore().doc(`devicePairings/${pairingId}`).get();
  if (!snap.exists) return { status: "not_found" };

  const data = snap.data()!;
  if (!data.claimed && isExpired(data)) return { status: "expired" };
  return { status: data.status as string };
});

export const approveDevicePairing = onCall(async (request) => {
  const uid = await requireAccountAuth(request);
  const pairingId = pairingIdFrom(request);

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
      // A display belongs to exactly the approving account. Never inherit
      // the phone's currently selected household, which can change later.
      householdId: uid,
      approvedAt: FieldValue.serverTimestamp(),
    });
  });

  logger.info("approveDevicePairing: approved", { pairingId, uid });
  return { success: true };
});

export const denyDevicePairing = onCall(async (request) => {
  await requireAccountAuth(request);
  const pairingId = pairingIdFrom(request);

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
  await enforceAnonymousRateLimit(request, "claim", 12);
  const pairingId = pairingIdFrom(request);
  const claimSecret = String(request.data?.claimSecret || "");
  if (!claimSecret) throw new HttpsError("invalid-argument", "claimSecret is required.");

  const ref = admin.firestore().doc(`devicePairings/${pairingId}`);
  const proposedDeviceRef = admin.firestore().collection("devices").doc();
  const claim = await admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "This pairing code has expired or doesn't exist.");
    const data = snap.data()!;
    if (!data.claimSecretHash || !secretsMatch(claimSecret, String(data.claimSecretHash))) {
      throw new HttpsError("permission-denied", "This pairing request does not belong to this display.");
    }
    // A retry with the same secret is safe and can recover if the custom-token
    // response was lost after the transaction committed.
    if (data.claimed && data.deviceId) {
      return {
        uid: data.uid as string,
        householdId: (data.householdId as string | null) ?? null,
        deviceId: String(data.deviceId),
      };
    }
    if (data.status !== "approved") throw new HttpsError("failed-precondition", "This pairing hasn't been approved yet.");
    if (data.claimed) throw new HttpsError("failed-precondition", "This pairing code has already been used.");
    if (isExpired(data)) throw new HttpsError("deadline-exceeded", "This pairing code has expired.");

    tx.create(proposedDeviceRef, {
      uid: data.uid,
      householdId: data.householdId ?? null,
      label: "New Display",
      deviceType: "display",
      pairedVia: "qr",
      revoked: false,
      createdAt: FieldValue.serverTimestamp(),
      lastSeenAt: FieldValue.serverTimestamp(),
      settings: {},
    });
    tx.update(ref, {
      claimed: true,
      deviceId: proposedDeviceRef.id,
      claimedAt: FieldValue.serverTimestamp(),
    });
    return {
      uid: data.uid as string,
      householdId: (data.householdId as string | null) ?? null,
      deviceId: proposedDeviceRef.id,
    };
  });

  // The deviceId custom claim is what lets firestore.rules enforce real,
  // near-immediate revocation for QR-paired devices (see isAuthenticated()).
  const customToken = await admin.auth().createCustomToken(claim.uid, { deviceId: claim.deviceId });

  logger.info("claimDevicePairing: claimed", { pairingId, uid: claim.uid, deviceId: claim.deviceId });
  return { customToken, deviceId: claim.deviceId, householdId: claim.householdId };
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
  if (request.auth?.token?.deviceId && householdId !== uid) {
    throw new HttpsError("permission-denied", "Remote displays are restricted to the paired account calendar.");
  }

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
