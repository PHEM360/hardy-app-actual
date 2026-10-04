import { useCallback, useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { useAuth } from "@/auth/AuthContext";
import { db } from "@/lib/firebase";
import type { FinancialModelInput, FinancialModelResult, SavedFinancialModel } from "@/lib/financialModel";

export function useFinancialModels(scopeUserId?: string) {
  const { dataUid } = useAuth();
  const uid = scopeUserId ?? dataUid;
  const [models, setModels] = useState<SavedFinancialModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setModels([]);
      setLoading(false);
      return;
    }
    return onSnapshot(
      query(collection(db, "finance", uid, "models"), orderBy("updatedAt", "desc")),
      (snapshot) => {
        setModels(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as SavedFinancialModel)));
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [uid]);

  const saveModel = useCallback(async (input: FinancialModelInput, result: FinancialModelResult, id?: string) => {
    if (!uid) throw new Error("Sign in to save a model.");
    const payload = { input, result, updatedAt: serverTimestamp() };
    if (id) {
      await setDoc(doc(db, "finance", uid, "models", id), payload, { merge: true });
      return id;
    }
    const created = await addDoc(collection(db, "finance", uid, "models"), { ...payload, createdAt: serverTimestamp() });
    return created.id;
  }, [uid]);

  const removeModel = useCallback(async (id: string) => {
    if (!uid) return;
    await deleteDoc(doc(db, "finance", uid, "models", id));
  }, [uid]);

  return { models, loading, saveModel, removeModel };
}
