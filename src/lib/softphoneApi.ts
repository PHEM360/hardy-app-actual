import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

export interface SoftphoneConfig {
  smsReady: boolean;
  voiceReady: boolean;
  fromNumber: string;
  identity: string;
  notifyCalls: boolean;
  notifySms: boolean;
  myMobile: string;
  displayName: string;
}

export async function getSoftphoneConfig() {
  const call = httpsCallable<Record<string, never>, SoftphoneConfig>(functions, "getSoftphoneConfig");
  return (await call({})).data;
}

export async function getSoftphoneVoiceToken() {
  const call = httpsCallable<Record<string, never>, { token: string; identity: string; fromNumber: string }>(
    functions,
    "getSoftphoneVoiceToken",
  );
  return (await call({})).data;
}

export async function sendSoftphoneSms(to: string, body: string) {
  const call = httpsCallable<{ to: string; body: string }, { sid: string; status: string }>(functions, "sendSoftphoneSms");
  return (await call({ to, body })).data;
}

export async function startSoftphoneCall(to: string, fromMobile?: string) {
  const call = httpsCallable<{ to: string; fromMobile?: string }, { sid: string; status: string; via: string }>(
    functions,
    "startSoftphoneCall",
  );
  return (await call({ to, fromMobile })).data;
}
