import { useCallback, useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";
import type { WearableDaily, WearableSourceId } from "@/lib/wearableImport";

export interface WearableSource {
  id: WearableSourceId;
  lastImportAt?: unknown;
  lastImportCount?: number;
}

export function useWearableHealth(scopeUserId?: string) {
  const { dataUid } = useAuth();
  const uid = scopeUserId ?? dataUid;
  const [days, setDays] = useState<WearableDaily[]>([]);
  const [sources, setSources] = useState<WearableSource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setDays([]);
      setSources([]);
      setLoading(false);
      return;
    }
    let dailyReady = false;
    let sourcesReady = false;
    const done = () => {
      if (dailyReady && sourcesReady) setLoading(false);
    };
    const unsubDays = onSnapshot(
      query(collection(db, "wearableHealth", uid, "daily"), orderBy("date", "desc")),
      (snap) => {
        setDays(snap.docs.map((item) => item.data() as WearableDaily));
        dailyReady = true;
        done();
      },
      () => {
        dailyReady = true;
        done();
      },
    );
    const unsubSources = onSnapshot(
      collection(db, "wearableHealth", uid, "sources"),
      (snap) => {
        setSources(snap.docs.map((item) => ({ id: item.id as WearableSourceId, ...(item.data() as Omit<WearableSource, "id">) })));
        sourcesReady = true;
        done();
      },
      () => {
        sourcesReady = true;
        done();
      },
    );
    return () => {
      unsubDays();
      unsubSources();
    };
  }, [uid]);

  const importDays = useCallback(async (source: WearableSourceId, imported: WearableDaily[]) => {
    if (!uid || imported.length === 0) return 0;
    const chunks: WearableDaily[][] = [];
    for (let i = 0; i < imported.length; i += 400) chunks.push(imported.slice(i, i + 400));
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      for (const day of chunk) {
        batch.set(doc(db, "wearableHealth", uid, "daily", `${day.date}_${source}`), {
          ...day,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
      await batch.commit();
    }
    const sourceBatch = writeBatch(db);
    sourceBatch.set(doc(db, "wearableHealth", uid, "sources", source), {
      lastImportAt: serverTimestamp(),
      lastImportCount: imported.length,
    }, { merge: true });
    await sourceBatch.commit();
    return imported.length;
  }, [uid]);

  return { days, sources, loading, importDays };
}
