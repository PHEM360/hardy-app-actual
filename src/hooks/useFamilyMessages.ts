import { useCallback, useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";
import { useActiveHousehold } from "@/hooks/useActiveHousehold";
import { useUserProfile } from "@/hooks/useUserProfile";

export interface FamilyMessage {
  id: string;
  text: string;
  authorUid: string;
  authorName: string;
  createdAt?: { toMillis?: () => number } | null;
}

export function useFamilyMessages() {
  const { dataUid, user } = useAuth();
  const { profile } = useUserProfile();
  const { activeHouseholdId } = useActiveHousehold();
  const [messages, setMessages] = useState<FamilyMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeHouseholdId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, "household", activeHouseholdId, "messages"),
      orderBy("createdAt", "desc"),
      limit(40),
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FamilyMessage, "id">) })));
      setLoading(false);
    }, () => {
      setMessages([]);
      setLoading(false);
    });
    return unsub;
  }, [activeHouseholdId]);

  const post = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!activeHouseholdId || !dataUid || !trimmed) return;
    const authorName = profile?.firstName || profile?.displayName || user?.displayName || user?.email?.split("@")[0] || "Family";
    await addDoc(collection(db, "household", activeHouseholdId, "messages"), {
      text: trimmed.slice(0, 280),
      authorUid: dataUid,
      authorName,
      createdAt: serverTimestamp(),
    });
  }, [activeHouseholdId, dataUid, profile?.firstName, profile?.displayName, user?.displayName, user?.email]);

  const remove = useCallback(async (id: string) => {
    if (!activeHouseholdId) return;
    await deleteDoc(doc(db, "household", activeHouseholdId, "messages", id));
  }, [activeHouseholdId]);

  return { messages, loading, householdId: activeHouseholdId, post, remove, uid: dataUid };
}
