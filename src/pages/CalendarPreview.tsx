import { useMemo, useState } from "react";
import { addDays, startOfWeek } from "date-fns";
import { CalendarDays, LayoutGrid, List, Sun } from "lucide-react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { TimedGrid } from "@/components/calendar/TimedGrid";
import type { CalendarEvent } from "@/types/app";

/**
 * Dev-only, unauthenticated preview of the calendar day/week grid.
 * Routed at /dev/calendar-preview when import.meta.env.DEV is true.
 */
const ANCHOR = new Date(2026, 8, 14, 12);

const SAMPLE: CalendarEvent[] = [
  {
    id: "all-1",
    title: "Mum's birthday",
    category: "birthday",
    startDate: "2026-09-14T00:00:00",
    endDate: "2026-09-14T23:59:00",
    allDay: true,
  },
  {
    id: "timed-1",
    title: "Dentist",
    category: "health",
    startDate: "2026-09-14T09:00:00",
    endDate: "2026-09-14T10:00:00",
  },
  {
    id: "timed-2",
    title: "Parents evening",
    category: "family",
    startDate: "2026-09-15T18:00:00",
    endDate: "2026-09-15T19:00:00",
  },
  {
    id: "timed-3",
    title: "Swim",
    category: "health",
    startDate: "2026-09-16T07:30:00",
    endDate: "2026-09-16T08:15:00",
  },
];

const ACCENTS: Record<string, string> = {
  birthday: "#f43f5e",
  health: "#10b981",
  family: "#f59e0b",
  personal: "#6366f1",
};

export default function CalendarPreview() {
  const [view, setView] = useState<"day" | "week">("week");
  const [selected, setSelected] = useState(ANCHOR);
  const weekDays = useMemo(() => {
    const start = startOfWeek(ANCHOR, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, []);

  return (
    <FeaturePageShell title="Calendar" icon={<CalendarDays className="h-5 w-5" />}>
      <div className="flex min-w-0 gap-3">
        <aside className="w-[3.4rem] shrink-0 sm:w-[11rem]">
          <nav className="space-y-1 rounded-2xl border border-border/50 bg-card p-1.5 shadow-card">
            {([
              { id: "day" as const, label: "Day", icon: Sun },
              { id: "week" as const, label: "Week", icon: CalendarDays },
              { id: "month" as const, label: "Month", icon: LayoutGrid },
              { id: "agenda" as const, label: "Agenda", icon: List },
            ]).map((item) => {
              const Icon = item.icon;
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.id === "day" || item.id === "week") setView(item.id);
                  }}
                  className={`flex w-full items-center gap-2 rounded-xl px-1.5 py-2 text-left sm:px-2 ${
                    active
                      ? "bg-gradient-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-[color-mix(in_srgb,hsl(var(--primary))_12%,transparent)]"
                  }`}
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${active ? "bg-white/15" : "bg-muted"}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="hidden text-xs font-semibold sm:block">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>
        <div className="min-w-0 flex-1 overflow-x-hidden">
          <TimedGrid
            days={view === "day" ? [selected] : weekDays}
            events={SAMPLE}
            selectedDate={selected}
            workDayStartHour={7}
            workDayEndHour={19}
            onSelectDay={(day) => {
              setSelected(day);
              setView("day");
            }}
            onOpenEvent={() => undefined}
            onCreateAt={() => undefined}
            accentFor={(event) => ACCENTS[event.category] || ACCENTS.personal}
          />
        </div>
      </div>
    </FeaturePageShell>
  );
}
