import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

export interface DogTagPublicPhone {
  id: string;
  label: string;
  number: string;
}

export interface DogTagPublicCustomField {
  id: string;
  label: string;
  value: string;
}

export interface DogTagPublicProfile {
  message: string;
  phones: DogTagPublicPhone[];
  address: string;
  vetName: string;
  vetPhone: string;
  vetAddress: string;
  customFields: DogTagPublicCustomField[];
  externalUrl: string;
  sendLocation: boolean;
}

export interface DogTagPublicInfo {
  valid: boolean;
  petName?: string;
  shape?: "circle" | "rounded" | "oval" | "heart";
  bgColor?: string;
  fgColor?: string;
  stickerText?: string;
  profile?: DogTagPublicProfile;
}

export interface DogTagPublicInfoBySlug extends DogTagPublicInfo {
  petId?: string;
  tagId?: string;
}

export async function getDogTagPublicInfo(petId: string, tagId: string, code: string): Promise<DogTagPublicInfo> {
  const fn = httpsCallable<{ petId: string; tagId: string; code: string }, DogTagPublicInfo>(
    functions,
    "getDogTagPublicInfo"
  );
  const res = await fn({ petId, tagId, code });
  return res.data;
}

export async function getDogTagProfileBySlug(slug: string): Promise<DogTagPublicInfoBySlug> {
  const fn = httpsCallable<{ slug: string }, DogTagPublicInfoBySlug>(functions, "getDogTagProfileBySlug");
  const res = await fn({ slug });
  return res.data;
}

export interface DogTagNotifyRecipient {
  uid: string;
  name: string;
  email?: string;
}

export async function getDogTagNotifyRecipients(petId: string): Promise<DogTagNotifyRecipient[]> {
  const fn = httpsCallable<{ petId: string }, { recipients: DogTagNotifyRecipient[] }>(
    functions,
    "getDogTagNotifyRecipients"
  );
  const res = await fn({ petId });
  return res.data.recipients;
}

export async function reportDogTagScan(
  petId: string,
  tagId: string,
  lat: number,
  lng: number,
  code?: string
): Promise<void> {
  const fn = httpsCallable<
    { petId: string; tagId: string; code?: string; lat: number; lng: number },
    { success: boolean }
  >(functions, "reportDogTagScan");
  await fn({ petId, tagId, code, lat, lng });
}
