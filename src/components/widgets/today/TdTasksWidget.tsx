import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Circle, Clock, CheckCircle2, ChevronRight, Sun } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import type { Task, TaskStatus } from "@/types/app";

const STATUSES: { value: TaskStatus; icon: any; color: string }[] = [
  { value: "todo",        icon: Circle,       color: "text-muted-foreground" },
  { value: "in_progress", icon: Clock,        color: "text-blue-500" },
  { value: "done",        icon: CheckCircle2, color: "text-green-500" },
];

export function TdTasksWidget() {
  const navigate = useNavigate();
  const { tasks, loading, setStatus, toggleToday } = useTasks();

  const todayTasks = tasks
    .filter((t) => t.isToday)
    .sort((a, b) => {
      const pw: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      const aDone = a.status === "done" ? 1 : 0;
      const bDone = b.status === "done" ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return (pw[a.priority] ?? 2) - (pw[b.priority] ?? 2);
    });

  const done = todayTasks.filter((t) => t.status === "done").length;
  const total = todayTasks.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  const cycle = (task: Task) => {
    if (!task.id) return;
    const idx = STATUSES.findIndex((s) => s.value === task.status);
    setStatus(task.id, STATUSES[(idx + 1) % STATUSES.length].value);
  };

  return (
    <div className="h-full flex flex-col p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-base">✅</span>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Today's Tasks</p>
        </div>
        <button onClick={() => navigate("/tasks")} className="text-[11px] text-primary font-medium flex items-center gap-0.5">
          All <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* Progress */}
      {total > 0 && (
        <div className="mb-2 flex-shrink-0">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>{done}/{total}</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-amber-400 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
        {loading && <p className="text-xs text-muted-foreground py-2">Loading…</p>}
        {!loading && total === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center py-4">
            <span className="text-2xl">☀️</span>
            <p className="text-xs text-muted-foreground">No tasks for today</p>
            <button onClick={() => navigate("/tasks")} className="text-xs text-primary underline">Add tasks</button>
          </div>
        )}
        <AnimatePresence mode="popLayout">
          {todayTasks.map((task) => {
            const s = STATUSES.find((x) => x.value === task.status)!;
            const Icon = s.icon;
            const isDone = task.status === "done";
            return (
              <motion.div key={task.id} layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                className={`flex items-center gap-2 p-2 rounded-xl bg-background/60 border border-border/40 ${isDone ? "opacity-50" : ""}`}
              >
                <button onClick={() => cycle(task)} className="flex-shrink-0">
                  <Icon className={`w-4 h-4 ${s.color}`} />
                </button>
                <p className={`flex-1 text-xs font-medium leading-snug min-w-0 truncate ${isDone ? "line-through text-muted-foreground" : ""}`}>
                  {task.title}
                </p>
                <button onClick={() => task.id && toggleToday(task.id, false)} className="flex-shrink-0 text-amber-300 hover:text-muted-foreground transition-colors">
                  <Sun className="w-3 h-3" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
