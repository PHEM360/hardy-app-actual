import { useParams, useNavigate } from "react-router-dom";
import { CalendarMiniWidget } from "@/components/widgets/CalendarMiniWidget";
import { TasksWidget } from "@/components/widgets/TasksWidget";
import { NotesWidget } from "@/components/widgets/NotesWidget";

const TITLES: Record<string, string> = {
  calendar: "Calendar",
  tasks: "Tasks",
  notes: "Notes",
};

export default function HubWidget() {
  const { kind = "notes" } = useParams();
  const navigate = useNavigate();
  const title = TITLES[kind] ?? "Hardy Hub";

  return (
    <div className="min-h-[100dvh] bg-[#0f1923] px-3 py-4 text-white">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/60">{title} widget</p>
        <button type="button" className="text-xs text-white/70" onClick={() => navigate(kind === "notes" ? "/notes" : `/${kind}`)}>
          Open full page
        </button>
      </div>
      <div className="overflow-hidden rounded-3xl bg-card text-card-foreground shadow-elevated min-h-[280px]">
        {kind === "calendar" && <CalendarMiniWidget />}
        {kind === "tasks" && <TasksWidget />}
        {kind === "notes" && <NotesWidget />}
        {!["calendar", "tasks", "notes"].includes(kind) && (
          <p className="p-6 text-sm text-muted-foreground">Unknown widget.</p>
        )}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-white/50">
        Add this page to your home screen for a glanceable tile. Native phone widgets for websites are limited — this is the closest Hardy Hub can offer as a web app.
      </p>
    </div>
  );
}
