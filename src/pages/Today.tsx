import { motion, AnimatePresence } from "framer-motion";
import { Sun, Circle, CheckCircle2, Clock, AlertCircle, XCircle, ChevronRight } from "lucide-react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { useTasks } from "@/hooks/useTasks";
import { Task, TaskPriority, TaskStatus } from "@/types/app";
import { useNavigate } from "react-router-dom";

const PRIORITIES: { value: TaskPriority; label: string; bg: string }[] = [
  { value: "critical", label: "Critical", bg: "bg-red-100 text-red-700" },
  { value: "high",     label: "High",     bg: "bg-orange-100 text-orange-700" },
  { value: "medium",   label: "Medium",   bg: "bg-yellow-100 text-yellow-700" },
  { value: "low",      label: "Low",      bg: "bg-green-100 text-green-700" },
];

const STATUSES: { value: TaskStatus; icon: any; color: string }[] = [
  { value: "todo",        icon: Circle,       color: "text-muted-foreground" },
  { value: "in_progress", icon: Clock,        color: "text-blue-500" },
  { value: "blocked",     icon: AlertCircle,  color: "text-red-500" },
  { value: "done",        icon: CheckCircle2, color: "text-green-500" },
  { value: "cancelled",   icon: XCircle,      color: "text-muted-foreground/50" },
];

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const p = PRIORITIES.find((x) => x.value === priority)!;
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${p.bg}`}>{p.label}</span>;
}

function StatusIcon({ status, onClick }: { status: TaskStatus; onClick: () => void }) {
  const s = STATUSES.find((x) => x.value === status)!;
  const Icon = s.icon;
  return (
    <button onClick={onClick} className="flex-shrink-0">
      <Icon className={`w-4.5 h-4.5 ${s.color}`} />
    </button>
  );
}

const Today = () => {
  const { tasks, loading, setStatus, toggleToday } = useTasks();
  const navigate = useNavigate();

  const todayTasks = tasks
    .filter((t) => t.isToday && t.status !== "cancelled")
    .sort((a, b) => {
      const pw: Record<TaskPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      const aDone = a.status === "done" ? 1 : 0;
      const bDone = b.status === "done" ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return pw[a.priority] - pw[b.priority];
    });

  const done = todayTasks.filter((t) => t.status === "done").length;
  const total = todayTasks.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  const cycleStatus = (task: Task) => {
    if (!task.id) return;
    const idx = STATUSES.findIndex((s) => s.value === task.status);
    const next = STATUSES[(idx + 1) % STATUSES.length];
    setStatus(task.id, next.value);
  };

  if (loading) {
    return (
      <FeaturePageShell title="Today" subtitle="Your focus for today" icon={<Sun className="w-5 h-5" />}>
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </FeaturePageShell>
    );
  }

  return (
    <FeaturePageShell
      title="Today"
      subtitle={new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
      icon={<Sun className="w-5 h-5" />}
      action={
        <button onClick={() => navigate("/tasks")} className="text-xs text-primary font-medium flex items-center gap-0.5">
          All tasks <ChevronRight className="w-3.5 h-3.5" />
        </button>
      }
    >
      {/* Progress */}
      {total > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-2xl bg-gradient-warm mb-5">
          <div className="flex justify-between items-end mb-2">
            <div>
              <p className="text-xs text-secondary-foreground/70 uppercase tracking-wider font-medium">Progress</p>
              <p className="text-2xl font-bold font-display text-secondary-foreground mt-0.5">{done}/{total} done</p>
            </div>
            <p className="text-2xl font-bold font-display text-secondary-foreground/80">{progress}%</p>
          </div>
          <div className="w-full h-2 rounded-full bg-secondary-foreground/20 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-secondary-foreground/70"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
        </motion.div>
      )}

      {/* Task list */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {todayTasks.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 gap-3"
            >
              <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center">
                <Sun className="w-7 h-7 text-amber-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">Nothing planned for today</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Go to{" "}
                  <button onClick={() => navigate("/tasks")} className="text-primary underline">Tasks</button>
                  {" "}and flag items with ☀️ to see them here
                </p>
              </div>
            </motion.div>
          ) : (
            todayTasks.map((task) => {
              const isDone = task.status === "done";
              return (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border border-border/50 bg-card shadow-soft transition-opacity ${isDone ? "opacity-50" : ""}`}
                >
                  <StatusIcon status={task.status} onClick={() => cycleStatus(task)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm font-medium leading-snug ${isDone ? "line-through text-muted-foreground" : "text-card-foreground"}`}>{task.title}</p>
                      <PriorityBadge priority={task.priority} />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {task.category}{task.company ? ` · ${task.company}` : ""}{task.dueDate ? ` · Due ${new Date(task.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}
                    </p>
                    {task.description && (
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{task.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => task.id && toggleToday(task.id, true)}
                    className="flex-shrink-0 p-1 rounded-md text-amber-400 hover:text-muted-foreground transition-colors"
                    title="Remove from Today"
                  >
                    <Sun className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </FeaturePageShell>
  );
};

export default Today;
