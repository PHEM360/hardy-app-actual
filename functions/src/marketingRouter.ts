/**
 * Marketing AI router — task → provider/model map (tune here).
 *
 * Secrets (Firebase Functions / Secret Manager, never the repo):
 *   OPENAI_API_KEY   — existing Hardy convention
 *   GEMINI_API_KEY   — Google AI Studio / Gemini API
 *   XAI_API_KEY      — xAI Grok (GROK_API_KEY is also read as an alias)
 *
 * Optional process env overrides (not secrets):
 *   MARKETING_TEXT_PROVIDER=auto|openai|gemini|grok
 *   MARKETING_IMAGE_PROVIDER=auto|openai|gemini|grok
 *   MARKETING_TEXT_MODEL / MARKETING_IMAGE_MODEL — pin a model id
 *
 * Default map (preference order, then next key, then mock):
 *   brand_scan / analysis  grok-4.3 → gpt-4o → gemini-2.5-flash
 *                          Strong British voice; Grok 4.3 first as the cheaper capable writer.
 *   copy                   grok-4.3 → gpt-4o → gemini-2.5-flash
 *                          Posts/ads/articles need the same quality bar as brand voice.
 *   plan                   gpt-4o → grok-4.3 → gemini-2.5-flash
 *                          Long structured JSON batches; GPT-4o is the reliable first pick.
 *   schedule               gemini-2.5-flash → gpt-4o-mini → grok-4.3
 *                          Cheap, fast, structured dates. Deterministic mock if JSON is junk.
 *   image                  gemini-3.1-flash-image → gpt-image-1 → grok-imagine-image-quality
 *                          Gemini Flash Image is the cheapest capable 2026 option.
 *
 * relativeCost is a rough 1–5 hint (1 = cheapest live), not a billing API.
 * Dry-run social publish is unchanged and does not use this router.
 */

export type MarketingLiveProvider = "openai" | "gemini" | "grok";
export type MarketingAiProviderId = MarketingLiveProvider | "mock";
export type MarketingAiTask =
  | "brand_scan"
  | "analysis"
  | "plan"
  | "copy"
  | "image"
  | "schedule";

export interface MarketingRouteCandidate {
  provider: MarketingLiveProvider;
  model: string;
  /** Rough 1 (cheapest live) to 5 (premium). Not live prices. */
  relativeCost: number;
  notes: string;
}

export interface MarketingKeyFlags {
  openai: boolean;
  gemini: boolean;
  grok: boolean;
}

export interface MarketingRouteOverrides {
  textProvider?: string;
  textModel?: string;
  imageProvider?: string;
  imageModel?: string;
}

export interface MarketingAiSelection {
  provider: MarketingAiProviderId;
  model: string;
  relativeCost: number;
  reason: string;
}

export const MARKETING_TASK_ROUTES: Record<MarketingAiTask, MarketingRouteCandidate[]> = {
  brand_scan: [
    { provider: "grok", model: "grok-4.3", relativeCost: 3, notes: "Cheaper strong writer for voice inference" },
    { provider: "openai", model: "gpt-4o", relativeCost: 4, notes: "Highest bar if Grok is unset" },
    { provider: "gemini", model: "gemini-2.5-flash", relativeCost: 1, notes: "Capable fallback when only Gemini is set" },
  ],
  analysis: [
    { provider: "grok", model: "grok-4.3", relativeCost: 3, notes: "SWOT in the same voice as the brand scan" },
    { provider: "openai", model: "gpt-4o", relativeCost: 4, notes: "Quality fallback" },
    { provider: "gemini", model: "gemini-2.5-flash", relativeCost: 1, notes: "Cheap structured fallback" },
  ],
  plan: [
    { provider: "openai", model: "gpt-4o", relativeCost: 4, notes: "Reliable long JSON plans" },
    { provider: "grok", model: "grok-4.3", relativeCost: 3, notes: "Strong second pick" },
    { provider: "gemini", model: "gemini-2.5-flash", relativeCost: 1, notes: "High-volume / budget fallback" },
  ],
  copy: [
    { provider: "grok", model: "grok-4.3", relativeCost: 3, notes: "Posts and adverts — quality without GPT-4o spend" },
    { provider: "openai", model: "gpt-4o", relativeCost: 4, notes: "Quality fallback" },
    { provider: "gemini", model: "gemini-2.5-flash", relativeCost: 1, notes: "Cheapest capable batch fallback" },
  ],
  image: [
    { provider: "gemini", model: "gemini-3.1-flash-image", relativeCost: 2, notes: "Default 2026 image model — cheaper than OpenAI" },
    { provider: "openai", model: "gpt-image-1", relativeCost: 4, notes: "Existing Hardy image path" },
    { provider: "grok", model: "grok-imagine-image-quality", relativeCost: 3, notes: "xAI image if Gemini/OpenAI are unset" },
  ],
  schedule: [
    { provider: "gemini", model: "gemini-2.5-flash", relativeCost: 1, notes: "Structured dates — cheapest first" },
    { provider: "openai", model: "gpt-4o-mini", relativeCost: 2, notes: "Cheap OpenAI fallback" },
    { provider: "grok", model: "grok-4.3", relativeCost: 3, notes: "If only Grok is configured" },
  ],
};

const LIVE: MarketingLiveProvider[] = ["openai", "gemini", "grok"];

