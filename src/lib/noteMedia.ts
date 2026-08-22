import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "@/lib/firebase";

function safeFileName(name: string) {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "attachment";
}

export async function uploadNoteMedia(ownerId: string, noteId: string, file: Blob, originalName: string) {
  if (!ownerId || !noteId) throw new Error("Save location is missing");
  const path = `hubNotes/${ownerId}/media/${noteId}/${crypto.randomUUID()}-${safeFileName(originalName)}`;
  const target = ref(storage, path);
  await uploadBytes(target, file, {
    contentType: file.type || "application/octet-stream",
    customMetadata: { noteId, ownerId },
  });
  return getDownloadURL(target);
}
