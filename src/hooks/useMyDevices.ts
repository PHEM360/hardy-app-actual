import { useEffect, useState, useCallback } from "react";
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";

export interface LinkedDevice {
  id: string;
  label: string;
  pairedVia: "direct" | "qr";
  createdAt: unknown;
  lastSeenAt: unknown;
  revoked: boolean;
}

/** The current user's own /display devices — for Settings -> Linked Displays. */
export function useMyDevices() {
  const { user } = useAuth();
  const [devices, setDevices] = useState<LinkedDevice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setDevices([]);
      setLoading(false);
      return;
    }
    const q = query(collection(db, "devices"), where("uid", "==", user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setDevices(
          snap.docs
            .map((d) => {
              const data = d.data();
              return {
                id: d.id,
                label: data.label || "Display",
                pairedVia: data.pairedVia === "qr" ? "qr" : "direct",
                createdAt: data.createdAt,
                lastSeenAt: data.lastSeenAt,
                revoked: data.revoked === true,
              } as LinkedDevice;
            })
            .filter((d) => !d.revoked)
        );
        setLoading(false);
      },
      () => {
        setDevices([]);
        setLoading(false);
      }
    );
    return unsub;
  }, [user]);

  const renameDevice = useCallback(async (deviceId: string, label: string) => {
    if (!label.trim()) return;
    await updateDoc(doc(db, "devices", deviceId), { label: label.trim() });
  }, []);

  const forgetDevice = useCallback(async (deviceId: string) => {
    // Soft-delete: setting revoked also cuts off QR-paired sessions immediately
    // via the deviceId-claim check in firestore.rules, not just this list.
    await updateDoc(doc(db, "devices", deviceId), { revoked: true });
  }, []);

  const deleteDeviceRecord = useCallback(async (deviceId: string) => {
    await deleteDoc(doc(db, "devices", deviceId));
  }, []);

  return { devices, loading, renameDevice, forgetDevice, deleteDeviceRecord };
}
