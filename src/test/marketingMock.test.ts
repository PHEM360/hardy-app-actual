import { describe, expect, it } from "vitest";
import {
  enabledMarketingPlatforms,
  estimateMonthlyBudget,
  mockBrandScan,
  mockContentBatch,
  mockMarketingPlan,
  mockPresenceAnalysis,
  mockScheduleSuggestion,
  type MockHubInput,
} from "@/lib/marketingMock";
import { shouldUseMarketingDemoFallback } from "@/lib/marketingApi";

describe("marketing mock provider", () => {
  const input = {
    companyName: "Hardy Studio",
    description: "Family consultancy",
    website: "hardystudio.co.uk",
    platforms: ["instagram", "linkedin"] as MockHubInput["platforms"],
    periodDays: 14,
    postsPerWeek: 3,
    focus: "Autumn tax wrap-up",
  };

  it("infers a British brand voice from the company name", () => {
    const scan = mockBrandScan(input);
    expect(scan.brandVoice).toMatch(/British English/);
    expect(scan.website).toBe("https://hardystudio.co.uk");
    expect(scan.objectives.length).toBeGreaterThan(0);
    expect(scan.styleNotes).toMatch(/photography/i);
  });

  it("keeps TikTok and YouTube off unless the brand opts in", () => {
    expect(enabledMarketingPlatforms({ platforms: ["instagram"] })).toEqual(["instagram"]);
    expect(enabledMarketingPlatforms({
      platforms: ["instagram"],
      enableTikTok: true,
      enableYouTube: true,
    })).toEqual(["instagram", "tiktok", "youtube"]);
  });

  it("writes a dated batch into pending approval shape", () => {
    const pieces = mockContentBatch(input, 6, Date.parse("2026-09-13T12:00:00Z"));
    expect(pieces).toHaveLength(6);
    expect(pieces.every((item) => item.draft.length > 40)).toBe(true);
    expect(pieces[0].scheduledFor).toMatch(/^2026-09-14/);
    expect(pieces.at(-1)?.scheduledFor).toMatch(/^2026-09-2/);
  });

  it("suggests a budget and a redistributed schedule", () => {
    const analysis = mockPresenceAnalysis(input);
    const plan = mockMarketingPlan(input, analysis);
    expect(plan.estimatedBudgetGbp).toBeGreaterThan(0);
    expect(plan.budgetNotes).toMatch(/planning figure/i);
    expect(estimateMonthlyBudget(["google"], 3)).toBeGreaterThan(estimateMonthlyBudget(["instagram"], 1));
    expect(mockScheduleSuggestion([{ id: "a" }, { id: "b" }], 7, Date.parse("2026-09-13T12:00:00Z"))).toHaveLength(2);
  });
});

describe("marketing demo fallback", () => {
  it("does not swallow auth failures", () => {
    expect(shouldUseMarketingDemoFallback({ code: "functions/unauthenticated" })).toBe(false);
    expect(shouldUseMarketingDemoFallback({ code: "functions/permission-denied" })).toBe(false);
    expect(shouldUseMarketingDemoFallback({ code: "functions/not-found" })).toBe(true);
    expect(shouldUseMarketingDemoFallback({ code: "functions/unavailable" })).toBe(true);
  });
});
