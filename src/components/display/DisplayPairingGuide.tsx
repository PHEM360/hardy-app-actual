import { Check, Copy, ExternalLink, MonitorSmartphone, Smartphone, Wifi } from "lucide-react";
import { useState } from "react";
import { APP_BASE_URL } from "@/lib/appUrl";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const DISPLAY_RECEIVER_PATH = "/display";

export function displayReceiverUrl() {
  return `${APP_BASE_URL.replace(/\/$/, "")}${DISPLAY_RECEIVER_PATH}`;
}

export function displayReceiverHost() {
  return displayReceiverUrl().replace(/^https?:\/\//, "");
}

const STEPS = [
  { title: "On the screen itself", body: "Open a browser on the tablet, TV or Pi and go to" },
  { title: "Scan its QR code", body: "Use the phone you are already signed in on. No password is typed on the screen." },
  { title: "Approve it", body: "Tap approve on your phone. The screen starts showing the pages you build here." },
];

export function DisplayPairingGuide({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const host = displayReceiverHost();
  const url = displayReceiverUrl();

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Display link copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy the link");
    }
  };

  return (
    <div className={`overflow-hidden rounded-3xl border border-primary/25 shadow-card ${compact ? "" : ""}`}>
      <div className="flex flex-wrap items-center gap-3 bg-gradient-primary px-4 py-3 text-primary-foreground">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/20">
          <Wifi className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-bold leading-tight">
            {compact ? "Link another screen" : "Link a screen in three steps"}
          </h2>
          <p className="text-xs text-primary-foreground/80">Any device with a browser can become an always-on display.</p>
        </div>
      </div>
      <div
        className="space-y-3 p-3"
        style={{ background: "color-mix(in srgb, hsl(198,60%,46%) 10%, hsl(var(--card)))" }}
      >
        <ol className={`grid gap-2.5 ${compact ? "" : "sm:grid-cols-3"}`}>
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-2xl border border-primary/15 bg-card p-3 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-sm font-bold text-primary-foreground">
                  {index + 1}
                </span>
                <p className="text-sm font-bold">{step.title}</p>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {step.body}
                {index === 0 && (
                  <>
                    {" "}
                    <code className="rounded-md bg-primary/12 px-1.5 py-0.5 font-bold text-primary">{host}</code>
                  </>
                )}
              </p>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="rounded-xl bg-gradient-primary" asChild>
            <a href={DISPLAY_RECEIVER_PATH} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" /> Open receiver
            </a>
          </Button>
          <Button size="sm" variant="outline" className="rounded-xl" type="button" onClick={() => void copyLink()}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy display link"}
          </Button>
        </div>
        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
          <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          Pairing is account-bound. Only a signed-in family member can approve a screen, and each QR code works once.
        </p>
      </div>
    </div>
  );
}

export function DisplayEmptyState({ onShowGuide }: { onShowGuide?: () => void }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-card">
      <div
        className="relative px-6 py-10 text-center"
        style={{ background: "color-mix(in srgb, hsl(198,60%,46%) 14%, hsl(var(--card)))" }}
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-primary text-primary-foreground shadow-glow">
          <MonitorSmartphone className="h-8 w-8" />
        </div>
        <p className="mt-4 font-display text-xl font-bold">Link your first screen</p>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
          A tablet on the kitchen counter, a TV in the hallway, or a Pi in a frame — they all show the same family pages.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button className="rounded-xl bg-gradient-primary" asChild>
            <a href={DISPLAY_RECEIVER_PATH} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" /> Open the display website
            </a>
          </Button>
          {onShowGuide && (
            <Button variant="outline" className="rounded-xl" type="button" onClick={onShowGuide}>
              How it works
            </Button>
          )}
        </div>
      </div>
      <div className="p-3">
        <DisplayPairingGuide />
      </div>
    </div>
  );
}
