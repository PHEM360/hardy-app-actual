import type { WidgetType } from "@/hooks/useDashboardLayout";
import { GreetingWidget } from "@/components/widgets/GreetingWidget";
import { TodayWidget } from "@/components/widgets/TodayWidget";
import { TasksWidget } from "@/components/widgets/TasksWidget";
import { CalendarMiniWidget } from "@/components/widgets/CalendarMiniWidget";
import { FinanceWidget } from "@/components/widgets/FinanceWidget";
import { HouseholdsWidget } from "@/components/widgets/HouseholdsWidget";
import { PetsWidget } from "@/components/widgets/PetsWidget";
import { TattersallsWidget } from "@/components/widgets/TattersallsWidget";
import { CompaniesWidget } from "@/components/widgets/CompaniesWidget";
import { WeightWidget } from "@/components/widgets/WeightWidget";
import { QuickLinksWidget } from "@/components/widgets/QuickLinksWidget";
import { NotesWidget } from "@/components/widgets/NotesWidget";

/** Maps a dashboard widget type to its content component — shared by the editable Dashboard grid and the read-only /display kiosk grid. */
export function WidgetContent({ type }: { type: WidgetType }) {
  switch (type) {
    case "greeting":      return <GreetingWidget />;
    case "quick_links":   return <QuickLinksWidget />;
    case "today":         return <TodayWidget />;
    case "tasks":         return <TasksWidget />;
    case "calendar_mini": return <CalendarMiniWidget />;
    case "finance":       return <FinanceWidget />;
    case "households":    return <HouseholdsWidget />;
    case "pets":          return <PetsWidget />;
    case "tattersalls":   return <TattersallsWidget />;
    case "companies":     return <CompaniesWidget />;
    case "weight":        return <WeightWidget />;
    case "notes":         return <NotesWidget />;
    default:              return null;
  }
}
