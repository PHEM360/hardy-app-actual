import { describe, expect, it } from "vitest";
import {
  buildMarketingPlanInstructions,
  calculateMarketingPieceCount,
  extractPublicPageHints,
  hasMeaningfulMarketingProfile,
  isSafePublicHttpUrl,
  parseApprovalVersion,
  parseMarketingAuditInput,
  parseMarketingPlanInput,
  splitCompetitorHints,
  ukSeasonalContext,
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
      includeImages: true,
      includeArticles: false,
      controversialTheme: undefined,
      textProvider: undefined,
      textModel: undefined,
      imageProvider: undefined,
      imageModel: undefined,
    });
  });

  it("keeps pictures on by default and can turn them off", () => {
    expect(parseMarketingPlanInput({
      periodDays: 30,
      postsPerWeek: 3,
      platforms: ["instagram"],
    }).includeImages).toBe(true);
    expect(parseMarketingPlanInput({
      periodDays: 30,
      postsPerWeek: 3,
      platforms: ["instagram"],
      includeImages: false,
    }).includeImages).toBe(false);
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
      platforms: ["threads"],
    })).toThrow("facebook, instagram, linkedin, x, tiktok, youtube, or google");
  });

  it("caps generated plans at one hundred and twenty pieces", () => {
    expect(calculateMarketingPieceCount(90, 14)).toBe(120);
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

  it("builds UK seasonal and brand-aware plan instructions", () => {
    const august = ukSeasonalContext(new Date("2026-08-25T12:00:00Z"));
    expect(august.join(" ")).toMatch(/summer holidays/i);
    const instructions = buildMarketingPlanInstructions(12, august);
    expect(instructions).toMatch(/British English/);
    expect(instructions).toMatch(/competitors/);
    expect(instructions).toMatch(/Return exactly 12 pieces/);
  });

  it("splits competitor names from public websites and blocks private URLs", () => {
    expect(splitCompetitorHints([
      "Acme Accounting",
      "https://acme.example",
      "http://localhost/secret",
      "https://127.0.0.1/admin",
    ])).toEqual({
      names: ["Acme Accounting"],
      urls: ["https://acme.example"],
    });
    expect(isSafePublicHttpUrl("https://competitor.co.uk")).toBe(true);
    expect(isSafePublicHttpUrl("http://169.254.169.254/latest/meta-data")).toBe(false);
  });

  it("extracts title, description and headings from a public page", () => {
    expect(extractPublicPageHints(`
      <html><head>
        <title>Acme Tax | Family accountants</title>
        <meta name="description" content="UK tax help for families">
      </head><body><h1>Friendly tax advice</h1><script>ignore()</script><p>We help with self assessment.</p></body></html>
    `)).toMatchObject({
      title: "Acme Tax | Family accountants",
      description: "UK tax help for families",
      headings: ["Friendly tax advice"],
    });
  });

  it("keeps only public extra URLs for an audit", () => {
    expect(parseMarketingAuditInput({
      extraUrls: "https://acme.co.uk/about http://localhost/admin",
      searchNotes: "  boiler repair  ",
      adsNotes: "",
    })).toEqual({
      extraUrls: ["https://acme.co.uk/about"],
      searchNotes: "boiler repair",
      adsNotes: "",
      socialNotes: "",
      otherNotes: "",
    });
  });
});
