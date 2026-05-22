import { useEffect, useState, useCallback } from "react";
import {
  collection, doc, onSnapshot, addDoc, getDocs,
  setDoc, getDoc, serverTimestamp, query, orderBy, deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";
import * as OTPAuth from "otpauth";

export interface SubstanceLog {
  id: string;
  name: string;
  dose: string;
  unit: string;
  date: string;      // ISO date "2026-05-22"
  time: string;      // "HH:MM"
  notes?: string;
  createdAt?: any;
}

interface SubstanceConfig {
  totpSecret?: string;       // base32 secret for TOTP
  totpSetupComplete?: boolean;
}

export function useSubstances() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<SubstanceLog[]>([]);
  const [config, setConfig] = useState<SubstanceConfig>({});
  const [loading, setLoading] = useState(true);

  // Subscribe to logs
  useEffect(() => {
    if (!user) { setLogs([]); setLoading(false); return; }
    const q = query(
      collection(db, "substanceLogs", user.uid, "logs"),
      orderBy("date", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SubstanceLog)));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [user?.uid]);

  // Subscribe to config (TOTP secret)
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "substancesConfig", user.uid), (snap) => {
      if (snap.exists()) setConfig(snap.data() as SubstanceConfig);
      else setConfig({});
    });
    return unsub;
  }, [user?.uid]);

  /** Generate a new TOTP secret, store it, return QR code URI */
  const setupTotp = useCallback(async (email: string): Promise<{ secret: string; uri: string }> => {
    if (!user) throw new Error("Not authenticated");
    const totp = new OTPAuth.TOTP({
      issuer: "Hardy Hub",
      label: email,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: new OTPAuth.Secret({ size: 20 }),
    });
    const secret = totp.secret.base32;
    const uri = totp.toString();   // otpauth:// URI
    await setDoc(doc(db, "substancesConfig", user.uid), {
      totpSecret: secret,
      totpSetupComplete: false,
    }, { merge: true });
    return { secret, uri };
  }, [user]);

  /** Mark TOTP setup as complete */
  const confirmTotpSetup = useCallback(async () => {
    if (!user) return;
    await setDoc(doc(db, "substancesConfig", user.uid), { totpSetupComplete: true }, { merge: true });
  }, [user]);

  /** Verify a user-entered 6-digit code against the stored secret */
  const verifyTotp = useCallback((code: string): boolean => {
    if (!config.totpSecret) return false;
    const totp = new OTPAuth.TOTP({
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(config.totpSecret),
    });
    const delta = totp.validate({ token: code.replace(/\s/g, ""), window: 1 });
    return delta !== null;
  }, [config.totpSecret]);

  /** Reset TOTP (delete config) */
  const resetTotp = useCallback(async () => {
    if (!user) return;
    await deleteDoc(doc(db, "substancesConfig", user.uid));
  }, [user]);

  /** Log a substance use */
  const addLog = useCallback(async (entry: Omit<SubstanceLog, "id" | "createdAt">) => {
    if (!user) return;
    await addDoc(collection(db, "substanceLogs", user.uid, "logs"), {
      ...entry,
      createdAt: serverTimestamp(),
    });
  }, [user]);

  /** Delete a log entry */
  const deleteLog = useCallback(async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, "substanceLogs", user.uid, "logs", id));
  }, [user]);

  const isTotpConfigured = Boolean(config.totpSecret && config.totpSetupComplete);
  const latestLog = logs[0] ?? null;

  return {
    logs, loading, config, isTotpConfigured, latestLog,
    setupTotp, confirmTotpSetup, verifyTotp, resetTotp, addLog, deleteLog,
  };
}
