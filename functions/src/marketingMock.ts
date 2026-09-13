/**
 * Deterministic marketing AI stub.
 * Used when OPENAI_API_KEY is missing, the live call fails, or the client
 * falls back because Cloud Functions are not reachable.
 * Swap this for a live provider by implementing MarketingAiProvider.
 */

export type MockPlatform =
  | "instagram"
  | "linkedin"
  | "facebook"
  | "x"
  | "tiktok"
  | "youtube"
  | "google"
  | "website";

export type MockContentType = "social_post" | "article" | "campaign_idea" | "advert";

export interface MockBrandScan {
  brandVoice: string;
  targetAudience: string;
  styleNotes: string;
  industry: string;
  objectives: string[];
  keyMessages: string[];
  preferredHashtags: string[];
  website: string;
}

export interface MockAnalysis {
  headline: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  estimatedMonthlyBudgetGbp: number;
}

export interface MockPlan {
  summary: string;
  objectives: string[];
  estimatedBudgetGbp: number;
  budgetNotes: string;
  periodDays: number;
  postsPerWeek: number;
  platforms: MockPlatform[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export interface MockPiece {
  type: MockContentType;
  platform: MockPlatform;
  topic: string;
  objective: string;
  audience: string;
  trendReason: string;
  draft: string;
  refinedDraft: string;
  hashtags: string[];
  aiImagePrompt: string;
  aiReasoning: string;
  brandChecks: string[];
  engagementSuggestions: string[];
  scheduledFor: string;
}

export interface MockHubInput {
  companyName: string;
  description?: string;
  website?: string;
  brandVoice?: string;
  targetAudience?: string;
  industry?: string;
  styleNotes?: string;
  platforms: MockPlatform[];
  periodDays: number;
  postsPerWeek: number;
  focus?: string;
  includeArticles?: boolean;
}

const CORE_PLATFORMS: MockPlatform[] = ["instagram", "facebook", "linkedin", "google"];

export function enabledMarketingPlatforms(input: {
  platforms?: string[];
  enableTikTok?: boolean;
  enableYouTube?: boolean;
}): MockPlatform[] {
  const fromProfile = (input.platforms || []).map((item) => item.toLowerCase()) as MockPlatform[];
  const next = fromProfile.length ? [...fromProfile] : [...CORE_PLATFORMS];
  if (input.enableTikTok && !next.includes("tiktok")) next.push("tiktok");
  if (input.enableYouTube && !next.includes("youtube")) next.push("youtube");
  return next.filter((item, index) => next.indexOf(item) === index);
}

export function mockScheduledDate(index: number, count: number, periodDays: number, now = Date.now()): string {
  const start = now + 24 * 60 * 60 * 1000;
  const span = Math.max(0, periodDays - 1) * 24 * 60 * 60 * 1000;
  const offset = count <= 1 ? 0 : (span * index) / (count - 1);
  const date = new Date(start + offset);
  date.setUTCHours(index % 2 === 0 ? 9 : 14, 0, 0, 0);
  return date.toISOString();
}

function brandName(input: Pick<MockHubInput, "companyName">): string {
  return (input.companyName || "This brand").trim() || "This brand";
}

export function mockBrandScan(input: Pick<MockHubInput, "companyName" | "description" | "website" | "industry">): MockBrandScan {
  const name = brandName(input);
  const industry = (input.industry || "").trim() || inferIndustry(input.description, name);
  const website = asHttps(input.website);
  return {
    brandVoice: `Warm, plain British English. ${name} sounds like a trusted specialist: clear, specific and never shouty. Short sentences. No jargon unless the audience uses it.`,
    targetAudience: `UK customers who already trust a local or specialist ${industry.toLowerCase()} brand and want straight answers before they spend.`,
    styleNotes: `Clean photography, natural light, real people and workplaces. Soft navy and cream rather than neon. Avoid stock-looking handshakes. On-screen text stays short.`,
    industry,
    objectives: [
      "Be the first name people remember in this category",
      "Turn website visits into enquiries",
      "Show up weekly on the channels customers already use",
    ],
    keyMessages: [
      `${name} does the work properly and explains it in plain English`,
      "Local knowledge, not generic national copy",
      "You can reach a real person if something needs fixing",
    ],
    preferredHashtags: hashtagsFor(name, industry),
    website,
  };
}

export function mockPresenceAnalysis(input: MockHubInput): MockAnalysis {
  const name = brandName(input);
  const monthly = estimateMonthlyBudget(input.platforms, input.postsPerWeek);
  return {
    headline: `Where ${name} is strong — and where to grow`,
    summary: `${name} already has a believable voice and a website to point people at. The gap is consistency: too little scheduled proof, and paid ads would be early until the organic queue is approved and shipping.`,
    strengths: [
      "Clear specialist positioning that a family operator can actually stand behind",
      input.website ? "A public website the scan can quote, so copy stays grounded" : "A named brand the plan can write for even before the website is added",
      "Approval-first workflow so nothing goes out unread",
    ],
    weaknesses: [
      "No live analytics connected yet — rankings and ad spend are inferred, not measured",
      "Social proof (reviews, case notes, before/after) is thin in the workspace",
      input.platforms.includes("tiktok") || input.platforms.includes("youtube")
        ? "Video channels are on, but Phase 1 will not generate finished video"
        : "TikTok and YouTube are off — fine for now, turn them on per brand if video becomes a priority",
    ],
    opportunities: [
      "Publish two useful posts a week for eight weeks, then decide where to put paid budget",
      "Reuse the strongest organic post as a Google or Meta advert with a clear enquiry CTA",
      "Add one customer story a month so the feed is not only tips",
    ],
    estimatedMonthlyBudgetGbp: monthly,
  };
}

export function mockMarketingPlan(input: MockHubInput, analysis?: MockAnalysis): MockPlan {
  const name = brandName(input);
  const monthly = analysis?.estimatedMonthlyBudgetGbp ?? estimateMonthlyBudget(input.platforms, input.postsPerWeek);
  const months = Math.max(1, Math.round(input.periodDays / 30));
  const budget = monthly * months;
  return {
    summary: `${input.periodDays}-day plan for ${name}: ${input.postsPerWeek} posts a week across ${input.platforms.join(", ")}. Copy waits in the review queue. Budget is indicative only — Hardy will not spend it.`,
    objectives: [
      "Fill the diary so the operator only reviews and approves",
      "Keep every post on-voice and on-audience",
      input.focus ? `Lean this run toward: ${input.focus}` : "Build a repeatable weekly rhythm",
    ],
    estimatedBudgetGbp: budget,
    budgetNotes: `About £${monthly.toLocaleString("en-GB")}/month for ${months} month${months === 1 ? "" : "s"}: boosting the two best posts, a light Google Ads test, and design time. Organic scheduling is included. This is a planning figure, not a connected ad account.`,
    periodDays: input.periodDays,
    postsPerWeek: input.postsPerWeek,
    platforms: input.platforms,
    strengths: analysis?.strengths ?? mockPresenceAnalysis(input).strengths,
    weaknesses: analysis?.weaknesses ?? mockPresenceAnalysis(input).weaknesses,
    recommendations: [
      "Approve in batches of five so the calendar stays two weeks ahead",
      "Request edits with a concrete note — the next generate pass will use it",
      "Leave TikTok/YouTube off until there is a simple video habit",
    ],
  };
}

export function mockContentBatch(input: MockHubInput, count: number, now = Date.now()): MockPiece[] {
  const name = brandName(input);
  const audience = (input.targetAudience || "").trim() || `People who need a reliable ${inferIndustry(input.description, name).toLowerCase()} team`;
  const voice = (input.brandVoice || "").trim() || `${name} in plain British English`;
  const templates = pieceTemplates(name, input.focus);
  const platforms = input.platforms.length ? input.platforms : CORE_PLATFORMS;
  return Array.from({ length: count }, (_, index) => {
    const template = templates[index % templates.length];
    const platform = platforms[index % platforms.length];
    const type = pickType(platform, index, input.includeArticles);
    const draft = fillCopy(template.body, name, platform, type);
    return {
      type,
      platform,
      topic: `${template.topic} (${index + 1})`,
      objective: template.objective,
      audience,
      trendReason: template.reason,
      draft,
      refinedDraft: draft,
      hashtags: hashtagsFor(name, inferIndustry(input.description, name)).slice(0, 5),
      aiImagePrompt: `Natural-light photograph for ${name}: ${template.image}. No text in the image. UK setting.`,
      aiReasoning: `Mock provider. Matches ${voice.slice(0, 80)}. ${template.reason}`,
      brandChecks: ["British English", "No invented prices or awards", `Fits ${platform}`],
      engagementSuggestions: [template.cta, "Reply to the first three comments the same day"],
      scheduledFor: mockScheduledDate(index, count, input.periodDays, now),
    };
  });
}

export function mockScheduleSuggestion(
  items: Array<{ id: string; platform?: string }>,
  periodDays: number,
  now = Date.now(),
): Array<{ id: string; scheduledFor: string }> {
  return items.map((item, index) => ({
    id: item.id,
    scheduledFor: mockScheduledDate(index, items.length, periodDays, now),
  }));
}

export function estimateMonthlyBudget(platforms: string[], postsPerWeek: number): number {
  const organic = 150 + postsPerWeek * 40;
  const paid = platforms.includes("google") ? 400 : 200;
  const extra = platforms.includes("tiktok") || platforms.includes("youtube") ? 150 : 0;
  return Math.round((organic + paid + extra) / 50) * 50;
}

function inferIndustry(description?: string, name?: string): string {
  const blob = `${description || ""} ${name || ""}`.toLowerCase();
  if (/tax|account/.test(blob)) return "Accountancy";
  if (/plumb|boiler|heat/.test(blob)) return "Home services";
  if (/estate|lett|propert/.test(blob)) return "Property";
  if (/legal|solicitor|law/.test(blob)) return "Legal services";
  if (/design|studio|brand/.test(blob)) return "Creative studio";
  if (/soft|app|tech/.test(blob)) return "Software";
  return "Professional services";
}

function asHttps(value?: string): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function hashtagsFor(name: string, industry: string): string[] {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 18) || "hardybrand";
  const sector = industry.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 16) || "ukbusiness";
  return [slug, sector, "uksmallbusiness", "familybusiness", "plainenglish"];
}

