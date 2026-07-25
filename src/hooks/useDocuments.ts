import { useEffect, useState, useCallback } from "react";
import {
  collection, onSnapshot, addDoc, deleteDoc, doc,
  query, orderBy, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";

export interface UserDocument {
  id?: string;
  name: string;
  url: string;
  mimeType: string;
  destination: string;
  destinationLabel: string;
  size: number;
  createdAt: any;
  thumbnailUrl?: string;
}

export function useDocuments(scopeUserId?: string) {
  const { user } = useAuth();
  const uid = scopeUserId ?? user?.uid;
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setDocuments([]);
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, "documents", uid, "items"),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setDocuments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as UserDocument)));
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  const addDocument = useCallback(async (data: Omit<UserDocument, "id" | "createdAt">) => {
    if (!uid) return;
    await addDoc(collection(db, "documents", uid, "items"), {
      ...data,
      createdAt: serverTimestamp(),
    });
  }, [uid]);

  const deleteDocument = useCallback(async (docId: string) => {
    if (!uid) return;
    await deleteDoc(doc(db, "documents", uid, "items", docId));
  }, [uid]);

  return { documents, addDocument, deleteDocument, loading };
}
