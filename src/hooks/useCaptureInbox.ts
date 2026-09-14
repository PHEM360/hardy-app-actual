import { useCallback, useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";
import {
  allocateInboxItem,
  deleteInboxItem,
  placeCapture,
  type CaptureDraft,
  type CaptureItem,
} from "@/lib/captureInbox";

export function useCaptureInbox() {
  const { dataUid, user } = useAuth();
  const uid = dataUid || user?.uid || "";
  const [items, setItems] = useState<CaptureItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setItems([]);
      setLoading(false);
      return;
    }
    const q = query(collection(db, "captureInbox", uid, "items"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CaptureItem)));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [uid]);

  const saveCapture = useCallback(
    async (draft: CaptureDraft, files: File[]) => {
      if (!uid) throw new Error("Sign in to save.");
      return placeCapture(uid, draft, files);
    },
    [uid],
  );

  const allocateItem = useCallback(
    async (item: CaptureItem, draft: CaptureDraft) => {
      if (!uid) throw new Error("Sign in to save.");
      return allocateInboxItem(uid, item, draft);
    },
    [uid],
  );

  const removeItem = useCallback(
    async (item: CaptureItem) => {
      if (!uid) return;
      await deleteInboxItem(uid, item);
    },
    [uid],
  );

  return { uid, items, loading, saveCapture, allocateItem, removeItem };
}
