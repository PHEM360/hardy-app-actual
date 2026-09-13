import { afterEach, describe, expect, it } from "vitest";
import {
  MARKETING_TASK_ROUTES,
  marketingFallbackChain,
  selectMarketingRoute,
  type MarketingKeyFlags,
} from "../../functions/src/marketingRouter";

const none: MarketingKeyFlags = { openai: false, gemini: false, grok: false };
const all: MarketingKeyFlags = { openai: true, gemini: true, grok: true };
const openaiOnly: MarketingKeyFlags = { openai: true, gemini: false, grok: false };
const geminiOnly: MarketingKeyFlags = { openai: false, gemini: true, grok: false };
const grokOnly: MarketingKeyFlags = { openai: false, gemini: false, grok: true };

describe("marketing AI router", () => {
  afterEach(() => {
    delete process.env.MARKETING_TEXT_PROVIDER;
    delete process.env.MARKETING_IMAGE_PROVIDER;
    delete process.env.MARKETING_TEXT_MODEL;
    delete process.env.MARKETING_IMAGE_MODEL;
  });

  it("picks Grok for brand voice and copy when all keys are set", () => {
    expect(selectMarketingRoute("brand_scan", all).provider).toBe("grok");
    expect(selectMarketingRoute("brand_scan", all).model).toBe("grok-4.3");
    expect(selectMarketingRoute("analysis", all).provider).toBe("grok");
    expect(selectMarketingRoute("copy", all)).toMatchObject({ provider: "grok", model: "grok-4.3" });
  });

  it("picks GPT-4o for long marketing plans when all keys are set", () => {
    expect(selectMarketingRoute("plan", all)).toMatchObject({ provider: "openai", model: "gpt-4o" });
  });

  it("picks Gemini Flash for cheap structured schedules", () => {
    expect(selectMarketingRoute("schedule", all)).toMatchObject({
      provider: "gemini",
      model: "gemini-2.5-flash",
    });
  });

  it("picks Gemini Flash Image as the default 2026 image model", () => {
    expect(selectMarketingRoute("image", all)).toMatchObject({
      provider: "gemini",
      model: "gemini-3.1-flash-image",
    });
  });

  it("falls back to the next keyed provider when the preferred key is missing", () => {
    expect(selectMarketingRoute("copy", openaiOnly)).toMatchObject({ provider: "openai", model: "gpt-4o" });
    expect(selectMarketingRoute("copy", geminiOnly)).toMatchObject({ provider: "gemini", model: "gemini-2.5-flash" });
    expect(selectMarketingRoute("plan", grokOnly)).toMatchObject({ provider: "grok", model: "grok-4.3" });
    expect(selectMarketingRoute("image", openaiOnly)).toMatchObject({ provider: "openai", model: "gpt-image-1" });
    expect(selectMarketingRoute("schedule", openaiOnly)).toMatchObject({ provider: "openai", model: "gpt-4o-mini" });
  });

  it("uses the mock provider when no live keys are present", () => {
    expect(selectMarketingRoute("copy", none)).toMatchObject({
      provider: "mock",
      model: "hardy-demo-v1",
    });
    expect(selectMarketingRoute("image", none).provider).toBe("mock");
  });

  it("honours MARKETING_TEXT_PROVIDER when that key is present", () => {
    expect(selectMarketingRoute("copy", all, { textProvider: "gemini" })).toMatchObject({
      provider: "gemini",
      model: "gemini-2.5-flash",
    });
    expect(selectMarketingRoute("copy", all, { textProvider: "openai", textModel: "gpt-4o-mini" })).toMatchObject({
      provider: "openai",
      model: "gpt-4o-mini",
    });
  });

  it("falls through when an override provider has no key", () => {
    const selected = selectMarketingRoute("copy", openaiOnly, { textProvider: "gemini" });
    expect(selected.provider).toBe("openai");
    expect(selected.reason).toMatch(/gemini requested but no key/i);
  });

  it("can pin the demo provider", () => {
    expect(selectMarketingRoute("plan", all, { textProvider: "mock" }).provider).toBe("mock");
  });

  it("reads env overrides", () => {
    process.env.MARKETING_IMAGE_PROVIDER = "openai";
    expect(selectMarketingRoute("image", all).provider).toBe("openai");
    process.env.MARKETING_TEXT_PROVIDER = "grok";
    expect(selectMarketingRoute("plan", all).provider).toBe("grok");
  });

  it("builds a fallback chain of remaining keyed providers then stops", () => {
    const chain = marketingFallbackChain("copy", { openai: true, gemini: true, grok: false });
    expect(chain.map((item) => item.provider)).toEqual(["openai", "gemini"]);
    expect(chain[0].model).toBe("gpt-4o");
  });

  it("documents a relative cost hint on every live candidate", () => {
    for (const [task, candidates] of Object.entries(MARKETING_TASK_ROUTES)) {
      expect(candidates.length).toBeGreaterThan(0);
      for (const item of candidates) {
        expect(item.relativeCost).toBeGreaterThanOrEqual(1);
        expect(item.relativeCost).toBeLessThanOrEqual(5);
        expect(item.model).toBeTruthy();
        expect(item.notes).toBeTruthy();
      }
      expect(task).toBeTruthy();
    }
  });
});
