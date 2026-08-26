import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { format, isToday } from "date-fns";
import { useCalendar } from "@/hooks/useCalendar";
import { eventsOnDay } from "@/lib/todayInsights";
import { TdHead } from "./TdHead";

export function TdCalendarWidget() {
  const navigate = useNavigate();
  const { events, loading } = useCalendar();
  const today = new Date();
  const todays = eventsOnDay(events, today).slice(0, 6);

  return (
    <div className="h-full flex flex-col p-3">
      <TdHead
        emoji="📅"
        title="Today's calendar"
        action={
          <button type="button" onClick={() => navigate("/calendar")} className="text-[11px] text-primary font-medium flex items-center gap-0.5">
            All <ChevronRight className="w-3 h-3" />
          </button>
        }
      />
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
        {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {!loading && todays.length === 0 && <p className="text-xs text-muted-foreground">Nothing on the calendar today.</p>}
        {todays.map((event) => (
          <div key={event.id} className="rounded-xl bg-background/60 border border-border/40 px-2.5 py-1.5">
            <p className="text-xs font-medium truncate">{event.title}</p>
            <p className="text-[10px] text-muted-foreground">
              {event.allDay ? "All day" : format(new Date(event.startDate), "HH:mm")}
              {isToday(new Date(event.startDate)) && event.location ? ` · ${event.location}` : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
