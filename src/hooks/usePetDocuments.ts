import { useEffect, useState, useCallback } from "react";
import {
  collection, onSnapshot, addDoc, deleteDoc, doc,
  query, orderBy, serverTimestamp,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";

export interface PetDocument {
  id: string;
  title: string;
  url: string;
  storagePath: string;
  petIds: string[];   // empty array means "all pets"
  fileType: string;   // e.g. "image/jpeg", "application/pdf"
  uploadedAt: any;
}

export function usePetDocuments() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<PetDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "petDocuments", user.uid, "docs"),
      orderBy("uploadedAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setDocuments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PetDocument)));
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const uploadDocument = useCallback(async (
    file: File,
    title: string,
    petIds: string[],
  ) => {
    if (!user) return;
    const path = `petDocuments/${user.uid}/${Date.now()}_${file.name}`;
    const sRef = storageRef(storage, path);
    await uploadBytes(sRef, file);
    const url = await getDownloadURL(sRef);
    await addDoc(collection(db, "petDocuments", user.uid, "docs"), {
      title: title || file.name,
      url,
      storagePath: path,
      petIds,
      fileType: file.type,
      uploadedAt: serverTimestamp(),
    });
  }, [user]);

  const deleteDocument = useCallback(async (docItem: PetDocument) => {
    if (!user) return;
    try { await deleteObject(storageRef(storage, docItem.storagePath)); } catch {}
    await deleteDoc(doc(db, "petDocuments", user.uid, "docs", docItem.id));
  }, [user]);

  return { documents, loading, uploadDocument, deleteDocument };
}
