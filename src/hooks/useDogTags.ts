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
import { auth, db } from "@/lib/firebase";
import { normalizeSlug } from "@/lib/slug";

export { normalizeSlug };

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

export interface DogTagScanLocation {
  lat: number;
  lng: number;
  placeName: string;
  at: unknown;
}

export interface DogTag {
  id: string;
  petId: string;
  ownerId: string;
  label: string;
  code: string;
  /** Short uppercase code behind the engraving friendly /t/:code link the QR encodes. */
  shortCode: string;
  slug: string;
  shape: DogTagShape;
  bgColor: string;
  fgColor: string;
  stickerText: string;
  /** Physical tag diameter/side length when printed, in cm — real dog tags are small (2–6cm). */
  sizeCm: number;
  /** QR code size, in cm — independently adjustable so text/QR balance works at any tag size. */
  qrSizeCm: number;
  /** Front sticker text height, in cm. */
  stickerTextSizeCm: number;
  /** Free text for the reverse side, e.g. "IF FOUND please scan the QR code". */
  backText: string;
  /** Back text height, in cm. */
  backTextSizeCm: number;
  profile: DogTagProfile;
  lastScanLocation: DogTagScanLocation | null;
  notifyEmails: string[];
  notifyUids: string[];
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

const DEFAULT_SIZE_CM = 3.5;
const DEFAULT_QR_SIZE_CM = 1.8;
const DEFAULT_STICKER_TEXT_SIZE_CM = 0.35;
const DEFAULT_BACK_TEXT_SIZE_CM = 0.4;

function genCode(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
}

/** No 0/O, 1/I/L: the code may be read off a worn tag and typed by hand. */
const SHORT_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const SHORT_CODE_LENGTH = 7;

function genShortCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SHORT_CODE_LENGTH));
  return Array.from(bytes, (b) => SHORT_CODE_ALPHABET[b % SHORT_CODE_ALPHABET.length]).join("");
}

/**
 * Claims a fresh dogTagShortCodes/{code} lookup and stores the code on the
 * tag. The lookup is create-only in firestore.rules, so a (vanishingly rare)
 * collision is rejected and simply retried with a new code. The server only
 * honours a lookup whose tag still carries the same shortCode, so replacing
 * the code retires the old one even if its lookup doc can't be deleted.
 */
export async function assignShortCode(petId: string, tagId: string, previous?: string) {
  const ownerId = auth.currentUser?.uid;
  if (!ownerId) throw new Error("Not signed in.");
  for (let attempt = 0; attempt < 3; attempt++) {
    const shortCode = genShortCode();
    try {
      await setDoc(doc(db, "dogTagShortCodes", shortCode), { ownerId, petId, tagId, createdAt: serverTimestamp() });
    } catch {
      continue;
    }
    await updateDoc(doc(db, "pets", petId, "tags", tagId), { shortCode, updatedAt: serverTimestamp() });
    if (previous) await deleteDoc(doc(db, "dogTagShortCodes", previous)).catch(() => {});
    return shortCode;
  }
  throw new Error("Could not allocate a short code.");
}

export function genFieldId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

type TagInput = Partial<Omit<DogTag, "id" | "petId" | "ownerId" | "code" | "shortCode" | "slug" | "lastScanLocation">>;

export function dogTagFromFirestore(petId: string, id: string, data: Record<string, unknown>): DogTag {
  return {
    id,
    petId,
    ownerId: String(data.ownerId || ""),
    label: String(data.label || "Tag"),
    code: String(data.code || ""),
    shortCode: String(data.shortCode || ""),
    slug: String(data.slug || ""),
    shape: (data.shape as DogTagShape) || "rounded",
    bgColor: String(data.bgColor || "#ffffff"),
    fgColor: String(data.fgColor || "#000000"),
    stickerText: String(data.stickerText || ""),
    sizeCm: typeof data.sizeCm === "number" ? data.sizeCm : DEFAULT_SIZE_CM,
    qrSizeCm: typeof data.qrSizeCm === "number" ? data.qrSizeCm : DEFAULT_QR_SIZE_CM,
    stickerTextSizeCm: typeof data.stickerTextSizeCm === "number" ? data.stickerTextSizeCm : DEFAULT_STICKER_TEXT_SIZE_CM,
    backText: String(data.backText || ""),
    backTextSizeCm: typeof data.backTextSizeCm === "number" ? data.backTextSizeCm : DEFAULT_BACK_TEXT_SIZE_CM,
    profile: { ...DEFAULT_TAG_PROFILE, ...((data.profile as DogTagProfile | undefined) || {}) },
    lastScanLocation: (data.lastScanLocation as DogTagScanLocation | null) || null,
    notifyEmails: Array.isArray(data.notifyEmails) ? data.notifyEmails.map(String) : [],
    notifyUids: Array.isArray(data.notifyUids) ? data.notifyUids.map(String) : [],
  };
}

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
        setTags(snap.docs.map((d) => dogTagFromFirestore(petId, d.id, d.data() as Record<string, unknown>)));
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
        sizeCm: input.sizeCm ?? DEFAULT_SIZE_CM,
        qrSizeCm: input.qrSizeCm ?? DEFAULT_QR_SIZE_CM,
        stickerTextSizeCm: input.stickerTextSizeCm ?? DEFAULT_STICKER_TEXT_SIZE_CM,
        backText: input.backText || "",
        backTextSizeCm: input.backTextSizeCm ?? DEFAULT_BACK_TEXT_SIZE_CM,
        profile: { ...DEFAULT_TAG_PROFILE, ...(input.profile || {}) },
        notifyEmails: input.notifyEmails || [],
        notifyUids: input.notifyUids || [],
        lastScanLocation: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      // The short code is assigned by DogTagsSection's backfill as soon as the
      // new tag reaches the live listener, same path as for older tags.
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
      const tag = tags.find((t) => t.id === tagId);
      await assignShortCode(petId, tagId, tag?.shortCode || undefined);
    },
    [petId, tags]
  );

  const deleteTag = useCallback(
    async (tagId: string) => {
      if (!petId) return;
      const tag = tags.find((t) => t.id === tagId);
      if (tag?.slug) {
        await deleteDoc(doc(db, "dogTagSlugs", tag.slug)).catch(() => {});
      }
      if (tag?.shortCode) {
        await deleteDoc(doc(db, "dogTagShortCodes", tag.shortCode)).catch(() => {});
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

/** Live tags for every pet on the page — used to print a mixed sheet. */
export function useAllDogTags(petIds: string[]) {
  const [tagsByPet, setTagsByPet] = useState<Record<string, DogTag[]>>({});
  const [loading, setLoading] = useState(petIds.length > 0);
  const petIdsKey = petIds.join("|");

  useEffect(() => {
    const ids = petIdsKey ? petIdsKey.split("|") : [];
    if (ids.length === 0) {
      setTagsByPet({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const received = new Set<string>();
    const unsubs = ids.map((petId) =>
      onSnapshot(
        collection(db, "pets", petId, "tags"),
        (snap) => {
          setTagsByPet((prev) => ({
            ...prev,
            [petId]: snap.docs.map((d) => dogTagFromFirestore(petId, d.id, d.data() as Record<string, unknown>)),
          }));
          received.add(petId);
          if (received.size === ids.length) setLoading(false);
        },
        () => {
          setTagsByPet((prev) => ({ ...prev, [petId]: [] }));
          received.add(petId);
          if (received.size === ids.length) setLoading(false);
        },
      )
    );
    return () => unsubs.forEach((unsub) => unsub());
  }, [petIdsKey]);

  return { tagsByPet, loading };
}
