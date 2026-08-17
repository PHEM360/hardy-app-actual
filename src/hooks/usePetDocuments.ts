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
  const { dataUid } = useAuth();
  const [documents, setDocuments] = useState<PetDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dataUid) return;
    const q = query(
      collection(db, "petDocuments", dataUid, "docs"),
      orderBy("uploadedAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setDocuments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PetDocument)));
      setLoading(false);
    });
    return unsub;
  }, [dataUid]);

  const uploadDocument = useCallback(async (
    file: File,
    title: string,
    petIds: string[],
  ) => {
    if (!dataUid) return;
    const path = `petDocuments/${dataUid}/${Date.now()}_${file.name}`;
    const sRef = storageRef(storage, path);
    await uploadBytes(sRef, file);
    const url = await getDownloadURL(sRef);
    await addDoc(collection(db, "petDocuments", dataUid, "docs"), {
      title: title || file.name,
      url,
      storagePath: path,
      petIds,
      fileType: file.type,
      uploadedAt: serverTimestamp(),
    });
  }, [dataUid]);

  const deleteDocument = useCallback(async (docItem: PetDocument) => {
    if (!dataUid) return;
    try { await deleteObject(storageRef(storage, docItem.storagePath)); } catch {}
    await deleteDoc(doc(db, "petDocuments", dataUid, "docs", docItem.id));
  }, [dataUid]);

  return { documents, loading, uploadDocument, deleteDocument };
}
