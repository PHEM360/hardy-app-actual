import { useNavigate } from "react-router-dom";
import { Sun, Circle, CheckCircle2 } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";

export function TodayWidget() {
  const navigate = useNavigate();
  const { tasks, loading } = useTasks();

  const todayTasks = tasks.filter((t) => t.isToday && t.status !== "done");
  const done = tasks.filter((t) => t.isToday && t.status === "done").length;
  const allToday = tasks.filter((t) => t.isToday);
  const total = allToday.length;
  const pending = todayTasks.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  const top3 = todayTasks.slice(0, 3);

  return (
    <button
      className="w-full h-full p-3 flex flex-col text-left overflow-hidden"
      onClick={() => navigate("/today")}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2 flex-shrink-0">
        <Sun className="w-3.5 h-3.5 text-amber-500" />
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Today</span>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : total === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <p className="text-xl">☀️</p>
          <p className="text-xs text-muted-foreground mt-1 text-center">All clear!</p>
        </div>
      ) : (
        <>
          {/* Count */}
          <div className="mb-2 flex-shrink-0">
            <p className="text-2xl font-bold font-display text-foreground leading-none">{pending}</p>
            <p className="text-[10px] text-muted-foreground">{done}/{total} done</p>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden mb-2 flex-shrink-0">
            <div
              className="h-full rounded-full bg-amber-400 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Top tasks */}
          <div className="flex-1 min-h-0 overflow-hidden space-y-1">
            {top3.map((t) => (
              <div key={t.id} className="flex items-center gap-1.5 text-[11px] text-foreground">
                <Circle className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                <span className="truncate">{t.title}</span>
              </div>
            ))}
            {pending > 3 && (
              <p className="text-[10px] text-muted-foreground">+{pending - 3} more</p>
            )}
          </div>
        </>
      )}
    </button>
  );
}
