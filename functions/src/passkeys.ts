import { createHash, randomUUID } from "node:crypto";
import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type Base64URLString,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { passkeyFreshnessDays } from "./securityPolicy";

const RP_NAME = "Hardy Hub";
const PRIMARY_RP_ID = "hardyapp.co.uk";
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const ALLOWED_CONTEXTS = new Map([
  ["https://hardyapp.co.uk", "hardyapp.co.uk"],
  ["https://www.hardyapp.co.uk", "hardyapp.co.uk"],
  ["https://hardyhub-7b30d.web.app", "hardyhub-7b30d.web.app"],
  ["https://hardyhub-7b30d.firebaseapp.com", "hardyhub-7b30d.firebaseapp.com"],
  ["http://localhost:5173", "localhost"],
  ["http://localhost:8080", "localhost"],
]);
const CHALLENGE_RATE_WINDOW_MS = 60_000;
const CHALLENGE_RATE_LIMIT = 20;

interface ChallengeRecord {
  challenge: string;
  kind: "registration" | "authentication";
  uid: string | null;
  origin: string;
  rpID: string;
  expiresAt: Timestamp;
}

interface StoredPasskey {
  uid: string;
  credentialId: Base64URLString;
  rpID?: string;
  publicKey: string;
  counter: number;
  transports?: AuthenticatorTransportFuture[];
  label: string;
  createdAt: Timestamp;
  lastUsedAt?: Timestamp;
}

function requestContext(request: { rawRequest: { headers: { origin?: string } } }) {
  const origin = String(request.rawRequest.headers.origin || "");
  const rpID = ALLOWED_CONTEXTS.get(origin);
  if (!rpID) throw new HttpsError("permission-denied", "Passkeys are not available from this web address.");
  return { origin, rpID };
}

function requireUid(request: { auth?: { uid: string; token?: Record<string, unknown> } }) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "You must be signed in.");
  if (request.auth.token?.deviceId) {
    throw new HttpsError("permission-denied", "Remote display credentials cannot manage passkeys.");
  }
  return request.auth.uid;
}

async function storeChallenge(record: Omit<ChallengeRecord, "expiresAt">) {
  const challengeId = randomUUID();
  await admin.firestore().doc(`passkeyChallenges/${challengeId}`).set({
    ...record,
    expiresAt: Timestamp.fromMillis(Date.now() + CHALLENGE_TTL_MS),
    createdAt: FieldValue.serverTimestamp(),
  });
  return challengeId;
}

async function enforceChallengeRateLimit(request: { rawRequest: { ip?: string; socket?: { remoteAddress?: string } } }) {
  const address = String(request.rawRequest.ip || request.rawRequest.socket?.remoteAddress || "unknown");
  const id = createHash("sha256").update(address).digest("hex");
  const ref = admin.firestore().doc(`passkeyRateLimits/${id}`);
  await admin.firestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const now = Date.now();
    const startedAt = Number(snapshot.data()?.startedAt || 0);
    const count = Number(snapshot.data()?.count || 0);
    if (startedAt > now - CHALLENGE_RATE_WINDOW_MS && count >= CHALLENGE_RATE_LIMIT) {
      throw new HttpsError("resource-exhausted", "Too many passkey requests. Please wait a moment.");
    }
    transaction.set(ref, startedAt > now - CHALLENGE_RATE_WINDOW_MS
      ? { startedAt, count: count + 1, expiresAt: Timestamp.fromMillis(now + CHALLENGE_RATE_WINDOW_MS) }
      : { startedAt: now, count: 1, expiresAt: Timestamp.fromMillis(now + CHALLENGE_RATE_WINDOW_MS) });
  });
}

async function consumeChallenge(
  challengeId: string,
  expectedKind: ChallengeRecord["kind"],
  authenticatedUid?: string,
) {
  if (!challengeId) throw new HttpsError("invalid-argument", "Missing passkey challenge.");
  const ref = admin.firestore().doc(`passkeyChallenges/${challengeId}`);
  return admin.firestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new HttpsError("failed-precondition", "This passkey request has expired.");
    const data = snapshot.data() as ChallengeRecord;
    transaction.delete(ref);
    if (data.kind !== expectedKind || data.expiresAt.toMillis() < Date.now()) {
      throw new HttpsError("failed-precondition", "This passkey request has expired.");
    }
    if (data.uid && data.uid !== authenticatedUid) {
      throw new HttpsError("permission-denied", "This passkey request belongs to another account.");
    }
    return data;
  });
}

async function userPasskeys(uid: string) {
  const snapshot = await admin.firestore().collection("passkeys").where("uid", "==", uid).get();
  return snapshot.docs.map((doc) => doc.data() as StoredPasskey);
}

