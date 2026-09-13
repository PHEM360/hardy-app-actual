import { FileText, Home, StickyNote, Video } from "lucide-react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import BottomNav from "@/components/layout/BottomNav";
import NotesSection from "@/components/household/NotesSection";
import { DEFAULT_NOTE_TYPES, type HouseholdNote } from "@/types/app";

/**
 * Dev-only preview of household Notes + mobile chrome (bottom nav).
 * Routed at /dev/household-notes-preview when import.meta.env.DEV.
 */
const SAMPLE_NOTES: HouseholdNote[] = [
  {
    id: "n1",
    title: "Boiler & hot water",
    body: "Combi boiler in the utility cupboard. Reset switch under the front panel. Service due each March — last done by HeatRight.",
    noteType: "Utilities",
    pinned: true,
    updatedAt: "2026-09-01T10:00:00.000Z",
  },
  {
    id: "n2",
    title: "Bin day",
    body: "Black bins Monday. Recycling (green) alternate Mondays. Food caddy weekly — bags under the sink.",
    noteType: "General",
    updatedAt: "2026-08-20T09:00:00.000Z",
  },
  {
    id: "n3",
    title: "Spare keys",
    body: "Front door spare with next-door (No. 14, Sarah). Window lock key in kitchen drawer by the toaster.",
    noteType: "Keys & Access",
    updatedAt: "2026-07-12T18:00:00.000Z",
  },
];

const HH_ACCENT = "hsl(30,60%,50%)";
const TABS = [
  { id: "items", label: "Items", icon: Home },
  { id: "cameras", label: "Cameras", icon: Video },
  { id: "documents", label: "Docs", icon: FileText },
  { id: "notes", label: "Notes", icon: StickyNote },
] as const;

export default function HouseholdNotesPreview() {
  return (
    <div className="min-h-[100dvh] bg-background pb-[calc(4rem+env(safe-area-inset-bottom,0px))]">
      <FeaturePageShell title="Ash Grove" subtitle="Shared with everyone in this household">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div />
          <p className="text-xs text-muted-foreground">Dev preview · Notes tab</p>
        </div>
        <div className="flex min-w-0 gap-2 sm:gap-3">
          <aside className="w-12 shrink-0 sm:w-[10.75rem]">
            <div
              className="sticky top-2 space-y-1 rounded-2xl border border-border/40 p-1 shadow-card sm:p-1.5"
              style={{ background: `color-mix(in srgb, ${HH_ACCENT} 12%, hsl(var(--card)))` }}
            >
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const active = tab.id === "notes";
                return (
                  <button
                    key={tab.id}
                    type="button"
                    title={tab.label}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-xs font-semibold sm:justify-start sm:px-2.5 sm:py-2 ${
                      active ? "bg-gradient-primary text-primary-foreground shadow-sm" : "text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden truncate sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </aside>
          <div className="min-w-0 flex-1 overflow-x-hidden">
            <NotesSection
              preview={{
                householdName: "Ash Grove",
                notes: SAMPLE_NOTES,
                noteTypes: DEFAULT_NOTE_TYPES,
              }}
            />
          </div>
        </div>
      </FeaturePageShell>
      <BottomNav />
    </div>
  );
}
