import { useEffect, useState, useCallback } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  deleteField,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { QRCodeItem, QRCodeSettings, DEFAULT_QR_SETTINGS } from "@/types/app";
import { normalizeSlug, randomSlug } from "@/lib/slug";
import { useAuth } from "@/auth/AuthContext";

// ─── Friendly-link slugs (URL-type QR codes only) ──────────────────────────────
//
// Mirrors the dog tag slug system (useDogTags.ts / dogTagSlugs): a top-level
// `qrLinkSlugs/{slug}` doc is the public redirect target for hardyapp.co.uk/l/:slug.
// Unlike dog tags, the destination `url` is stored directly on the slug doc (not
// looked up via a Cloud Function) since a redirect target isn't sensitive — anyone
// scanning the QR would land on that URL anyway.
//
// Every URL-type, non-sendLocation QR code gets a slug automatically (a random one)
// the moment it's saved, so the printed QR always encodes a stable app link instead
// of the raw destination — the destination can then be changed later without
// reprinting. `claimLinkSlug` lets the user swap the random one for a friendly one.

async function ensureLinkSlugDoc(uid: string, qrCodeId: string, slug: string, url: string) {
  await setDoc(doc(db, "qrLinkSlugs", slug), { ownerId: uid, qrCodeId, url, createdAt: serverTimestamp() }, { merge: true });
}

/** Keeps a QR code's `qrLinkSlugs` doc in sync with its content, creating one if needed. */
async function syncLinkSlugForItem(
  uid: string,
  qrCodeId: string,
  item: { contentType: string; content: string; sendLocation?: boolean; slug?: string },
): Promise<string | undefined> {
  const isUrlType = item.contentType === "url" && !item.sendLocation;

  if (!isUrlType) {
    if (item.slug) await deleteDoc(doc(db, "qrLinkSlugs", item.slug)).catch(() => {});
    return undefined;
  }

  if (item.slug) {
    await ensureLinkSlugDoc(uid, qrCodeId, item.slug, item.content);
    return item.slug;
  }

  for (let i = 0; i < 5; i++) {
    const candidate = randomSlug();
    const existing = await getDoc(doc(db, "qrLinkSlugs", candidate));
    if (!existing.exists()) {
      await ensureLinkSlugDoc(uid, qrCodeId, candidate, item.content);
      return candidate;
    }
  }
  return undefined;
}

// ─── QR Code items CRUD ────────────────────────────────────────────────────────

export function useQRCodes(scopeUserId?: string) {
  const [qrCodes, setQrCodes] = useState<QRCodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { dataUid } = useAuth();
  const uid = scopeUserId ?? dataUid;

  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, "qrcodes", uid, "items"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setQrCodes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as QRCodeItem)));
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  const addQRCode = useCallback(async (item: Omit<QRCodeItem, "id" | "createdAt" | "updatedAt">) => {
    if (!uid) return;
    const ref = await addDoc(collection(db, "qrcodes", uid, "items"), {
      ...item,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const slug = await syncLinkSlugForItem(uid, ref.id, item);
    if (slug !== item.slug) await updateDoc(ref, { slug: slug ?? deleteField(), slugIsCustom: slug ? false : deleteField() });
  }, [uid]);

  const updateQRCode = useCallback(async (id: string, updates: Partial<QRCodeItem>) => {
    if (!uid) return;
    await updateDoc(doc(db, "qrcodes", uid, "items", id), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    // Only a full-form save (GeneratorView) includes contentType/content — a
    // partial patch like { labelDesign } shouldn't touch the link slug.
    if (updates.contentType !== undefined && updates.content !== undefined) {
      const slug = await syncLinkSlugForItem(uid, id, updates as { contentType: string; content: string; sendLocation?: boolean; slug?: string });
      if (slug !== updates.slug) {
        await updateDoc(doc(db, "qrcodes", uid, "items", id), { slug: slug ?? deleteField(), slugIsCustom: slug ? false : deleteField() });
      }
    }
  }, [uid]);

  /**
   * Swaps a URL-type QR code's auto-generated link identifier for a friendly
   * one. Uniqueness is enforced by firestore.rules (first write to
   * qrLinkSlugs/{slug} wins), mirroring the dog tag slug system.
   */
  const claimLinkSlug = useCallback(
    async (qrCodeId: string, currentSlug: string | undefined, rawSlug: string, url: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      if (!uid) return { ok: false, error: "Not signed in." };
      const slug = normalizeSlug(rawSlug);
      if (!slug) return { ok: false, error: "Enter a link using letters, numbers and hyphens." };

      const existing = await getDoc(doc(db, "qrLinkSlugs", slug));
      if (existing.exists() && existing.data().qrCodeId !== qrCodeId) {
        return { ok: false, error: "That link is already taken — try another." };
      }

      try {
        if (currentSlug && currentSlug !== slug) {
          await deleteDoc(doc(db, "qrLinkSlugs", currentSlug)).catch(() => {});
        }
        await ensureLinkSlugDoc(uid, qrCodeId, slug, url);
        await updateDoc(doc(db, "qrcodes", uid, "items", qrCodeId), { slug, slugIsCustom: true, updatedAt: serverTimestamp() });
        return { ok: true };
      } catch {
        return { ok: false, error: "That link is already taken — try another." };
      }
    },
    [uid],
  );

  const deleteQRCode = useCallback(async (id: string) => {
    if (!uid) return;
    await deleteDoc(doc(db, "qrcodes", uid, "items", id));
  }, [uid]);

  const removeLabelDesign = useCallback(async (id: string) => {
    if (!uid) return;
    await updateDoc(doc(db, "qrcodes", uid, "items", id), {
      labelDesign: deleteField(),
      updatedAt: serverTimestamp(),
    });
  }, [uid]);

  const addQRCodeAndGetId = useCallback(async (item: Omit<QRCodeItem, "id" | "createdAt" | "updatedAt">): Promise<string | null> => {
    if (!uid) return null;
    const ref = await addDoc(collection(db, "qrcodes", uid, "items"), {
      ...item,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  }, [uid]);

  return { qrCodes, loading, addQRCode, addQRCodeAndGetId, updateQRCode, deleteQRCode, removeLabelDesign, claimLinkSlug };
}

// ─── QR Code settings ──────────────────────────────────────────────────────────

export function useQRCodeSettings(scopeUserId?: string) {
  const [settings, setSettings] = useState<QRCodeSettings>(DEFAULT_QR_SETTINGS);
  const { dataUid } = useAuth();
  const uid = scopeUserId ?? dataUid;

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, "qrcodes", uid, "settings", "default"), (snap) => {
      if (snap.exists()) {
        setSettings({ ...DEFAULT_QR_SETTINGS, ...snap.data() } as QRCodeSettings);
      }
    });
    return unsub;
  }, [uid]);

  const saveSettings = useCallback(async (updates: Partial<QRCodeSettings>) => {
    if (!uid) return;
    await setDoc(
      doc(db, "qrcodes", uid, "settings", "default"),
      { ...updates, updatedAt: serverTimestamp() },
      { merge: true }
    );
  }, [uid]);

  return { settings, saveSettings };
}
