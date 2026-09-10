import { HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { Timestamp } from "firebase-admin/firestore";
import { hasFreshPasskey, passkeyFreshnessDays } from "./securityPolicy";

// Shared helpers for the "anonymous device claims a one-time secret" pairing
// pattern used by both /display kiosk pairing (display.ts) and sunrise light
// pairing (lightPairing.ts) — kept in one place so a security fix (rate
// limits, hashing, passkey freshness) never has to be made twice.

export const PAIRING_ID_PATTERN = /^[A-Za-z0-9_-]{10,128}$/;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;

export function newPairingSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function secretsMatch(value: string, expectedHash: string): boolean {
  const actual = Buffer.from(sha256(value), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function isExpired(data: FirebaseFirestore.DocumentData): boolean {
  const expiresAtMs = data.expiresAt?.toMillis ? data.expiresAt.toMillis() : 0;
  return expiresAtMs > 0 && Date.now() > expiresAtMs;
}

export async function enforceAnonymousRateLimit(
  request: { rawRequest: { ip?: string; socket?: { remoteAddress?: string } } },
  scope: string,
  action: "create" | "claim",
  maxAttempts: number
): Promise<void> {
  const address = request.rawRequest.ip || request.rawRequest.socket?.remoteAddress || "unknown";
  const window = Math.floor(Date.now() / RATE_LIMIT_WINDOW_MS);
  const key = sha256(`${scope}:${action}:${address}:${window}`);
  const ref = admin.firestore().doc(`functionRateLimits/${key}`);

  await admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = snap.exists ? Number(snap.data()?.count || 0) : 0;
    if (count >= maxAttempts) {
      throw new HttpsError("resource-exhausted", "Too many pairing attempts. Please wait a few minutes.");
    }
    tx.set(ref, {
      scope,
      action,
      count: count + 1,
      expiresAt: Timestamp.fromMillis((window + 2) * RATE_LIMIT_WINDOW_MS),
    });
  });
}

export function requireAuth(request: { auth?: { uid: string } }): string {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "You must be signed in.");
  return uid;
}

/**
 * A real signed-in account with a fresh passkey — not a device session (a
 * /display kiosk or, in future, another device type carrying its own claim)
 * pairing itself in, and not a stale login someone forgot to re-verify.
 */
export async function requireAccountAuth(request: { auth?: { uid: string; token?: Record<string, unknown> } }): Promise<string> {
  const uid = requireAuth(request);
  if (request.auth?.token?.deviceId) {
    throw new HttpsError("permission-denied", "Pairing must be approved from your phone or computer.");
  }
  const days = await passkeyFreshnessDays(uid);
  if (!hasFreshPasskey(request.auth?.token, days)) {
    throw new HttpsError("failed-precondition", "Confirm your passkey before linking a new device.");
  }
  return uid;
}

export function pairingIdFrom(request: { data?: unknown }): string {
  const data = request.data as { pairingId?: unknown } | undefined;
  const pairingId = String(data?.pairingId || "");
  if (!PAIRING_ID_PATTERN.test(pairingId)) {
    throw new HttpsError("invalid-argument", "A valid pairingId is required.");
  }
  return pairingId;
}
