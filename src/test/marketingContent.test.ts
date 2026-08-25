import { describe, expect, it } from "vitest";
import {
  approvalResetForMarketingEdit,
  formatMarketingPostForShare,
  isMarketingProfileReady,
} from "@/lib/marketingContent";
import type { ContentPiece, MarketingProfile } from "@/types/app";

const approved = {
  approvalVersion: 7,
  status: "scheduled",
} as ContentPiece;

describe("marketing content approval invalidation", () => {
  it("creates a new review version when approved copy or timing changes", () => {
    expect(approvalResetForMarketingEdit(approved, { draft: "New copy" })).toEqual({
      status: "awaiting_approval",
      approvalVersion: 8,
      approvedVersion: 0,
      approvedAt: "",
      approvedBy: "",
    });
    expect(approvalResetForMarketingEdit(approved, { scheduledFor: "2026-10-01T09:00:00Z" }))
      .toMatchObject({ approvalVersion: 8, status: "awaiting_approval" });
  });

  it("also versions a draft already open in another reviewer’s browser", () => {
    const awaiting = { approvalVersion: 3, status: "awaiting_approval" } as ContentPiece;
    expect(approvalResetForMarketingEdit(awaiting, { hashtags: ["updated"] }))
      .toMatchObject({ approvalVersion: 4, status: "awaiting_approval" });
  });

  it("does not disturb approval for non-material metadata", () => {
    expect(approvalResetForMarketingEdit(approved, { topic: "Internal label" })).toEqual({});
  });
});

describe("marketing profile readiness", () => {
  const ready: MarketingProfile = {
    brandVoice: "Warm and expert",
    targetAudience: "Local business owners",
    objectives: ["Build trust"],
    keyMessages: [],
    requiredPhrases: [],
    bannedPhrases: [],
    disclaimers: [],
    preferredHashtags: [],
    competitors: [],
    platforms: ["instagram"],
    tradingNames: [],
    relatedCompanyIds: [],
    industry: "Consulting",
    website: "",
    defaultPlanDays: 30,
    postsPerWeek: 3,
    approvalRequired: true,
  };

  it("matches the server: identity, positioning and substance are all required", () => {
    expect(isMarketingProfileReady(ready)).toBe(true);
    expect(isMarketingProfileReady({ ...ready, industry: "", tradingNames: [] })).toBe(false);
    expect(isMarketingProfileReady({ ...ready, brandVoice: "Hi" })).toBe(false);
    expect(isMarketingProfileReady({ ...ready, objectives: [], keyMessages: [] })).toBe(false);
  });
});

describe("manual publishing export", () => {
  it("packs caption, hashtags and timing into one copyable block", () => {
    const text = formatMarketingPostForShare({
      ...approved,
      type: "social_post",
      platform: "instagram",
      topic: "Monday tip",
      draft: "Start with one decision.",
      refinedDraft: "",
      hashtags: ["help", "#focus"],
      scheduledFor: "2026-09-01T09:00:00.000Z",
    });
    expect(text).toContain("Monday tip");
    expect(text).toContain("Start with one decision.");
    expect(text).toMatch(/#help #focus/);
    expect(text).toContain("Instagram");
  });
});
