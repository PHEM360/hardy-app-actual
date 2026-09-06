import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CalendarDays, Check, ClipboardCheck, ImagePlus, LayoutDashboard, Link2,
  Loader2, Megaphone, Radar, Settings2, Sparkles, Upload,
} from "lucide-react";
import { toast } from "sonner";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAllCompanyMarketing, filterMarketingContent } from "@/hooks/useAllCompanyMarketing";
import { useCompanyMarketing } from "@/hooks/useCompanyMarketing";
import {
  approveMarketingContent,
  bulkApproveMarketingContent,
  rejectMarketingContent,
  generateMarketingAudit,
  generateMarketingImage,
  generateMarketingPlan,
  getMarketingConnectionUrl,
  publishMarketingContentNow,
  saveMarketingSocialLink,
} from "@/lib/marketingApi";
import { isMarketingProfileReady, seedMarketingProfileFromCompany } from "@/lib/marketingContent";
import {
  IMAGE_MODEL_OPTIONS,
  LIVE_OAUTH_PLATFORMS,
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_HINTS,
  SOCIAL_PLATFORM_LABELS,
  TEXT_MODEL_OPTIONS,
  defaultCadence,
  platformLabel,
} from "@/lib/socialPlatforms";
import type { MarketingCadenceRule, SocialPlatform } from "@/types/app";

type SectionId = "dashboard" | "calendar" | "queue" | "generate" | "brand" | "media" | "presence" | "connections";

const SECTIONS: Array<{ id: SectionId; label: string; icon: typeof LayoutDashboard }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "queue", label: "Queue", icon: ClipboardCheck },
  { id: "generate", label: "Generate", icon: Sparkles },
  { id: "brand", label: "Brand", icon: Settings2 },
  { id: "media", label: "Media", icon: ImagePlus },
  { id: "presence", label: "Presence", icon: Radar },
  { id: "connections", label: "Accounts", icon: Link2 },
];

const ACCENT = "hsl(210,50%,50%)";

function railClass(active: boolean) {
  return `flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold transition-colors ${
    active ? "bg-gradient-primary text-primary-foreground shadow-sm" : "text-foreground hover:bg-card"
  }`;
}

