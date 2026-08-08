import { useEffect, useState, useCallback } from "react";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type DogTagShape = "circle" | "rounded" | "oval" | "heart";

export interface DogTagPhone {
  id: string;
  label: string;
  number: string;
}

export interface DogTagCustomField {
  id: string;
  label: string;
  value: string;
}

export interface DogTagProfile {
  message: string;
  phones: DogTagPhone[];
  address: string;
  vetName: string;
  vetPhone: string;
  vetAddress: string;
  customFields: DogTagCustomField[];
  externalUrl: string;
  sendLocation: boolean;
}

export interface DogTag {
  id: string;
  petId: string;
  ownerId: string;
  label: string;
  code: string;
  slug: string;
  shape: DogTagShape;
  bgColor: string;
  fgColor: string;
  stickerText: string;
  profile: DogTagProfile;
}

export const DEFAULT_TAG_PROFILE: DogTagProfile = {
  message: "",
  phones: [],
  address: "",
  vetName: "",
  vetPhone: "",
  vetAddress: "",
  customFields: [],
  externalUrl: "",
  sendLocation: false,
};

function genCode(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
}

export function genFieldId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Lowercase letters, numbers, hyphens only — keeps /p/:slug URLs clean and predictable. */
export function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

type TagInput = Partial<Omit<DogTag, "id" | "petId" | "ownerId" | "code" | "slug">>;

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
              slug: data.slug || "",
              shape: (data.shape as DogTagShape) || "rounded",
              bgColor: data.bgColor || "#ffffff",
              fgColor: data.fgColor || "#000000",
              stickerText: data.stickerText || "",
              profile: { ...DEFAULT_TAG_PROFILE, ...(data.profile || {}) },
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
        slug: "",
        shape: input.shape || "rounded",
        bgColor: input.bgColor || "#ffffff",
        fgColor: input.fgColor || "#000000",
        stickerText: input.stickerText || "",
        profile: { ...DEFAULT_TAG_PROFILE, ...(input.profile || {}) },
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
      const tag = tags.find((t) => t.id === tagId);
      if (tag?.slug) {
        await deleteDoc(doc(db, "dogTagSlugs", tag.slug)).catch(() => {});
      }
      await deleteDoc(doc(db, "pets", petId, "tags", tagId));
    },
    [petId, tags]
  );

  /**
   * Claims a friendly /p/:slug URL for a tag. Uniqueness is enforced entirely
   * by firestore.rules (first write to dogTagSlugs/{slug} wins — see the
   * rule comment there), not by this function, so a race between two people
   * claiming the same slug at once still resolves safely server-side.
   */
  const claimSlug = useCallback(
    async (ownerId: string, tagId: string, rawSlug: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      if (!petId) return { ok: false, error: "No pet selected." };
      const slug = normalizeSlug(rawSlug);
      if (!slug) return { ok: false, error: "Enter a slug using letters, numbers and hyphens." };

      const existing = await getDoc(doc(db, "dogTagSlugs", slug));
      if (existing.exists() && !(existing.data().petId === petId && existing.data().tagId === tagId)) {
        return { ok: false, error: "That URL is already taken — try another." };
      }

      try {
        const tag = tags.find((t) => t.id === tagId);
        if (tag?.slug && tag.slug !== slug) {
          await deleteDoc(doc(db, "dogTagSlugs", tag.slug)).catch(() => {});
        }
        await setDoc(doc(db, "dogTagSlugs", slug), {
          ownerId,
          petId,
          tagId,
          createdAt: serverTimestamp(),
        });
        await updateDoc(doc(db, "pets", petId, "tags", tagId), { slug, updatedAt: serverTimestamp() });
        return { ok: true };
      } catch {
        return { ok: false, error: "That URL is already taken — try another." };
      }
    },
    [petId, tags]
  );

  return { tags, loading, addTag, updateTag, regenerateCode, deleteTag, claimSlug };
}
