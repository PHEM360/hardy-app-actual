import { useCallback, useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { approvalResetForMarketingEdit } from "@/lib/marketingContent";
import type {
  ContentPiece,
  MarketingAsset,
  MarketingCampaign,
  MarketingPlatformConnection,
  MarketingProfile,
} from "@/types/app";

export const DEFAULT_MARKETING_PROFILE: MarketingProfile = {
  brandVoice: "",
  targetAudience: "",
  objectives: [],
  keyMessages: [],
  requiredPhrases: [],
  bannedPhrases: [],
  disclaimers: [],
  preferredHashtags: [],
  competitors: [],
  platforms: ["instagram", "facebook", "linkedin"],
  tradingNames: [],
  relatedCompanyIds: [],
  industry: "",
  website: "",
  defaultPlanDays: 30,
  postsPerWeek: 3,
  approvalRequired: true,
};

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 100) || "asset";
}

export function companyMarketingAssetPath(companyId: string, fileName: string) {
  const id = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `companies/${companyId}/marketing/${id}-${safeFileName(fileName)}`;
}

function clean<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [
        key,
        Array.isArray(item)
          ? item.map((entry) => entry && typeof entry === "object" ? clean(entry) : entry)
          : item && typeof item === "object" && !(item instanceof Date)
            ? clean(item)
            : item,
      ]),
  ) as T;
}

export function useCompanyMarketing(companyId: string | undefined) {
  const [profile, setProfile] = useState<MarketingProfile>(DEFAULT_MARKETING_PROFILE);
  const [content, setContent] = useState<ContentPiece[]>([]);
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [assets, setAssets] = useState<MarketingAsset[]>([]);
  const [connections, setConnections] = useState<MarketingPlatformConnection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    let remaining = 5;
    const ready = () => {
      remaining -= 1;
      if (remaining <= 0) setLoading(false);
    };
    const unsubscribers = [
      onSnapshot(doc(db, "companies", companyId, "marketing", "profile"), (snapshot) => {
        setProfile(snapshot.exists()
          ? { ...DEFAULT_MARKETING_PROFILE, ...snapshot.data() } as MarketingProfile
          : DEFAULT_MARKETING_PROFILE);
        ready();
      }, ready),
      onSnapshot(
        query(collection(db, "companies", companyId, "content"), orderBy("createdAt", "desc")),
        (snapshot) => {
          setContent(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as ContentPiece)));
          ready();
        },
        ready,
      ),
      onSnapshot(
        query(collection(db, "companies", companyId, "campaigns"), orderBy("createdAt", "desc")),
        (snapshot) => {
          setCampaigns(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as MarketingCampaign)));
          ready();
        },
        ready,
      ),
      onSnapshot(
        query(collection(db, "companies", companyId, "marketingAssets"), orderBy("createdAt", "desc")),
        (snapshot) => {
          setAssets(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as MarketingAsset)));
          ready();
        },
        ready,
      ),
      onSnapshot(
        collection(db, "companies", companyId, "platformConnections"),
        (snapshot) => {
          setConnections(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as MarketingPlatformConnection)));
          ready();
        },
        ready,
      ),
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [companyId]);

  const saveProfile = useCallback(async (next: MarketingProfile) => {
    if (!companyId) return;
    await setDoc(doc(db, "companies", companyId, "marketing", "profile"), {
      ...clean(next),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }, [companyId]);

  const addCampaign = useCallback(async (
    campaign: Omit<MarketingCampaign, "id" | "createdAt" | "updatedAt">,
  ) => {
    if (!companyId) return;
    return addDoc(collection(db, "companies", companyId, "campaigns"), {
      ...clean(campaign),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }, [companyId]);

  const updateCampaign = useCallback(async (id: string, updates: Partial<MarketingCampaign>) => {
    if (!companyId) return;
    await updateDoc(doc(db, "companies", companyId, "campaigns", id), {
      ...clean(updates),
      updatedAt: serverTimestamp(),
    });
  }, [companyId]);

  const deleteCampaign = useCallback(async (id: string) => {
    if (!companyId) return;
    await deleteDoc(doc(db, "companies", companyId, "campaigns", id));
  }, [companyId]);

  const addContent = useCallback(async (
    piece: Omit<ContentPiece, "id" | "createdAt" | "updatedAt">,
  ) => {
    if (!companyId) return;
    return addDoc(collection(db, "companies", companyId, "content"), {
      ...clean(piece),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }, [companyId]);

  const updateContent = useCallback(async (id: string, updates: Partial<ContentPiece>) => {
    if (!companyId) return;
    const existing = content.find((piece) => piece.id === id);
    const approvalReset = approvalResetForMarketingEdit(existing, updates);
    await updateDoc(doc(db, "companies", companyId, "content", id), {
      ...clean(updates),
      ...approvalReset,
      updatedAt: serverTimestamp(),
    });
  }, [companyId, content]);

  const deleteContent = useCallback(async (id: string) => {
    if (!companyId) return;
    await deleteDoc(doc(db, "companies", companyId, "content", id));
  }, [companyId]);

  const uploadAssets = useCallback(async (files: File[]) => {
    if (!companyId) return;
    for (const file of files) {
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        throw new Error(`${file.name} is not an image or video.`);
      }
      if (file.size > 50 * 1024 * 1024) {
        throw new Error(`${file.name} is larger than 50 MB.`);
      }
      const storagePath = companyMarketingAssetPath(companyId, file.name);
      const objectRef = ref(storage, storagePath);
      await uploadBytes(objectRef, file, { contentType: file.type });
      const url = await getDownloadURL(objectRef);
      await addDoc(collection(db, "companies", companyId, "marketingAssets"), {
        name: file.name,
        url,
        storagePath,
        mediaType: file.type.startsWith("video/") ? "video" : "image",
        source: "uploaded",
        tags: [],
        altText: "",
        usageNotes: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }, [companyId]);

  const updateAsset = useCallback(async (id: string, updates: Partial<MarketingAsset>) => {
    if (!companyId) return;
    await updateDoc(doc(db, "companies", companyId, "marketingAssets", id), {
      ...clean(updates),
      updatedAt: serverTimestamp(),
    });
  }, [companyId]);

  const deleteAsset = useCallback(async (asset: MarketingAsset) => {
    if (!companyId || !asset.id) return;
    if (asset.storagePath) await deleteObject(ref(storage, asset.storagePath)).catch(() => undefined);
    await deleteDoc(doc(db, "companies", companyId, "marketingAssets", asset.id));
  }, [companyId]);

  return {
    profile,
    content,
    campaigns,
    assets,
    connections,
    loading,
    saveProfile,
    addCampaign,
    updateCampaign,
    deleteCampaign,
    addContent,
    updateContent,
    deleteContent,
    uploadAssets,
    updateAsset,
    deleteAsset,
  };
}
