import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

export type PairingStatus = "pending" | "approved" | "denied" | "expired" | "not_found";

export async function createDevicePairing(): Promise<{ pairingId: string; expiresAt: number }> {
  const fn = httpsCallable<void, { pairingId: string; expiresAt: number }>(functions, "createDevicePairing");
  const res = await fn();
  return res.data;
}

export async function getDevicePairingStatus(pairingId: string): Promise<PairingStatus> {
  const fn = httpsCallable<{ pairingId: string }, { status: PairingStatus }>(functions, "getDevicePairingStatus");
  const res = await fn({ pairingId });
  return res.data.status;
}

export async function approveDevicePairing(pairingId: string, householdId: string | null): Promise<void> {
  const fn = httpsCallable<{ pairingId: string; householdId: string | null }, { success: boolean }>(
    functions,
    "approveDevicePairing"
  );
  await fn({ pairingId, householdId });
}

export async function denyDevicePairing(pairingId: string): Promise<void> {
  const fn = httpsCallable<{ pairingId: string }, { success: boolean }>(functions, "denyDevicePairing");
  await fn({ pairingId });
}

export async function claimDevicePairing(
  pairingId: string
): Promise<{ customToken: string; deviceId: string; householdId: string | null }> {
  const fn = httpsCallable<
    { pairingId: string },
    { customToken: string; deviceId: string; householdId: string | null }
  >(functions, "claimDevicePairing");
  const res = await fn({ pairingId });
  return res.data;
}
