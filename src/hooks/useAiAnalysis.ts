import { useEffect, useState, useCallback } from "react";
import { collection, onSnapshot, addDoc, query, orderBy, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { db, storage, functions } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";

export interface AiSession {
  id: string;
  documentNames: string[];
  documentUrls: string[];
  question: string;
  answer: string;
  createdAt: unknown;
}

export interface UploadedDoc {
  storagePath: string;
  mimeType: string;
  name: string;
  url: string;
}

export function useAiAnalysis() {
  const { dataUid } = useAuth();
  const [sessions, setSessions] = useState<AiSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dataUid) {
      setSessions([]);
      setLoading(false);
      return;
    }
    const q = query(collection(db, "aiAnalysis", dataUid, "sessions"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setSessions(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AiSession, "id">) })));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [dataUid]);

  const uploadDocument = useCallback(
    async (file: File): Promise<UploadedDoc> => {
      if (!dataUid) throw new Error("You must be signed in.");
      const storagePath = `aiAnalysis/${dataUid}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      return { storagePath, mimeType: file.type, name: file.name, url };
    },
    [dataUid]
  );

  const analyze = useCallback(
    async (documents: UploadedDoc[], question: string): Promise<string> => {
      const call = httpsCallable(functions, "analyzeDocuments");
      const result = await call({
        documents: documents.map((d) => ({ storagePath: d.storagePath, mimeType: d.mimeType })),
        question,
      });
      const answer = (result.data as { answer: string }).answer;

      if (dataUid) {
        await addDoc(collection(db, "aiAnalysis", dataUid, "sessions"), {
          documentNames: documents.map((d) => d.name),
          documentUrls: documents.map((d) => d.url),
          question,
          answer,
          createdAt: serverTimestamp(),
        });
      }
      return answer;
    },
    [dataUid]
  );

  return { sessions, loading, uploadDocument, analyze };
}
