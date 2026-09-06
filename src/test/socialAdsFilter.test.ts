import { describe, expect, it } from "vitest";
import { filterMarketingContent, type CompanyMarketingBundle } from "@/hooks/useAllCompanyMarketing";
import { DEFAULT_MARKETING_PROFILE } from "@/hooks/useCompanyMarketing";
import type { Company, ContentPiece } from "@/types/app";

const company = (id: string, name: string): Company => ({
  id,
  name,
  description: "",
  color: "#3366aa",
  emoji: "🏢",
  logoUrl: "",
  isRegistered: false,
  companyType: "other",
  taxYearStart: "2026-04-06",
  contact: {},
});

const post = (id: string, platform: ContentPiece["platform"]): ContentPiece => ({
  id,
  type: "social_post",
  platform,
  topic: id,
  campaignId: "",
  objective: "",
  audience: "",
  trendReason: "",
  draft: "Hello",
  refinedDraft: "",
  hashtags: [],
  assetIds: [],
  aiImagePrompt: "",
  scheduledFor: "2026-09-10T09:00:00.000Z",
  timezone: "Europe/London",
  status: "awaiting_approval",
  approvalVersion: 1,
  approvedVersion: 0,
  approvedAt: "",
  approvedBy: "",
  rejectedAt: "",
  rejectedBy: "",
  rejectionReason: "",
  publishedAt: "",
  externalPostId: "",
  externalPostUrl: "",
  publishAttempts: 0,
  publishError: "",
  aiProvider: "openai",
  aiModel: "gpt-4o-mini",
  aiReasoning: "",
  brandChecks: [],
  engagementSuggestions: [],
  revisions: [],
});

function bundle(id: string, name: string, content: ContentPiece[]): CompanyMarketingBundle {
  return {
    company: company(id, name),
    profile: DEFAULT_MARKETING_PROFILE,
    content,
    assets: [],
    connections: [],
    audits: [],
  };
}

describe("social ads dashboard filters", () => {
  const rows = [
    bundle("alpha", "Alpha", [post("a1", "instagram"), post("a2", "linkedin")]),
    bundle("beta", "Beta", [post("b1", "instagram")]),
  ];

  it("can show every company and one platform", () => {
    expect(filterMarketingContent(rows, "all", "instagram").map((row) => row.item.id)).toEqual(["a1", "b1"]);
  });

  it("can lock to one company across platforms", () => {
    expect(filterMarketingContent(rows, "alpha", "all").map((row) => row.item.id)).toEqual(["a1", "a2"]);
  });
});