function passkeyRpID(passkey: StoredPasskey) {
  // Records created before rpID was stored all belong to the live site, which
  // was the only place passkeys could be created at the time.
  return passkey.rpID || PRIMARY_RP_ID;
}

function passkeysForRp(passkeys: StoredPasskey[], rpID: string) {
  // A WebAuthn credential cannot cross relying-party domains, so only offer
  // the browser credentials it can actually satisfy.
  return passkeys.filter((passkey) => passkeyRpID(passkey) === rpID);
}

function hasFreshPasswordAuthentication(request: { auth?: { token?: Record<string, unknown> } }) {
  const token = request.auth?.token;
  const firebase = token?.firebase as { sign_in_provider?: string } | undefined;
  const authenticatedAt = Number(token?.auth_time || 0);
  return firebase?.sign_in_provider === "password" && authenticatedAt >= (Date.now() / 1000) - 300;
}

async function requirePasskeyAdmin(uid: string, email?: string) {
  const profile = await admin.firestore().doc(`users/${uid}`).get();
  const role = String(profile.data()?.role || "").toLowerCase().replace(/[-_\s]/g, "");
  const owner = String(email || "").toLowerCase() === "chris.hardy.07@googlemail.com";
  if (!owner && role !== "admin" && role !== "superadmin") {
    throw new HttpsError("permission-denied", "Admin privileges required.");
  }
}

export const beginPasskeyRegistration = onCall(async (request) => {
  await enforceChallengeRateLimit(request);
  const uid = requireUid(request);
  const { origin, rpID } = requestContext(request);
  const [authUser, existing, profile] = await Promise.all([
    admin.auth().getUser(uid),
    userPasskeys(uid),
    admin.firestore().doc(`users/${uid}`).get(),
  ]);
  const existingForRp = passkeysForRp(existing, rpID);
  if (!profile.exists || profile.data()?.enabled === false || authUser.disabled) {
    throw new HttpsError("permission-denied", "This account is not enabled.");
  }
  const passkeyVerifiedAt = Number(request.auth?.token?.passkeyVerifiedAt || 0);
  const freshnessDays = await passkeyFreshnessDays(uid);
  const canBootstrapPasskeyForRp = existingForRp.length === 0 && hasFreshPasswordAuthentication(request);
  if (
    profile.data()?.passkeyEnrolled === true &&
    passkeyVerifiedAt < (Date.now() / 1000) - freshnessDays * 86_400 &&
    !canBootstrapPasskeyForRp
  ) {
    throw new HttpsError("failed-precondition", "Confirm an existing passkey before adding another.");
  }
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userID: Buffer.from(uid, "utf8"),
    userName: authUser.email || uid,
    userDisplayName: authUser.displayName || authUser.email || "Hardy Hub user",
    attestationType: "none",
    preferredAuthenticatorType: "localDevice",
    excludeCredentials: existingForRp.map((passkey) => ({
      id: passkey.credentialId,
      transports: passkey.transports,
    })),
    authenticatorSelection: {
      residentKey: "required",
      requireResidentKey: true,
      userVerification: "required",
    },
    timeout: 60_000,
  });
  const challengeId = await storeChallenge({
    challenge: options.challenge,
    kind: "registration",
    uid,
    origin,
    rpID,
  });
  return { challengeId, options };
});

