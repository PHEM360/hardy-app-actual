import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import type { DriveFolderOption } from "@/types/photos";

function friendly(err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : fallback;
  return message.replace(/^Firebase:\s*/i, "").replace(/\s*\(.*\)$/, "") || fallback;
}

export async function startGoogleDriveConnect(): Promise<string> {
  const call = httpsCallable<Record<string, never>, { authUrl: string }>(functions, "startGoogleDriveConnect");
  try {
    const result = await call({});
    if (!result.data.authUrl) throw new Error("Could not start Google Drive.");
    return result.data.authUrl;
  } catch (err) {
    throw new Error(friendly(err, "Finish the family setup at the top of Settings, then try Connect again."));
  }
}

export async function listGoogleDriveFolders(): Promise<DriveFolderOption[]> {
  const call = httpsCallable<Record<string, never>, { folders: DriveFolderOption[] }>(functions, "listGoogleDriveFolders");
  try {
    const result = await call({});
    return result.data.folders || [];
  } catch (err) {
    throw new Error(friendly(err, "Could not list Drive folders."));
  }
}

export async function syncGoogleDriveAlbum(albumId: string, folderId: string, folderName?: string): Promise<number> {
  const call = httpsCallable<{ albumId: string; folderId: string; folderName?: string }, { added: number }>(
    functions,
    "syncGoogleDriveAlbum",
  );
  try {
    const result = await call({ albumId, folderId, folderName });
    return result.data.added ?? 0;
  } catch (err) {
    throw new Error(friendly(err, "Could not sync that Drive folder."));
  }
}

export async function disconnectGoogleDrive(): Promise<void> {
  const call = httpsCallable(functions, "disconnectGoogleDrive");
  try {
    await call({});
  } catch (err) {
    throw new Error(friendly(err, "Could not disconnect Google Drive."));
  }
}
