import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCompanyBilling, useCompanyWebsiteArticles } from "@/hooks/useCompanyHub";
import { useCompanyMarketing } from "@/hooks/useCompanyMarketing";
import { publishCompanyWebsiteArticle } from "@/lib/companyHubApi";
import type { Company } from "@/types/app";

export function CompanyContentHub({ company, canEdit }: { company: Company; canEdit: boolean }) {
  const navigate = useNavigate();
  const { profile, saveProfile } = useCompanyBilling(company.id);
  const { articles, addArticle } = useCompanyWebsiteArticles(company.id);
  const marketing = useCompanyMarketing(company.id);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const scheduled = marketing.content.filter((piece) => piece.status === "scheduled" || piece.status === "approved");
  const published = marketing.content.filter((piece) => piece.status === "published");

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/50 p-4 shadow-card" style={{ background: `color-mix(in srgb, ${company.color} 12%, hsl(var(--card)))`, borderLeft: `4px solid ${company.color}` }}>
        <p className="font-display font-bold">Content across this brand</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Social posts live in Social & Ads. Articles here can be drafted on Hardy Hub and pushed to the company website when a publish URL is set.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => navigate(`/companies/social?company=${company.id}`)}>Open social calendar</Button>
          {profile.websiteUrl && (
            <a href={/^https?:\/\//i.test(profile.websiteUrl) ? profile.websiteUrl : `https://${profile.websiteUrl}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-semibold">
              <ExternalLink className="h-3.5 w-3.5" /> Website
            </a>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Website URL"><Input value={profile.websiteUrl || ""} onChange={(event) => void saveProfile({ websiteUrl: event.target.value })} placeholder="https://nbfst.co.uk" /></Field>
        <Field label="Website publish webhook"><Input value={profile.websitePublishUrl || ""} onChange={(event) => void saveProfile({ websitePublishUrl: event.target.value })} placeholder="https://site.example/api/hardy-article" /></Field>
      </div>

      {canEdit && (
        <div className="space-y-2 rounded-2xl border border-border/50 bg-card p-4 shadow-card">
          <p className="font-semibold">New article</p>
          <Input placeholder="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
          <Textarea placeholder="Body" value={body} onChange={(event) => setBody(event.target.value)} rows={6} />
          <Button className="rounded-xl bg-gradient-primary" onClick={async () => {
            if (!title.trim()) return;
            const id = await addArticle({ title: title.trim(), body, status: "draft", source: "hardy" });
            setTitle(""); setBody("");
            toast.success("Article saved as a draft");
            if (id && profile.websitePublishUrl) {
              try {
                await publishCompanyWebsiteArticle({ companyId: company.id!, articleId: id });
                toast.success("Sent to the website");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Saved here. Website publish needs the webhook.");
              }
            }
          }}>
            <Plus className="mr-1 h-4 w-4" /> Save article
          </Button>
        </div>
      )}

      <Section title="Website articles" empty="No website articles yet.">
        {articles.map((article) => (
          <div key={article.id} className="rounded-xl border border-border/40 bg-card px-3 py-2.5">
            <p className="font-semibold">{article.title}</p>
            <p className="text-xs text-muted-foreground">{article.status} · {article.source}</p>
          </div>
        ))}
      </Section>

      <Section title="Scheduled social and ads" empty="Nothing scheduled.">
        {scheduled.map((piece) => (
          <div key={piece.id} className="rounded-xl border border-border/40 bg-card px-3 py-2.5">
            <p className="font-semibold">{piece.topic || piece.type}</p>
            <p className="text-xs text-muted-foreground">{piece.platform} · {piece.scheduledFor || piece.status}</p>
          </div>
        ))}
      </Section>

      <Section title="Published social" empty="Nothing published yet.">
        {published.map((piece) => (
          <div key={piece.id} className="rounded-xl border border-border/40 bg-card px-3 py-2.5">
            <p className="font-semibold">{piece.topic || piece.type}</p>
            <p className="text-xs text-muted-foreground">{piece.platform} · {piece.publishedAt || "published"}</p>
          </div>
        ))}
      </Section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1 text-xs font-medium">{label}{children}</label>;
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  const has = items.filter(Boolean).length > 0 && !(Array.isArray(children) && children.length === 0);
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
      {has ? children : <p className="text-sm text-muted-foreground">{empty}</p>}
    </div>
  );
}
