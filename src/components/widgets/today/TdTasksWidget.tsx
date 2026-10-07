import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Circle, Clock, CheckCircle2, ChevronRight, Sun, Plus, Trash2 } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import { newSubtaskId } from "@/lib/tasks";
import type { Task, TaskStatus, TaskSubtask } from "@/types/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TdHead } from "./TdHead";

const STATUSES: { value: TaskStatus; icon: typeof Circle; color: string }[] = [
  { value: "todo", icon: Circle, color: "text-muted-foreground" },
  { value: "in_progress", icon: Clock, color: "text-blue-500" },
  { value: "done", icon: CheckCircle2, color: "text-green-500" },
];

export function TdTasksWidget() {
  const navigate = useNavigate();
  const { tasks, loading, setStatus, toggleToday, updateTask } = useTasks();
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [notes, setNotes] = useState("");
  const [subTitle, setSubTitle] = useState("");

  const allTodayTasks = tasks.filter((task) => task.isToday);
  const todayTasks = allTodayTasks
    .filter((task) => task.status !== "done")
    .sort((a, b) => {
      const weight: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return (weight[a.priority] ?? 2) - (weight[b.priority] ?? 2);
    });
  const live = openTask?.id ? tasks.find((task) => task.id === openTask.id) ?? openTask : null;

  const done = allTodayTasks.filter((task) => task.status === "done").length;
  const total = allTodayTasks.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  const cycle = (task: Task) => {
    if (!task.id) return;
    const index = STATUSES.findIndex((status) => status.value === task.status);
    setStatus(task.id, STATUSES[(index + 1) % STATUSES.length].value);
  };

  const open = (task: Task) => {
    setOpenTask(task);
    setNotes(task.notes || "");
    setSubTitle("");
  };

  const saveNotes = async () => {
    if (!live?.id) return;
    await updateTask(live.id, { notes });
  };

  const addSubtask = async () => {
    if (!live?.id || !subTitle.trim()) return;
    const next: TaskSubtask = { id: newSubtaskId(), title: subTitle.trim(), done: false };
    await updateTask(live.id, { subtasks: [...(live.subtasks || []), next] });
    setSubTitle("");
  };

  const toggleSubtask = async (subtask: TaskSubtask) => {
    if (!live?.id) return;
    await updateTask(live.id, {
      subtasks: (live.subtasks || []).map((item) => (item.id === subtask.id ? { ...item, done: !item.done } : item)),
    });
  };

  const removeSubtask = async (subtaskId: string) => {
    if (!live?.id) return;
    await updateTask(live.id, { subtasks: (live.subtasks || []).filter((item) => item.id !== subtaskId) });
  };

  return (
    <div className="flex h-full flex-col p-3">
      <TdHead
        emoji="✅"
        title="Today's Tasks"
        action={
          <button type="button" onClick={() => navigate("/tasks")} className="flex items-center gap-0.5 text-[11px] font-medium text-primary">
            All <ChevronRight className="h-3 w-3" />
          </button>
        }
      />

      {total > 0 && (
        <div className="mb-2 flex-shrink-0">
          <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
            <span>{done}/{total}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-amber-400 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
        {loading && <p className="py-2 text-xs text-muted-foreground">Loading…</p>}
        {!loading && total === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-4 text-center">
            <span className="text-2xl">☀️</span>
            <p className="text-xs text-muted-foreground">No tasks for today</p>
            <button type="button" onClick={() => navigate("/tasks")} className="text-xs font-semibold text-primary underline">Add tasks</button>
          </div>
        )}
        {!loading && total > 0 && todayTasks.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-4 text-center">
            <span className="text-2xl">🎉</span>
            <p className="text-xs text-muted-foreground">All of today's tasks are done</p>
          </div>
        )}
        <AnimatePresence mode="popLayout">
          {todayTasks.map((task) => {
            const status = STATUSES.find((item) => item.value === task.status) ?? STATUSES[0];
            const Icon = status.icon;
            return (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center gap-2 rounded-lg border border-foreground/15 bg-card p-2"
              >
                <button type="button" onClick={() => cycle(task)} className="flex-shrink-0" aria-label={`Change status for ${task.title}`}>
                  <Icon className={`h-4 w-4 ${status.color}`} />
                </button>
                <button type="button" onClick={() => open(task)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-xs font-medium leading-snug">{task.title}</p>
                  {(task.notes || task.subtasks?.length) && (
                    <p className="truncate text-[10px] text-foreground/60">
                      {task.subtasks?.length ? `${task.subtasks.filter((item) => item.done).length}/${task.subtasks.length} steps` : "Has notes"}
                    </p>
                  )}
                </button>
                <button type="button" onClick={() => task.id && toggleToday(task.id, task.isToday)} className="flex-shrink-0 text-amber-500" aria-label="Remove from today">
                  <Sun className="h-3 w-3" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <Sheet open={!!live} onOpenChange={(openSheet) => { if (!openSheet) setOpenTask(null); }}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-xl">
          <SheetHeader>
            <SheetTitle className="font-display text-left">{live?.title}</SheetTitle>
          </SheetHeader>
          {live && (
            <div className="mt-4 space-y-4 pb-4">
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/70">Notes</p>
                <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-[96px]" placeholder="Add a note" />
                <Button type="button" onClick={() => void saveNotes()}>Save notes</Button>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/70">Subtasks</p>
                {(live.subtasks || []).map((subtask) => (
                  <div key={subtask.id} className="flex items-center gap-2 rounded-lg border border-foreground/15 px-2 py-2">
                    <button type="button" onClick={() => void toggleSubtask(subtask)} className="text-left text-sm">
                      {subtask.done ? <CheckCircle2 className="h-4 w-4 text-emerald-700" /> : <Circle className="h-4 w-4" />}
                    </button>
                    <p className={`min-w-0 flex-1 text-sm ${subtask.done ? "text-foreground/50 line-through" : ""}`}>{subtask.title}</p>
                    <button type="button" onClick={() => void removeSubtask(subtask.id)} aria-label={`Remove ${subtask.title}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void addSubtask(); }}>
                  <Input value={subTitle} onChange={(event) => setSubTitle(event.target.value)} placeholder="Add a step" className="h-11" />
                  <Button type="submit" disabled={!subTitle.trim()}><Plus /> Add</Button>
                </form>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