function pickType(platform: MockPlatform, index: number, includeArticles?: boolean): MockContentType {
  if (includeArticles && (platform === "linkedin" || platform === "website") && index % 4 === 3) return "article";
  if (platform === "google" && index % 5 === 4) return "advert";
  return "social_post";
}

function pieceTemplates(name: string, focus?: string) {
  const hook = focus?.trim() || "useful weekly proof";
  return [
    {
      topic: "One thing we fixed this week",
      objective: "Build trust with a concrete story",
      reason: "Proof beats slogans; operators can swap in a real example.",
      image: "a real workspace or van, slightly messy, honest",
      cta: "Ask readers what they would like explained next",
      body: `Most people do not need another slogan from ${name}. They need one clear example.\n\nThis week we are talking about ${hook} — what changed, why it mattered, and what we would do again.\n\nIf that is on your list, send a message. A person reads it.`,
    },
    {
      topic: "A question we hear every month",
      objective: "Answer a real objection",
      reason: "Search-shaped questions convert better than announcements.",
      image: "notebook and tea on a kitchen table, UK home office",
      cta: "Invite a yes/no reply in the comments",
      body: `"Is it worth starting now, or should we wait?" We hear that a lot.\n\nShort answer from ${name}: start the bit you can finish this month. Waiting rarely makes the paperwork kinder.\n\nFocus this run: ${hook}.`,
    },
    {
      topic: "What we will not do",
      objective: "Show standards without bragging",
      reason: "A boundary is a brand asset for a family firm.",
      image: "quiet street or shopfront, overcast British light",
      cta: "Offer a 15-minute call for a specific problem",
      body: `${name} will not invent a price, a ranking or a review to fill a post.\n\nWe would rather post less and stay accurate. That is the deal with ${hook}.`,
    },
    {
      topic: "How to brief us in four lines",
      objective: "Make enquiries easier",
      reason: "Lowering the effort to reply is the cheapest conversion work.",
      image: "simple desk setup with a handwritten list",
      cta: "Ask them to paste the four lines in a DM",
      body: `Send ${name} four lines: who it is for, by when, what good looks like, and the budget band.\n\nThat is enough to start. We will tell you if ${hook} needs a different shape.`,
    },
    {
      topic: "A seasonal reminder",
      objective: "Stay timely without being generic",
      reason: "UK calendar hooks keep a long plan from going stale.",
      image: "seasonal UK outdoor scene, no logos",
      cta: "Link to the website contact page",
      body: `If you only do one useful thing this fortnight, make it about ${hook}.\n\n${name} can help you pick the first step — not a 40-page strategy you will never open.`,
    },
  ];
}

function fillCopy(body: string, name: string, platform: MockPlatform, type: MockContentType): string {
  if (type === "article") {
    return `${body}\n\n## Why this matters\n${name} sees the same pattern: people wait for a perfect plan, then miss the week they could have posted.\n\n## What to do next\nWrite the post. Queue it. Approve it. Then look at the numbers.\n\n(LinkedIn / website article stub — replace with a longer piece when the live model is connected.)`;
  }
  if (type === "advert") {
    return `Headline: ${name} — plain answers, not noise.\n\n${body}\n\nCTA: Get in touch this week.\n\n(Advert stub for ${platform}. Live Google/Meta spend is not connected.)`;
  }
  if (platform === "x") return body.split("\n\n")[0].slice(0, 240);
  return body;
}

export const MARKETING_MOCK_PROVIDER = "mock";
export const MARKETING_MOCK_MODEL = "hardy-demo-v1";
