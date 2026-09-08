import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, HelpCircle, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { generateMarketingAudit } from "@/lib/marketingApi";
import { SOCIAL_PLATFORMS, SOCIAL_PLATFORM_LABELS } from "@/lib/socialPlatforms";
import type { useCompanyMarketing } from "@/hooks/useCompanyMarketing";

const ACCENT = "hsl(210,50%,50%)";

/** True once the profile has any real signal in it — otherwise this company has never been set up. */
export function needsMarketingOnboarding(profile: ReturnType<typeof useCompanyMarketing>["profile"]): boolean {
  if (profile.onboardedAt) return false;
  const hasSocial = Object.values(profile.socialUrls || {}).some((value) => (value || "").trim().length > 0);
  const hasWebsite = (profile.website || "").trim().length > 0;
  const hasPr = (profile.prStrategy || "").trim().length > 0;
  const hasSpend = (profile.marketingSpendSummary || "").trim().length > 0;
  const hasBrand = (profile.brandVoice || "").trim().length >= 3;
  return !hasSocial && !hasWebsite && !hasPr && !hasSpend && !hasBrand;
}

/** A small "?" button that explains the feature in plain English — safe for anyone with page access to read. */
export function MarketingHelpButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="How this page works"
        aria-label="How this page works"
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/50 bg-card text-muted-foreground shadow-card transition-colors hover:text-foreground"
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">How Social & Ads works</DialogTitle>
          </DialogHeader>
          <ol className="space-y-3 text-sm">
            <li><strong>1. Set up a company.</strong> Tell it the company's website, social media links, general PR approach, and roughly what's been spent on marketing so far.</li>
            <li><strong>2. AI suggests a starting point.</strong> It reads that plus anything public on the website, then suggests a brand voice, target audience and key messages — a first draft, not a final answer.</li>
            <li><strong>3. You review and edit.</strong> Anything AI suggested is clearly marked so you know what to check. Change anything that doesn't sound right.</li>
            <li><strong>4. Generate a content plan.</strong> Once the brand guidance looks right, AI can write a batch of draft posts to that voice and schedule.</li>
            <li><strong>5. You approve before anything goes out.</strong> Drafts wait in the Queue for your sign-off, unless you turn approval off for a company you're happy to let auto-post.</li>
            <li><strong>6. Connect accounts to publish directly.</strong> Under Accounts, link real social profiles to allow posting. Without a connection, you can still plan and export content by hand.</li>
          </ol>
          <p className="text-xs text-muted-foreground">
            Nothing is posted, spent, or shared publicly without a real account connection and, by default, your approval first.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}

type Step = "website" | "social" | "pr" | "spend" | "finish";
const STEPS: Step[] = ["website", "social", "pr", "spend", "finish"];
const STEP_TITLES: Record<Step, string> = {
  website: "Website",
  social: "Social platforms",
  pr: "PR / marketing strategy",
  spend: "Marketing spend so far",
  finish: "All set",
};

