import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, ChevronRight, Circle, Clock, Eye, EyeOff, Plus, Sun } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import type { Task, TaskStatus } from "@/types/app";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const STATUSES: { value: TaskStatus; icon: typeof Circle; color: string }[] = [
  { value: "todo", icon: Circle, color: "text-muted-foreground" },
  { value: "in_progress", icon: Clock, color: "text-blue-500" },
  { value: "done", icon: CheckCircle2, color: "text-green-500" },
];

export function TdTasksWidget() {
  const navigate = useNavigate();
  const { tasks, loading, setStatus, toggleToday, addTask } = useTasks();
  const [hideCompleted, setHideCompleted] = useState(false);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);

  const todayTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.isToday)
        .sort((a, b) => {
          const pw: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
          const aDone = a.status === "done" ? 1 : 0;
          const bDone = b.status === "done" ? 1 : 0;
          if (aDone !== bDone) return aDone - bDone;
          return (pw[a.priority] ?? 2) - (pw[b.priority] ?? 2);
        }),
    [tasks],
  );

  const visible = hideCompleted ? todayTasks.filter((t) => t.status !== "done") : todayTasks;
  const done = todayTasks.filter((t) => t.status === "done").length;
  const total = todayTasks.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  const cycle = (task: Task) => {
    if (!task.id) return;
    const idx = STATUSES.findIndex((s) => s.value === task.status);
    void setStatus(task.id, STATUSES[(idx + 1) % STATUSES.length].value);
  };

  const submit = async () => {
    const title = draft.trim();
    if (!title || adding) return;
    setAdding(true);
    try {
      await addTask({
        title,
        priority: "medium",
        status: "todo",
        category: "General",
        isToday: true,
        tags: [],
      });
      setDraft("");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col p-3">
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-base">✅</span>
          <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Today&apos;s Tasks
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setHideCompleted((v) => !v)}
            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold transition ${
              hideCompleted
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "border-transparent text-muted-foreground hover:bg-muted/50"
            }`}
            title={hideCompleted ? "Show completed" : "Hide completed"}
          >
            {hideCompleted ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {hideCompleted ? "Hidden" : "Done"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/tasks")}
            className="flex items-center gap-0.5 text-[11px] font-medium text-primary"
          >
            All <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {total > 0 && (
        <div className="mb-2 shrink-0">
          <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
            <span>
              {done}/{total}
              {hideCompleted ? ` · showing ${visible.length}` : ""}
            </span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-amber-400 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="mb-2 flex shrink-0 gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="Add a task for today…"
          className="h-8 rounded-lg text-xs"
        />
        <Button
          size="icon"
          className="h-8 w-8 shrink-0 rounded-lg bg-gradient-primary"
          disabled={!draft.trim() || adding}
          onClick={() => void submit()}
          aria-label="Add task"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
        {loading && <p className="py-2 text-xs text-muted-foreground">Loading…</p>}
        {!loading && visible.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-4 text-center">
            <span className="text-2xl">☀️</span>
            <p className="text-xs text-muted-foreground">
              {total > 0 && hideCompleted ? "All done — completed tasks are hidden" : "No tasks for today"}
            </p>
          </div>
        )}
        <AnimatePresence mode="popLayout">
          {visible.map((task) => {
            const s = STATUSES.find((x) => x.value === task.status)!;
            const Icon = s.icon;
            const isDone = task.status === "done";
            return (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`flex items-center gap-2 rounded-xl border border-border/40 bg-background/60 p-2 ${
                  isDone ? "opacity-50" : ""
                }`}
              >
                <button type="button" onClick={() => cycle(task)} className="shrink-0">
                  <Icon className={`h-4 w-4 ${s.color}`} />
                </button>
                <p
                  className={`min-w-0 flex-1 truncate text-xs font-medium leading-snug ${
                    isDone ? "text-muted-foreground line-through" : ""
                  }`}
                >
                  {task.title}
                </p>
                <button
                  type="button"
                  onClick={() => task.id && void toggleToday(task.id, true)}
                  className="shrink-0 text-amber-300 transition-colors hover:text-muted-foreground"
                  title="Remove from Today"
                >
                  <Sun className="h-3 w-3" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
