import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

export interface DogTagPublicInfo {
  valid: boolean;
  petName?: string;
  shape?: "circle" | "rounded" | "oval" | "heart";
  bgColor?: string;
  fgColor?: string;
  stickerText?: string;
  actions?: {
    showPhone: boolean;
    phoneNumber: string;
    contactName: string;
    showMessage: boolean;
    message: string;
    showWebpage: boolean;
    webpageUrl: string;
    sendLocation: boolean;
  };
}

export async function getDogTagPublicInfo(petId: string, tagId: string, code: string): Promise<DogTagPublicInfo> {
  const fn = httpsCallable<{ petId: string; tagId: string; code: string }, DogTagPublicInfo>(
    functions,
    "getDogTagPublicInfo"
  );
  const res = await fn({ petId, tagId, code });
  return res.data;
}

export async function reportDogTagScan(
  petId: string,
  tagId: string,
  code: string,
  lat: number,
  lng: number
): Promise<void> {
  const fn = httpsCallable<
    { petId: string; tagId: string; code: string; lat: number; lng: number },
    { success: boolean }
  >(functions, "reportDogTagScan");
  await fn({ petId, tagId, code, lat, lng });
}
