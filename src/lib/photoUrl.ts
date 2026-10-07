import { getDownloadURL, ref } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { isNativeApp, NATIVE_API_ORIGIN } from "@/lib/nativeApp";

const PROXY_PATHS = new Set(["/api/drive-photo", "/api/gphotos-photo"]);

function photoProxyOrigin() {
  if (isNativeApp()) return NATIVE_API_ORIGIN;
  return typeof window !== "undefined" ? window.location.origin : "";
}

/** Point Drive / Google Photos proxies at the current origin so Vite can forward them. */
export function rewritePhotoProxyUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  try {
    const origin = photoProxyOrigin();
    const parsed = new URL(trimmed, origin || NATIVE_API_ORIGIN);
    if (PROXY_PATHS.has(parsed.pathname) && origin) {
      return `${origin}${parsed.pathname}${parsed.search}`;
    }
  } catch {
    return trimmed;
  }
  return trimmed;
}

export async function resolveStoredPhotoUrl(input: {
  url?: string;
  storagePath?: string;
}): Promise<string> {
  if (input.storagePath) {
    try {
      return await getDownloadURL(ref(storage, input.storagePath));
    } catch {
      // Fall through to the stored url (Drive / Google Photos proxies, pasted links).
    }
  }
  return rewritePhotoProxyUrl(input.url || "");
}