function chipClass(active: boolean) {
  return `rounded-xl border px-2.5 py-1.5 text-xs font-semibold ${
    active
      ? "border-primary/50 bg-gradient-primary text-primary-foreground"
      : "border-border/50 bg-card text-foreground"
  }`;
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

export default function CompanySocial() {
  const { companies, rows, loading } = useAllCompanyMarketing();
  const [params, setParams] = useSearchParams();
  const [section, setSection] = useState<SectionId>((params.get("section") as SectionId) || "dashboard");
  const [companyId, setCompanyId] = useState(params.get("company") || "all");
  const [platform, setPlatform] = useState(params.get("platform") || "all");
  const companyMarketing = useCompanyMarketing(companyId === "all" ? companies[0]?.id : companyId);

  useEffect(() => {
    if (params.get("connect") === "ok") toast.success("Social account linked");
    if (params.get("connect") === "error") toast.error("That social login did not finish");
    if (params.get("company")) setCompanyId(params.get("company") || "all");
    if (!params.get("connect")) return;
    const next = new URLSearchParams(params);
    next.delete("connect");
    next.delete("reason");
    next.delete("platform");
    setParams(next, { replace: true });
  }, [params, setParams]);

  const posts = useMemo(
    () => filterMarketingContent(rows, companyId, platform),
    [rows, companyId, platform],
  );
  const awaiting = posts.filter((row) => row.item.status === "awaiting_approval");
  const selectedCompany = companies.find((item) => item.id === companyId) || companies[0];

  return (
    <FeaturePageShell
      title="Social & Ads"
      subtitle="Every company’s posts, brand and calendar in one place"
      icon={<Megaphone className="h-5 w-5" />}
      sharePage="companies"
    >
      <div className="flex min-w-0 gap-3">
        <aside className="w-[4.5rem] shrink-0 sm:w-[10.75rem]">
          <div
            className="sticky top-2 space-y-1 rounded-2xl border border-border/40 p-1.5 shadow-card"
            style={{ background: `color-mix(in srgb, ${ACCENT} 12%, hsl(var(--card)))` }}
          >
            {SECTIONS.map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.id} type="button" className={railClass(section === item.id)} onClick={() => setSection(item.id)}>
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden truncate sm:inline">{item.label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-3 overflow-x-hidden">
          <div className="rounded-2xl border border-border/40 bg-card p-3 shadow-card">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Company</p>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className={chipClass(companyId === "all")} onClick={() => setCompanyId("all")}>All companies</button>
              {companies.map((company) => (
                <button key={company.id} type="button" className={chipClass(companyId === company.id)} onClick={() => setCompanyId(company.id)}>
                  {company.emoji} {company.name}
                </button>
              ))}
            </div>
            <p className="mb-2 mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Platform</p>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className={chipClass(platform === "all")} onClick={() => setPlatform("all")}>All platforms</button>
              {SOCIAL_PLATFORMS.map((item) => (
                <button key={item} type="button" className={chipClass(platform === item)} onClick={() => setPlatform(item)}>
                  {SOCIAL_PLATFORM_LABELS[item]}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading social plans…</p>
          ) : !companies.length ? (
            <EmptyCard title="Add a company first" body="Social & Ads plans sit on each company. Create one on the Companies page, then come back here." />
          ) : section === "dashboard" ? (
            <DashboardSection posts={posts} awaiting={awaiting.length} companies={companyId === "all" ? companies.length : 1} />
          ) : section === "calendar" ? (
            <CalendarSection posts={posts} />
          ) : section === "queue" ? (
            <QueueSection
              posts={awaiting}
              ready={posts.filter((row) => row.item.status === "approved" || row.item.status === "scheduled")}
            />
          ) : section === "generate" ? (
            <GenerateSection companyId={selectedCompany?.id} profile={companyMarketing.profile} disabled={companyId === "all"} />
          ) : section === "brand" ? (
            <BrandSection state={companyMarketing} company={selectedCompany} disabled={companyId === "all"} />
          ) : section === "media" ? (
            <MediaSection state={companyMarketing} companyId={selectedCompany?.id} disabled={companyId === "all"} />
          ) : section === "presence" ? (
            <PresenceSection state={companyMarketing} companyId={selectedCompany?.id} disabled={companyId === "all"} />
          ) : (
            <ConnectionsSection state={companyMarketing} companyId={selectedCompany?.id} disabled={companyId === "all"} />
          )}
        </div>
      </div>
    </FeaturePageShell>
  );
}

function EmptyCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card p-8 text-center shadow-card">
      <Megaphone className="mx-auto h-8 w-8 text-primary" />
      <p className="mt-3 font-display text-lg font-bold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function DashboardSection({
  posts,
  awaiting,
  companies,
}: {
  posts: ReturnType<typeof filterMarketingContent>;
  awaiting: number;
  companies: number;
}) {
  const published = posts.filter((row) => row.item.status === "published").length;
  const scheduled = posts.filter((row) => row.item.status === "scheduled" || row.item.status === "approved").length;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["In the queue", awaiting, "Waiting for you"],
          ["Scheduled", scheduled, "Ready to go out"],
          ["Published", published, `${companies} compan${companies === 1 ? "y" : "ies"}`],
        ].map(([label, value, hint]) => (
          <div
            key={String(label)}
            className="rounded-2xl border border-border/40 p-4 shadow-card"
            style={{ background: `color-mix(in srgb, ${ACCENT} 10%, hsl(var(--card)))`, borderLeftWidth: 4, borderLeftColor: ACCENT }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-1 font-display text-3xl font-bold">{value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
          </div>
        ))}
      </div>
      <CalendarSection posts={posts} compact />
    </div>
  );
}

