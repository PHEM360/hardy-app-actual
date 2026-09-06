import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Copy,
  Download,
  ExternalLink,
  Facebook,
  FileImage,
  ImagePlus,
  Instagram,
  LayoutDashboard,
  Lightbulb,
  Link2,
  ListOrdered,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  Radar,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useCompanyMarketing } from "@/hooks/useCompanyMarketing";
import { CompanyMarketingAudit } from "@/components/companies/CompanyMarketingAudit";
import { copyMarketingPost, downloadMarketingPost, isMarketingProfileReady } from "@/lib/marketingContent";
import { SOCIAL_PLATFORMS, SOCIAL_PLATFORM_LABELS } from "@/lib/socialPlatforms";
import {
  approveMarketingContent,
  generateMarketingImage,
  generateMarketingPlan,
  getMarketingConnectionUrl,
  rejectMarketingContent,
} from "@/lib/marketingApi";
import type {
  Company,
  ContentPiece,
  ContentStatus,
  MarketingAsset,
  MarketingCampaign,
  MarketingCampaignStatus,
  MarketingPlanRequest,
  MarketingProfile,
  SocialPlatform,
} from "@/types/app";

type MarketingState = ReturnType<typeof useCompanyMarketing>;
type SectionId = "overview" | "planner" | "review" | "campaigns" | "media" | "brand" | "audit" | "connections" | "adviser";

const PLATFORMS: SocialPlatform[] = SOCIAL_PLATFORMS;
const PLATFORM_LABELS = SOCIAL_PLATFORM_LABELS;
const STATUS_LABELS: Record<ContentStatus, string> = {
  suggestion: "Suggestion",
  draft: "Draft",
  awaiting_approval: "Awaiting review",
  approved: "Approved",
  scheduled: "Scheduled",
  publishing: "Publishing",
  published: "Published",
  rejected: "Rejected",
  failed: "Failed",
  cancelled: "Cancelled",
};
const CAMPAIGN_STATUSES: MarketingCampaignStatus[] = ["idea", "planned", "active", "completed", "cancelled"];
const inputClass = "h-10 rounded-xl";
const cardClass = "rounded-2xl border border-border/50 bg-card shadow-card";

const SECTION_ITEMS: Array<{ id: SectionId; label: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "planner", label: "Planner", icon: CalendarDays },
  { id: "review", label: "Review", icon: ClipboardCheck },
  { id: "campaigns", label: "Campaigns", icon: Megaphone },
  { id: "media", label: "Media", icon: FileImage },
  { id: "brand", label: "Brand guidance", icon: Settings2 },
  { id: "audit", label: "PR audit", icon: Radar },
  { id: "connections", label: "Connections", icon: Link2 },
  { id: "adviser", label: "Ad adviser", icon: Lightbulb },
];

