import type { WidgetType } from "@/hooks/useDashboardLayout";

/** Widget types offered on the kiosk overview scene — excludes "greeting" (addressed to one signed-in person, odd on a shared screen) and "calendar_mini" (the dedicated Calendar scene covers that). */
export const KIOSK_WIDGET_TYPES: WidgetType[] = [
  "today",
  "tasks",
  "households",
  "pets",
  "tattersalls",
  "companies",
  "weight",
  "quick_links",
  "finance",
  "notes",
];
