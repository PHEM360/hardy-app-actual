import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { BankAccountSnapshot } from "@/lib/truelayerApi";

export interface BankConnection {
  id: string;
  provider: string;
  status: "active" | "needs_reauth" | "error";
  sandbox?: boolean;
  accounts: BankAccountSnapshot[];
  lastSyncedAt?: { toDate?: () => Date } | null;
  consentExpiresAt?: number;
  lastError?: string;
}

export function useBankConnections(scopeUserId?: string | null) {
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!scopeUserId) {
      setConnections([]);
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      query(collection(db, "finance", scopeUserId, "bankConnections"), orderBy("createdAt", "desc")),
      (snap) => {
        setConnections(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              provider: data.provider || "truelayer",
              status: data.status === "needs_reauth" || data.status === "error" ? data.status : "active",
              sandbox: data.sandbox === true,
              accounts: Array.isArray(data.accounts) ? data.accounts : [],
              lastSyncedAt: data.lastSyncedAt ?? null,
              consentExpiresAt: data.consentExpiresAt,
              lastError: data.lastError,
            };
          })
        );
        setLoading(false);
      },
      () => {
        setConnections([]);
        setLoading(false);
      }
    );
    return unsub;
  }, [scopeUserId]);

  return { connections, loading };
}
