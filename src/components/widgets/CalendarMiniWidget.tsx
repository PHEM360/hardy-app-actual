import { useNavigate } from "react-router-dom";
import { CalendarDays, ChevronRight } from "lucide-react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, isToday, isSameMonth,
} from "date-fns";
import { useCalendar } from "@/hooks/useCalendar";
import { WIDGET_ACCENT, accentGradient } from "@/lib/widgetAccents";

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
  const accent = WIDGET_ACCENT.calendar_mini;

  const monthStart  = startOfMonth(now);
  const monthEnd    = endOfMonth(now);
  const calStart    = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd      = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days        = eachDayOfInterval({ start: calStart, end: calEnd });

  const eventsForDay = (day: Date) =>
    events.filter((e) => isSameDay(new Date(e.startDate), day));

  return (
    <button
      className="w-full h-full p-3 pb-3.5 flex flex-col text-left overflow-y-auto group"
      onClick={() => navigate("/calendar")}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between mb-2 -mx-3 -mt-3 px-3 py-2.5 flex-shrink-0"
        style={{ background: accentGradient(accent) }}
      >
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-white/20 flex-shrink-0 text-white">
            <CalendarDays className="w-3.5 h-3.5" />
          </span>
          <span className="text-[11px] font-bold text-white uppercase tracking-wider">Calendar</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-semibold text-white/90">{format(now, "MMMM yyyy")}</span>
          <ChevronRight className="w-3 h-3 text-white/50 group-hover:text-white/80 group-hover:translate-x-0.5 transition-all" />
        </div>
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
            <div key={i} className={`flex flex-col items-center pt-0.5 ${!inMonth ? "opacity-30" : ""}`}>
              <span
                className={`flex items-center justify-center w-4 h-4 text-[10px] leading-none font-medium rounded-full ${
                  isNow ? "text-white font-bold" : inMonth ? "text-foreground" : "text-muted-foreground"
                }`}
                style={isNow ? { background: accent } : undefined}
              >
                {format(day, "d")}
              </span>
              {/* Event dots */}
              <div className="flex items-center justify-center gap-0.5 mt-1 h-1.5">
                {dayEvents.slice(0, 3).map((ev, j) => (
                  <div
                    key={j}
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
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
