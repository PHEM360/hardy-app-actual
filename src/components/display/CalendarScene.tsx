import { useMemo } from "react";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import type { HouseholdCalendarEvent } from "@/hooks/useHouseholdCalendar";

const CATEGORY_EMOJI: Record<string, string> = {
  personal: "🙂",
  family: "👨‍👩‍👧‍👦",
  work: "💼",
  health: "💊",
  social: "🎉",
  other: "📌",
};

function dayLabel(dateStr: string): string {
  const d = parseISO(dateStr);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "EEEE d MMMM");
}

export function CalendarScene({ events, loading, error }: { events: HouseholdCalendarEvent[]; loading: boolean; error: string | null }) {
  const grouped = useMemo(() => {
    const now = new Date();
    const upcoming = events.filter((e) => parseISO(e.endDate || e.startDate) >= now);
    const groups = new Map<string, HouseholdCalendarEvent[]>();
    for (const event of upcoming) {
      const key = format(parseISO(event.startDate), "yyyy-MM-dd");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(event);
    }
    return Array.from(groups.entries()).slice(0, 8);
  }, [events]);

  return (
    <div className="absolute inset-0 bg-zinc-950 px-10 py-10 flex flex-col">
      <div className="flex items-center gap-3 mb-8 flex-shrink-0">
        <CalendarDays className="w-7 h-7 text-white/70" />
        <h1 className="text-3xl font-display font-bold text-white">What's coming up</h1>
      </div>

      {loading && <p className="text-white/50">Loading calendar…</p>}
      {!loading && error && <p className="text-white/50">{error}</p>}
      {!loading && !error && grouped.length === 0 && (
        <p className="text-white/50">Nothing on the calendar for the next few weeks.</p>
      )}

      <div className="flex-1 min-h-0 overflow-hidden grid grid-cols-2 gap-x-12 gap-y-6 content-start">
        {grouped.map(([dateKey, dayEvents]) => (
          <div key={dateKey}>
            <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">
              {dayLabel(dayEvents[0].startDate)}
            </p>
            <div className="space-y-2.5">
              {dayEvents.map((event) => (
                <div key={event.id} className="flex items-start gap-3">
                  <span className="text-lg leading-none mt-0.5">{CATEGORY_EMOJI[event.category] || "📌"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-base font-medium truncate">{event.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: event.ownerColor }}
                      />
                      <span className="text-white/50 text-xs">
                        {event.allDay ? "All day" : format(parseISO(event.startDate), "h:mm a")} · {event.ownerName}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
