import { useEffect, useState, useCallback } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { QRCodeItem, QRCodeSettings, DEFAULT_QR_SETTINGS } from "@/types/app";

// ─── QR Code items CRUD ────────────────────────────────────────────────────────

export function useQRCodes() {
  const [qrCodes, setQrCodes] = useState<QRCodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, "qrcodes", uid, "items"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setQrCodes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as QRCodeItem)));
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  const addQRCode = useCallback(async (item: Omit<QRCodeItem, "id" | "createdAt" | "updatedAt">) => {
    if (!uid) return;
    await addDoc(collection(db, "qrcodes", uid, "items"), {
      ...item,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }, [uid]);

  const updateQRCode = useCallback(async (id: string, updates: Partial<QRCodeItem>) => {
    if (!uid) return;
    await updateDoc(doc(db, "qrcodes", uid, "items", id), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  }, [uid]);

  const deleteQRCode = useCallback(async (id: string) => {
    if (!uid) return;
    await deleteDoc(doc(db, "qrcodes", uid, "items", id));
  }, [uid]);

  return { qrCodes, loading, addQRCode, updateQRCode, deleteQRCode };
}

// ─── QR Code settings ──────────────────────────────────────────────────────────

export function useQRCodeSettings() {
  const [settings, setSettings] = useState<QRCodeSettings>(DEFAULT_QR_SETTINGS);
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, "qrcodes", uid, "settings"), (snap) => {
      if (snap.exists()) {
        setSettings({ ...DEFAULT_QR_SETTINGS, ...snap.data() } as QRCodeSettings);
      }
    });
    return unsub;
  }, [uid]);

  const saveSettings = useCallback(async (updates: Partial<QRCodeSettings>) => {
    if (!uid) return;
    await setDoc(
      doc(db, "qrcodes", uid, "settings"),
      { ...updates, updatedAt: serverTimestamp() },
      { merge: true }
    );
  }, [uid]);

  return { settings, saveSettings };
}
