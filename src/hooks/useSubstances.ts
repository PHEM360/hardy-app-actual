import { useEffect, useState, useCallback } from "react";
import {
  collection, doc, onSnapshot, addDoc,
  setDoc, serverTimestamp, query, orderBy, deleteDoc,
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

export interface WeaningEntry {
  id?: string;
  date: string;        // ISO "2026-06-25"
  substance: string;
  targetDose: number;
  unit: string;
}

interface SubstanceConfig {
  totpSecret?: string;
  totpSetupComplete?: boolean;
  substanceNames?: string[];
  weaningSchedule?: WeaningEntry[];
  calendarOverrides?: Record<string, "green" | "amber" | "red">;
}

export function useSubstances() {
  const { dataUid } = useAuth();
  const [logs, setLogs] = useState<SubstanceLog[]>([]);
  const [config, setConfig] = useState<SubstanceConfig>({});
  const [loading, setLoading] = useState(true);

  // Subscribe to logs
  useEffect(() => {
    if (!dataUid) { setLogs([]); setLoading(false); return; }
    const q = query(
      collection(db, "substanceLogs", dataUid, "logs"),
      orderBy("date", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SubstanceLog)));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [dataUid]);

  // Subscribe to config (TOTP secret + substance names)
  useEffect(() => {
    if (!dataUid) return;
    const unsub = onSnapshot(doc(db, "substancesConfig", dataUid), (snap) => {
      if (snap.exists()) setConfig(snap.data() as SubstanceConfig);
      else setConfig({});
    });
    return unsub;
  }, [dataUid]);

  /** Generate a new TOTP secret, store it, return QR code URI */
  const setupTotp = useCallback(async (email: string): Promise<{ secret: string; uri: string }> => {
    if (!dataUid) throw new Error("Not authenticated");
    const totp = new OTPAuth.TOTP({
      issuer: "Hardy Hub",
      label: email,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: new OTPAuth.Secret({ size: 20 }),
    });
    const secret = totp.secret.base32;
    const uri = totp.toString();
    await setDoc(doc(db, "substancesConfig", dataUid), {
      totpSecret: secret,
      totpSetupComplete: false,
    }, { merge: true });
    return { secret, uri };
  }, [dataUid]);

  /** Mark TOTP setup as complete */
  const confirmTotpSetup = useCallback(async () => {
    if (!dataUid) return;
    await setDoc(doc(db, "substancesConfig", dataUid), { totpSetupComplete: true }, { merge: true });
  }, [dataUid]);

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
    if (!dataUid) return;
    await deleteDoc(doc(db, "substancesConfig", dataUid));
  }, [dataUid]);

  /** Add a substance name to the tracked list */
  const addSubstanceName = useCallback(async (name: string) => {
    if (!dataUid) return;
    const current = config.substanceNames ?? [];
    if (current.includes(name)) return;
    await setDoc(doc(db, "substancesConfig", dataUid), {
      substanceNames: [...current, name],
    }, { merge: true });
  }, [dataUid, config.substanceNames]);

  /** Remove a substance name from the tracked list */
  const removeSubstanceName = useCallback(async (name: string) => {
    if (!dataUid) return;
    const current = config.substanceNames ?? [];
    await setDoc(doc(db, "substancesConfig", dataUid), {
      substanceNames: current.filter((n) => n !== name),
    }, { merge: true });
  }, [dataUid, config.substanceNames]);

  /** Log a substance use */
  const addLog = useCallback(async (entry: Omit<SubstanceLog, "id" | "createdAt">) => {
    if (!dataUid) return;
    // Strip undefined — Firestore rejects them and causes "invalid data" error
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(entry)) {
      if (v !== undefined) clean[k] = v;
    }
    await addDoc(collection(db, "substanceLogs", dataUid, "logs"), {
      ...clean,
      createdAt: serverTimestamp(),
    });
  }, [dataUid]);

  /** Delete a log entry */
  const deleteLog = useCallback(async (id: string) => {
    if (!dataUid) return;
    await deleteDoc(doc(db, "substanceLogs", dataUid, "logs", id));
  }, [dataUid]);

  /** Save the entire weaning schedule */
  const saveWeaningSchedule = useCallback(async (entries: WeaningEntry[]) => {
    if (!dataUid) return;
    // Strip id fields before writing to Firestore
    const clean = entries.map(({ id: _id, ...rest }) => rest);
    await setDoc(doc(db, "substancesConfig", dataUid), {
      weaningSchedule: clean,
    }, { merge: true });
  }, [dataUid]);

  /** Set or clear a manual calendar colour override for a date */
  const setCalendarOverride = useCallback(async (date: string, status: "green" | "amber" | "red" | null) => {
    if (!dataUid) return;
    const overrides = { ...(config.calendarOverrides ?? {}) };
    if (status === null) {
      delete overrides[date];
    } else {
      overrides[date] = status;
    }
    await setDoc(doc(db, "substancesConfig", dataUid), {
      calendarOverrides: overrides,
    }, { merge: true });
  }, [dataUid, config.calendarOverrides]);

  const isTotpConfigured = Boolean(config.totpSecret && config.totpSetupComplete);
  const latestLog = logs[0] ?? null;
  const substanceNames: string[] = config.substanceNames ?? [];

  return {
    logs, loading, config, isTotpConfigured, latestLog, substanceNames,
    setupTotp, confirmTotpSetup, verifyTotp, resetTotp,
    addLog, deleteLog, addSubstanceName, removeSubstanceName,
    weaningSchedule: (config.weaningSchedule ?? []) as WeaningEntry[],
    calendarOverrides: (config.calendarOverrides ?? {}) as Record<string, "green" | "amber" | "red">,
    saveWeaningSchedule,
    setCalendarOverride,
  };
}



