import { useEffect, useState } from "react";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  DEFAULT_SECURITY_SCAN_PREFS,
  type SecurityReport,
  type SecurityScanPrefs,
} from "@/types/securityReport";

export function useSecurityReports(enabled: boolean) {
  const [latest, setLatest] = useState<SecurityReport | null>(null);
  const [history, setHistory] = useState<SecurityReport[]>([]);
  const [prefs, setPrefs] = useState<SecurityScanPrefs>(DEFAULT_SECURITY_SCAN_PREFS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const reportsQ = query(
      collection(db, "securityReports"),
      orderBy("createdAtIso", "desc"),
      limit(20),
    );

    const unsubReports = onSnapshot(
      reportsQ,
      (snap) => {
        const rows = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SecurityReport, "id">),
        }));
        setHistory(rows);
        setLatest(rows[0] || null);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    const unsubPrefs = onSnapshot(
      doc(db, "securityScanPrefs", "global"),
      (snap) => {
        if (snap.exists()) {
          setPrefs({ ...DEFAULT_SECURITY_SCAN_PREFS, ...(snap.data() as SecurityScanPrefs) });
        } else {
          setPrefs(DEFAULT_SECURITY_SCAN_PREFS);
        }
      },
      () => {
        /* prefs optional until first save */
      },
    );

    return () => {
      unsubReports();
      unsubPrefs();
    };
  }, [enabled]);

  return { latest, history, prefs, loading, error };
}
