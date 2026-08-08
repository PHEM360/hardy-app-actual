import { useEffect, useState, useCallback } from "react";
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type DogTagShape = "circle" | "rounded" | "oval" | "heart";

export interface DogTagActions {
  showPhone: boolean;
  phoneNumber: string;
  contactName: string;
  showMessage: boolean;
  message: string;
  showWebpage: boolean;
  webpageUrl: string;
  sendLocation: boolean;
}

export interface DogTag {
  id: string;
  petId: string;
  ownerId: string;
  label: string;
  code: string;
  shape: DogTagShape;
  bgColor: string;
  fgColor: string;
  stickerText: string;
  actions: DogTagActions;
}

export const DEFAULT_TAG_ACTIONS: DogTagActions = {
  showPhone: false,
  phoneNumber: "",
  contactName: "",
  showMessage: false,
  message: "",
  showWebpage: false,
  webpageUrl: "",
  sendLocation: false,
};

function genCode(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
}

type TagInput = Partial<Omit<DogTag, "id" | "petId" | "ownerId" | "code">>;

/** Dog tags for one pet — a subcollection so access inherits the pet's own owner/sharedWith rules. */
export function useDogTags(petId: string | null) {
  const [tags, setTags] = useState<DogTag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!petId) {
      setTags([]);
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      collection(db, "pets", petId, "tags"),
      (snap) => {
        setTags(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              petId,
              ownerId: data.ownerId || "",
              label: data.label || "Tag",
              code: data.code || "",
              shape: (data.shape as DogTagShape) || "rounded",
              bgColor: data.bgColor || "#ffffff",
              fgColor: data.fgColor || "#000000",
              stickerText: data.stickerText || "",
              actions: { ...DEFAULT_TAG_ACTIONS, ...(data.actions || {}) },
            } as DogTag;
          })
        );
        setLoading(false);
      },
      () => {
        setTags([]);
        setLoading(false);
      }
    );
    return unsub;
  }, [petId]);

  const addTag = useCallback(
    async (ownerId: string, input: TagInput): Promise<string | undefined> => {
      if (!petId) return undefined;
      const ref = await addDoc(collection(db, "pets", petId, "tags"), {
        ownerId,
        label: input.label || "Collar tag",
        code: genCode(),
        shape: input.shape || "rounded",
        bgColor: input.bgColor || "#ffffff",
        fgColor: input.fgColor || "#000000",
        stickerText: input.stickerText || "",
        actions: { ...DEFAULT_TAG_ACTIONS, ...(input.actions || {}) },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return ref.id;
    },
    [petId]
  );

  const updateTag = useCallback(
    async (tagId: string, patch: TagInput) => {
      if (!petId) return;
      await updateDoc(doc(db, "pets", petId, "tags", tagId), {
        ...patch,
        updatedAt: serverTimestamp(),
      });
    },
    [petId]
  );

  const regenerateCode = useCallback(
    async (tagId: string) => {
      if (!petId) return;
      await updateDoc(doc(db, "pets", petId, "tags", tagId), {
        code: genCode(),
        updatedAt: serverTimestamp(),
      });
    },
    [petId]
  );

  const deleteTag = useCallback(
    async (tagId: string) => {
      if (!petId) return;
      await deleteDoc(doc(db, "pets", petId, "tags", tagId));
    },
    [petId]
  );

  return { tags, loading, addTag, updateTag, regenerateCode, deleteTag };
}
