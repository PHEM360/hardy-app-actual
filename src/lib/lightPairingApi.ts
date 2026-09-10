import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

export type LightPairingStatus = "pending" | "claimed" | "expired" | "not_found";

export interface CreatedLightPairing {
  pairingId: string;
  claimSecret: string;
  deviceId: string;
  expiresAt: number;
  mqttTopic: string;
  mqttBrokerUrl: string;
  mqttUsername: string;
  mqttPassword: string;
}

export async function createLightPairing(): Promise<CreatedLightPairing> {
  const fn = httpsCallable<void, CreatedLightPairing>(functions, "createLightPairing");
  const res = await fn();
  return res.data;
}

export async function getLightPairingStatus(pairingId: string): Promise<{ status: LightPairingStatus; deviceId?: string }> {
  const fn = httpsCallable<{ pairingId: string }, { status: LightPairingStatus; deviceId?: string }>(
    functions,
    "getLightPairingStatus"
  );
  const res = await fn({ pairingId });
  return res.data;
}

export async function sendLightCommand(
  deviceId: string,
  patch: { on?: boolean; brightness?: number; colorHex?: string }
): Promise<void> {
  const fn = httpsCallable<{ deviceId: string } & typeof patch, { success: boolean }>(functions, "sendLightCommand");
  await fn({ deviceId, ...patch });
}
