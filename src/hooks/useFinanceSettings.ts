import { useCallback, useEffect, useState } from "react";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";
import { DEFAULT_ACCOUNT_TYPES, withOtherLast } from "@/lib/financeAccounts";
import { mergeDisplayStats, type FinanceStatId } from "@/lib/financeDisplay";

export function useFinanceSettings(scopeUserId?: string) {
  const { dataUid } = useAuth();
  const uid = scopeUserId ?? dataUid;
  const [accountTypes, setAccountTypes] = useState<string[]>([...DEFAULT_ACCOUNT_TYPES]);
  const [displayStats, setDisplayStats] = useState<Record<FinanceStatId, boolean>>(mergeDisplayStats());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setAccountTypes([...DEFAULT_ACCOUNT_TYPES]);
      setDisplayStats(mergeDisplayStats());
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      doc(db, "finance", uid, "settings", "default"),
      (snap) => {
        const data = snap.data();
        const raw = data?.accountTypes;
        if (Array.isArray(raw) && raw.length > 0) {
          setAccountTypes(withOtherLast(raw.map(String).filter(Boolean)));
        } else {
          setAccountTypes([...DEFAULT_ACCOUNT_TYPES]);
        }
        setDisplayStats(mergeDisplayStats(data?.displayStats));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [uid]);

  const saveAccountTypes = useCallback(
    async (next: string[]) => {
      if (!uid) return;
      const cleaned = withOtherLast(
        [...new Set(next.map((t) => t.trim()).filter(Boolean))]
      );
      setAccountTypes(cleaned);
      await setDoc(
        doc(db, "finance", uid, "settings", "default"),
        { accountTypes: cleaned, updatedAt: serverTimestamp() },
        { merge: true }
      );
    },
    [uid]
  );

  const saveDisplayStats = useCallback(
    async (next: Record<FinanceStatId, boolean>) => {
      if (!uid) return;
      setDisplayStats(next);
      await setDoc(
        doc(db, "finance", uid, "settings", "default"),
        { displayStats: next, updatedAt: serverTimestamp() },
        { merge: true }
      );
    },
    [uid]
  );

  const ensureType = useCallback(
    async (type: string) => {
      const trimmed = type.trim();
      if (!trimmed || trimmed === "Other" || accountTypes.includes(trimmed)) return;
      const withoutOther = accountTypes.filter((t) => t !== "Other");
      await saveAccountTypes([...withoutOther, trimmed, "Other"]);
    },
    [accountTypes, saveAccountTypes]
  );

  return { accountTypes, displayStats, loading, saveAccountTypes, saveDisplayStats, ensureType };
}
