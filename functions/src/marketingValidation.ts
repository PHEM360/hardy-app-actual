export const SUPPORTED_MARKETING_PLATFORMS = [
  "facebook",
  "instagram",
  "linkedin",
  "x",
  "tiktok",
  "youtube",
  "google",
] as const;

export type MarketingPlatform = typeof SUPPORTED_MARKETING_PLATFORMS[number];

export interface MarketingPlanInput {
  periodDays: number;
  postsPerWeek: number;
  platforms: MarketingPlatform[];
  campaignId?: string;
  focus?: string;
  includeImages: boolean;
  includeArticles: boolean;
  controversialTheme?: string;
  textProvider?: string;
  textModel?: string;
  imageProvider?: string;
  imageModel?: string;
}

export interface MarketingBrandProfile {
  brandVoice?: unknown;
  targetAudience?: unknown;
  objectives?: unknown;
  keyMessages?: unknown;
  industry?: unknown;
  tradingNames?: unknown;
  website?: unknown;
  requiredPhrases?: unknown;
  bannedPhrases?: unknown;
  disclaimers?: unknown;
  competitors?: unknown;
  preferredHashtags?: unknown;
  currentThemes?: unknown;
}

function requiredInteger(value: unknown, minimum: number, maximum: number, label: string): number {
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new Error(`${label} must be a whole number from ${minimum} to ${maximum}.`);
  }
  return Number(value);
}

export function parseMarketingPlanInput(value: unknown): MarketingPlanInput {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const periodDays = requiredInteger(input.periodDays, 1, 90, "periodDays");
  const postsPerWeek = requiredInteger(input.postsPerWeek, 1, 14, "postsPerWeek");
  if (!Array.isArray(input.platforms) || input.platforms.length === 0) {
    throw new Error("At least one supported platform is required.");
  }
  const platforms = [...new Set(input.platforms.map((item) => String(item).toLowerCase()))];
  if (platforms.some((item) => !SUPPORTED_MARKETING_PLATFORMS.includes(item as MarketingPlatform))) {
    throw new Error("Platforms must be facebook, instagram, linkedin, x, tiktok, youtube, or google.");
  }
  return {
    periodDays,
    postsPerWeek,
    platforms: platforms as MarketingPlatform[],
    campaignId: cleanOptionalString(input.campaignId, 200),
    focus: cleanOptionalString(input.focus, 1000),
    includeImages: input.includeImages !== false,
    includeArticles: input.includeArticles === true,
    controversialTheme: cleanOptionalString(input.controversialTheme, 500),
    textProvider: cleanOptionalString(input.textProvider, 40),
    textModel: cleanOptionalString(input.textModel, 80),
    imageProvider: cleanOptionalString(input.imageProvider, 40),
    imageModel: cleanOptionalString(input.imageModel, 80),
  };
}

export function ukSeasonalContext(now: Date): string[] {
  const month = now.getMonth();
  const day = now.getDate();
  const weekday = now.toLocaleDateString("en-GB", { weekday: "long" });
  const context = [
    `Today is ${now.toISOString().slice(0, 10)}, a ${weekday} in the UK.`,
  ];
  if (month === 0) context.push("New year planning, January resets, Dry January.");
  if (month === 1) context.push("Valentine's Day, winter still in, mid-term fatigue.");
  if (month === 2) context.push("Mother's Day (UK, usually late March), spring starting, end of tax year approaching.");
  if (month === 3) context.push("UK tax year end 5 April, Easter, spring launches, school holidays.");
  if (month === 4) context.push("Early May bank holiday, outdoor season, exam period.");
  if (month === 5) context.push("Father's Day, midsummer, Pride, wedding season.");
  if (month === 6 || month === 7) context.push("UK summer holidays, staycations, quieter inboxes, August lull.");
  if (month === 8) context.push("Back to school, autumn routines, new-term energy.");
  if (month === 9) context.push("Halloween, autumn offers, darker evenings.");
  if (month === 10) context.push("Bonfire Night, Black Friday / Cyber Monday, Christmas planning.");
  if (month === 11) context.push("Advent, Christmas, Boxing Day, year-end reviews.");
  if (month === 2 && day >= 20) context.push("Clocks go forward late March; lighter evenings.");
  if (month === 9 && day >= 20) context.push("Clocks go back late October; darker afternoons.");
  return context;
}

export function buildMarketingPlanInstructions(pieceCount: number, seasonal: string[]): string {
  return [
    "You are a senior UK social media strategist writing for a real family-run business.",
    "Create polished, concrete, ready-to-approve posts. Never use placeholders such as [insert] or TODO.",
    "Write in British English. Do not invent legal claims, prices, reviews, awards or statistics.",
    "Use the saved brand voice, audience, key messages, required phrases, banned phrases and disclaimers exactly.",
    "If competitors are listed, write distinctive angles that do not copy them: contrast, fill a gap, or say what this brand does differently.",
    "Use seasonal UK context, currentThemes, and the current date. Prefer timely hooks (tax year, school terms, bank holidays, weather, cultural moments) over generic filler.",
    "Each post must have a clear hook, a useful point, and a natural call to action.",
    "If articles are requested, write full LinkedIn or website articles of 400-800 words, not captions.",
    "If a controversial theme is supplied, include that many opinion pieces with a clear, professional stance — never abusive or illegal.",
    "Honour each platform's cadence and tone from the brand profile.",
    "Vary formats across the batch: tip, story, question, proof, offer, behind-the-scenes, article.",
    "aiImagePrompt must describe a specific photograph or graphic that matches the post, including lighting, setting and mood. No text-in-image.",
    "aiReasoning must cite the brand rule, competitor gap or seasonal hook that justified this post.",
    `Return exactly ${pieceCount} pieces and only the requested platforms.`,
    ...seasonal,
  ].join(" ");
}

