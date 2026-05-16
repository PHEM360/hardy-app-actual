import { useNavigate } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, isToday, isSameMonth,
} from "date-fns";
import { useCalendar } from "@/hooks/useCalendar";

const CAT_COLORS: Record<string, string> = {
  personal: "#6366f1",
  family:   "#f59e0b",
  work:     "#3b82f6",
  health:   "#10b981",
  social:   "#ec4899",
  other:    "#8b5cf6",
};

export function CalendarMiniWidget() {
  const navigate = useNavigate();
  const { events } = useCalendar();
  const now = new Date();

  const monthStart  = startOfMonth(now);
  const monthEnd    = endOfMonth(now);
  const calStart    = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd      = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days        = eachDayOfInterval({ start: calStart, end: calEnd });

  const eventsForDay = (day: Date) =>
    events.filter((e) => isSameDay(new Date(e.startDate), day));

  return (
    <button
      className="w-full h-full p-3 flex flex-col text-left overflow-hidden"
      onClick={() => navigate("/calendar")}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Calendar</span>
        </div>
        <span className="text-[11px] font-medium text-foreground">{format(now, "MMMM yyyy")}</span>
      </div>

      {/* Week day headers */}
      <div className="grid grid-cols-7 gap-px mb-0.5 flex-shrink-0">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div key={i} className="text-center text-[9px] font-semibold text-muted-foreground py-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-px flex-1 min-h-0">
        {days.map((day, i) => {
          const dayEvents = eventsForDay(day);
          const inMonth = isSameMonth(day, now);
          const isNow = isToday(day);

          return (
            <div
              key={i}
              className={`flex flex-col items-center pt-0.5 rounded-md ${isNow ? "bg-primary/10" : ""} ${!inMonth ? "opacity-30" : ""}`}
            >
              <span
                className={`text-[10px] leading-none font-medium ${
                  isNow ? "text-primary font-bold" : inMonth ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {format(day, "d")}
              </span>
              {/* Event dots */}
              <div className="flex flex-wrap justify-center gap-px mt-0.5">
                {dayEvents.slice(0, 3).map((ev, j) => (
                  <div
                    key={j}
                    className="w-1 h-1 rounded-full"
                    style={{ background: CAT_COLORS[ev.category] ?? "#8b5cf6" }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Upcoming */}
      {(() => {
        const upcoming = events
          .filter((e) => new Date(e.startDate) >= now)
          .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
          .slice(0, 2);
        if (!upcoming.length) return null;
        return (
          <div className="mt-2 space-y-0.5 flex-shrink-0 border-t border-border/40 pt-1.5">
            {upcoming.map((e) => (
              <div key={e.id} className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: CAT_COLORS[e.category] }} />
                <span className="text-[10px] text-foreground truncate flex-1">{e.title}</span>
                <span className="text-[9px] text-muted-foreground flex-shrink-0">
                  {format(new Date(e.startDate), "d MMM")}
                </span>
              </div>
            ))}
          </div>
        );
      })()}
    </button>
  );
}
