import { describe, expect, it, vi } from "vitest";
import {
  generateMarketingImageBuffer,
  generateMarketingJson,
  geminiGenerateJson,
  grokChatJson,
  marketingFlagsFromSecrets,
  openaiChatJson,
  parseModelJson,
} from "../../functions/src/marketingProviders";

const liveSecrets = {
  openai: "sk-test-openai-key",
  gemini: "gemini-test-key",
  grok: "xai-test-key-here",
};

describe("marketing provider adapters", () => {
  it("derives key flags from secret length", () => {
    expect(marketingFlagsFromSecrets({ openai: "", gemini: "short", grok: "xai-test-key-here" })).toEqual({
      openai: false,
      gemini: false,
      grok: true,
    });
  });

  it("strips markdown fences before parsing JSON", () => {
    expect(parseModelJson("```json\n{\"ok\":true}\n```")).toEqual({ ok: true });
  });

  it("uses the mock provider when no keys are set", async () => {
    const result = await generateMarketingJson({
      task: "copy",
      system: "sys",
      user: "user",
      secrets: { openai: "", gemini: "", grok: "" },
      mockGenerate: () => ({ draft: "demo" }),
      adapters: {
        openai: async () => {
          throw new Error("must not call OpenAI");
        },
      },
    });
    expect(result.usage.provider).toBe("mock");
    expect(result.value).toEqual({ draft: "demo" });
  });

  it("selects Grok for copy when all keys are present and never calls other adapters", async () => {
    const grok = vi.fn(async () => ({ draft: "from grok" }));
    const openai = vi.fn(async () => ({ draft: "from openai" }));
    const result = await generateMarketingJson({
      task: "copy",
      system: "sys",
      user: "user",
      secrets: liveSecrets,
      mockGenerate: () => ({ draft: "demo" }),
      adapters: { grok, openai },
    });
    expect(result.usage).toMatchObject({ provider: "grok", model: "grok-4.3" });
    expect(result.value).toEqual({ draft: "from grok" });
    expect(grok).toHaveBeenCalledOnce();
    expect(openai).not.toHaveBeenCalled();
  });

  it("falls through to the next provider when the first adapter fails", async () => {
    const grok = vi.fn(async () => {
      throw new Error("grok down");
    });
    const openai = vi.fn(async () => ({ draft: "from openai" }));
    const result = await generateMarketingJson({
      task: "copy",
      system: "sys",
      user: "user",
      secrets: liveSecrets,
      mockGenerate: () => ({ draft: "demo" }),
      adapters: { grok, openai },
    });
    expect(result.usage.provider).toBe("openai");
    expect(result.value).toEqual({ draft: "from openai" });
  });

  it("falls back to mock after every live adapter fails", async () => {
    const result = await generateMarketingJson({
      task: "plan",
      system: "sys",
      user: "user",
      secrets: liveSecrets,
      mockGenerate: () => ({ pieces: [] }),
      adapters: {
        openai: async () => {
          throw new Error("openai down");
        },
        grok: async () => {
          throw new Error("grok down");
        },
        gemini: async () => {
          throw new Error("gemini down");
        },
      },
    });
    expect(result.usage.provider).toBe("mock");
    expect(result.value).toEqual({ pieces: [] });
  });

  it("skips a missing-key override and uses the next available provider", async () => {
    const openai = vi.fn(async () => ({ ok: true }));
    const result = await generateMarketingJson({
      task: "copy",
      system: "sys",
      user: "user",
      secrets: { openai: "sk-test-openai-key", gemini: "", grok: "" },
      overrides: { textProvider: "gemini" },
      mockGenerate: () => ({ ok: false }),
      adapters: { openai },
    });
    expect(result.usage.provider).toBe("openai");
    expect(openai).toHaveBeenCalledOnce();
  });

  it("does not call image adapters when no image keys are set", async () => {
    const result = await generateMarketingImageBuffer({
      prompt: "A cream shopfront in Yorkshire rain",
      secrets: { openai: "", gemini: "", grok: "" },
      adapters: {
        gemini: async () => {
          throw new Error("must not call Gemini");
        },
      },
    });
    expect(result.buffer).toBeNull();
    expect(result.usage.provider).toBe("mock");
  });

  it("parses OpenAI, Gemini and Grok JSON envelopes via injected fetch", async () => {
    const openaiFetch = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: "{\"hello\":\"openai\"}" } }],
    }), { status: 200 }));
    const geminiFetch = vi.fn(async () => new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: "{\"hello\":\"gemini\"}" }] } }],
    }), { status: 200 }));
    const grokFetch = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: "```json\n{\"hello\":\"grok\"}\n```" } }],
    }), { status: 200 }));

    await expect(openaiChatJson({
      model: "gpt-4o",
      system: "s",
      user: "u",
      apiKey: "k",
      fetchImpl: openaiFetch as unknown as typeof fetch,
    })).resolves.toEqual({ hello: "openai" });
    await expect(geminiGenerateJson({
      model: "gemini-2.5-flash",
      system: "s",
      user: "u",
      apiKey: "k",
      fetchImpl: geminiFetch as unknown as typeof fetch,
    })).resolves.toEqual({ hello: "gemini" });
    await expect(grokChatJson({
      model: "grok-4.3",
      system: "s",
      user: "u",
      apiKey: "k",
      fetchImpl: grokFetch as unknown as typeof fetch,
    })).resolves.toEqual({ hello: "grok" });

    expect(String(openaiFetch.mock.calls[0][0])).toContain("api.openai.com");
    expect(String(geminiFetch.mock.calls[0][0])).toContain("generativelanguage.googleapis.com");
    expect(String(grokFetch.mock.calls[0][0])).toContain("api.x.ai");
  });
});
