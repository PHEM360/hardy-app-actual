import { format } from "date-fns";
import { usePets } from "@/hooks/usePets";
import { useCalendar } from "@/hooks/useCalendar";
import { upcomingBirthdays } from "@/lib/todayInsights";
import { TdHead } from "./TdHead";

export function TdBirthdaysWidget() {
  const { pets } = usePets();
  const { events } = useCalendar();
  const items = upcomingBirthdays({ pets, events, withinDays: 14 });

  return (
    <div className="h-full flex flex-col p-3">
      <TdHead emoji="🎂" title="Birthdays" />
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
        {items.length === 0 && <p className="text-xs text-muted-foreground">No birthdays in the next 2 weeks.</p>}
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl bg-background/60 border border-border/40 px-2.5 py-1.5">
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{item.name}</p>
              <p className="text-[10px] text-muted-foreground">{item.kind === "pet" ? "Pet" : "Calendar"}</p>
            </div>
            <span className="text-[10px] font-semibold text-primary flex-shrink-0">
              {item.days === 0 ? "Today" : item.days === 1 ? "Tomorrow" : format(item.date, "d MMM")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
