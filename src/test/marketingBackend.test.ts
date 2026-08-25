import { describe, expect, it } from "vitest";
import {
  calculateMarketingPieceCount,
  hasMeaningfulMarketingProfile,
  parseApprovalVersion,
  parseMarketingPlanInput,
} from "../../functions/src/marketingValidation";

describe("marketing backend validation", () => {
  it("normalises valid plan input and removes duplicate platforms", () => {
    expect(parseMarketingPlanInput({
      periodDays: 30,
      postsPerWeek: 3,
      platforms: ["instagram", "instagram", "linkedin"],
      focus: "  Autumn launch  ",
    })).toEqual({
      periodDays: 30,
      postsPerWeek: 3,
      platforms: ["instagram", "linkedin"],
      campaignId: undefined,
      focus: "Autumn launch",
    });
  });

  it("rejects unsafe plan bounds and unsupported platforms", () => {
    expect(() => parseMarketingPlanInput({
      periodDays: 91,
      postsPerWeek: 3,
      platforms: ["instagram"],
    })).toThrow("periodDays");
    expect(() => parseMarketingPlanInput({
      periodDays: 30,
      postsPerWeek: 3,
      platforms: ["x"],
    })).toThrow("facebook, instagram, or linkedin");
  });

  it("caps generated plans at forty pieces", () => {
    expect(calculateMarketingPieceCount(90, 14)).toBe(40);
    expect(calculateMarketingPieceCount(7, 3)).toBe(3);
  });

  it("requires a meaningful brand identity, positioning, and substance", () => {
    expect(hasMeaningfulMarketingProfile({
      industry: "Consulting",
      brandVoice: "Warm and precise",
      targetAudience: "UK small businesses",
      objectives: ["Build trust"],
    })).toBe(true);
    expect(hasMeaningfulMarketingProfile({
      brandVoice: "Warm",
      targetAudience: "Businesses",
      objectives: ["Build trust"],
    })).toBe(false);
  });

  it("requires an exact positive integer approval version", () => {
    expect(parseApprovalVersion(2)).toBe(2);
    expect(() => parseApprovalVersion(0)).toThrow("approvalVersion");
    expect(() => parseApprovalVersion(1.5)).toThrow("approvalVersion");
  });
});
