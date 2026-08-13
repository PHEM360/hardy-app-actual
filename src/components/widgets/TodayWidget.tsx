import { useNavigate } from "react-router-dom";
import { Sun, Circle, ChevronRight } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import { WIDGET_ACCENT, accentGradient } from "@/lib/widgetAccents";

export function TodayWidget() {
  const navigate = useNavigate();
  const { tasks, loading } = useTasks();
  const accent = WIDGET_ACCENT.today;

  const todayTasks = tasks.filter((t) => t.isToday && t.status !== "done");
  const done = tasks.filter((t) => t.isToday && t.status === "done").length;
  const allToday = tasks.filter((t) => t.isToday);
  const total = allToday.length;
  const pending = todayTasks.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  const top3 = todayTasks.slice(0, 3);

  return (
    <button
      className="w-full h-full p-3 pb-3.5 flex flex-col text-left overflow-y-auto group"
      onClick={() => navigate("/today")}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 -mx-3 -mt-3 mb-2 px-3 py-2.5 flex-shrink-0"
        style={{ background: accentGradient(accent) }}
      >
        <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-white/20 flex-shrink-0 text-white">
          <Sun className="w-3.5 h-3.5" />
        </span>
        <span className="text-[11px] font-bold text-white uppercase tracking-wider">Today</span>
        <ChevronRight className="w-3 h-3 text-white/50 ml-auto group-hover:text-white/80 group-hover:translate-x-0.5 transition-all" />
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
            <p className="text-xs text-muted-foreground mt-0.5">{done}/{total} done</p>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden mb-2 flex-shrink-0">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, background: accent }}
            />
          </div>

          {/* Top tasks */}
          <div className="flex-1 min-h-0 space-y-1.5">
            {top3.map((t) => (
              <div key={t.id} className="flex items-center gap-1.5 text-sm text-foreground">
                <Circle className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                <span className="truncate">{t.title}</span>
              </div>
            ))}
            {pending > 3 && (
              <p className="text-xs text-muted-foreground pl-[18px]">+{pending - 3} more</p>
            )}
          </div>
        </>
      )}
    </button>
  );
}
