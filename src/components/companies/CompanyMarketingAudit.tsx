import { useState, type ReactNode } from "react";
import { Radar, Sparkles, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { generateMarketingAudit } from "@/lib/marketingApi";
import type { MarketingAudit, MarketingAuditRequest } from "@/types/app";
import type { useCompanyMarketing } from "@/hooks/useCompanyMarketing";

const EMPTY_REQUEST: MarketingAuditRequest = {
  extraUrls: "",
  searchNotes: "",
  adsNotes: "",
  socialNotes: "",
  otherNotes: "",
};

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

function timestampLabel(value: unknown) {
  if (value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toLocaleString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return "Just now";
}

const IMPACT: Record<string, string> = {
  high: "border-amber-500/35 bg-amber-500/10",
  medium: "border-primary/25 bg-primary/10",
  low: "border-border/60 bg-muted/30",
};

export function CompanyMarketingAudit({
  companyId,
  companyColor,
  state,
}: {
  companyId: string;
  companyColor: string;
  state: ReturnType<typeof useCompanyMarketing>;
}) {
  const [request, setRequest] = useState<MarketingAuditRequest>(EMPTY_REQUEST);
  const [scanning, setScanning] = useState(false);
  const latest = state.audits[0];

  const scan = async () => {
    setScanning(true);
    try {
      const result = await generateMarketingAudit(companyId, request);
      toast.success(result.headline || "Audit ready.");
    } catch (error) {
      toast.error(`Scan could not finish: ${errorMessage(error)}`);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold">PR audit</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A weekly look at search, ads, social and the website — using public pages plus anything you paste in.
          </p>
        </div>
        <Button onClick={() => void scan()} disabled={scanning} className="gap-2 bg-gradient-primary">
          {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {scanning ? "Scanning…" : latest ? "Run another scan" : "Run a scan"}
        </Button>
      </div>

      <div
        className="rounded-2xl border border-border/50 bg-card p-4 shadow-card sm:p-5"
        style={{
          background: `color-mix(in srgb, ${companyColor} 12%, hsl(var(--card)))`,
          borderLeft: `3px solid ${companyColor}`,
        }}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
            <Radar className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-display text-lg font-bold">What this scan can see</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              It reads your website and competitor pages, brand guidance, and posts already in this hub. Paste Search Console, Google Ads or social stats if you have them. It cannot log into Google or Instagram, so it will not invent rankings, clicks or spend.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-card sm:p-5">
        <h3 className="font-semibold">Add anything else it should use</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="audit-urls">Extra public pages</Label>
            <Textarea
              id="audit-urls"
              aria-label="Extra public pages"
              rows={2}
              value={request.extraUrls}
              onChange={(event) => setRequest({ ...request, extraUrls: event.target.value })}
              placeholder="https://… one URL per line"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-search">Search Console or ranking notes</Label>
            <Textarea
              id="audit-search"
              aria-label="Search Console or ranking notes"
              rows={4}
              value={request.searchNotes}
              onChange={(event) => setRequest({ ...request, searchNotes: event.target.value })}
              placeholder="Top queries, impressions, pages that rank…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-ads">Google Ads notes</Label>
            <Textarea
              id="audit-ads"
              aria-label="Google Ads notes"
              rows={4}
              value={request.adsNotes}
              onChange={(event) => setRequest({ ...request, adsNotes: event.target.value })}
              placeholder="Spend, CTR, converting search terms…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-social">Social performance notes</Label>
            <Textarea
              id="audit-social"
              aria-label="Social performance notes"
              rows={4}
              value={request.socialNotes}
              onChange={(event) => setRequest({ ...request, socialNotes: event.target.value })}
              placeholder="Reach, saves, which posts did well…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-other">Anything else</Label>
            <Textarea
              id="audit-other"
              aria-label="Anything else"
              rows={4}
              value={request.otherNotes}
              onChange={(event) => setRequest({ ...request, otherNotes: event.target.value })}
              placeholder="Press, reviews, local events, what you want more of…"
            />
          </div>
        </div>
      </div>

      {latest ? <AuditReport audit={latest} onDelete={latest.id ? () => void state.deleteAudit(latest.id!) : undefined} /> : (
        <div className="rounded-2xl border border-border/50 bg-card p-8 text-center shadow-card">
          <Radar className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">No scan yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Run one whenever you like. Weekly is a good rhythm.</p>
        </div>
      )}

      {state.audits.length > 1 && (
        <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-card">
          <h3 className="font-semibold">Earlier scans</h3>
          <div className="mt-3 space-y-2">
            {state.audits.slice(1, 6).map((audit) => (
              <div key={audit.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/25 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{audit.headline}</p>
                  <p className="text-xs text-muted-foreground">{timestampLabel(audit.createdAt)}</p>
                </div>
                {audit.id && (
                  <button type="button" aria-label={`Delete ${audit.headline}`} className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive" onClick={() => void state.deleteAudit(audit.id!)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AuditReport({ audit, onDelete }: { audit: MarketingAudit; onDelete?: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{timestampLabel(audit.createdAt)}</p>
          <h3 className="font-display text-lg font-bold">{audit.headline}</h3>
        </div>
        {onDelete && (
          <button type="button" aria-label="Delete this audit" onClick={onDelete} className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      <p className="rounded-2xl border border-border/50 bg-card p-4 text-sm leading-relaxed shadow-card">{audit.executiveSummary}</p>
      <div className="grid gap-3 lg:grid-cols-2">
        <ReportCard title="Search and ranking" body={audit.search.ranking}>
          <p className="text-sm"><span className="font-semibold">Demand. </span>{audit.search.demand}</p>
          <p className="text-sm"><span className="font-semibold">How closely you match. </span>{audit.search.match}</p>
          {audit.search.queries.length > 0 && (
            <p className="text-xs text-muted-foreground">Likely queries: {audit.search.queries.join(" · ")}</p>
          )}
        </ReportCard>
        <ReportCard title="Google Ads" body={audit.ads.performance}>
          {audit.ads.caveats && <p className="text-xs text-muted-foreground">{audit.ads.caveats}</p>}
        </ReportCard>
        <ReportCard title="Social media" body={audit.social.performance}>
          {audit.social.popularTopics.length > 0 && (
            <p className="text-xs text-muted-foreground">Popular topics: {audit.social.popularTopics.join(" · ")}</p>
          )}
        </ReportCard>
        <ReportCard title="Website">
          {audit.website.strengths.map((item) => <p key={item} className="text-sm">+ {item}</p>)}
          {audit.website.gaps.map((item) => <p key={item} className="text-sm">— {item}</p>)}
        </ReportCard>
      </div>
      <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-card sm:p-5">
        <h3 className="font-semibold">Where you can have more impact</h3>
        <div className="mt-3 space-y-2">
          {audit.opportunities.map((item, index) => (
            <div key={`${item.title}-${index}`} className={`rounded-xl border p-3 ${IMPACT[item.impact] || IMPACT.medium}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{index + 1}. {item.title}</p>
                <span className="text-[10px] font-bold uppercase tracking-wide">{item.impact}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{item.why}</p>
              <p className="mt-1 text-sm">{item.action}</p>
            </div>
          ))}
        </div>
      </div>
      {audit.limitations.length > 0 && (
        <p className="text-xs text-muted-foreground">{audit.limitations.join(" ")}</p>
      )}
    </div>
  );
}

function ReportCard({ title, body, children }: { title: string; body?: string; children?: ReactNode }) {
  return (
    <article className="rounded-2xl border border-border/50 bg-card p-4 shadow-card">
      <h3 className="font-semibold">{title}</h3>
      {body && <p className="mt-2 text-sm leading-relaxed">{body}</p>}
      {children && <div className="mt-2 space-y-1.5">{children}</div>}
    </article>
  );
}
