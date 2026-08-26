import { useCallback, useEffect, useState } from "react";
import type { RemoteDisplayPhoto } from "@/hooks/useRemoteDisplayPhotos";

type DirectoryHandle = FileSystemDirectoryHandle & {
  entries: () => AsyncIterableIterator<[string, FileSystemHandle & { kind: string; getFile?: () => Promise<File> }]>;
  queryPermission: (descriptor?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
  requestPermission: (descriptor?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
};

declare global {
  interface Window {
    showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<DirectoryHandle>;
  }
}

const DB_NAME = "hardy-hub-display";
const STORE = "handles";
const KEY = "photo-folder";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readHandle(): Promise<DirectoryHandle | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
      request.onsuccess = () => resolve((request.result as DirectoryHandle | undefined) || null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

async function writeHandle(handle: DirectoryHandle | null) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const store = db.transaction(STORE, "readwrite").objectStore(STORE);
    const request = handle ? store.put(handle, KEY) : store.delete(KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function ensurePermission(handle: DirectoryHandle): Promise<boolean> {
  const current = await handle.queryPermission({ mode: "read" });
  if (current === "granted") return true;
  return (await handle.requestPermission({ mode: "read" })) === "granted";
}

async function listImages(handle: DirectoryHandle): Promise<RemoteDisplayPhoto[]> {
  const photos: RemoteDisplayPhoto[] = [];
  for await (const [name, entry] of handle.entries()) {
    if (entry.kind !== "file" || !entry.getFile) continue;
    if (!/\.(jpe?g|png|gif|webp|avif|heic)$/i.test(name)) continue;
    const file = await entry.getFile();
    if (!file.type.startsWith("image/") && !/\.heic$/i.test(name)) continue;
    photos.push({
      id: `local:${name}`,
      url: URL.createObjectURL(file),
      storagePath: "",
      caption: name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
      source: "local",
      createdAt: file.lastModified,
    });
  }
  return photos.sort((a, b) => String(a.caption).localeCompare(String(b.caption)));
}

export function useLocalDisplayFolder() {
  const supported = typeof window !== "undefined" && "showDirectoryPicker" in window;
  const [photos, setPhotos] = useState<RemoteDisplayPhoto[]>([]);
  const [folderName, setFolderName] = useState("");

  const load = useCallback(async (handle: DirectoryHandle) => {
    const allowed = await ensurePermission(handle);
    if (!allowed) return;
    const next = await listImages(handle);
    setPhotos((current) => {
      current.forEach((photo) => URL.revokeObjectURL(photo.url));
      return next;
    });
    setFolderName(handle.name);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void readHandle().then((handle) => {
      if (!cancelled && handle) void load(handle);
    });
    return () => {
      cancelled = true;
      setPhotos((current) => {
        current.forEach((photo) => URL.revokeObjectURL(photo.url));
        return [];
      });
    };
  }, [load]);

  const pickFolder = useCallback(async () => {
    if (!supported || !window.showDirectoryPicker) return;
    const handle = await window.showDirectoryPicker({ mode: "read" });
    await writeHandle(handle);
    await load(handle);
  }, [load, supported]);

  const clearFolder = useCallback(async () => {
    await writeHandle(null);
    setFolderName("");
    setPhotos((current) => {
      current.forEach((photo) => URL.revokeObjectURL(photo.url));
      return [];
    });
  }, []);

  return { photos, supported, folderName, pickFolder, clearFolder };
}
