import type { WidgetType } from "@/hooks/useDashboardLayout";

/**
 * One accent colour per dashboard/today widget domain, shared by WidgetShell's
 * identity stripe and each widget's own header icon/stat chips so they always
 * match. Mirrors the hues used in BottomNav's per-route colours.
 */
export const WIDGET_ACCENT: Record<WidgetType, string> = {
  greeting: "hsl(178,55%,36%)",
  quick_links: "hsl(178,55%,36%)",
  today: "hsl(38,92%,50%)",
  tasks: "hsl(260,55%,55%)",
  calendar_mini: "hsl(220,60%,55%)",
  finance: "hsl(25,62%,55%)",
  households: "hsl(30,60%,50%)",
  pets: "hsl(0,65%,50%)",
  tattersalls: "hsl(195,50%,45%)",
  companies: "hsl(210,50%,50%)",
  weight: "hsl(152,55%,40%)",
  notes: "hsl(42,85%,48%)",
};

/** Diagonal gradient (accent -> darker accent) used for widget header bands. */
export function accentGradient(accent: string): string {
  return `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 65%, black))`;
}
