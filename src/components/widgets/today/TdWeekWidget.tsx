import { addDays, format, startOfWeek } from "date-fns";
import { useCalendar } from "@/hooks/useCalendar";
import { eventsOnDay } from "@/lib/todayInsights";
import { TdHead } from "./TdHead";

export function TdWeekWidget() {
  const { events } = useCalendar();
  const start = startOfWeek(new Date(), { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  return (
    <div className="h-full flex flex-col p-3">
      <TdHead emoji="🗓️" title="This week" />
      <div className="grid grid-cols-7 gap-1 flex-1 min-h-0">
        {days.map((day) => {
          const count = eventsOnDay(events, day).length;
          const today = format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
          return (
            <div key={day.toISOString()} className={`rounded-xl border px-1 py-1.5 text-center ${today ? "border-primary bg-primary/10" : "border-border/50 bg-background/50"}`}>
              <p className="text-[9px] font-semibold text-muted-foreground">{format(day, "EEEEE")}</p>
              <p className="text-xs font-bold">{format(day, "d")}</p>
              <p className="text-[9px] text-muted-foreground">{count || "·"}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
