import { format, isSameDay, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/types/app";
import {
  eventOverlapsDay,
  formatHourLabel,
  hourRange,
  isAllDayEvent,
  timedPlacement,
  workHours,
} from "@/lib/calendarLayout";

const HOUR_PX = 48;

type Props = {
  days: Date[];
  events: CalendarEvent[];
  selectedDate: Date;
  workDayStartHour?: number;
  workDayEndHour?: number;
  onSelectDay: (day: Date) => void;
  onOpenEvent: (event: CalendarEvent) => void;
  onCreateAt: (day: Date, hour: number) => void;
  accentFor: (event: CalendarEvent) => string;
};

export function TimedGrid({
  days,
  events,
  selectedDate,
  workDayStartHour,
  workDayEndHour,
  onSelectDay,
  onOpenEvent,
  onCreateAt,
  accentFor,
}: Props) {
  const { start, end } = workHours(workDayStartHour, workDayEndHour);
  const hours = hourRange(start, end);
  const gridH = Math.max(hours.length, 1) * HOUR_PX;
  const allDayByDay = days.map((day) => events.filter((event) => isAllDayEvent(event) && eventOverlapsDay(event, day)));
  const timedByDay = days.map((day) => events.filter((event) => !isAllDayEvent(event) && eventOverlapsDay(event, day)));

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card">
      <div
        className="grid border-b border-border/50"
        style={{ gridTemplateColumns: `3.25rem repeat(${days.length}, minmax(0, 1fr))` }}
      >
        <div className="bg-[color-mix(in_oklab,hsl(var(--primary))_10%,hsl(var(--card)))] px-0.5 py-2 text-center text-[9px] font-semibold uppercase leading-tight tracking-wide text-foreground">
          All-day
        </div>
        {days.map((day, i) => {
          const selected = isSameDay(day, selectedDate);
          const today = isToday(day);
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDay(day)}
              className={cn(
                "min-w-0 border-l border-border/40 px-1.5 py-2 text-left",
                selected && "bg-[color-mix(in_oklab,hsl(var(--primary))_16%,hsl(var(--card)))]",
                today && !selected && "bg-[color-mix(in_oklab,hsl(var(--primary))_8%,hsl(var(--card)))]",
              )}
            >
              <div className="truncate text-[11px] font-semibold text-foreground">
                {format(day, days.length === 1 ? "EEEE" : "EEE")}
              </div>
              <div className={cn("font-display text-lg leading-none", (selected || today) && "text-primary")}>
                {format(day, "d")}
              </div>
              <div className="mt-1 flex min-w-0 flex-col gap-1">
                {allDayByDay[i].slice(0, 4).map((event) => (
                  <button
                    key={event.id || `${event.title}-${event.startDate}`}
                    type="button"
                    onClick={(click) => {
                      click.stopPropagation();
                      onOpenEvent(event);
                    }}
                    className="truncate rounded-md px-1.5 py-0.5 text-left text-[10px] font-medium text-white"
                    style={{ background: accentFor(event) }}
                  >
                    {event.title}
                  </button>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <div className="max-h-[min(70vh,40rem)] overflow-y-auto">
        <div
          className="grid"
          style={{ gridTemplateColumns: `3.25rem repeat(${days.length}, minmax(0, 1fr))` }}
        >
          <div className="relative" style={{ height: gridH }}>
            {hours.map((hour, index) => (
              <div
                key={hour}
                className="absolute right-1 -translate-y-2 text-[10px] tabular-nums text-foreground/70"
                style={{ top: index * HOUR_PX }}
              >
                {formatHourLabel(hour)}
              </div>
            ))}
          </div>
          {days.map((day, dayIndex) => (
            <div
              key={day.toISOString()}
              className="relative border-l border-border/40"
              style={{ height: gridH }}
            >
              {hours.map((hour, index) => (
                <button
                  key={hour}
                  type="button"
                  aria-label={`Add event at ${formatHourLabel(hour)} on ${format(day, "d MMMM")}`}
                  className="absolute inset-x-0 border-t border-border/30 hover:bg-[color-mix(in_oklab,hsl(var(--primary))_8%,transparent)]"
                  style={{ top: index * HOUR_PX, height: HOUR_PX }}
                  onClick={() => onCreateAt(day, hour)}
                />
              ))}
              {timedByDay[dayIndex].map((event) => {
                const place = timedPlacement(event, day, start, end);
                if (!place) return null;
                return (
                  <button
                    key={event.id || `${event.title}-${event.startDate}`}
                    type="button"
                    onClick={() => onOpenEvent(event)}
                    className="absolute inset-x-1 z-[1] overflow-hidden rounded-md px-1.5 py-1 text-left text-[11px] font-medium leading-tight text-white shadow-sm"
                    style={{
                      top: `${place.topPct}%`,
                      height: `${place.heightPct}%`,
                      background: accentFor(event),
                    }}
                  >
                    <span className="block truncate">{event.title}</span>
                    {!event.allDay && (
                      <span className="block text-[10px] text-white/85">
                        {format(new Date(event.startDate), "H:mm")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
