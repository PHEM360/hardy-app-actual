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

export function useDocuments() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setDocuments([]);
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, "documents", user.uid, "items"),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setDocuments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as UserDocument)));
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const addDocument = useCallback(async (data: Omit<UserDocument, "id" | "createdAt">) => {
    if (!user) return;
    await addDoc(collection(db, "documents", user.uid, "items"), {
      ...data,
      createdAt: serverTimestamp(),
    });
  }, [user]);

  const deleteDocument = useCallback(async (docId: string) => {
    if (!user) return;
    await deleteDoc(doc(db, "documents", user.uid, "items", docId));
  }, [user]);

  return { documents, addDocument, deleteDocument, loading };
}
