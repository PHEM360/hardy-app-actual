/**
 * Marketing LLM / image adapters. Keys stay in env / Firebase secrets — never in repo.
 *
 * Env (local) or Functions secrets (same names):
 *   OPENAI_API_KEY   — existing Hardy OpenAI wiring
 *   GEMINI_API_KEY   — Google AI Studio / Gemini
 *   XAI_API_KEY      — xAI Grok (GROK_API_KEY also accepted locally)
 *
 * Tests inject `fetchImpl` and `adapters` so this module never hits paid APIs.
 */

import type {
  MarketingAiProviderId,
  MarketingAiTask,
  MarketingKeyFlags,
  MarketingLiveProvider,
  MarketingRouteOverrides,
} from "./marketingRouter";
import { marketingFallbackChain } from "./marketingRouter";

export interface MarketingSecretValues {
  openai: string;
  gemini: string;
  grok: string;
}

export interface MarketingLlmUsage {
  provider: MarketingAiProviderId;
  model: string;
  relativeCost: number;
  reason: string;
}

export type MarketingTextAdapter = (args: {
  model: string;
  system: string;
  user: string;
  apiKey: string;
  fetchImpl: typeof fetch;
}) => Promise<unknown>;

export type MarketingImageAdapter = (args: {
  model: string;
  prompt: string;
  apiKey: string;
  fetchImpl: typeof fetch;
}) => Promise<Buffer>;

export function marketingFlagsFromSecrets(secrets: MarketingSecretValues): MarketingKeyFlags {
  const configured = (value: string) => value.trim().length > 8;
  return {
    openai: configured(secrets.openai),
    gemini: configured(secrets.gemini),
    grok: configured(secrets.grok),
  };
}

export function secretForProvider(provider: MarketingLiveProvider, secrets: MarketingSecretValues): string {
  return secrets[provider].trim();
}

export function stripJsonFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

export function parseModelJson(raw: string): unknown {
  return JSON.parse(stripJsonFence(raw)) as unknown;
}

export async function openaiChatJson(args: {
  model: string;
  system: string;
  user: string;
  apiKey: string;
  fetchImpl: typeof fetch;
}): Promise<unknown> {
  const res = await args.fetchImpl("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      temperature: 0.45,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`OpenAI request failed (${res.status}): ${detail.slice(0, 400)}`);
  }
  const payload = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned an empty response");
  return parseModelJson(content);
}

/**
 * Gemini generateContent with application/json mime type.
 * Default text model: gemini-2.5-flash (cheap structured + capable copy).
 */
export async function geminiGenerateJson(args: {
  model: string;
  system: string;
  user: string;
  apiKey: string;
  fetchImpl: typeof fetch;
}): Promise<unknown> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(args.model)}:generateContent` +
    `?key=${encodeURIComponent(args.apiKey)}`;
  const res = await args.fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: args.system }] },
      contents: [{ role: "user", parts: [{ text: args.user }] }],
      generationConfig: {
        temperature: 0.45,
        responseMimeType: "application/json",
      },
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Gemini request failed (${res.status}): ${detail.slice(0, 400)}`);
  }
  const payload = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const content = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!content.trim()) throw new Error("Gemini returned an empty response");
  return parseModelJson(content);
}

/**
 * xAI Grok — OpenAI-compatible chat completions at api.x.ai.
 * Default text model: grok-4.3 (grok-3 retired May 2026).
 */
export async function grokChatJson(args: {
  model: string;
  system: string;
  user: string;
  apiKey: string;
  fetchImpl: typeof fetch;
}): Promise<unknown> {
  const res = await args.fetchImpl("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      temperature: 0.45,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Grok request failed (${res.status}): ${detail.slice(0, 400)}`);
  }
  const payload = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("Grok returned an empty response");
  return parseModelJson(content);
}

export async function openaiImagePng(args: {
  model: string;
  prompt: string;
  apiKey: string;
  fetchImpl: typeof fetch;
}): Promise<Buffer> {
  const res = await args.fetchImpl("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      prompt: args.prompt,
      size: "1024x1024",
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`OpenAI image request failed (${res.status}): ${detail.slice(0, 400)}`);
  }
  const payload = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  const first = payload.data?.[0];
  if (first?.b64_json) return Buffer.from(first.b64_json, "base64");
  if (first?.url) {
    const imageRes = await args.fetchImpl(first.url);
    if (!imageRes.ok) throw new Error("Failed to download generated OpenAI image");
    return Buffer.from(await imageRes.arrayBuffer());
  }
  throw new Error("OpenAI image response had no image data");
}

/**
 * Gemini native image (gemini-*-flash-image).
 * Imagen predict was deprecated August 2026 — do not use imagen-*.
 */