export function calculateMarketingPieceCount(periodDays: number, postsPerWeek: number): number {
  return Math.min(120, Math.max(1, Math.ceil((periodDays / 7) * postsPerWeek)));
}

export function isSafePublicHttpUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "metadata.google.internal" ||
    host.endsWith(".internal") ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1"
  ) {
    return false;
  }
  if (/^(10\.|192\.168\.|169\.254\.|127\.)/.test(host)) return false;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return false;
  if (host.includes(":") || /^[\d.]+$/.test(host)) return false;
  return true;
}

export function splitCompetitorHints(values: unknown): { names: string[]; urls: string[] } {
  const names: string[] = [];
  const urls: string[] = [];
  for (const item of stringList(values, 20, 300)) {
    if (/^https?:\/\//i.test(item)) {
      if (isSafePublicHttpUrl(item)) urls.push(item);
    } else {
      names.push(item);
    }
  }
  return { names, urls: [...new Set(urls)].slice(0, 3) };
}

export function extractPublicPageHints(html: string): {
  title: string;
  description: string;
  headings: string[];
  text: string;
} {
  const strip = (value: string) => value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const title = strip(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").slice(0, 200);
  const description = (
    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1] ||
    html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i)?.[1] ||
    ""
  ).trim().slice(0, 400);
  const headings = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
    .map((match) => strip(match[1]).slice(0, 160))
    .filter((item) => item.length >= 2)
    .slice(0, 12);
  const text = strip(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
  ).slice(0, 4000);
  return { title, description, headings, text };
}

export interface MarketingAuditInput {
  extraUrls: string[];
  searchNotes: string;
  adsNotes: string;
  socialNotes: string;
  otherNotes: string;
}

export function parseMarketingAuditInput(value: unknown): MarketingAuditInput {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const rawUrls = Array.isArray(input.extraUrls)
    ? input.extraUrls.map((item) => String(item)).join("\n")
    : String(input.extraUrls || "");
  const extraUrls = [...new Set(
    rawUrls
      .split(/[\s,]+/)
      .map((item) => item.trim())
      .filter((item) => isSafePublicHttpUrl(item))
  )].slice(0, 6);
  return {
    extraUrls,
    searchNotes: cleanOptionalString(input.searchNotes, 4000) || "",
    adsNotes: cleanOptionalString(input.adsNotes, 4000) || "",
    socialNotes: cleanOptionalString(input.socialNotes, 4000) || "",
    otherNotes: cleanOptionalString(input.otherNotes, 4000) || "",
  };
}

export function buildMarketingAuditInstructions(seasonal: string[]): string {
  return [
    "You are a UK PR, SEO and social strategist writing a practical weekly audit for a family-run business.",
    "Write in British English. Be concrete and useful. Never invent rankings, impressions, clicks, spend, follower counts or review scores.",
    "If Search Console, Google Ads or social analytics were not supplied, say so clearly and infer only from public pages, brand guidance and the Hardy Hub workspace.",
    "Google ranking must be framed as inferred visibility and likely query match, not a live SERP position.",
    "Use seasonal UK context. Prioritise a short list of high-impact next moves.",
    "opportunities must be specific actions the owner can take this week.",
    "Also infer a suggestedBrand: voice, audience, industry, objectives, key messages and hashtags from the public pages. Be specific, not generic.",
    ...seasonal,
  ].join(" ");
}

function meaningfulString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length >= 3;
}

function meaningfulList(value: unknown): boolean {
  return Array.isArray(value) && value.some(meaningfulString);
}

export function hasMeaningfulMarketingProfile(profile: MarketingBrandProfile): boolean {
  const identity = meaningfulString(profile.industry) || meaningfulList(profile.tradingNames);
  const positioning = meaningfulString(profile.brandVoice) && meaningfulString(profile.targetAudience);
  const substance = meaningfulList(profile.objectives) || meaningfulList(profile.keyMessages);
  return identity && positioning && substance;
}

export function parseApprovalVersion(value: unknown): number {
  return requiredInteger(value, 1, Number.MAX_SAFE_INTEGER, "approvalVersion");
}

export function parsePlatform(value: unknown): MarketingPlatform {
  const platform = String(value || "").toLowerCase();
  if (!SUPPORTED_MARKETING_PLATFORMS.includes(platform as MarketingPlatform)) {
    throw new Error("Platform must be facebook, instagram, linkedin, x, tiktok, youtube, or google.");
  }
  return platform as MarketingPlatform;
}

export function cleanOptionalString(value: unknown, maximumLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const result = value.trim();
  return result ? result.slice(0, maximumLength) : undefined;
}

export function stringList(value: unknown, maximumItems: number, maximumLength = 200): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, maximumLength))
    .filter(Boolean)
    .slice(0, maximumItems);
}
