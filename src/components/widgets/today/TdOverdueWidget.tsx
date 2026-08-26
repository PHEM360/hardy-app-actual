import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useTasks } from "@/hooks/useTasks";
import { overdueByDueDate } from "@/lib/todayInsights";
import { TdHead } from "./TdHead";

export function TdOverdueWidget() {
  const navigate = useNavigate();
  const { tasks, loading } = useTasks();
  const overdue = overdueByDueDate(tasks).slice(0, 8);

  return (
    <div className="h-full flex flex-col p-3">
      <TdHead
        emoji="⏰"
        title="Overdue"
        action={
          <button type="button" onClick={() => navigate("/tasks")} className="text-[11px] text-primary font-medium flex items-center gap-0.5">
            Tasks <ChevronRight className="w-3 h-3" />
          </button>
        }
      />
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
        {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {!loading && overdue.length === 0 && <p className="text-xs text-muted-foreground">Nothing overdue. Nice.</p>}
        {overdue.map((task) => (
          <div key={task.id} className="flex items-center justify-between gap-2 rounded-xl bg-background/60 border border-border/40 px-2.5 py-1.5">
            <p className="text-xs font-medium truncate">{task.title}</p>
            {task.dueDate && <span className="text-[10px] text-destructive flex-shrink-0">{format(new Date(task.dueDate), "d MMM")}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