export async function geminiImagePng(args: {
  model: string;
  prompt: string;
  apiKey: string;
  fetchImpl: typeof fetch;
}): Promise<Buffer> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(args.model)}:generateContent` +
    `?key=${encodeURIComponent(args.apiKey)}`;
  const res = await args.fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: args.prompt }] }],
      generationConfig: { responseModalities: ["IMAGE"] },
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Gemini image request failed (${res.status}): ${detail.slice(0, 400)}`);
  }
  const payload = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { data?: string }; inline_data?: { data?: string } }> };
    }>;
  };
  const part = payload.candidates?.[0]?.content?.parts?.find((item) => item.inlineData?.data || item.inline_data?.data);
  const b64 = part?.inlineData?.data ?? part?.inline_data?.data;
  if (!b64) throw new Error("Gemini image response had no image data");
  return Buffer.from(b64, "base64");
}

export async function grokImagePng(args: {
  model: string;
  prompt: string;
  apiKey: string;
  fetchImpl: typeof fetch;
}): Promise<Buffer> {
  const res = await args.fetchImpl("https://api.x.ai/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      prompt: args.prompt,
      n: 1,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Grok image request failed (${res.status}): ${detail.slice(0, 400)}`);
  }
  const payload = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  const first = payload.data?.[0];
  if (first?.b64_json) return Buffer.from(first.b64_json, "base64");
  if (first?.url) {
    const imageRes = await args.fetchImpl(first.url);
    if (!imageRes.ok) throw new Error("Failed to download generated Grok image");
    return Buffer.from(await imageRes.arrayBuffer());
  }
  throw new Error("Grok image response had no image data");
}

const DEFAULT_TEXT_ADAPTERS: Record<MarketingLiveProvider, MarketingTextAdapter> = {
  openai: openaiChatJson,
  gemini: geminiGenerateJson,
  grok: grokChatJson,
};

const DEFAULT_IMAGE_ADAPTERS: Record<MarketingLiveProvider, MarketingImageAdapter> = {
  openai: openaiImagePng,
  gemini: geminiImagePng,
  grok: grokImagePng,
};

const MOCK_USAGE: MarketingLlmUsage = {
  provider: "mock",
  model: "hardy-demo-v1",
  relativeCost: 0,
  reason: "Demo provider",
};

export async function generateMarketingJson(options: {
  task: MarketingAiTask;
  system: string;
  user: string;
  secrets: MarketingSecretValues;
  overrides?: MarketingRouteOverrides;
  fetchImpl?: typeof fetch;
  adapters?: Partial<Record<MarketingLiveProvider, MarketingTextAdapter>>;
  mockGenerate: () => unknown;
}): Promise<{ value: unknown; usage: MarketingLlmUsage }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const flags = marketingFlagsFromSecrets(options.secrets);
  const chain = marketingFallbackChain(options.task, flags, options.overrides);
  const adapters = options.adapters ?? DEFAULT_TEXT_ADAPTERS;
  let lastError: unknown;

  for (const step of chain) {
    if (step.provider === "mock") {
      return { value: options.mockGenerate(), usage: { ...step } };
    }
    const adapter = adapters[step.provider];
    const apiKey = secretForProvider(step.provider, options.secrets);
    if (!adapter || !apiKey) continue;
    try {
      const value = await adapter({
        model: step.model,
        system: options.system,
        user: options.user,
        apiKey,
        fetchImpl,
      });
      return { value, usage: { ...step } };
    } catch (error) {
      lastError = error;
      console.warn("marketing.generate.provider_failed", {
        task: options.task,
        provider: step.provider,
        model: step.model,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (lastError) {
    console.warn("marketing.generate.falling_back_to_mock", {
      task: options.task,
      error: lastError instanceof Error ? lastError.message : String(lastError),
    });
  }
  return { value: options.mockGenerate(), usage: MOCK_USAGE };
}

export async function generateMarketingImageBuffer(options: {
  prompt: string;
  secrets: MarketingSecretValues;
  overrides?: MarketingRouteOverrides;
  fetchImpl?: typeof fetch;
  adapters?: Partial<Record<MarketingLiveProvider, MarketingImageAdapter>>;
}): Promise<{ buffer: Buffer | null; usage: MarketingLlmUsage }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const flags = marketingFlagsFromSecrets(options.secrets);
  const chain = marketingFallbackChain("image", flags, options.overrides);
  const adapters = options.adapters ?? DEFAULT_IMAGE_ADAPTERS;

  for (const step of chain) {
    if (step.provider === "mock") {
      return { buffer: null, usage: { ...step } };
    }
    const adapter = adapters[step.provider];
    const apiKey = secretForProvider(step.provider, options.secrets);
    if (!adapter || !apiKey) continue;
    try {
      const buffer = await adapter({
        model: step.model,
        prompt: options.prompt,
        apiKey,
        fetchImpl,
      });
      return { buffer, usage: { ...step } };
    } catch (error) {
      console.warn("marketing.generate_image.provider_failed", {
        provider: step.provider,
        model: step.model,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { buffer: null, usage: MOCK_USAGE };
}
