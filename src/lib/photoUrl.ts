import { getDownloadURL, ref } from "firebase/storage";
import { storage } from "@/lib/firebase";

const PROXY_PATHS = new Set(["/api/drive-photo", "/api/gphotos-photo"]);

/** Point Drive / Google Photos proxies at the current origin so Vite can forward them. */
export function rewritePhotoProxyUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  try {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const parsed = new URL(trimmed, origin || "https://hardyhub-7b30d.web.app");
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