function MarketingOnboardingWizard({
  state,
  company,
  companyId,
  onClose,
}: {
  state: ReturnType<typeof useCompanyMarketing>;
  company?: { name: string; contact?: { website?: string } };
  companyId: string;
  onClose: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [website, setWebsite] = useState(state.profile.website || company?.contact?.website || "");
  const [socialUrls, setSocialUrls] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(state.profile.socialUrls || {}).map(([k, v]) => [k, v || ""])),
  );
  const [prStrategy, setPrStrategy] = useState(state.profile.prStrategy || "");
  const [marketingSpendSummary, setMarketingSpendSummary] = useState(state.profile.marketingSpendSummary || "");
  const [saving, setSaving] = useState(false);

  const step = STEPS[stepIndex];
  const hasAnySignal = Boolean(
    website.trim() || Object.values(socialUrls).some((v) => v.trim()) || prStrategy.trim() || marketingSpendSummary.trim(),
  );

  const persist = async (extra: { onboardedAt?: Date } = {}) => {
    const cleanedSocial = Object.fromEntries(
      Object.entries(socialUrls).filter(([, value]) => value.trim().length > 0),
    );
    await state.saveProfile({
      ...state.profile,
      website: website.trim() || state.profile.website,
      socialUrls: { ...state.profile.socialUrls, ...cleanedSocial },
      prStrategy: prStrategy.trim(),
      marketingSpendSummary: marketingSpendSummary.trim(),
      ...extra,
    });
    return cleanedSocial;
  };

  const finishWithoutAi = async () => {
    setSaving(true);
    try {
      await persist({ onboardedAt: new Date() });
      toast.success("Saved. Fill in Brand voice and Audience yourself whenever you're ready.");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save that");
    } finally {
      setSaving(false);
    }
  };

  const finishWithAi = async () => {
    setSaving(true);
    try {
      const cleanedSocial = await persist({ onboardedAt: new Date() });
      try {
        const result = await generateMarketingAudit(companyId, {
          extraUrls: Object.values(cleanedSocial).join("\n"),
          searchNotes: "",
          adsNotes: "",
          socialNotes: "",
          otherNotes: "",
        });
        toast.success(result.headline || "Set up — check the Brand tab for AI's suggested voice and audience.");
      } catch (auditError) {
        toast.message("Saved. AI could not infer the rest yet — fill in Brand voice and Audience yourself, or try a Presence scan later.");
      }
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save that");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Let's get {company?.name || "this company"} set up</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className="h-1.5 flex-1 rounded-full"
              style={{ backgroundColor: i <= stepIndex ? ACCENT : "hsl(var(--muted))" }}
            />
          ))}
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Step {stepIndex + 1} of {STEPS.length} · {STEP_TITLES[step]}
        </p>

        {step === "website" && (
          <div className="space-y-1.5">
            <Label>Company website</Label>
            <Input value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="https://…" />
            <p className="text-xs text-muted-foreground">Optional, but AI can read this to suggest a brand voice. Skip if there isn't one yet.</p>
          </div>
        )}

        {step === "social" && (
          <div className="space-y-1.5">
            <Label>Social media platforms</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {SOCIAL_PLATFORMS.map((item) => (
                <Input
                  key={item}
                  value={socialUrls[item] ?? ""}
                  onChange={(event) => setSocialUrls((current) => ({ ...current, [item]: event.target.value }))}
                  placeholder={`${SOCIAL_PLATFORM_LABELS[item]} URL or @handle`}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Paste whichever apply. Leave the rest blank.</p>
          </div>
        )}

        {step === "pr" && (
          <div className="space-y-1.5">
            <Label>General PR / marketing strategy</Label>
            <Textarea
              rows={4}
              value={prStrategy}
              onChange={(event) => setPrStrategy(event.target.value)}
              placeholder="e.g. mostly word of mouth plus Instagram, run by the owner, occasional local paper coverage…"
            />
            <p className="text-xs text-muted-foreground">Whatever you've got, in your own words — this feeds straight into AI's suggestions.</p>
          </div>
        )}

        {step === "spend" && (
          <div className="space-y-1.5">
            <Label>Marketing spend so far</Label>
            <Textarea
              rows={3}
              value={marketingSpendSummary}
              onChange={(event) => setMarketingSpendSummary(event.target.value)}
              placeholder="e.g. ~£300/month on Instagram ads, one-off £1,500 for a rebrand last year"
            />
            <p className="text-xs text-muted-foreground">Rough figures are fine.</p>
          </div>
        )}

        {step === "finish" && (
          <div className="space-y-3">
            <p className="text-sm">
              That's everything. Want AI to suggest a brand voice, audience and key messages from what you've just given it?
            </p>
            {!hasAnySignal && (
              <p className="rounded-xl bg-amber-500/15 p-2.5 text-xs text-amber-700 dark:text-amber-300">
                You didn't add a website, social link, or notes — AI won't have much to go on. You can still save and fill in Brand guidance yourself.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button disabled={saving || !hasAnySignal} onClick={() => void finishWithAi()}>
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
                Yes, suggest my brand guidance
              </Button>
              <Button variant="outline" disabled={saving} onClick={() => void finishWithoutAi()}>
                No, I'll fill it in myself
              </Button>
            </div>
          </div>
        )}

        {step !== "finish" && (
          <div className="flex justify-between pt-1">
            <Button
              type="button"
              variant="ghost"
              disabled={stepIndex === 0}
              onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <Button type="button" onClick={() => setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))}>
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Page-level "let's get this company set up" prompt for Social & Ads. Shows a
 * banner (any tab) the first time a company's marketing profile is untouched,
 * and opens a short step-by-step wizard to gather the essentials before AI
 * suggests brand guidance from them.
 */
export function MarketingOnboarding({
  state,
  company,
  companyId,
}: {
  state: ReturnType<typeof useCompanyMarketing>;
  company?: { name: string; contact?: { website?: string } };
  companyId?: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  useEffect(() => setDismissed(false), [companyId]);

  if (!companyId || dismissed || !needsMarketingOnboarding(state.profile)) return null;

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/40 p-4 shadow-card"
      style={{ background: `color-mix(in srgb, ${ACCENT} 10%, hsl(var(--card)))`, borderLeftWidth: 4, borderLeftColor: ACCENT }}
    >
      <div>
        <p className="font-display text-base font-bold">Let's get {company?.name || "this company"} set up</p>
        <p className="text-sm text-muted-foreground">A few quick questions, then AI suggests the brand basics for you to check.</p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setDismissed(true)}>Not now</Button>
        <Button size="sm" onClick={() => setWizardOpen(true)}>Start setup</Button>
      </div>
      {wizardOpen && (
        <MarketingOnboardingWizard state={state} company={company} companyId={companyId} onClose={() => setWizardOpen(false)} />
      )}
    </div>
  );
}