export const finishPasskeyRegistration = onCall(async (request) => {
  const uid = requireUid(request);
  const response = request.data?.response as RegistrationResponseJSON | undefined;
  const challenge = await consumeChallenge(String(request.data?.challengeId || ""), "registration", uid);
  if (!response?.id) throw new HttpsError("invalid-argument", "Missing passkey response.");
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: challenge.origin,
    expectedRPID: challenge.rpID,
    requireUserVerification: true,
  });
  if (!verification.verified || !verification.registrationInfo) {
    throw new HttpsError("permission-denied", "The passkey could not be verified.");
  }
  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  const label = String(request.data?.label || "My passkey").trim().slice(0, 80) || "My passkey";
  const passkey: StoredPasskey & Record<string, unknown> = {
    uid,
    credentialId: credential.id,
    rpID: challenge.rpID,
    publicKey: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter,
    transports: credential.transports,
    label,
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    createdAt: Timestamp.now(),
  };
  const passkeyRef = admin.firestore().doc(`passkeys/${credential.id}`);
  await admin.firestore().runTransaction(async (transaction) => {
    const existing = await transaction.get(passkeyRef);
    if (existing.exists) throw new HttpsError("already-exists", "This passkey is already registered.");
    transaction.create(passkeyRef, passkey);
    transaction.set(admin.firestore().doc(`users/${uid}`), {
      passkeyEnrolled: true,
      passkeyEnrolledAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
  const token = await admin.auth().createCustomToken(uid, {
    authMethod: "passkey",
    passkeyVerifiedAt: Math.floor(Date.now() / 1000),
  });
  return { verified: true, credentialId: credential.id, label, token };
});

export const beginPasskeyAuthentication = onCall(async (request) => {
  await enforceChallengeRateLimit(request);
  const { origin, rpID } = requestContext(request);
  const reauthenticate = request.data?.reauthenticate === true;
  const uid = reauthenticate ? requireUid(request) : null;
  const existing = uid ? await userPasskeys(uid) : [];
  const existingForRp = passkeysForRp(existing, rpID);
  if (uid && existingForRp.length === 0) {
    throw new HttpsError("failed-precondition", "No passkey is registered for this web address.");
  }
  const generatedOptions = await generateAuthenticationOptions({
    rpID,
    allowCredentials: uid ? existingForRp.map((passkey) => ({
      id: passkey.credentialId,
      transports: passkey.transports,
    })) : undefined,
    userVerification: "required",
    timeout: 60_000,
  });
  const options = {
    ...generatedOptions,
    // Prefer Touch ID, Face ID, Windows Hello, or another authenticator on
    // this device. Browsers can still offer a phone QR fallback when needed.
    hints: ["client-device", "hybrid"],
  };
  const challengeId = await storeChallenge({
    challenge: options.challenge,
    kind: "authentication",
    uid,
    origin,
    rpID,
  });
  return { challengeId, options };
});

export const finishPasskeyAuthentication = onCall(async (request) => {
  const authenticatedUid = request.auth?.uid;
  const response = request.data?.response as AuthenticationResponseJSON | undefined;
  const challenge = await consumeChallenge(
    String(request.data?.challengeId || ""),
    "authentication",
    authenticatedUid,
  );
  if (!response?.id) throw new HttpsError("invalid-argument", "Missing passkey response.");
  const passkeyRef = admin.firestore().doc(`passkeys/${response.id}`);
  const passkeySnapshot = await passkeyRef.get();
  if (!passkeySnapshot.exists) throw new HttpsError("permission-denied", "This passkey is not registered.");
  const passkey = passkeySnapshot.data() as StoredPasskey;
  if (challenge.uid && passkey.uid !== challenge.uid) {
    throw new HttpsError("permission-denied", "This passkey belongs to another account.");
  }
  const userRecord = await admin.auth().getUser(passkey.uid);
  const profile = await admin.firestore().doc(`users/${passkey.uid}`).get();
  if (userRecord.disabled || profile.data()?.enabled === false) {
    throw new HttpsError("permission-denied", "This account is disabled.");
  }
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: challenge.origin,
    expectedRPID: challenge.rpID,
    credential: {
      id: passkey.credentialId,
      publicKey: new Uint8Array(Buffer.from(passkey.publicKey, "base64url")),
      counter: passkey.counter,
      transports: passkey.transports,
    },
    requireUserVerification: true,
  });
  if (!verification.verified) throw new HttpsError("permission-denied", "The passkey could not be verified.");
  await admin.firestore().runTransaction(async (transaction) => {
    const latest = await transaction.get(passkeyRef);
    if (!latest.exists || Number(latest.data()?.counter || 0) !== passkey.counter) {
      throw new HttpsError("aborted", "This passkey was used simultaneously. Please try again.");
    }
    transaction.update(passkeyRef, {
      counter: verification.authenticationInfo.newCounter,
      lastUsedAt: FieldValue.serverTimestamp(),
      rpID: challenge.rpID,
    });
  });
  const token = await admin.auth().createCustomToken(passkey.uid, {
    authMethod: "passkey",
    passkeyVerifiedAt: Math.floor(Date.now() / 1000),
  });
  return { verified: true, token };
});

export const resetUserPasskeys = onCall(async (request) => {
  const adminUid = requireUid(request);
  await requirePasskeyAdmin(adminUid, request.auth?.token?.email);
  const targetUid = String(request.data?.uid || "");
  if (!targetUid) throw new HttpsError("invalid-argument", "A user is required.");
  const snapshot = await admin.firestore().collection("passkeys").where("uid", "==", targetUid).get();
  const batch = admin.firestore().batch();
  snapshot.docs.forEach((document) => batch.delete(document.ref));
  batch.set(admin.firestore().doc(`users/${targetUid}`), {
    passkeyEnrolled: false,
    passkeyResetAt: FieldValue.serverTimestamp(),
    passkeyResetBy: adminUid,
  }, { merge: true });
  await batch.commit();
  await admin.auth().revokeRefreshTokens(targetUid);
  return { success: true, removed: snapshot.size };
});
