import { SOCIAL_PLATFORM_LABELS } from "@/lib/socialPlatforms";
import type { Company, ContentPiece, MarketingProfile, SocialPlatform } from "@/types/app";

const PLATFORM_LABELS = SOCIAL_PLATFORM_LABELS;

function meaningfulString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length >= 3;
}

function meaningfulList(value: unknown): boolean {
  return Array.isArray(value) && value.some(meaningfulString);
}

/** Same bar the Cloud Function uses before it will generate a plan. */
export function isMarketingProfileReady(profile: Partial<MarketingProfile> | undefined) {
  if (!profile) return false;
  const identity = meaningfulString(profile.industry) || meaningfulList(profile.tradingNames);
  const positioning = meaningfulString(profile.brandVoice) && meaningfulString(profile.targetAudience);
  const substance = meaningfulList(profile.objectives) || meaningfulList(profile.keyMessages);
  return identity && positioning && substance;
}

function asHttps(value?: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

/** Fill empty brand fields from the company record so guidance is not blank. */
export function seedMarketingProfileFromCompany(
  profile: MarketingProfile,
  company: Pick<Company, "name" | "description"> & { contact?: Company["contact"] },
): MarketingProfile {
  const website = profile.website.trim() || asHttps(company.contact?.website);
  const tradingNames = profile.tradingNames.length ? profile.tradingNames : (company.name ? [company.name] : []);
  const currentThemes = profile.currentThemes.trim() || String(company.description || "").trim();
  return {
    ...profile,
    website,
    tradingNames,
    currentThemes,
  };
}

export function formatMarketingPostForShare(item: ContentPiece) {
  const caption = (item.refinedDraft || item.draft || "").trim();
  const hashtags = item.hashtags
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => tag.startsWith("#") ? tag : `#${tag}`)
    .join(" ");
  const platform = PLATFORM_LABELS[item.platform as SocialPlatform] || item.platform;
  const when = item.scheduledFor
    ? new Date(item.scheduledFor).toLocaleString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
    : "Unscheduled";
  return [
    item.topic || "Untitled post",
    `${platform} · ${when}`,
    "",
    caption,
    hashtags,
  ].filter((line, index, lines) => line !== "" || lines[index - 1] !== "").join("\n").trim();
}

export async function copyMarketingPost(item: ContentPiece) {
  const text = formatMarketingPostForShare(item);
  if (!navigator.clipboard?.writeText) throw new Error("Clipboard is not available in this browser.");
  await navigator.clipboard.writeText(text);
  return text;
}

export function downloadMarketingPost(item: ContentPiece) {
  const text = formatMarketingPostForShare(item);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const slug = (item.topic || "post").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "post";
  link.href = url;
  link.download = `${slug}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return text;
}

const MATERIAL_FIELDS: Array<keyof ContentPiece> = [
  "draft",
  "refinedDraft",
  "hashtags",
  "assetIds",
  "scheduledFor",
  "platform",
];

export function materialMarketingContentChanged(updates: Partial<ContentPiece>) {
  return MATERIAL_FIELDS.some((field) => updates[field] !== undefined);
}

/** Every material edit invalidates an earlier review, including an edit made
 * while another browser still has the approval screen open. */
export function approvalResetForMarketingEdit(
  existing: ContentPiece | undefined,
  updates: Partial<ContentPiece>,
) {
  if (!materialMarketingContentChanged(updates)) return {};
  return {
    status: "awaiting_approval" as const,
    approvalVersion: (existing?.approvalVersion || 0) + 1,
    approvedVersion: 0,
    approvedAt: "",
    approvedBy: "",
  };
}
