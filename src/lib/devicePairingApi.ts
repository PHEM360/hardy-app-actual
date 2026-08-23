import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

export type PairingStatus = "pending" | "approved" | "denied" | "expired" | "not_found";

export interface CreatedDevicePairing {
  pairingId: string;
  claimSecret: string;
  expiresAt: number;
}

export async function createDevicePairing(): Promise<CreatedDevicePairing> {
  const fn = httpsCallable<void, CreatedDevicePairing>(functions, "createDevicePairing");
  const res = await fn();
  return res.data;
}

export async function getDevicePairingStatus(pairingId: string): Promise<PairingStatus> {
  const fn = httpsCallable<{ pairingId: string }, { status: PairingStatus }>(functions, "getDevicePairingStatus");
  const res = await fn({ pairingId });
  return res.data.status;
}

export async function approveDevicePairing(pairingId: string): Promise<void> {
  const fn = httpsCallable<{ pairingId: string }, { success: boolean }>(
    functions,
    "approveDevicePairing"
  );
  await fn({ pairingId });
}

export async function denyDevicePairing(pairingId: string): Promise<void> {
  const fn = httpsCallable<{ pairingId: string }, { success: boolean }>(functions, "denyDevicePairing");
  await fn({ pairingId });
}

export async function claimDevicePairing(
  pairingId: string,
  claimSecret: string
): Promise<{ customToken: string; deviceId: string; householdId: string | null }> {
  const fn = httpsCallable<
    { pairingId: string; claimSecret: string },
    { customToken: string; deviceId: string; householdId: string | null }
  >(functions, "claimDevicePairing");
  const res = await fn({ pairingId, claimSecret });
  return res.data;
}