function CalendarSection({
  posts,
  compact,
}: {
  posts: ReturnType<typeof filterMarketingContent>;
  compact?: boolean;
}) {
  const byDay = useMemo(() => {
    const map = new Map<string, typeof posts>();
    for (const row of posts) {
      const day = (row.item.scheduledFor || "").slice(0, 10);
      if (!day) continue;
      map.set(day, [...(map.get(day) || []), row]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [posts]);
  if (!byDay.length) {
    return <EmptyCard title="Nothing on the calendar yet" body="Generate a plan, then approve posts. They land here by date, company and platform." />;
  }
  return (
    <div className="space-y-2">
      {!compact && <p className="font-display text-lg font-bold">What goes out when</p>}
      <div className="space-y-2">
        {byDay.slice(0, compact ? 8 : 90).map(([day, items]) => (
          <article key={day} className="rounded-2xl border border-border/40 bg-card p-3 shadow-card">
            <p className="text-sm font-bold">
              {new Date(`${day}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
            </p>
            <div className="mt-2 space-y-1.5">
              {items.map((row) => (
                <div key={`${row.company.id}:${row.item.id}`} className="flex min-w-0 items-start justify-between gap-2 rounded-xl px-2 py-1.5" style={{ background: `color-mix(in srgb, ${row.company.color || ACCENT} 12%, hsl(var(--card)))` }}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{row.item.topic}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {row.company.name} · {platformLabel(String(row.item.platform))} · {statusLabel(row.item.status)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function QueueSection({
  posts,
  ready,
}: {
  posts: ReturnType<typeof filterMarketingContent>;
  ready: ReturnType<typeof filterMarketingContent>;
}) {
  const [busy, setBusy] = useState(false);
  const grouped = useMemo(() => {
    const map = new Map<string, typeof posts>();
    for (const row of posts) {
      map.set(row.company.id, [...(map.get(row.company.id) || []), row]);
    }
    return [...map.entries()];
  }, [posts]);

  const approveAll = async (companyId: string, items: typeof posts) => {
    setBusy(true);
    try {
      const result = await bulkApproveMarketingContent(
        companyId,
        items.map((row) => ({ contentId: row.item.id!, approvalVersion: row.item.approvalVersion })),
      );
      toast.success(`Approved ${result.approved} post${result.approved === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not approve those posts");
    } finally {
      setBusy(false);
    }
  };

  const publishNow = async (companyId: string, itemId: string, version: number) => {
    setBusy(true);
    try {
      await publishMarketingContentNow(companyId, itemId, version);
      toast.success("Queued to post now");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish that post");
    } finally {
      setBusy(false);
    }
  };

  if (!posts.length && !ready.length) {
    return <EmptyCard title="Review queue is clear" body="When AI writes a batch, they wait here so you can edit, approve or reject before anything goes out." />;
  }

  return (
    <div className="space-y-4">
      {ready.length > 0 && (
        <section className="space-y-2">
          <p className="font-display text-lg font-bold">Ready to post</p>
          {ready.map((row) => (
            <article key={row.item.id} className="rounded-2xl border border-border/40 bg-card p-4 shadow-card">
              <p className="text-xs font-semibold text-muted-foreground">{row.company.name} · {platformLabel(String(row.item.platform))}</p>
              <p className="mt-1 font-semibold">{row.item.topic}</p>
              <Button className="mt-3" size="sm" disabled={busy} onClick={() => void publishNow(row.company.id, row.item.id!, row.item.approvalVersion)}>
                Post now
              </Button>
            </article>
          ))}
        </section>
      )}
      {grouped.map(([id, items]) => (
        <section key={id} className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="font-display text-lg font-bold">{items[0].company.name}</p>
            <Button size="sm" disabled={busy} onClick={() => void approveAll(id, items)}>
              <Check className="mr-1.5 h-3.5 w-3.5" /> Approve all
            </Button>
          </div>
          {items.map((row) => (
            <article key={row.item.id} className="rounded-2xl border border-border/40 bg-card p-4 shadow-card">
              <p className="text-xs font-semibold text-muted-foreground">{platformLabel(String(row.item.platform))} · {row.item.type.replace("_", " ")}</p>
              <p className="mt-1 font-semibold">{row.item.topic}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm">{row.item.refinedDraft || row.item.draft}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" disabled={busy} onClick={async () => {
                  setBusy(true);
                  try {
                    await approveMarketingContent(row.company.id, row.item.id!, row.item.approvalVersion);
                    toast.success("Approved");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Could not approve");
                  } finally {
                    setBusy(false);
                  }
                }}>Approve</Button>
                <Button size="sm" disabled={busy} onClick={async () => {
                  setBusy(true);
                  try {
                    await approveMarketingContent(row.company.id, row.item.id!, row.item.approvalVersion);
                    await publishMarketingContentNow(row.company.id, row.item.id!, row.item.approvalVersion);
                    toast.success("Approved and queued to post now");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Could not publish now");
                  } finally {
                    setBusy(false);
                  }
                }}>Approve & post now</Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={async () => {
                  setBusy(true);
                  try {
                    await rejectMarketingContent(row.company.id, row.item.id!, row.item.approvalVersion, "Rejected from the queue");
                    toast.success("Rejected");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Could not reject");
                  } finally {
                    setBusy(false);
                  }
                }}>Reject</Button>
              </div>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}

function GenerateSection({
  companyId,
  profile,
  disabled,
}: {
  companyId?: string;
  profile: ReturnType<typeof useCompanyMarketing>["profile"];
  disabled: boolean;
}) {
  const [days, setDays] = useState(profile.defaultPlanDays || 30);
  const [postsPerWeek, setPostsPerWeek] = useState(profile.postsPerWeek || 3);
  const [platforms, setPlatforms] = useState<SocialPlatform[]>(profile.platforms);
  const [focus, setFocus] = useState("");
  const [controversial, setControversial] = useState(profile.controversialTheme || "");
  const [textModel, setTextModel] = useState(profile.textModel || "auto");
  const [imageModel, setImageModel] = useState(profile.imageModel || "auto");
  const [includeImages, setIncludeImages] = useState(true);
  const [includeArticles, setIncludeArticles] = useState(true);
  const [busy, setBusy] = useState(false);
  if (disabled || !companyId) {
    return <EmptyCard title="Pick one company" body="Choose a company above, then generate up to 90 days of posts for that brand." />;
  }
  const ready = isMarketingProfileReady(profile);
  return (
    <div
      className="space-y-4 rounded-2xl border border-border/40 p-4 shadow-card"
      style={{ background: `color-mix(in srgb, ${ACCENT} 10%, hsl(var(--card)))`, borderLeftWidth: 4, borderLeftColor: ACCENT }}
    >
      <div>
        <p className="font-display text-lg font-bold">Generate a run</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Up to 90 days. AI writes to this company’s voice and cadence. You review the queue, then it auto-posts when accounts are linked.
        </p>
      </div>
      {!ready && <p className="rounded-xl bg-amber-500/15 p-3 text-sm">Run a Presence scan or fill Brand first — AI needs a voice, audience and objective.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Days ahead">
          <Input type="number" min={7} max={90} value={days} onChange={(event) => setDays(Number(event.target.value))} />
        </Field>
        <Field label="Posts per week">
          <Input type="number" min={1} max={14} value={postsPerWeek} onChange={(event) => setPostsPerWeek(Number(event.target.value))} />
        </Field>
        <Field label="Writing model">
          <select className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm" value={textModel} onChange={(event) => setTextModel(event.target.value)}>
            {TEXT_MODEL_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </Field>
        <Field label="Picture model">
          <select className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm" value={imageModel} onChange={(event) => setImageModel(event.target.value)}>
            {IMAGE_MODEL_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </Field>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {SOCIAL_PLATFORMS.map((item) => (
          <button key={item} type="button" className={chipClass(platforms.includes(item))} onClick={() => setPlatforms((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item])}>
            {SOCIAL_PLATFORM_LABELS[item]}
          </button>
        ))}
      </div>
      <Field label="Focus this month">
        <Textarea rows={2} value={focus} onChange={(event) => setFocus(event.target.value)} placeholder="e.g. tax year wrap-up, new service launch" />
      </Field>
      <Field label="Controversial / opinion theme" hint="Used when a platform’s cadence asks for a debate piece.">
        <Input value={controversial} onChange={(event) => setControversial(event.target.value)} placeholder="e.g. AI in family businesses" />
      </Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeArticles} onChange={(event) => setIncludeArticles(event.target.checked)} /> Include LinkedIn / long-form articles</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeImages} onChange={(event) => setIncludeImages(event.target.checked)} /> Generate pictures where needed</label>
      <Button disabled={busy || !ready || !platforms.length} onClick={async () => {
        setBusy(true);
        try {
          const result = await generateMarketingPlan(companyId, {
            periodDays: days,
            postsPerWeek,
            platforms,
            focus,
            includeImages,
            includeArticles,
            controversialTheme: controversial,
            textModel,
            imageModel,
            textProvider: TEXT_MODEL_OPTIONS.find((item) => item.id === textModel)?.provider || "auto",
            imageProvider: IMAGE_MODEL_OPTIONS.find((item) => item.id === imageModel)?.provider || "auto",
          });
          toast.success(result.summary || `Created ${result.created} posts for review`);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Could not generate that plan");
        } finally {
          setBusy(false);
        }
      }}>
        {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
        Generate {days}-day plan
      </Button>
    </div>
  );
}

function BrandSection({
  state,
  company,
  disabled,
}: {
  state: ReturnType<typeof useCompanyMarketing>;
  company?: { name: string; description?: string; contact?: { website?: string } };
  disabled: boolean;
}) {
  const [form, setForm] = useState(state.profile);
  const [cadence, setCadence] = useState(state.profile.cadence || defaultCadence());
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setForm(company ? seedMarketingProfileFromCompany(state.profile, company) : state.profile);
    setCadence(state.profile.cadence || defaultCadence());
  }, [state.profile, company]);
  if (disabled) return <EmptyCard title="Pick one company" body="Brand voice and cadence are per company. Choose one above to edit." />;
  return (
    <form
      className="space-y-4 rounded-2xl border border-border/40 bg-card p-4 shadow-card"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
          await state.saveProfile({ ...form, cadence });
          toast.success("Brand guidance saved");
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Could not save brand");
        } finally {
          setSaving(false);
        }
      }}
    >
      <p className="font-display text-lg font-bold">Brand guidance</p>
      <p className="text-sm text-muted-foreground">A Presence scan fills this in from the website. Edit anything that does not sound like you.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Brand voice"><Textarea rows={4} value={form.brandVoice} onChange={(event) => setForm({ ...form, brandVoice: event.target.value })} /></Field>
        <Field label="Audience"><Textarea rows={4} value={form.targetAudience} onChange={(event) => setForm({ ...form, targetAudience: event.target.value })} /></Field>
        <Field label="Industry"><Input value={form.industry} onChange={(event) => setForm({ ...form, industry: event.target.value })} /></Field>
        <Field label="Website"><Input value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} /></Field>
        <Field label="Objectives" hint="One per line.">
          <Textarea rows={3} value={form.objectives.join("\n")} onChange={(event) => setForm({ ...form, objectives: lines(event.target.value) })} />
        </Field>
        <Field label="Key messages">
          <Textarea rows={3} value={form.keyMessages.join("\n")} onChange={(event) => setForm({ ...form, keyMessages: lines(event.target.value) })} />
        </Field>
      </div>
      <p className="font-semibold">Monthly cadence</p>
      <div className="grid gap-2">
        {SOCIAL_PLATFORMS.map((item) => {
          const rule = cadence[item] || { postsPerMonth: 0, articlesPerMonth: 0, controversialCount: 0, tone: "" };
          const patch = (updates: Partial<MarketingCadenceRule>) => setCadence({ ...cadence, [item]: { ...rule, ...updates } });
          return (
            <div key={item} className="grid gap-2 rounded-xl bg-card p-3 shadow-card sm:grid-cols-5">
              <p className="text-sm font-semibold sm:col-span-5">{SOCIAL_PLATFORM_LABELS[item]} <span className="font-normal text-muted-foreground">· {SOCIAL_PLATFORM_HINTS[item]}</span></p>
              <Field label="Posts / month"><Input type="number" min={0} max={60} value={rule.postsPerMonth} onChange={(event) => patch({ postsPerMonth: Number(event.target.value) })} /></Field>
              <Field label="Articles"><Input type="number" min={0} max={12} value={rule.articlesPerMonth} onChange={(event) => patch({ articlesPerMonth: Number(event.target.value) })} /></Field>
              <Field label="Opinion pieces"><Input type="number" min={0} max={8} value={rule.controversialCount} onChange={(event) => patch({ controversialCount: Number(event.target.value) })} /></Field>
              <div className="sm:col-span-2"><Field label="Tone"><Input value={rule.tone} onChange={(event) => patch({ tone: event.target.value })} /></Field></div>
            </div>
          );
        })}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.approvalRequired}
          onChange={(event) => setForm({ ...form, approvalRequired: event.target.checked })}
        />
        Review posts before they go out
      </label>
      <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save brand"}</Button>
    </form>
  );
}

function MediaSection({
  state,
  companyId,
  disabled,
}: {
  state: ReturnType<typeof useCompanyMarketing>;
  companyId?: string;
  disabled: boolean;
}) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  if (disabled || !companyId) return <EmptyCard title="Pick one company" body="Uploads and AI pictures belong to a company library." />;
  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border/40 bg-card p-4 shadow-card">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
        </span>
        <span>
          <span className="block text-sm font-semibold">Upload photos, video or PDF</span>
          <span className="block text-xs text-muted-foreground">Up to 80 MB. These stay in this company’s library for posts.</span>
        </span>
        <input
          type="file"
          accept="image/*,video/*,.pdf"
          multiple
          className="sr-only"
          onChange={async (event) => {
            const files = Array.from(event.target.files || []);
            if (!files.length) return;
            setBusy(true);
            try {
              await state.uploadAssets(files);
              toast.success(files.length === 1 ? "Media uploaded" : `${files.length} files uploaded`);
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Could not upload that file");
            } finally {
              setBusy(false);
              event.target.value = "";
            }
          }}
        />
      </label>
      <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-card">
        <Field label="Make a picture">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Warm editorial photo of…" />
            <Button disabled={busy} onClick={async () => {
              if (prompt.trim().length < 10) return toast.error("Describe the picture in a bit more detail.");
              setBusy(true);
              try {
                await generateMarketingImage(companyId, prompt.trim());
                toast.success("AI picture added");
                setPrompt("");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not make that picture");
              } finally {
                setBusy(false);
              }
            }}>Generate</Button>
          </div>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {state.assets.map((asset) => (
          <figure key={asset.id} className="overflow-hidden rounded-2xl border border-border/40 bg-card shadow-card">
            {asset.mediaType === "video" ? (
              <video src={asset.url} className="aspect-square w-full object-cover" controls />
            ) : asset.mediaType === "document" ? (
              <div className="flex aspect-square items-center justify-center text-sm">{asset.name}</div>
            ) : (
              <img src={asset.url} alt={asset.altText || asset.name} className="aspect-square w-full object-cover" />
            )}
          </figure>
        ))}
      </div>
    </div>
  );
}

function PresenceSection({
  state,
  companyId,
  disabled,
}: {
  state: ReturnType<typeof useCompanyMarketing>;
  companyId?: string;
  disabled: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const latest = state.audits[0];
  if (disabled || !companyId) return <EmptyCard title="Pick one company" body="The scan reads that company’s website and public profiles." />;
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border/40 p-4 shadow-card" style={{ background: `color-mix(in srgb, ${ACCENT} 10%, hsl(var(--card)))`, borderLeftWidth: 4, borderLeftColor: ACCENT }}>
        <p className="font-display text-lg font-bold">Presence scan</p>
        <p className="mt-1 text-sm text-muted-foreground">
          AI reads the website, linked social URLs and Google-style search clues, then writes what’s working, what’s weak, and fills empty brand fields.
        </p>
        <Button className="mt-3" disabled={busy} onClick={async () => {
          setBusy(true);
          try {
            const result = await generateMarketingAudit(companyId, {
              extraUrls: Object.values(state.profile.socialUrls || {}).join("\n"),
              searchNotes: "",
              adsNotes: "",
              socialNotes: "",
              otherNotes: "",
            });
            toast.success(result.headline || "Scan ready. Brand fields updated where they were empty.");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Scan could not finish");
          } finally {
            setBusy(false);
          }
        }}>
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Radar className="mr-1.5 h-4 w-4" />}
          Scan this company
        </Button>
      </div>
      {latest && (
        <article className="space-y-3 rounded-2xl border border-border/40 bg-card p-4 shadow-card">
          <p className="font-display text-lg font-bold">{latest.headline}</p>
          <p className="text-sm">{latest.executiveSummary}</p>
          <Block title="Google / search" body={[latest.search.demand, latest.search.match, latest.search.ranking].filter(Boolean).join(" ")} />
          <Block title="Website" body={[...(latest.website.strengths || []), ...(latest.website.gaps || [])].join(" · ")} />
          <Block title="Social" body={latest.social.performance} />
          {latest.opportunities?.map((item) => (
            <div key={item.title} className="rounded-xl bg-card p-3 shadow-card">
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.action}</p>
            </div>
          ))}
        </article>
      )}
    </div>
  );
}

function ConnectionsSection({
  state,
  companyId,
  disabled,
}: {
  state: ReturnType<typeof useCompanyMarketing>;
  companyId?: string;
  disabled: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  if (disabled || !companyId) return <EmptyCard title="Pick one company" body="Link Instagram, LinkedIn, Google and the rest for that brand." />;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {SOCIAL_PLATFORMS.map((item) => {
        const connection = state.connections.find((row) => row.platform === item);
        const linked = connection?.status === "connected";
        return (
          <article key={item} className="rounded-2xl border border-border/40 bg-card p-4 shadow-card">
            <p className="font-semibold">{SOCIAL_PLATFORM_LABELS[item]}</p>
            <p className="text-xs text-muted-foreground">{linked ? `Linked${connection?.accountName ? ` as ${connection.accountName}` : ""}` : "Not linked"}</p>
            <Input
              className="mt-3"
              placeholder={`${SOCIAL_PLATFORM_LABELS[item]} URL or @handle`}
              value={urls[item] ?? state.profile.socialUrls?.[item] ?? connection?.profileUrl ?? ""}
              onChange={(event) => setUrls((current) => ({ ...current, [item]: event.target.value }))}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" disabled={busy === item} onClick={async () => {
                setBusy(item);
                try {
                  await saveMarketingSocialLink(companyId, item, urls[item] || state.profile.socialUrls?.[item] || "", urls[item]);
                  toast.success(`${SOCIAL_PLATFORM_LABELS[item]} profile saved`);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not save that profile");
                } finally {
                  setBusy(null);
                }
              }}>Save profile</Button>
              <Button size="sm" disabled={busy === item || !LIVE_OAUTH_PLATFORMS.includes(item)} onClick={async () => {
                setBusy(item);
                try {
                  const result = await getMarketingConnectionUrl(companyId, item);
                  if (result.available && result.authUrl) {
                    window.location.href = result.authUrl;
                    return;
                  }
                  toast.message(result.reason || "Save the public profile for scans. Autopost needs the family app for this network.");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not start that login");
                } finally {
                  setBusy(null);
                }
              }}>{LIVE_OAUTH_PLATFORMS.includes(item) ? "Connect in app" : "Profile only"}</Button>
            </div>
            {!LIVE_OAUTH_PLATFORMS.includes(item) && (
              <p className="mt-2 text-xs text-muted-foreground">Save the public profile for scans. Autopost for this network is not live yet.</p>
            )}
            {item === "instagram" && (
              <p className="mt-2 text-xs text-muted-foreground">Instagram posting needs a photo on the post.</p>
            )}
          </article>
        );
      })}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Block({ title, body }: { title: string; body: string }) {
  if (!body) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <p className="mt-1 text-sm">{body}</p>
    </div>
  );
}

function lines(value: string) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}
