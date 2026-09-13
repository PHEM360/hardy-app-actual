import { useState } from "react";
import {
  CalendarDays, ClipboardCheck, ImagePlus, LayoutDashboard, Link2,
  Megaphone, Radar, Settings2, Sparkles,
} from "lucide-react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import BottomNav from "@/components/layout/BottomNav";
import { SOCIAL_PLATFORMS, SOCIAL_PLATFORM_LABELS } from "@/lib/socialPlatforms";

/**
 * Dev-only mobile layout preview for Social & Ads (narrow rail + selects).
 * Routed at /dev/social-mobile-preview when import.meta.env.DEV.
 */
const ACCENT = "hsl(210,50%,50%)";
const SECTIONS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "queue", label: "Queue", icon: ClipboardCheck },
  { id: "generate", label: "Generate", icon: Sparkles },
  { id: "brand", label: "Brand", icon: Settings2 },
  { id: "media", label: "Media", icon: ImagePlus },
  { id: "presence", label: "Presence", icon: Radar },
  { id: "connections", label: "Accounts", icon: Link2 },
] as const;

export default function SocialMobilePreview() {
  const [section, setSection] = useState<(typeof SECTIONS)[number]["id"]>("dashboard");
  const [companyId, setCompanyId] = useState("all");
  const [platform, setPlatform] = useState("all");

  return (
    <div className="min-h-[100dvh] bg-background pb-[calc(4rem+env(safe-area-inset-bottom,0px))]">
      <FeaturePageShell
        title="Social & Ads"
        subtitle="Every company’s posts, brand and calendar in one place"
        icon={<Megaphone className="h-5 w-5" />}
      >
        <div className="flex min-w-0 gap-2 sm:gap-3">
          <aside className="w-12 shrink-0 sm:w-[10.75rem]">
            <div
              className="sticky top-2 max-h-[calc(100dvh-8rem)] space-y-1 overflow-y-auto rounded-2xl border border-border/40 p-1 shadow-card sm:p-1.5"
              style={{ background: `color-mix(in srgb, ${ACCENT} 12%, hsl(var(--card)))` }}
            >
              {SECTIONS.map((item) => {
                const Icon = item.icon;
                const active = section === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={item.label}
                    aria-label={item.label}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-xs font-semibold sm:justify-start sm:px-2.5 sm:py-2 ${
                      active ? "bg-gradient-primary text-primary-foreground shadow-sm" : "text-foreground hover:bg-card"
                    }`}
                    onClick={() => setSection(item.id)}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden truncate sm:inline">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="min-w-0 flex-1 space-y-3 overflow-x-hidden">
            <div className="rounded-2xl border border-border/40 bg-card p-3 shadow-card">
              <div className="space-y-3 sm:hidden">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Company</p>
                  <select
                    className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm"
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                  >
                    <option value="all">All companies</option>
                    <option value="c1">🌿 Greenfield Consulting</option>
                    <option value="c2">🏠 Hardy Homes</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Platform</p>
                  <select
                    className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm"
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                  >
                    <option value="all">All platforms</option>
                    {SOCIAL_PLATFORMS.map((item) => (
                      <option key={item} value={item}>{SOCIAL_PLATFORM_LABELS[item]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="hidden sm:block">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Company</p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-xl border border-primary/50 bg-gradient-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground">All companies</span>
                  <span className="rounded-xl border border-border/50 bg-card px-2.5 py-1.5 text-xs font-semibold">🌿 Greenfield</span>
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              {[
                ["In the queue", "3", "Waiting for you"],
                ["Scheduled", "12", "Ready to go out"],
                ["Published", "48", "2 companies"],
              ].map(([label, value, hint]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-border/40 p-4 shadow-card"
                  style={{ background: `color-mix(in srgb, ${ACCENT} 10%, hsl(var(--card)))`, borderLeftWidth: 4, borderLeftColor: ACCENT }}
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                  <p className="mt-1 font-display text-3xl font-bold">{value}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </FeaturePageShell>
      <BottomNav />
    </div>
  );
}
