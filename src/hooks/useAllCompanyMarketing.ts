import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCompanies } from "@/hooks/useCompanies";
import { DEFAULT_MARKETING_PROFILE } from "@/hooks/useCompanyMarketing";
import type {
  Company,
  ContentPiece,
  MarketingAsset,
  MarketingAudit,
  MarketingPlatformConnection,
  MarketingProfile,
} from "@/types/app";

export interface CompanyMarketingBundle {
  company: Company;
  profile: MarketingProfile;
  content: ContentPiece[];
  assets: MarketingAsset[];
  connections: MarketingPlatformConnection[];
  audits: MarketingAudit[];
}

export function useAllCompanyMarketing() {
  const { companies, loading: companiesLoading } = useCompanies();
  const [bundles, setBundles] = useState<Record<string, Omit<CompanyMarketingBundle, "company">>>({});

  useEffect(() => {
    if (!companies.length) {
      setBundles({});
      return;
    }
    const unsubs = companies.flatMap((company) => [
      onSnapshot(doc(db, "companies", company.id, "marketing", "profile"), (snap) => {
        setBundles((current) => ({
          ...current,
          [company.id]: {
            ...(current[company.id] || emptyBundle()),
            profile: snap.exists()
              ? { ...DEFAULT_MARKETING_PROFILE, ...snap.data() } as MarketingProfile
              : DEFAULT_MARKETING_PROFILE,
          },
        }));
      }),
      onSnapshot(
        query(collection(db, "companies", company.id, "content"), orderBy("scheduledFor", "asc")),
        (snap) => {
          setBundles((current) => ({
            ...current,
            [company.id]: {
              ...(current[company.id] || emptyBundle()),
              content: snap.docs.map((item) => ({ id: item.id, ...item.data() } as ContentPiece)),
            },
          }));
        },
        () => undefined,
      ),
      onSnapshot(
        query(collection(db, "companies", company.id, "marketingAssets"), orderBy("createdAt", "desc")),
        (snap) => {
          setBundles((current) => ({
            ...current,
            [company.id]: {
              ...(current[company.id] || emptyBundle()),
              assets: snap.docs.map((item) => ({ id: item.id, ...item.data() } as MarketingAsset)),
            },
          }));
        },
        () => undefined,
      ),
      onSnapshot(collection(db, "companies", company.id, "platformConnections"), (snap) => {
        setBundles((current) => ({
          ...current,
          [company.id]: {
            ...(current[company.id] || emptyBundle()),
            connections: snap.docs.map((item) => ({ id: item.id, ...item.data() } as MarketingPlatformConnection)),
          },
        }));
      }),
      onSnapshot(
        query(collection(db, "companies", company.id, "marketingAudits"), orderBy("createdAt", "desc")),
        (snap) => {
          setBundles((current) => ({
            ...current,
            [company.id]: {
              ...(current[company.id] || emptyBundle()),
              audits: snap.docs.map((item) => ({ id: item.id, ...item.data() } as MarketingAudit)),
            },
          }));
        },
        () => undefined,
      ),
    ]);
    return () => unsubs.forEach((unsub) => unsub());
  }, [companies]);

  const rows = useMemo<CompanyMarketingBundle[]>(
    () => companies.map((company) => ({
      company,
      ...(bundles[company.id] || emptyBundle()),
    })),
    [companies, bundles],
  );

  return { companies, rows, loading: companiesLoading };
}

function emptyBundle(): Omit<CompanyMarketingBundle, "company"> {
  return {
    profile: DEFAULT_MARKETING_PROFILE,
    content: [],
    assets: [],
    connections: [],
    audits: [],
  };
}

export function filterMarketingContent(
  rows: CompanyMarketingBundle[],
  companyId: string,
  platform: string,
) {
  return rows.flatMap((row) => {
    if (companyId !== "all" && row.company.id !== companyId) return [];
    return row.content
      .filter((item) => platform === "all" || item.platform === platform)
      .map((item) => ({ item, company: row.company, profile: row.profile, assets: row.assets }));
  });
}