function lines(value: string) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function dateValue(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function readableDate(value?: string) {
  if (!value) return "No date set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

async function sharePost(item: ContentPiece, mode: "copy" | "download") {
  try {
    if (mode === "copy") {
      await copyMarketingPost(item);
      toast.success("Post copied. Paste it into Instagram, Facebook or LinkedIn.");
    } else {
      downloadMarketingPost(item);
      toast.success("Post downloaded as a text file.");
    }
  } catch (error) {
    toast.error(errorMessage(error));
  }
}

function companySurface(color: string, strength = 11) {
  return {
    background: `color-mix(in srgb, ${color} ${strength}%, hsl(var(--card)))`,
    borderLeft: `3px solid ${color}`,
  };
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function PlatformChecks({
  value,
  onChange,
  legend = "Platforms",
}: {
  value: SocialPlatform[];
  onChange: (value: SocialPlatform[]) => void;
  legend?: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {PLATFORMS.map((platform) => {
          const checked = value.includes(platform);
          return (
            <label
              key={platform}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                checked ? "border-primary/60 bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground"
              }`}
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(next) => onChange(next
                  ? [...value, platform]
                  : value.filter((item) => item !== platform))}
                aria-label={PLATFORM_LABELS[platform]}
              />
              {PLATFORM_LABELS[platform]}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function StatusPill({ status }: { status: ContentStatus }) {
  const caution = status === "failed" || status === "rejected";
  const success = status === "published" || status === "approved" || status === "scheduled";
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
      caution
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : success
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-primary/25 bg-primary/10 text-foreground"
    }`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="font-display text-xl font-bold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function OverviewSection({
  state,
  company,
  companyId,
  onSection,
}: {
  state: MarketingState;
  company: Company;
  companyId: string;
  onSection: (section: SectionId) => void;
}) {
  const [generatingMonth, setGeneratingMonth] = useState(false);
  const brandReady = isMarketingProfileReady(state.profile);
  const counts = {
    review: state.content.filter((item) => item.status === "awaiting_approval").length,
    scheduled: state.content.filter((item) => item.status === "scheduled" || item.status === "approved").length,
    published: state.content.filter((item) => item.status === "published").length,
    failed: state.content.filter((item) => item.status === "failed").length,
  };
  const essentials = [
    state.profile.brandVoice,
    state.profile.targetAudience,
    state.profile.industry,
    state.profile.website,
    state.profile.objectives.length > 0,
    state.profile.keyMessages.length > 0,
    state.profile.platforms.length > 0,
  ];
  const completeness = Math.round((essentials.filter(Boolean).length / essentials.length) * 100);
  const upcoming = state.content
    .filter((item) => item.scheduledFor && new Date(item.scheduledFor).getTime() >= Date.now())
    .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))
    .slice(0, 4);

  const generateNextMonth = async () => {
    if (!brandReady) {
      toast.error("Save brand voice, audience and a few key messages first.");
      onSection("brand");
      return;
    }
    setGeneratingMonth(true);
    try {
      const result = await generateMarketingPlan(companyId, {
        periodDays: 30,
        postsPerWeek: state.profile.postsPerWeek || 3,
        platforms: state.profile.platforms.length ? state.profile.platforms : PLATFORMS,
        includeImages: true,
        focus: "Create the next month of engaging social posts with matching pictures.",
      });
      toast.success(result.summary || `${result.created} posts created for review.`);
      onSection("review");
    } catch (error) {
      toast.error(`Plan could not be generated: ${errorMessage(error)}`);
    } finally {
      setGeneratingMonth(false);
    }
  };

  return (
    <div className="space-y-5">
      <SectionHeading
        title="Social & Ads"
        description={`Plan, review and publish ${company.name}'s marketing in one place.`}
        action={
          <Button onClick={() => onSection(brandReady ? "planner" : "brand")} className="gap-2 bg-gradient-primary">
            <Sparkles className="h-4 w-4" />
            {brandReady ? "Open planner" : "Finish setup"}
          </Button>
        }
      />
      <div className={`${cardClass} p-4 sm:p-5`} style={companySurface(company.color, 12)}>
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
            <ListOrdered className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg font-bold">How this works</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              You clicked in — next, tell AI how this brand sounds, then generate a month of posts with pictures.
            </p>
          </div>
        </div>
        <ol className="mt-4 space-y-3">
          {[
            ["Brand guidance", "Add voice, audience, key messages, competitors and anything happening now. This is what AI writes from."],
            ["Optional photos", "Upload your own shots in Media if you would rather use real photography than AI pictures."],
            ["Generate next month", "AI drafts posts and matching pictures from your brand, competitor notes, the UK calendar and current themes."],
            ["Review", "Approve, reject with a reason, or edit. Rejected feedback shapes the next batch."],
            ["Share it", "Copy or download each post into Instagram, Facebook or LinkedIn. Direct posting is not connected yet."],
          ].map(([title, detail], index) => (
            <li key={title} className="flex gap-3 rounded-xl border border-border/50 bg-card p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">
          AI cannot log into Instagram or scrape a competitor's feed. List competitor names or websites, and note seasonal hooks or news in Brand guidance.
        </p>
        <Button
          onClick={() => void generateNextMonth()}
          disabled={generatingMonth}
          className="mt-4 w-full gap-2 bg-gradient-primary sm:w-auto"
        >
          {generatingMonth ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {generatingMonth ? "Generating next month…" : "Generate next month"}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Needs review", counts.review, ClipboardCheck, "text-amber-600"],
          ["Scheduled", counts.scheduled, CalendarDays, "text-blue-600"],
          ["Published", counts.published, CheckCircle2, "text-emerald-600"],
          ["Failed", counts.failed, AlertCircle, "text-destructive"],
        ].map(([label, value, Icon, colour]) => (
          <div key={String(label)} className={`${cardClass} p-4`} style={companySurface(company.color, 8)}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">{label as string}</span>
              <Icon className={`h-4 w-4 ${colour as string}`} />
            </div>
            <p className="mt-3 text-3xl font-bold">{value as number}</p>
          </div>
        ))}
      </div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <div className={`${cardClass} min-w-0 p-4 sm:p-5`}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Next scheduled posts</h3>
            <Button variant="ghost" size="sm" onClick={() => onSection("planner")}>Open planner <ChevronRight className="ml-1 h-4 w-4" /></Button>
          </div>
          {upcoming.length ? (
            <div className="space-y-2">
              {upcoming.map((item) => (
                <div key={item.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-border/50 bg-muted/30 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{item.topic || item.draft.slice(0, 60) || "Untitled post"}</p>
                    <p className="text-xs text-muted-foreground">{PLATFORM_LABELS[item.platform as SocialPlatform] || item.platform} · {readableDate(item.scheduledFor)}</p>
                  </div>
                  <StatusPill status={item.status} />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl bg-muted/40 p-5 text-center">
              <CalendarDays className="mx-auto h-7 w-7 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">Nothing scheduled yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Create a post or generate a plan to fill the diary.</p>
            </div>
          )}
        </div>
        <div className={`${cardClass} p-4 sm:p-5`} style={companySurface(company.color, 10)}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Brand profile</h3>
            <span className="text-sm font-bold">{completeness}%</span>
          </div>
          <Progress value={completeness} className="mt-3 h-2" />
          <p className="mt-3 text-sm text-muted-foreground">
            {completeness < 70
              ? "Add your voice, audience, objectives and key messages before asking AI to write."
              : "Your core guidance is ready for useful, on-brand plans."}
          </p>
          <Button variant="outline" className="mt-4 w-full" onClick={() => onSection("brand")}>
            Edit brand guidance
          </Button>
        </div>
      </div>
    </div>
  );
}

const EMPTY_CONTENT: Omit<ContentPiece, "id" | "createdAt" | "updatedAt"> = {
  type: "social_post",
  platform: "instagram",
  topic: "",
  campaignId: "",
  objective: "",
  audience: "",
  trendReason: "",
  draft: "",
  refinedDraft: "",
  hashtags: [],
  assetIds: [],
  aiImagePrompt: "",
  scheduledFor: "",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London",
  status: "draft",
  approvalVersion: 1,
  approvedVersion: 0,
  approvedAt: "",
  approvedBy: "",
  rejectedAt: "",
  rejectedBy: "",
  rejectionReason: "",
  publishedAt: "",
  externalPostId: "",
  externalPostUrl: "",
  publishAttempts: 0,
  publishError: "",
  aiProvider: "",
  aiModel: "",
  aiReasoning: "",
  brandChecks: [],
  engagementSuggestions: [],
  revisions: [],
};

function ContentForm({
  value,
  assets,
  campaigns,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  value: ContentPiece | typeof EMPTY_CONTENT;
  assets: MarketingAsset[];
  campaigns: MarketingCampaign[];
  submitLabel: string;
  onSubmit: (updates: Partial<ContentPiece>) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    topic: value.topic,
    platform: value.platform as SocialPlatform,
    campaignId: value.campaignId,
    objective: value.objective,
    audience: value.audience,
    draft: value.refinedDraft || value.draft,
    hashtags: value.hashtags.join(" "),
    assetIds: value.assetIds,
    scheduledFor: dateValue(value.scheduledFor),
  });
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.draft.trim()) {
      toast.error("Add the post copy before saving.");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        topic: form.topic.trim(),
        platform: form.platform,
        campaignId: form.campaignId,
        objective: form.objective.trim(),
        audience: form.audience.trim(),
        draft: form.draft.trim(),
        refinedDraft: "",
        hashtags: form.hashtags.split(/[\s,]+/).map((tag) => tag.replace(/^#/, "").trim()).filter(Boolean),
        assetIds: form.assetIds,
        scheduledFor: form.scheduledFor ? new Date(form.scheduledFor).toISOString() : "",
      });
      onCancel();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Topic">
          <Input aria-label="Topic" className={inputClass} value={form.topic} onChange={(event) => setForm({ ...form, topic: event.target.value })} />
        </Field>
        <Field label="Platform">
          <select aria-label="Platform" className={`${inputClass} w-full border-2 border-border bg-input px-3 text-sm`} value={form.platform} onChange={(event) => setForm({ ...form, platform: event.target.value as SocialPlatform })}>
            {PLATFORMS.map((platform) => <option key={platform} value={platform}>{PLATFORM_LABELS[platform]}</option>)}
          </select>
        </Field>
        <Field label="Campaign">
          <select aria-label="Campaign" className={`${inputClass} w-full border-2 border-border bg-input px-3 text-sm`} value={form.campaignId} onChange={(event) => setForm({ ...form, campaignId: event.target.value })}>
            <option value="">No campaign</option>
            {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
          </select>
        </Field>
        <Field label="Schedule">
          <Input aria-label="Schedule" className={inputClass} type="datetime-local" value={form.scheduledFor} onChange={(event) => setForm({ ...form, scheduledFor: event.target.value })} />
        </Field>
        <Field label="Objective">
          <Input aria-label="Objective" className={inputClass} value={form.objective} onChange={(event) => setForm({ ...form, objective: event.target.value })} />
        </Field>
        <Field label="Audience">
          <Input aria-label="Audience" className={inputClass} value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value })} />
        </Field>
      </div>
      <Field label="Post copy">
        <Textarea aria-label="Post copy" rows={6} value={form.draft} onChange={(event) => setForm({ ...form, draft: event.target.value })} />
      </Field>
      <Field label="Hashtags" hint="Separate hashtags with spaces or commas.">
        <Input aria-label="Hashtags" className={inputClass} value={form.hashtags} onChange={(event) => setForm({ ...form, hashtags: event.target.value })} />
      </Field>
      {assets.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Attach media</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {assets.map((asset) => {
              const checked = Boolean(asset.id && form.assetIds.includes(asset.id));
              return (
                <label key={asset.id} className={`min-w-0 cursor-pointer rounded-xl border p-2 ${checked ? "border-primary bg-primary/10" : "border-border"}`}>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      aria-label={`Attach ${asset.name}`}
                      checked={checked}
                      onCheckedChange={(next) => asset.id && setForm({
                        ...form,
                        assetIds: next ? [...form.assetIds, asset.id] : form.assetIds.filter((id) => id !== asset.id),
                      })}
                    />
                    <span className="truncate text-xs font-medium">{asset.name}</span>
                  </div>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={saving} className="bg-gradient-primary">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function PlanGenerator({
  state,
  companyId,
  title = "Generate a marketing plan",
  advert = false,
}: {
  state: MarketingState;
  companyId: string;
  title?: string;
  advert?: boolean;
}) {
  const [request, setRequest] = useState<MarketingPlanRequest>({
    periodDays: advert ? 14 : state.profile.defaultPlanDays || 30,
    postsPerWeek: state.profile.postsPerWeek || 3,
    platforms: state.profile.platforms.length ? state.profile.platforms : PLATFORMS,
    campaignId: "",
    focus: advert ? "Create an advert plan with testable messaging and a clear call to action." : "",
    includeImages: true,
  });
  const [generating, setGenerating] = useState(false);
  const essentialReady = isMarketingProfileReady(state.profile);

  const generate = async () => {
    if (!essentialReady) {
      toast.error("Complete the brand essentials before generating content.");
      return;
    }
    if (!request.platforms.length) {
      toast.error("Choose at least one platform.");
      return;
    }
    setGenerating(true);
    try {
      const result = await generateMarketingPlan(companyId, request);
      toast.success(result.summary || `${result.created} posts created for review.`);
    } catch (error) {
      toast.error(`Plan could not be generated: ${errorMessage(error)}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className={`${cardClass} p-4 sm:p-5`}>
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground"><Sparkles className="h-4 w-4" /></span>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">AI uses brand voice, competitors, current themes and the UK calendar. Nothing publishes until you review it.</p>
        </div>
      </div>
      {!essentialReady && (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          Add brand voice, audience, objectives and key messages in Brand guidance first.
        </div>
      )}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Period">
          <select aria-label="Period" className={`${inputClass} w-full border-2 border-border bg-input px-3 text-sm`} value={request.periodDays} onChange={(event) => setRequest({ ...request, periodDays: Number(event.target.value) })}>
            {[7, 14, 30, 60, 90].map((days) => <option key={days} value={days}>{days} days</option>)}
          </select>
        </Field>
        <Field label="Posts per week">
          <Input aria-label="Posts per week" className={inputClass} type="number" min={1} max={14} value={request.postsPerWeek} onChange={(event) => setRequest({ ...request, postsPerWeek: Number(event.target.value) })} />
        </Field>
        <Field label="Campaign">
          <select aria-label="Plan campaign" className={`${inputClass} w-full border-2 border-border bg-input px-3 text-sm`} value={request.campaignId} onChange={(event) => setRequest({ ...request, campaignId: event.target.value || undefined })}>
            <option value="">No campaign</option>
            {state.campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
          </select>
        </Field>
        <Field label={advert ? "Advert objective or focus" : "Campaign focus"}>
          <Input aria-label={advert ? "Advert objective or focus" : "Campaign focus"} className={inputClass} value={request.focus || ""} onChange={(event) => setRequest({ ...request, focus: event.target.value })} placeholder={advert ? "Leads, awareness, bookings…" : "Optional launch, theme or offer"} />
        </Field>
      </div>
      <div className="mt-4">
        <PlatformChecks value={request.platforms} onChange={(platforms) => setRequest({ ...request, platforms })} />
      </div>
      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 bg-muted/25 p-3">
        <Checkbox
          aria-label="Create pictures for each post"
          checked={request.includeImages !== false}
          onCheckedChange={(next) => setRequest({ ...request, includeImages: Boolean(next) })}
        />
        <span>
          <span className="block text-sm font-medium">Create pictures for each post</span>
          <span className="block text-xs text-muted-foreground">AI generates a matching image. Swap in your own photos later if you prefer.</span>
        </span>
      </label>
      <Button onClick={generate} disabled={generating || !essentialReady} className="mt-4 w-full gap-2 bg-gradient-primary sm:w-auto">
        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {generating ? "Generating plan…" : advert ? "Generate advert plan" : "Generate plan"}
      </Button>
    </div>
  );
}

function PlannerSection({ state, companyId }: { state: MarketingState; companyId: string }) {
  const [platform, setPlatform] = useState("all");
  const [status, setStatus] = useState("all");
  const [view, setView] = useState<"month" | "list">("month");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ContentPiece | null>(null);
  const filtered = state.content
    .filter((item) => platform === "all" || item.platform === platform)
    .filter((item) => status === "all" || item.status === status)
    .sort((a, b) => (a.scheduledFor || "9999").localeCompare(b.scheduledFor || "9999"));
  const groups = filtered.reduce<Record<string, ContentPiece[]>>((result, item) => {
    const key = item.scheduledFor ? new Date(item.scheduledFor).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) : "Unscheduled";
    result[key] = [...(result[key] || []), item];
    return result;
  }, {});

  return (
    <div className="space-y-5">
      <SectionHeading
        title="Content planner"
        description="Shape the schedule, create posts and generate an on-brand plan."
        action={<Button onClick={() => setCreating(true)} className="gap-2 bg-gradient-primary"><Plus className="h-4 w-4" /> New post</Button>}
      />
      <PlanGenerator state={state} companyId={companyId} />
      <div className={`${cardClass} min-w-0 p-4 sm:p-5`}>
        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <select aria-label="Filter by platform" className={`${inputClass} min-w-0 border-2 border-border bg-input px-3 text-sm`} value={platform} onChange={(event) => setPlatform(event.target.value)}>
            <option value="all">All platforms</option>
            {PLATFORMS.map((item) => <option key={item} value={item}>{PLATFORM_LABELS[item]}</option>)}
          </select>
          <select aria-label="Filter by status" className={`${inputClass} min-w-0 border-2 border-border bg-input px-3 text-sm`} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <div className="flex rounded-xl border bg-card p-1">
            {(["month", "list"] as const).map((item) => (
              <button key={item} type="button" onClick={() => setView(item)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${view === item ? "bg-gradient-primary text-primary-foreground" : "text-muted-foreground"}`}>
                {item}
              </button>
            ))}
          </div>
        </div>
        {Object.keys(groups).length ? (
          <div className={view === "month" ? "grid min-w-0 gap-3 md:grid-cols-2" : "space-y-4"}>
            {Object.entries(groups).map(([date, items]) => (
              <section key={date} className="min-w-0 rounded-2xl border border-border/50 bg-muted/25 p-3">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{date}</h3>
                <div className="space-y-2">
                  {items.map((item) => (
                    <article key={item.id} className="min-w-0 rounded-xl border border-border/60 bg-card p-3">
                      <div className="flex min-w-0 items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{item.topic || item.draft.slice(0, 60) || "Untitled post"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{PLATFORM_LABELS[item.platform as SocialPlatform] || item.platform} · {readableDate(item.scheduledFor)}</p>
                        </div>
                        <StatusPill status={item.status} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3">
                        <button type="button" className="flex items-center gap-1 text-xs font-semibold text-primary" onClick={() => setEditing(item)} aria-label={`Edit ${item.topic || "post"}`}>
                          <Pencil className="h-3 w-3" /> Edit post
                        </button>
                        <button type="button" className="flex items-center gap-1 text-xs font-semibold text-primary" onClick={() => void sharePost(item, "copy")} aria-label={`Copy ${item.topic || "post"}`}>
                          <Copy className="h-3 w-3" /> Copy
                        </button>
                        <button type="button" className="flex items-center gap-1 text-xs font-semibold text-primary" onClick={() => void sharePost(item, "download")} aria-label={`Download ${item.topic || "post"}`}>
                          <Download className="h-3 w-3" /> Download
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="rounded-xl bg-muted/40 p-7 text-center text-sm text-muted-foreground">No posts match these filters.</div>
        )}
      </div>
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Create a post</DialogTitle><DialogDescription>Add copy, timing and media to the content planner.</DialogDescription></DialogHeader>
          <ContentForm
            value={EMPTY_CONTENT}
            assets={state.assets}
            campaigns={state.campaigns}
            submitLabel="Create post"
            onCancel={() => setCreating(false)}
            onSubmit={async (updates) => {
              await state.addContent({ ...EMPTY_CONTENT, ...updates, status: "awaiting_approval" });
              toast.success("Post added to the review queue.");
            }}
          />
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Edit scheduled post</DialogTitle><DialogDescription>Approved changes return this post to review.</DialogDescription></DialogHeader>
          {editing && (
            <ContentForm
              key={editing.id}
              value={editing}
              assets={state.assets}
              campaigns={state.campaigns}
              submitLabel="Save post"
              onCancel={() => setEditing(null)}
              onSubmit={async (updates) => {
                await state.updateContent(editing.id!, updates);
                toast.success(editing.status === "scheduled" || editing.status === "approved"
                  ? "Post updated and returned to review."
                  : "Post updated.");
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlatformPreview({ item, assets }: { item: ContentPiece; assets: MarketingAsset[] }) {
  const media = assets.filter((asset) => asset.id && item.assetIds.includes(asset.id));
  const copy = item.refinedDraft || item.draft;
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
      <div className="flex items-center gap-2 border-b p-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">
          {item.platform === "instagram" ? <Instagram className="h-4 w-4" /> : item.platform === "facebook" ? <Facebook className="h-4 w-4" /> : "in"}
        </span>
        <div>
          <p className="text-sm font-bold">Brand account</p>
          <p className="text-[11px] text-muted-foreground">{PLATFORM_LABELS[item.platform as SocialPlatform]} preview</p>
        </div>
      </div>
      {media.map((asset) => asset.mediaType === "video" ? (
        <video key={asset.id} controls src={asset.url} className="max-h-80 w-full bg-black object-contain" aria-label={asset.altText || asset.name} />
      ) : (
        <img key={asset.id} src={asset.url} alt={asset.altText || asset.name} className="max-h-80 w-full object-cover" />
      ))}
      <div className="space-y-2 p-4">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{copy}</p>
        {item.hashtags.length > 0 && <p className="text-sm text-primary">{item.hashtags.map((tag) => `#${tag.replace(/^#/, "")}`).join(" ")}</p>}
        <p className="text-xs text-muted-foreground">{readableDate(item.scheduledFor)}</p>
      </div>
    </div>
  );
}

function ReviewSection({ state, companyId }: { state: MarketingState; companyId: string }) {
  const queue = state.content.filter((item) => item.status === "awaiting_approval" || item.status === "rejected");
  const [editing, setEditing] = useState<ContentPiece | null>(null);
  const [rejecting, setRejecting] = useState<ContentPiece | null>(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState("");

  const approve = async (item: ContentPiece) => {
    setBusyId(item.id || "");
    try {
      await approveMarketingContent(companyId, item.id!, item.approvalVersion);
      toast.success("Approved at the current version.");
    } catch (error) {
      toast.error(`Approval failed: ${errorMessage(error)}`);
    } finally {
      setBusyId("");
    }
  };

  const reject = async () => {
    if (!reason.trim()) {
      toast.error("Add a reason before rejecting this post.");
      return;
    }
    if (!rejecting?.id) return;
    setBusyId(rejecting.id);
    try {
      await rejectMarketingContent(companyId, rejecting.id, rejecting.approvalVersion, reason.trim());
      toast.success("Post returned with feedback.");
      setRejecting(null);
      setReason("");
    } catch (error) {
      toast.error(`Rejection failed: ${errorMessage(error)}`);
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="space-y-5">
      <SectionHeading title="Review queue" description="See the exact post, media and AI rationale before approving a specific version." />
      {queue.length ? queue.map((item) => (
        <article key={item.id} className={`${cardClass} min-w-0 p-4 sm:p-5`}>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{item.topic || "Untitled post"}</h3>
                <StatusPill status={item.status} />
                <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-semibold">Version {item.approvalVersion}</span>
              </div>
              {item.rejectionReason && <p className="mt-2 text-sm text-destructive">Previous feedback: {item.rejectionReason}</p>}
            </div>
          </div>
          <div className="grid min-w-0 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <PlatformPreview item={item} assets={state.assets} />
            <div className="min-w-0 space-y-3">
              <div className="rounded-xl border border-violet-500/25 bg-violet-500/10 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">Why AI suggested this</p>
                <p className="mt-1 text-sm">{item.aiReasoning || item.trendReason || "No AI reasoning was recorded for this draft."}</p>
              </div>
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Brand checks</p>
                {item.brandChecks.length ? (
                  <ul className="mt-2 space-y-1 text-sm">{item.brandChecks.map((check) => <li key={check} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0" />{check}</li>)}</ul>
                ) : <p className="mt-1 text-sm">No automated checks recorded. Review manually.</p>}
              </div>
              <div className="rounded-xl border border-blue-500/25 bg-blue-500/10 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">Engagement ideas</p>
                {item.engagementSuggestions.length ? (
                  <ul className="mt-2 list-inside list-disc text-sm">{item.engagementSuggestions.map((idea) => <li key={idea}>{idea}</li>)}</ul>
                ) : <p className="mt-1 text-sm">Consider a clear question or call to action.</p>}
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {item.status === "awaiting_approval" && (
              <Button onClick={() => approve(item)} disabled={busyId === item.id} className="gap-2 bg-gradient-primary">
                {busyId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Approve
              </Button>
            )}
            <Button variant="outline" onClick={() => setEditing(item)} className="gap-2">
              <Pencil className="h-4 w-4" /> {item.status === "rejected" ? "Revise" : "Edit"}
            </Button>
            <Button variant="outline" onClick={() => void sharePost(item, "copy")} className="gap-2">
              <Copy className="h-4 w-4" /> Copy post
            </Button>
            <Button variant="outline" onClick={() => void sharePost(item, "download")} className="gap-2">
              <Download className="h-4 w-4" /> Download
            </Button>
            {item.status === "awaiting_approval" && (
              <Button variant="outline" onClick={() => { setRejecting(item); setReason(""); }} className="gap-2 text-destructive">
                <XCircle className="h-4 w-4" /> Reject
              </Button>
            )}
          </div>
        </article>
      )) : (
        <div className={`${cardClass} p-8 text-center`}>
          <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-500" />
          <h3 className="mt-3 font-semibold">Review queue clear</h3>
          <p className="mt-1 text-sm text-muted-foreground">New AI drafts and edited approved posts will appear here.</p>
        </div>
      )}
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Edit review post</DialogTitle><DialogDescription>Update the copy, timing or attached media before approval.</DialogDescription></DialogHeader>
          {editing && <ContentForm key={editing.id} value={editing} assets={state.assets} campaigns={state.campaigns} submitLabel="Save changes" onCancel={() => setEditing(null)} onSubmit={async (updates) => {
            await state.updateContent(editing.id!, updates);
            toast.success("Draft updated.");
          }} />}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(rejecting)} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject this post</DialogTitle><DialogDescription>Explain what should change in the next version.</DialogDescription></DialogHeader>
          <Field label="Reason" hint="Give clear feedback so the next revision improves.">
            <Textarea aria-label="Rejection reason" value={reason} onChange={(event) => setReason(event.target.value)} rows={4} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={reject} disabled={busyId === rejecting?.id}>Reject post</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const EMPTY_CAMPAIGN: Omit<MarketingCampaign, "id" | "createdAt" | "updatedAt"> = {
  name: "",
  objective: "",
  audience: "",
  brief: "",
  startDate: "",
  endDate: "",
  budget: undefined,
  status: "idea",
  platforms: ["instagram"],
};

function CampaignForm({
  campaign,
  onSave,
  onCancel,
}: {
  campaign: MarketingCampaign | typeof EMPTY_CAMPAIGN;
  onSave: (value: typeof EMPTY_CAMPAIGN) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ ...campaign });
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return toast.error("Campaign name is required.");
    setSaving(true);
    try {
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...value } = form as MarketingCampaign;
      await onSave({ ...value, name: value.name.trim(), budget: value.budget === undefined || Number.isNaN(value.budget) ? undefined : Number(value.budget) });
      onCancel();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Campaign name"><Input aria-label="Campaign name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
        <Field label="Status">
          <select aria-label="Campaign status" className={`${inputClass} w-full border-2 border-border bg-input px-3 text-sm`} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as MarketingCampaignStatus })}>
            {CAMPAIGN_STATUSES.map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}
          </select>
        </Field>
        <Field label="Objective"><Input aria-label="Campaign objective" value={form.objective} onChange={(event) => setForm({ ...form, objective: event.target.value })} /></Field>
        <Field label="Audience"><Input aria-label="Campaign audience" value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value })} /></Field>
        <Field label="Start date"><Input aria-label="Campaign start date" type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></Field>
        <Field label="End date"><Input aria-label="Campaign end date" type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></Field>
        <Field label="Indicative budget (£)" hint="Planning only; this app cannot spend it."><Input aria-label="Campaign budget" type="number" min={0} value={form.budget ?? ""} onChange={(event) => setForm({ ...form, budget: event.target.value ? Number(event.target.value) : undefined })} /></Field>
      </div>
      <Field label="Campaign brief"><Textarea aria-label="Campaign brief" rows={4} value={form.brief} onChange={(event) => setForm({ ...form, brief: event.target.value })} /></Field>
      <PlatformChecks value={form.platforms} onChange={(platforms) => setForm({ ...form, platforms })} />
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="submit" disabled={saving} className="bg-gradient-primary">Save campaign</Button></div>
    </form>
  );
}

function CampaignsSection({ state, company }: { state: MarketingState; company: Company }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MarketingCampaign | null>(null);
  return (
    <div className="space-y-5">
      <SectionHeading title="Campaigns" description="Keep the audience, dates, channels and planning budget attached to the work." action={<Button onClick={() => setOpen(true)} className="gap-2 bg-gradient-primary"><Plus className="h-4 w-4" /> New campaign</Button>} />
      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        {state.campaigns.map((campaign) => (
          <article key={campaign.id} className={`${cardClass} min-w-0 p-4`} style={companySurface(company.color, 8)}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><h3 className="truncate font-semibold">{campaign.name}</h3><p className="mt-1 text-xs capitalize text-muted-foreground">{campaign.status} · {campaign.platforms.map((item) => PLATFORM_LABELS[item]).join(", ")}</p></div>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold">{campaign.budget === undefined ? "No budget" : `£${campaign.budget.toLocaleString("en-GB")}`}</span>
            </div>
            <p className="mt-3 text-sm">{campaign.objective || "No objective set"}</p>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{campaign.brief || "No campaign brief yet."}</p>
            <p className="mt-3 text-xs text-muted-foreground">{campaign.startDate || "No start"} → {campaign.endDate || "No end"}</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(campaign)}><Pencil className="mr-1 h-3 w-3" /> Edit</Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => {
                if (!window.confirm(`Delete ${campaign.name}?`)) return;
                try { await state.deleteCampaign(campaign.id!); toast.success("Campaign deleted."); } catch (error) { toast.error(errorMessage(error)); }
              }}><Trash2 className="mr-1 h-3 w-3" /> Delete</Button>
            </div>
          </article>
        ))}
        {!state.campaigns.length && <div className={`${cardClass} col-span-full p-8 text-center text-sm text-muted-foreground`}>Create a campaign to connect posts to a shared objective and audience.</div>}
      </div>
      <Dialog open={open || Boolean(editing)} onOpenChange={(next) => { if (!next) { setOpen(false); setEditing(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Edit campaign" : "New campaign"}</DialogTitle><DialogDescription>Define the objective, audience, dates and planning budget.</DialogDescription></DialogHeader>
          <CampaignForm campaign={editing || EMPTY_CAMPAIGN} onCancel={() => { setOpen(false); setEditing(null); }} onSave={async (value) => {
            if (editing) await state.updateCampaign(editing.id!, value);
            else await state.addCampaign(value);
            toast.success(editing ? "Campaign updated." : "Campaign created.");
          }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MediaSection({ state, companyId }: { state: MarketingState; companyId: string }) {
  const [editing, setEditing] = useState<MarketingAsset | null>(null);
  const [assetForm, setAssetForm] = useState({ altText: "", tags: "", usageNotes: "" });
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    if (editing) setAssetForm({ altText: editing.altText, tags: editing.tags.join("\n"), usageNotes: editing.usageNotes });
  }, [editing]);
  return (
    <div className="space-y-5">
      <SectionHeading title="Media library" description="Upload reusable images and video, or create an AI image with a clear prompt." />
      <div className="grid gap-4 lg:grid-cols-2">
        <label className={`${cardClass} flex cursor-pointer items-center gap-3 p-4 transition hover:border-primary/50`}>
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">{uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}</span>
          <span><span className="block text-sm font-semibold">Upload images or videos</span><span className="block text-xs text-muted-foreground">JPG, PNG, GIF, WebP or video up to 50 MB</span></span>
          <input aria-label="Upload images or videos" className="sr-only" type="file" accept="image/*,video/*" multiple onChange={async (event) => {
            const files = Array.from(event.target.files || []);
            if (!files.length) return;
            setUploading(true);
            try { await state.uploadAssets(files); toast.success(`${files.length} media file${files.length === 1 ? "" : "s"} uploaded.`); } catch (error) { toast.error(errorMessage(error)); } finally { setUploading(false); event.target.value = ""; }
          }} />
        </label>
        <div className={`${cardClass} p-4`}>
          <Field label="AI image prompt" hint="AI-generated images are labelled in the library.">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input aria-label="AI image prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Warm editorial photograph of…" />
              <Button type="button" disabled={generating} onClick={async () => {
                if (!prompt.trim()) return toast.error("Describe the image you want.");
                setGenerating(true);
                try { await generateMarketingImage(companyId, prompt.trim()); toast.success("AI image added to the library."); setPrompt(""); } catch (error) { toast.error(`Image could not be generated: ${errorMessage(error)}`); } finally { setGenerating(false); }
              }} className="shrink-0 gap-2 bg-gradient-primary">{generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} Generate image</Button>
            </div>
          </Field>
        </div>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {state.assets.map((asset) => (
          <article key={asset.id} className={`${cardClass} min-w-0 overflow-hidden`}>
            {asset.mediaType === "video" ? <video src={asset.url} controls className="aspect-video w-full bg-black object-contain" aria-label={asset.altText || asset.name} /> : <img src={asset.url} alt={asset.altText || asset.name} className="aspect-video w-full object-cover" />}
            <div className="p-3">
              <div className="flex items-start justify-between gap-2"><p className="min-w-0 truncate text-sm font-semibold">{asset.name}</p><span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold">{asset.source === "ai_generated" ? "AI generated" : "Uploaded"}</span></div>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{asset.altText || "No alt text yet"}</p>
              <div className="mt-3 flex gap-2"><Button size="sm" variant="outline" onClick={() => setEditing(asset)}>Edit details</Button><Button size="sm" variant="ghost" className="text-destructive" aria-label={`Delete ${asset.name}`} onClick={async () => { if (!window.confirm(`Delete ${asset.name}?`)) return; try { await state.deleteAsset(asset); toast.success("Media deleted."); } catch (error) { toast.error(errorMessage(error)); } }}><Trash2 className="h-4 w-4" /></Button></div>
            </div>
          </article>
        ))}
        {!state.assets.length && <div className={`${cardClass} col-span-full p-8 text-center`}><FileImage className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-2 text-sm font-medium">Your media library is empty</p><p className="mt-1 text-xs text-muted-foreground">Upload brand photography or generate a first image.</p></div>}
      </div>
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit media details</DialogTitle><DialogDescription>Add accessible alt text and usage guidance.</DialogDescription></DialogHeader>
          <Field label="Alt text" hint="Describe the important visual content for accessibility."><Textarea aria-label="Alt text" value={assetForm.altText} onChange={(event) => setAssetForm({ ...assetForm, altText: event.target.value })} /></Field>
          <Field label="Tags" hint="One tag per line."><Textarea aria-label="Media tags" value={assetForm.tags} onChange={(event) => setAssetForm({ ...assetForm, tags: event.target.value })} /></Field>
          <Field label="Usage notes"><Textarea aria-label="Usage notes" value={assetForm.usageNotes} onChange={(event) => setAssetForm({ ...assetForm, usageNotes: event.target.value })} /></Field>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button className="bg-gradient-primary" onClick={async () => { if (!editing?.id) return; try { await state.updateAsset(editing.id, { altText: assetForm.altText.trim(), tags: lines(assetForm.tags), usageNotes: assetForm.usageNotes.trim() }); toast.success("Media details saved."); setEditing(null); } catch (error) { toast.error(errorMessage(error)); } }}>Save media details</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const ARRAY_PROFILE_FIELDS: Array<{ key: keyof MarketingProfile; label: string; hint: string }> = [
  { key: "objectives", label: "Objectives", hint: "One business or marketing objective per line." },
  { key: "keyMessages", label: "Key messages", hint: "The ideas every post should reinforce." },
  { key: "requiredPhrases", label: "Required phrases", hint: "One required phrase per line." },
  { key: "bannedPhrases", label: "Banned phrases", hint: "Words or claims AI must avoid." },
  { key: "disclaimers", label: "Disclaimers", hint: "Legal or contextual notices, one per line." },
  { key: "preferredHashtags", label: "Preferred hashtags", hint: "One hashtag per line." },
  { key: "competitors", label: "Competitors", hint: "One name or website per line. AI uses this to write distinctive angles — it cannot scrape Instagram." },
  { key: "tradingNames", label: "Trading names", hint: "One recognised trading name per line." },
  { key: "relatedCompanyIds", label: "Related company IDs", hint: "One Hardy Hub company ID per line." },
];

function BrandSection({ state }: { state: MarketingState }) {
  const [form, setForm] = useState(state.profile);
  const [saving, setSaving] = useState(false);
  useEffect(() => setForm(state.profile), [state.profile]);
  const essentialsMissing = [
    !form.brandVoice.trim() && "brand voice",
    !form.targetAudience.trim() && "target audience",
    !(form.industry.trim() || form.tradingNames.length) && "industry or a trading name",
    !(form.objectives.length || form.keyMessages.length) && "objectives or key messages",
  ].filter(Boolean);
  return (
    <div className="space-y-5">
      <SectionHeading title="Brand guidance" description="Give AI the voice, audience, competitors and current themes it needs to write useful, recognisable content." />
      {essentialsMissing.length > 0 && <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 text-sm"><div className="flex gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /><p><strong>Generation is paused.</strong> Add {essentialsMissing.join(", ")} before AI can generate a plan.</p></div></div>}
      <form className={`${cardClass} space-y-5 p-4 sm:p-5`} onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        try { await state.saveProfile(form); toast.success("Brand guidance saved."); } catch (error) { toast.error(errorMessage(error)); } finally { setSaving(false); }
      }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Brand voice" hint="For example: warm, direct, expert and never corporate."><Textarea aria-label="Brand voice" rows={4} value={form.brandVoice} onChange={(event) => setForm({ ...form, brandVoice: event.target.value })} /></Field>
          <Field label="Target audience" hint="Who they are, what they need and what matters to them."><Textarea aria-label="Target audience" rows={4} value={form.targetAudience} onChange={(event) => setForm({ ...form, targetAudience: event.target.value })} /></Field>
          <Field label="Industry"><Input aria-label="Industry" value={form.industry} onChange={(event) => setForm({ ...form, industry: event.target.value })} /></Field>
          <Field label="Website"><Input aria-label="Marketing website" type="url" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} /></Field>
          <div className="sm:col-span-2">
            <Field label="What's happening now" hint="Seasonal hooks, local events, news in your sector, or what a competitor just launched.">
              <Textarea aria-label="What's happening now" rows={3} value={form.currentThemes || ""} onChange={(event) => setForm({ ...form, currentThemes: event.target.value })} />
            </Field>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {ARRAY_PROFILE_FIELDS.map((field) => (
            <Field key={field.key} label={field.label} hint={field.hint}>
              <Textarea aria-label={field.label} rows={4} value={(form[field.key] as string[]).join("\n")} onChange={(event) => setForm({ ...form, [field.key]: lines(event.target.value) })} />
            </Field>
          ))}
        </div>
        <PlatformChecks value={form.platforms} onChange={(platforms) => setForm({ ...form, platforms })} legend="Default platforms" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Default plan days"><Input aria-label="Default plan days" type="number" min={7} max={90} value={form.defaultPlanDays} onChange={(event) => setForm({ ...form, defaultPlanDays: Number(event.target.value) })} /></Field>
          <Field label="Default posts per week"><Input aria-label="Default posts per week" type="number" min={1} max={14} value={form.postsPerWeek} onChange={(event) => setForm({ ...form, postsPerWeek: Number(event.target.value) })} /></Field>
          <fieldset className="space-y-2"><legend className="text-sm font-medium">Approval</legend><label className="flex h-11 items-center gap-2 rounded-xl border-2 border-border bg-input px-3 text-sm"><Checkbox aria-label="Require approval before publishing" checked={form.approvalRequired} onCheckedChange={(checked) => setForm({ ...form, approvalRequired: Boolean(checked) })} />Require approval</label></fieldset>
        </div>
        <div className="flex justify-end"><Button type="submit" disabled={saving} className="gap-2 bg-gradient-primary">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save brand guidance</Button></div>
      </form>
    </div>
  );
}

function ConnectionsSection({ state, companyId }: { state: MarketingState; companyId: string }) {
  const [messages, setMessages] = useState<Partial<Record<SocialPlatform, string>>>({});
  const [busy, setBusy] = useState<SocialPlatform | null>(null);
  return (
    <div className="space-y-5">
      <SectionHeading title="Connections" description="Publishing only works after the platform authorises this company. Disconnected accounts are never treated as live." />
      <div className="grid gap-3 md:grid-cols-3">
        {PLATFORMS.map((platform) => {
          const connection = state.connections.find((item) => item.platform === platform);
          const connected = connection?.status === "connected";
          return (
            <article key={platform} className={`${cardClass} p-4`}>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">{platform === "instagram" ? <Instagram className="h-5 w-5" /> : platform === "facebook" ? <Facebook className="h-5 w-5" /> : <span className="font-bold">in</span>}</span>
                <div><h3 className="font-semibold">{PLATFORM_LABELS[platform]}</h3><p className={`text-xs font-semibold ${connected ? "text-emerald-600" : "text-muted-foreground"}`}>{connected ? `Connected${connection.accountName ? ` as ${connection.accountName}` : ""}` : connection?.status === "expired" ? "Connection expired" : connection?.status === "error" ? "Connection error" : "Not connected"}</p></div>
              </div>
              {connection?.error && <p className="mt-3 rounded-xl bg-destructive/10 p-2 text-xs text-destructive">{connection.error}</p>}
              {messages[platform] && <p role="status" className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2 text-xs">{messages[platform]}</p>}
              <Button variant="outline" className="mt-4 w-full gap-2" disabled={busy === platform} onClick={async () => {
                setBusy(platform);
                setMessages((current) => ({ ...current, [platform]: "" }));
                try {
                  const result = await getMarketingConnectionUrl(companyId, platform);
                  if (!result.available || !result.authUrl) {
                    setMessages((current) => ({ ...current, [platform]: result.reason || `${PLATFORM_LABELS[platform]} connection is not available.` }));
                  } else {
                    window.location.assign(result.authUrl);
                  }
                } catch (error) {
                  setMessages((current) => ({ ...current, [platform]: errorMessage(error) }));
                } finally {
                  setBusy(null);
                }
              }}>{busy === platform ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />} {connected ? `Reconnect ${PLATFORM_LABELS[platform]}` : `Connect ${PLATFORM_LABELS[platform]}`}</Button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function AdviserSection({ state, companyId }: { state: MarketingState; companyId: string }) {
  const activeCampaigns = state.campaigns.filter((item) => item.status === "active" || item.status === "planned");
  const failed = state.content.filter((item) => item.status === "failed");
  const published = state.content.filter((item) => item.status === "published");
  const recommendations = [
    !activeCampaigns.length && "Create one focused campaign with a defined audience and measurable objective before planning adverts.",
    activeCampaigns.some((item) => !item.budget) && "Add an indicative test budget to active campaigns so spend scenarios can be compared.",
    state.profile.platforms.length > 1 && published.length < 3 && "Build a small organic baseline first; reuse the strongest message across channels before paying to amplify it.",
    failed.length > 0 && `Resolve ${failed.length} failed post${failed.length === 1 ? "" : "s"} and verify platform connections before considering paid activity.`,
    state.content.filter((item) => item.status === "awaiting_approval").length > 3 && "Clear the review queue before generating another batch, so feedback improves the next plan.",
  ].filter(Boolean) as string[];
  if (!recommendations.length) recommendations.push("Choose one campaign objective and generate a short advert plan with two message angles to test.");
  return (
    <div className="space-y-5">
      <SectionHeading title="Ad adviser" description="Practical recommendations based on this workspace. It cannot launch ads, change accounts or spend money." />
      <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4">
        <div className="flex gap-3"><BarChart3 className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" /><div><h3 className="font-semibold">Budget remains a recommendation</h3><p className="mt-1 text-sm text-muted-foreground">Any campaign budget here is for planning only. Launch and spend controls stay inside the advertising platform.</p></div></div>
      </div>
      <div className={`${cardClass} p-4 sm:p-5`}>
        <h3 className="font-semibold">Recommended next moves</h3>
        <div className="mt-3 space-y-2">
          {recommendations.map((recommendation, index) => <div key={recommendation} className="flex gap-3 rounded-xl border border-border/50 bg-muted/30 p-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold">{index + 1}</span><p className="text-sm">{recommendation}</p></div>)}
        </div>
      </div>
      <PlanGenerator state={state} companyId={companyId} title="Create an AI advert plan" advert />
    </div>
  );
}

export default function CompanyMarketingTab({ companyId, company }: { companyId: string; company: Company }) {
  const state = useCompanyMarketing(companyId);
  const [section, setSection] = useState<SectionId>("overview");
  if (state.loading) {
    return <div className={`${cardClass} flex min-h-56 items-center justify-center gap-2 text-sm text-muted-foreground`}><Loader2 className="h-4 w-4 animate-spin" /> Loading Social & Ads…</div>;
  }
  return (
    <div className="min-w-0 overflow-x-hidden">
      <div className="flex min-w-0 gap-3 lg:gap-4">
        <aside className="w-[3.5rem] shrink-0 sm:w-[10.75rem]">
          <nav aria-label="Social and advertising sections" className="sticky top-2 space-y-1 rounded-2xl border border-border/50 bg-card p-1.5 shadow-card">
            {SECTION_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setSection(item.id)}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  className={`flex w-full items-center gap-2 rounded-xl border px-1.5 py-2 text-left transition sm:px-2 ${active ? "border-primary/45 text-foreground" : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}
                  style={active ? { background: `color-mix(in srgb, ${company.color} 18%, hsl(var(--card)))` } : undefined}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? "bg-gradient-primary text-primary-foreground" : "bg-muted"}`}><Icon className="h-4 w-4" /></span>
                  <span className="hidden min-w-0 text-xs font-semibold sm:block">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">
          {section === "overview" && <OverviewSection state={state} company={company} companyId={companyId} onSection={setSection} />}
          {section === "planner" && <PlannerSection state={state} companyId={companyId} />}
          {section === "review" && <ReviewSection state={state} companyId={companyId} />}
          {section === "campaigns" && <CampaignsSection state={state} company={company} />}
          {section === "media" && <MediaSection state={state} companyId={companyId} />}
          {section === "brand" && <BrandSection state={state} />}
          {section === "audit" && <CompanyMarketingAudit companyId={companyId} companyColor={company.color} state={state} />}
          {section === "connections" && <ConnectionsSection state={state} companyId={companyId} />}
          {section === "adviser" && <AdviserSection state={state} companyId={companyId} />}
        </div>
      </div>
    </div>
  );
}