export function normalizeProviderId(
  value: string | undefined,
): MarketingLiveProvider | "auto" | "mock" | undefined {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw || raw === "auto") return "auto";
  if (raw === "mock" || raw === "demo") return "mock";
  if (raw === "xai") return "grok";
  if (LIVE.includes(raw as MarketingLiveProvider)) return raw as MarketingLiveProvider;
  return undefined;
}

export function hasLiveTextKey(keys: MarketingKeyFlags): boolean {
  return keys.openai || keys.gemini || keys.grok;
}

export function hasLiveImageKey(keys: MarketingKeyFlags): boolean {
  return keys.gemini || keys.openai || keys.grok;
}

function keyFor(provider: MarketingLiveProvider, keys: MarketingKeyFlags): boolean {
  return keys[provider];
}

function envOverrides(): MarketingRouteOverrides {
  return {
    textProvider: process.env.MARKETING_TEXT_PROVIDER,
    textModel: process.env.MARKETING_TEXT_MODEL,
    imageProvider: process.env.MARKETING_IMAGE_PROVIDER,
    imageModel: process.env.MARKETING_IMAGE_MODEL,
  };
}

function mergeOverrides(explicit?: MarketingRouteOverrides): MarketingRouteOverrides {
  const env = envOverrides();
  return {
    textProvider: explicit?.textProvider || env.textProvider,
    textModel: explicit?.textModel || env.textModel,
    imageProvider: explicit?.imageProvider || env.imageProvider,
    imageModel: explicit?.imageModel || env.imageModel,
  };
}

/**
 * Preferred live candidate first, then remaining keyed providers cheapest-first.
 * Callers try this list in order, then the mock.
 */
export function marketingFallbackChain(
  task: MarketingAiTask,
  keys: MarketingKeyFlags,
  explicit?: MarketingRouteOverrides,
): MarketingAiSelection[] {
  const preferred = selectMarketingRoute(task, keys, explicit);
  const seen = new Set<string>();
  const chain: MarketingAiSelection[] = [];
  const push = (item: MarketingAiSelection) => {
    const id = `${item.provider}:${item.model}`;
    if (item.provider === "mock" || seen.has(id)) return;
    seen.add(id);
    chain.push(item);
  };
  push(preferred);
  // Keep the documented preference order (quality first where that is the map).
  // relativeCost is a hint for operators, not the fallback sort.
  const rest = MARKETING_TASK_ROUTES[task].filter((item) => keyFor(item.provider, keys));
  for (const item of rest) {
    push({
      provider: item.provider,
      model: item.model,
      relativeCost: item.relativeCost,
      reason: `Fallback after ${preferred.provider} (${item.notes})`,
    });
  }
  return chain;
}

export function marketingImageFallbackChain(
  keys: MarketingKeyFlags,
  explicit?: MarketingRouteOverrides,
): MarketingAiSelection[] {
  return marketingFallbackChain("image", keys, explicit);
}

export function selectMarketingRoute(
  task: MarketingAiTask,
  keys: MarketingKeyFlags,
  explicit?: MarketingRouteOverrides,
): MarketingAiSelection {
  const overrides = mergeOverrides(explicit);
  const isImage = task === "image";
  const forced = normalizeProviderId(isImage ? overrides.imageProvider : overrides.textProvider);
  const forcedModel = isImage ? overrides.imageModel : overrides.textModel;
  const preferred = MARKETING_TASK_ROUTES[task];

  if (forced && forced !== "auto") {
    if (forced === "mock") {
      return {
        provider: "mock",
        model: "hardy-demo-v1",
        relativeCost: 0,
        reason: "Pinned to the demo provider",
      };
    }
    if (!keyFor(forced, keys)) {
      const next = preferred.find((item) => keyFor(item.provider, keys));
      if (!next) {
        return { provider: "mock", model: "hardy-demo-v1", relativeCost: 0, reason: `${forced} requested but no key; using mock` };
      }
      return {
        provider: next.provider,
        model: next.model,
        relativeCost: next.relativeCost,
        reason: `${forced} requested but no key; using ${next.provider}`,
      };
    }
    const listed = preferred.find((item) => item.provider === forced);
    return {
      provider: forced,
      model: (forcedModel || "").trim() || listed?.model || defaultModel(forced, isImage),
      relativeCost: listed?.relativeCost ?? 3,
      reason: `Pinned by ${isImage ? "MARKETING_IMAGE_PROVIDER" : "MARKETING_TEXT_PROVIDER"} / request`,
    };
  }

  const hit = preferred.find((item) => keyFor(item.provider, keys));
  if (!hit) {
    return { provider: "mock", model: "hardy-demo-v1", relativeCost: 0, reason: "No live marketing API keys; demo provider" };
  }
  return {
    provider: hit.provider,
    model: (forcedModel || "").trim() || hit.model,
    relativeCost: hit.relativeCost,
    reason: `Auto-router for ${task}: ${hit.notes}`,
  };
}

function defaultModel(provider: MarketingLiveProvider, image: boolean): string {
  if (image) {
    if (provider === "gemini") return "gemini-3.1-flash-image";
    if (provider === "grok") return "grok-imagine-image-quality";
    return "gpt-image-1";
  }
  if (provider === "gemini") return "gemini-2.5-flash";
  if (provider === "grok") return "grok-4.3";
  return "gpt-4o";
}
