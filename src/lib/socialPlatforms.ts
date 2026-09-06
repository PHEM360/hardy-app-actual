import type { SocialPlatform } from "@/types/app";

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  "instagram",
  "facebook",
  "linkedin",
  "x",
  "tiktok",
  "youtube",
  "google",
];

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  x: "X",
  tiktok: "TikTok",
  youtube: "YouTube",
  google: "Google",
};

/** In-app login is live for these. X and TikTok stay profile-only for now. */
export const LIVE_OAUTH_PLATFORMS: SocialPlatform[] = [
  "facebook",
  "instagram",
  "linkedin",
  "google",
  "youtube",
];

export const SOCIAL_PLATFORM_HINTS: Record<SocialPlatform, string> = {
  instagram: "Reels, carousels and short captions",
  facebook: "Page posts and community updates",
  linkedin: "Articles, thought leadership and B2B",
  x: "Short timely takes",
  tiktok: "Short video scripts",
  youtube: "Titles, descriptions and community posts",
  google: "Business Profile posts and search presence",
};

export const TEXT_MODEL_OPTIONS = [
  { id: "auto", label: "Let AI choose", provider: "auto" },
  { id: "gpt-4o-mini", label: "OpenAI GPT-4o mini", provider: "openai" },
  { id: "gpt-4o", label: "OpenAI GPT-4o", provider: "openai" },
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", provider: "gemini" },
] as const;

export const IMAGE_MODEL_OPTIONS = [
  { id: "auto", label: "Let AI choose", provider: "auto" },
  { id: "dall-e-3", label: "OpenAI DALL·E 3", provider: "openai" },
  { id: "gpt-image-1", label: "OpenAI GPT Image", provider: "openai" },
  { id: "gemini-imagen", label: "Gemini Imagen", provider: "gemini" },
] as const;

export function platformLabel(platform: string) {
  return SOCIAL_PLATFORM_LABELS[platform as SocialPlatform] || platform;
}

export function defaultCadence() {
  return {
    instagram: { postsPerMonth: 12, articlesPerMonth: 0, controversialCount: 0, tone: "warm and visual" },
    facebook: { postsPerMonth: 8, articlesPerMonth: 0, controversialCount: 0, tone: "friendly and local" },
    linkedin: { postsPerMonth: 8, articlesPerMonth: 3, controversialCount: 1, tone: "expert and direct" },
    x: { postsPerMonth: 12, articlesPerMonth: 0, controversialCount: 1, tone: "sharp and timely" },
    tiktok: { postsPerMonth: 8, articlesPerMonth: 0, controversialCount: 0, tone: "casual and punchy" },
    youtube: { postsPerMonth: 4, articlesPerMonth: 0, controversialCount: 0, tone: "clear and helpful" },
    google: { postsPerMonth: 4, articlesPerMonth: 0, controversialCount: 0, tone: "trustworthy and local" },
  };
}
