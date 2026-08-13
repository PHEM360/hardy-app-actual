import { useNavigate } from "react-router-dom";
import { CheckSquare, ChevronRight, AlertTriangle } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import { WIDGET_ACCENT, accentGradient } from "@/lib/widgetAccents";

const PRIORITY_DOT: Record<string, string> = {
  critical: "hsl(var(--destructive))",
  high: "hsl(var(--gold))",
  medium: "hsl(var(--info))",
  low: "hsl(var(--success))",
};

export function TasksWidget() {
  const navigate = useNavigate();
  const { tasks, loading } = useTasks();
  const accent = WIDGET_ACCENT.tasks;

  const open = tasks.filter((t) => t.status !== "done");
  const done = tasks.length - open.length;
  const completion = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
  const overdue = open.filter((t) => t.dueDate && new Date(t.dueDate) < new Date()).length;
  const top3 = open.slice(0, 3);

  return (
    <button
      className="w-full h-full p-3 pb-3.5 flex flex-col text-left overflow-y-auto group"
      onClick={() => navigate("/tasks")}
    >
      <div
        className="flex items-center gap-2 -mx-3 -mt-3 mb-2.5 px-3 py-2.5 flex-shrink-0"
        style={{ background: accentGradient(accent) }}
      >
        <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-white/20 flex-shrink-0 text-white">
          <CheckSquare className="w-3.5 h-3.5" />
        </span>
        <span className="text-[11px] font-bold text-white uppercase tracking-wider">Tasks</span>
        <ChevronRight className="w-3 h-3 text-white/50 ml-auto group-hover:text-white/80 group-hover:translate-x-0.5 transition-all" />
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-1.5 flex-shrink-0">
            <p className="text-3xl font-bold font-display text-foreground leading-none">{open.length}</p>
            <p className="text-sm text-muted-foreground">open</p>
            {overdue > 0 ? (
              <span className="ml-auto flex items-center gap-1 text-xs font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full flex-shrink-0">
                <AlertTriangle className="w-3 h-3" /> {overdue}
              </span>
            ) : tasks.length > 0 ? (
              <span className="ml-auto text-xs font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full flex-shrink-0">
                On track
              </span>
            ) : null}
          </div>

          {tasks.length > 0 && (
            <div className="mb-2.5 flex-shrink-0">
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${completion}%`, background: accent }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{completion}% complete &middot; {done} done</p>
            </div>
          )}

          <div className="flex-1 min-h-0 space-y-2">
            {top3.map((t) => (
              <div key={t.id} className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: PRIORITY_DOT[t.priority] ?? "hsl(var(--muted-foreground))" }}
                />
                <span className="text-sm text-foreground truncate">{t.title}</span>
              </div>
            ))}
            {open.length > 3 && <p className="text-xs text-muted-foreground pl-4">+{open.length - 3} more</p>}
            {open.length === 0 && tasks.length > 0 && (
              <p className="text-sm text-muted-foreground">All caught up</p>
            )}
            {tasks.length === 0 && <p className="text-sm text-muted-foreground">No tasks yet</p>}
          </div>
        </>
      )}
    </button>
  );
}
