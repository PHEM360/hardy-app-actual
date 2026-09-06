import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

function friendly(err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : fallback;
  return message.replace(/^Firebase:\s*/i, "").replace(/\s*\(.*\)$/, "") || fallback;
}

export async function startGooglePhotosConnect(): Promise<string> {
  const call = httpsCallable<Record<string, never>, { authUrl: string }>(functions, "startGooglePhotosConnect");
  try {
    const result = await call({});
    if (!result.data.authUrl) throw new Error("Could not start Google Photos.");
    return result.data.authUrl;
  } catch (err) {
    throw new Error(friendly(err, "Finish the family setup at the top of Settings, then try Connect again."));
  }
}

export async function startGooglePhotosPicker(albumId: string): Promise<{ sessionId: string; pickerUri: string }> {
  const call = httpsCallable<{ albumId: string }, { sessionId: string; pickerUri: string }>(
    functions,
    "startGooglePhotosPicker",
  );
  try {
    const result = await call({ albumId });
    if (!result.data.sessionId || !result.data.pickerUri) throw new Error("Could not open Google Photos.");
    return result.data;
  } catch (err) {
    throw new Error(friendly(err, "Could not open Google Photos."));
  }
}

export async function pollGooglePhotosPicker(albumId: string, sessionId: string): Promise<{ done: boolean; added: number }> {
  const call = httpsCallable<{ albumId: string; sessionId: string }, { done: boolean; added: number }>(
    functions,
    "pollGooglePhotosPicker",
  );
  try {
    const result = await call({ albumId, sessionId });
    return { done: Boolean(result.data.done), added: result.data.added ?? 0 };
  } catch (err) {
    throw new Error(friendly(err, "Could not finish that Google Photos pick."));
  }
}

export async function syncGooglePhotosAlbum(albumId: string, shareUrl?: string): Promise<{ added: number; title?: string }> {
  const call = httpsCallable<{ albumId: string; shareUrl?: string }, { added: number; title?: string }>(
    functions,
    "syncGooglePhotosAlbum",
  );
  try {
    const result = await call({ albumId, shareUrl });
    return { added: result.data.added ?? 0, title: result.data.title };
  } catch (err) {
    throw new Error(friendly(err, "Could not sync that Google Photos album."));
  }
}

export async function disconnectGooglePhotos(): Promise<void> {
  const call = httpsCallable(functions, "disconnectGooglePhotos");
  try {
    await call({});
  } catch (err) {
    throw new Error(friendly(err, "Could not disconnect Google Photos."));
  }
}
