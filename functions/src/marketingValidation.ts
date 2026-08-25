export const SUPPORTED_MARKETING_PLATFORMS = [
  "facebook",
  "instagram",
  "linkedin",
] as const;

export type MarketingPlatform = typeof SUPPORTED_MARKETING_PLATFORMS[number];

export interface MarketingPlanInput {
  periodDays: number;
  postsPerWeek: number;
  platforms: MarketingPlatform[];
  campaignId?: string;
  focus?: string;
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
  preferredHashtags?: unknown;
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
    throw new Error("Platforms must be facebook, instagram, or linkedin.");
  }
  return {
    periodDays,
    postsPerWeek,
    platforms: platforms as MarketingPlatform[],
    campaignId: cleanOptionalString(input.campaignId, 200),
    focus: cleanOptionalString(input.focus, 1000),
  };
}

export function calculateMarketingPieceCount(periodDays: number, postsPerWeek: number): number {
  return Math.min(40, Math.max(1, Math.ceil((periodDays / 7) * postsPerWeek)));
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
    throw new Error("Platform must be facebook, instagram, or linkedin.");
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
