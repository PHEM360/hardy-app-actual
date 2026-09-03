import { useCallback, useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";
import {
  DEFAULT_HOLIDAY_SETTINGS,
  nextHolidaySearchAt,
  type HolidayPriceFinding,
  type HolidaySettings,
  type HolidayWatch,
  type HolidayWatchStatus,
} from "@/types/holidays";

function stripUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

export function useHolidays(scopeUserId?: string) {
  const { dataUid } = useAuth();
  const uid = scopeUserId ?? dataUid;
  const [watches, setWatches] = useState<HolidayWatch[]>([]);
  const [settings, setSettings] = useState<HolidaySettings>(DEFAULT_HOLIDAY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setWatches([]);
      setSettings(DEFAULT_HOLIDAY_SETTINGS);
      setLoading(false);
      return;
    }

    setLoading(true);
    const watchesQ = query(
      collection(db, "holidays", uid, "watches"),
      orderBy("updatedAt", "desc"),
    );
    const unsubWatches = onSnapshot(
      watchesQ,
      (snap) => {
        setWatches(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<HolidayWatch, "id">) })),
        );
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    const unsubSettings = onSnapshot(
      doc(db, "holidays", uid, "meta", "settings"),
      (snap) => {
        if (snap.exists()) {
          setSettings({ ...DEFAULT_HOLIDAY_SETTINGS, ...(snap.data() as HolidaySettings) });
        } else {
          setSettings(DEFAULT_HOLIDAY_SETTINGS);
        }
      },
      () => {
        /* settings are optional */
      },
    );

    return () => {
      unsubWatches();
      unsubSettings();
    };
  }, [uid]);

  const saveSettings = useCallback(
    async (next: HolidaySettings) => {
      if (!uid) return;
      await setDoc(
        doc(db, "holidays", uid, "meta", "settings"),
        stripUndefined({ ...next, updatedAt: serverTimestamp() }),
        { merge: true },
      );
    },
    [uid],
  );

  const addWatch = useCallback(
    async (
      data: Omit<
        HolidayWatch,
        | "id"
        | "createdAt"
        | "updatedAt"
        | "bestPriceGbp"
        | "bestPriceSource"
        | "bestPriceUrl"
        | "bestPriceFoundAt"
        | "lastSearchedAt"
        | "nextSearchAt"
      >,
    ) => {
      if (!uid) return;
      const now = new Date();
      const once = data.scheduleMode === "once";
      const ref = await addDoc(
        collection(db, "holidays", uid, "watches"),
        stripUndefined({
          ...data,
          scheduleMode: once ? "once" : "scheduled",
          bestPriceGbp: null,
          bestPriceSource: null,
          bestPriceUrl: null,
          bestPriceFoundAt: null,
          lastSearchedAt: null,
          // One-off: due immediately so scheduler / client search can run it.
          // Scheduled: first automatic check after the interval.
          nextSearchAt: once
            ? now.toISOString()
            : nextHolidaySearchAt(now, data.searchIntervalAmount, data.searchIntervalUnit),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      );
      return ref.id;
    },
    [uid],
  );

  const updateWatch = useCallback(
    async (id: string, patch: Partial<HolidayWatch>) => {
      if (!uid) return;
      const { id: _id, createdAt: _c, ...rest } = patch;
      await updateDoc(
        doc(db, "holidays", uid, "watches", id),
        stripUndefined({ ...rest, updatedAt: serverTimestamp() }),
      );
    },
    [uid],
  );

  const setWatchStatus = useCallback(
    async (id: string, status: HolidayWatchStatus) => {
      await updateWatch(id, { status });
    },
    [updateWatch],
  );

  const deleteWatch = useCallback(
    async (id: string) => {
      if (!uid) return;
      await deleteDoc(doc(db, "holidays", uid, "watches", id));
    },
    [uid],
  );

  const addManualPrice = useCallback(
    async (
      watchId: string,
      finding: Omit<HolidayPriceFinding, "id" | "watchId" | "createdAt" | "manual" | "currency">,
    ) => {
      if (!uid) return;
      const ref = await addDoc(
        collection(db, "holidays", uid, "watches", watchId, "prices"),
        stripUndefined({
          ...finding,
          watchId,
          currency: "GBP",
          manual: true,
          createdAt: serverTimestamp(),
        }),
      );

      const watch = watches.find((w) => w.id === watchId);
      const currentBest = watch?.bestPriceGbp;
      if (currentBest == null || finding.priceGbp < currentBest) {
        await updateWatch(watchId, {
          bestPriceGbp: finding.priceGbp,
          bestPriceSource: finding.sourceName,
          bestPriceUrl: finding.sourceUrl,
          bestPriceFoundAt: finding.foundAt,
        });
      }
      return ref.id;
    },
    [uid, watches, updateWatch],
  );

  return {
    watches,
    settings,
    loading,
    error,
    saveSettings,
    addWatch,
    updateWatch,
    setWatchStatus,
    deleteWatch,
    addManualPrice,
    uid,
  };
}

export function useHolidayPrices(watchId: string | null, scopeUserId?: string) {
  const { dataUid } = useAuth();
  const uid = scopeUserId ?? dataUid;
  const [prices, setPrices] = useState<HolidayPriceFinding[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!uid || !watchId) {
      setPrices([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, "holidays", uid, "watches", watchId, "prices"),
      orderBy("foundAt", "desc"),
    );
    return onSnapshot(
      q,
      (snap) => {
        setPrices(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<HolidayPriceFinding, "id">),
          })),
        );
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [uid, watchId]);

  return { prices, loading };
}
