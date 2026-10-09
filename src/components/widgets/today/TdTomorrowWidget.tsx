import { addDays, format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useCalendar } from "@/hooks/useCalendar";
import { useTasks } from "@/hooks/useTasks";
import { dueOnDay, eventsOnDay } from "@/lib/todayInsights";
import { TdHead } from "./TdHead";

export function TdTomorrowWidget() {
  const navigate = useNavigate();
  const { events } = useCalendar();
  const { tasks } = useTasks();
  const tomorrow = addDays(new Date(), 1);
  const cal = eventsOnDay(events, tomorrow).slice(0, 4);
  const due = dueOnDay(tasks, tomorrow).slice(0, 4);

  return (
    <div className="h-full flex flex-col p-3">
      <TdHead emoji="🌤️" title="Tomorrow" />
      <p className="text-[10px] text-muted-foreground mb-2 flex-shrink-0">{format(tomorrow, "EEEE d MMMM")}</p>
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
        {cal.length === 0 && due.length === 0 && <p className="text-xs text-muted-foreground">A quiet day ahead.</p>}
        {cal.map((event) => (
          <button
            key={event.id}
            type="button"
            onClick={() => navigate("/calendar")}
            className="block w-full truncate text-left text-xs"
          >
            📅 {event.title}
            {event.source === "birthday" ? " · schedule a message" : ""}
          </button>
        ))}
        {due.map((task) => (
          <p key={task.id} className="text-xs truncate">✅ {task.title}</p>
        ))}
      </div>
    </div>
  );
}
