import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import {
  CheckSquare, Plus, Trash2, Sun, Circle, CheckCircle2,
  Clock, Settings2, X, Flag,
  LayoutList, LayoutGrid, Columns2, ListChecks, StickyNote,
  Eye, EyeOff, Palette, ChevronRight, GripVertical,
  Building2, Search, AlertTriangle,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useTasks } from "@/hooks/useTasks";
import { useTaskSettings } from "@/hooks/useTaskSettings";
import { useSharedScope } from "@/hooks/useSharedScope";
import { Task, TaskPriority, TaskStatus, TaskSettings, TaskCustomField, TaskSubtask } from "@/types/app";
import {
  defaultTaskDraft,
  filterTasks,
  formatTaskDue,
  isTaskOverdue,
  newSubtaskId,
  sortTasks,
  type TaskFilter,
} from "@/lib/tasks";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITIES: { value: TaskPriority; label: string; color: string; bg: string; hex: string }[] = [
  { value: "critical", label: "Critical", color: "text-red-600",    bg: "bg-red-100 text-red-700",      hex: "#ef4444" },
  { value: "high",     label: "High",     color: "text-orange-500", bg: "bg-orange-100 text-orange-700", hex: "#f97316" },
  { value: "medium",   label: "Medium",   color: "text-yellow-600", bg: "bg-yellow-100 text-yellow-700", hex: "#eab308" },
  { value: "low",      label: "Low",      color: "text-green-600",  bg: "bg-green-100 text-green-700",   hex: "#22c55e" },
];

const STATUSES: { value: TaskStatus; label: string; icon: any; color: string; hex: string }[] = [
  { value: "todo",        label: "To Do",       icon: Circle, color: "text-muted-foreground", hex: "#94a3b8" },
  { value: "in_progress", label: "In Progress", icon: Clock,  color: "text-blue-500",         hex: "#3b82f6" },
  { value: "done",        label: "Done",        icon: CheckCircle2, color: "text-green-500",  hex: "#22c55e" },
];

// Urgency levels cycle: none → amber → red
type UrgencyLevel = "none" | "amber" | "red";
function cycleUrgency(u: UrgencyLevel): UrgencyLevel {
  if (u === "none") return "amber";
  if (u === "amber") return "red";
  return "none";
}
function urgencyDotStyle(u: UrgencyLevel): string {
  if (u === "red")   return "bg-red-500 shadow-[0_0_4px_1px_rgba(239,68,68,0.5)]";
  if (u === "amber") return "bg-amber-400 shadow-[0_0_4px_1px_rgba(251,191,36,0.5)]";
  return "bg-muted-foreground/30";
}

type ColourBy = "none" | "priority" | "status" | "category" | "company";

const COLOUR_BY_OPTIONS: { value: ColourBy; label: string }[] = [
  { value: "none",     label: "No colour" },
  { value: "priority", label: "Priority" },
  { value: "status",   label: "Status" },
  { value: "category", label: "Category" },
  { value: "company",  label: "Company" },
];

const VIEW_STORAGE = "hardy-tasks-view";
const COLOUR_STORAGE = "hardy-tasks-colour";

type TaskView = "list" | "tile" | "kanban" | "company";

function readStoredView(): TaskView {
  try {
    const value = localStorage.getItem(VIEW_STORAGE);
    if (value === "list" || value === "tile" || value === "kanban" || value === "company") return value;
  } catch {
    // ignore
  }
  return "list";
}

function readStoredColour(): ColourBy {
  try {
    const value = localStorage.getItem(COLOUR_STORAGE);
    if (value === "none" || value === "priority" || value === "status" || value === "category" || value === "company") return value;
  } catch {
    // ignore
  }
  return "none";
}

function railBtnClass(on: boolean) {
  return `relative flex w-full items-center gap-2 overflow-hidden rounded-xl px-2 py-2 text-left transition sm:px-3 ${
    on
      ? "bg-gradient-primary text-primary-foreground shadow-sm"
      : "text-foreground hover:bg-card"
  }`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusIcon({ status, className = "w-4 h-4" }: { status: TaskStatus; className?: string }) {
  const s = STATUSES.find((x) => x.value === status)!;
  const Icon = s.icon;
  return <Icon className={`flex-shrink-0 ${className} ${s.color}`} />;
}

// Urgency dot — shown left of title, cycles none→amber→red
function UrgencyDot({ urgency, done, onClick }: { urgency: UrgencyLevel; done: boolean; onClick: (e: React.MouseEvent) => void }) {
  const dotColour = done ? "bg-green-500 shadow-[0_0_4px_1px_rgba(34,197,94,0.5)]" : urgencyDotStyle(urgency);
  return (
    <button
      onClick={onClick}
      title={done ? "Done" : urgency === "none" ? "No urgency. Click to set amber." : urgency === "amber" ? "Amber urgency. Click for red." : "Red urgency. Click to clear."}
      className={`w-3 h-3 rounded-full flex-shrink-0 transition-all duration-150 hover:scale-125 ${dotColour}`}
    />
  );
}

// Done checkbox — clicking toggles done status
function DoneCheckbox({ done, onClick, size = "md" }: { done: boolean; onClick: (e: React.MouseEvent) => void; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  return (
    <button
      onClick={onClick}
      title={done ? "Mark incomplete" : "Mark done"}
      className={`flex-shrink-0 rounded transition-all duration-150 hover:scale-110 ${dim} flex items-center justify-center border-2 ${
        done ? "border-green-500 bg-green-500 text-white" : "border-muted-foreground/40 hover:border-green-400"
      }`}
    >
      {done && <CheckCircle2 className="w-2.5 h-2.5" />}
    </button>
  );
}

function getTaskColour(task: Task, colourBy: ColourBy, settings: TaskSettings): string {
  if (colourBy === "priority") {
    const p = PRIORITIES.find((x) => x.value === task.priority);
    return p?.hex ?? "";
  }
  if (colourBy === "status") {
    const s = STATUSES.find((x) => x.value === task.status);
    return s?.hex ?? "";
  }
  if (colourBy === "category") {
    return settings.categoryColors?.[task.category] ?? "";
  }
  if (colourBy === "company" && task.company) {
    return settings.companyColors?.[task.company] ?? "";
  }
  return "";
}

// ─── Task Detail Sheet ────────────────────────────────────────────────────────

function TaskDetailSheet({
  task,
  open,
  onClose,
  onEdit,
  onDelete,
  onToggleToday,
  onStatusChange,
  settings,
  updateTask,
  showCompleted = true,
}: {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleToday: () => void;
  onStatusChange: (s: TaskStatus) => void;
  settings: TaskSettings;
  updateTask: (id: string, data: Partial<Task>) => Promise<void>;
  showCompleted?: boolean;
}) {
  const [quickAddInput, setQuickAddInput] = useState("");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [expandedSubId, setExpandedSubId] = useState<string | null>(null);
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editingSubTitle, setEditingSubTitle] = useState("");
  const [editingSubNotesId, setEditingSubNotesId] = useState<string | null>(null);
  const [editingSubNotes, setEditingSubNotes] = useState("");
  const [dragSubIdx, setDragSubIdx] = useState<number | null>(null);
  const [dragOverSubIdx, setDragOverSubIdx] = useState<number | null>(null);

  if (!task) return null;

  const priority = PRIORITIES.find((p) => p.value === task.priority) ?? PRIORITIES[2];
  const status = STATUSES.find((s) => s.value === task.status) ?? STATUSES[0];
  const subtaskCount = task.subtasks?.length ?? 0;
  const subtaskDone = task.subtasks?.filter((s) => s.done).length ?? 0;
  const isDone = task.status === "done";

  const patchSub = (subId: string, patch: Partial<TaskSubtask>) => {
    if (!task.id) return;
    updateTask(task.id, {
      subtasks: task.subtasks!.map((s) => s.id === subId ? { ...s, ...patch } : s),
    });
  };

  const deleteSub = (subId: string) => {
    if (!task.id) return;
    updateTask(task.id, { subtasks: task.subtasks!.filter((s) => s.id !== subId) });
  };

  const handleSubDragStart = (idx: number) => setDragSubIdx(idx);
  const handleSubDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOverSubIdx(idx); };
  const handleSubDrop = () => {
    if (dragSubIdx === null || dragOverSubIdx === null || dragSubIdx === dragOverSubIdx) {
      setDragSubIdx(null); setDragOverSubIdx(null); return;
    }
    const subs = [...(task.subtasks ?? [])];
    const [moved] = subs.splice(dragSubIdx, 1);
    subs.splice(dragOverSubIdx, 0, moved);
    updateTask(task.id!, { subtasks: subs });
    setDragSubIdx(null); setDragOverSubIdx(null);
  };

  const commitSubTitle = (subId: string) => {
    const t = editingSubTitle.trim();
    if (t) patchSub(subId, { title: t });
    setEditingSubId(null);
    setEditingSubTitle("");
  };

  const commitSubNotes = (subId: string) => {
    patchSub(subId, { notes: editingSubNotes });
    setEditingSubNotesId(null);
  };

  const visibleSubtasks = (task.subtasks ?? []).filter((s) => showCompleted || !s.done);
  const hiddenDoneCount = subtaskCount - visibleSubtasks.length;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col gap-0">
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-4 pr-12 border-b border-border/50 text-left">
          <div className="flex items-start gap-3">
            <button
              onClick={() => {
                const idx = STATUSES.findIndex((s) => s.value === task.status);
                onStatusChange(STATUSES[(idx + 1) % STATUSES.length].value);
              }}
              className="mt-0.5 flex-shrink-0 hover:scale-110 transition-transform"
              title="Cycle status (To Do → In Progress → Done)"
            >
              <StatusIcon status={task.status} className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <SheetTitle className={`text-base font-semibold leading-snug ${isDone ? "line-through text-muted-foreground" : ""}`}>
                {task.title}
              </SheetTitle>
              {task.description && (
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{task.description}</p>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Meta chips */}
          <div className="flex flex-wrap gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${priority.bg}`}>{priority.label}</span>
            <span className={`text-xs px-2.5 py-1 rounded-full bg-muted font-medium ${status.color}`}>{status.label}</span>
            {task.category && <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-medium">{task.category}</span>}
            {task.company && <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-medium">{task.company}</span>}
            {task.dueDate && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-medium">
                Due {new Date(task.dueDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
            {task.isToday && <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">Today</span>}
          </div>

          {/* Tags */}
          {task.tags?.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {task.tags.map((t) => (
                  <span key={t} className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* ── Subtasks ─────────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Subtasks
              </p>
              {subtaskCount > 0 && (
                <span className="text-xs text-muted-foreground">{subtaskDone}/{subtaskCount}</span>
              )}
            </div>
            {hiddenDoneCount > 0 && (
              <p className="text-[11px] text-muted-foreground mb-2">
                {hiddenDoneCount} completed {hiddenDoneCount === 1 ? "subtask" : "subtasks"} hidden
              </p>
            )}

            {/* Progress bar */}
            {subtaskCount > 0 && (
              <div className="h-1 bg-muted rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-green-400 rounded-full transition-all duration-300"
                  style={{ width: `${(subtaskDone / subtaskCount) * 100}%` }}
                />
              </div>
            )}

            {/* Subtask cards */}
            <div className="space-y-2">
              {visibleSubtasks.map((sub) => {
                const idx = (task.subtasks ?? []).findIndex((s) => s.id === sub.id);
                const subStatus = sub.status ?? (sub.done ? "done" : "todo");
                const subPriority = PRIORITIES.find((p) => p.value === (sub.priority ?? "medium"))!;
                const subStatusMeta = STATUSES.find((s) => s.value === subStatus)!;
                const isExpanded = expandedSubId === sub.id;
                const isEditingTitle = editingSubId === sub.id;

                return (
                  <div
                    key={sub.id}
                    draggable
                    onDragStart={() => handleSubDragStart(idx)}
                    onDragOver={(e) => handleSubDragOver(e, idx)}
                    onDrop={handleSubDrop}
                    onDragEnd={() => { setDragSubIdx(null); setDragOverSubIdx(null); }}
                    className={`rounded-xl border transition-all ${
                      dragOverSubIdx === idx && dragSubIdx !== idx
                        ? "border-primary/50 bg-primary/5"
                        : sub.done
                        ? "bg-muted/20 border-border/30"
                        : isExpanded
                        ? "bg-card border-border shadow-sm"
                        : "bg-muted/40 border-border/40 hover:border-border/70"
                    }`}
                  >
                    {/* ── Top row ── */}
                    <div className="flex items-start gap-2 px-2 pt-2.5 pb-2">
                      {/* Drag handle */}
                      <span
                        className="mt-0.5 flex-shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                        title="Drag to reorder"
                      >
                        <GripVertical className="w-3.5 h-3.5" />
                      </span>

                      {/* Done checkbox */}
                      <button
                        onClick={() => {
                          const newDone = !sub.done;
                          patchSub(sub.id, {
                            done: newDone,
                            status: newDone ? "done" : "todo",
                          });
                        }}
                        className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          sub.done
                            ? "bg-green-500 border-green-500 text-white"
                            : "border-muted-foreground/40 hover:border-green-400"
                        }`}
                        title={sub.done ? "Mark incomplete" : "Mark done"}
                      >
                        {sub.done && <CheckCircle2 className="w-2.5 h-2.5" />}
                      </button>

                      {/* Title — click to edit inline */}
                      <div className="flex-1 min-w-0">
                        {isEditingTitle ? (
                          <input
                            autoFocus
                            value={editingSubTitle}
                            onChange={(e) => setEditingSubTitle(e.target.value)}
                            onBlur={() => commitSubTitle(sub.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.preventDefault(); commitSubTitle(sub.id); }
                              if (e.key === "Escape") { setEditingSubId(null); setEditingSubTitle(""); }
                            }}
                            className="w-full bg-transparent border-b border-primary outline-none text-sm py-0.5"
                          />
                        ) : (
                          <button
                            className={`text-sm text-left w-full break-words ${
                              sub.done ? "line-through text-muted-foreground" : "text-card-foreground"
                            }`}
                            onClick={() => {
                              setEditingSubId(sub.id);
                              setEditingSubTitle(sub.title);
                            }}
                            title="Click to edit title"
                          >
                            {sub.title}
                          </button>
                        )}
                      </div>

                      {/* Status pill — click to cycle */}
                      <button
                        onClick={() => {
                          const idx2 = STATUSES.findIndex((s) => s.value === subStatus);
                          const next = STATUSES[(idx2 + 1) % STATUSES.length];
                          patchSub(sub.id, { status: next.value, done: next.value === "done" });
                        }}
                        title="Cycle status"
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 border transition-colors ${subStatusMeta.color} bg-muted/60 border-border/40 hover:border-border`}
                      >
                        {subStatusMeta.label}
                      </button>

                      {/* Priority badge — click to cycle */}
                      <button
                        onClick={() => {
                          const i = PRIORITIES.findIndex((p) => p.value === (sub.priority ?? "medium"));
                          const next = PRIORITIES[(i + 1) % PRIORITIES.length];
                          patchSub(sub.id, { priority: next.value });
                        }}
                        title="Cycle priority"
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 border border-transparent hover:border-border/50 transition-colors ${subPriority.bg}`}
                      >
                        {subPriority.label}
                      </button>

                      {/* Expand toggle (notes/date) */}
                      <button
                        onClick={() => setExpandedSubId(isExpanded ? null : sub.id)}
                        title={isExpanded ? "Collapse" : "Notes & date"}
                        className={`p-0.5 rounded flex-shrink-0 transition-colors ${
                          isExpanded || sub.notes || sub.dueDate
                            ? "text-primary"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <StickyNote className="w-3 h-3" />
                      </button>

                      {/* Today toggle */}
                      <button
                        onClick={() => patchSub(sub.id, { isToday: !sub.isToday })}
                        title={sub.isToday ? "Remove from Today" : "Add to Today"}
                        className={`p-0.5 rounded flex-shrink-0 transition-colors ${
                          sub.isToday ? "text-amber-500" : "text-muted-foreground hover:text-amber-400"
                        }`}
                      >
                        <Sun className="w-3 h-3" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => deleteSub(sub.id)}
                        className="p-0.5 rounded flex-shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete subtask"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>

                    {/* ── Expanded section: notes + due date ── */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border/30">
                        {/* Notes textarea */}
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
                          <textarea
                            value={editingSubNotesId === sub.id ? editingSubNotes : (sub.notes ?? "")}
                            onFocus={() => { setEditingSubNotesId(sub.id); setEditingSubNotes(sub.notes ?? ""); }}
                            onChange={(e) => setEditingSubNotes(e.target.value)}
                            onBlur={() => commitSubNotes(sub.id)}
                            placeholder="Add notes…"
                            rows={3}
                            className="w-full text-xs bg-muted/40 border border-border/40 rounded-lg px-2.5 py-2 resize-none outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground/60 leading-relaxed"
                          />
                        </div>
                        {/* Due date */}
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Due Date</p>
                          <input
                            type="date"
                            value={sub.dueDate ?? ""}
                            onChange={(e) => patchSub(sub.id, { dueDate: e.target.value || "" })}
                            className="text-xs bg-muted/40 border border-border/40 rounded-lg px-2.5 py-1.5 outline-none focus:border-primary/50 text-foreground"
                          />
                        </div>
                      </div>
                    )}

                    {/* ── Collapsed summary line (notes/due date preview) ── */}
                    {!isExpanded && (sub.notes || sub.dueDate) && (
                      <div className="px-9 pb-2 flex flex-wrap gap-2">
                        {sub.dueDate && (
                          <span className="text-[10px] text-muted-foreground">
                            📅 {new Date(sub.dueDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </span>
                        )}
                        {sub.notes && (
                          <span className="text-[10px] text-muted-foreground italic truncate max-w-[200px]">
                            {sub.notes}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── Quick-add subtask ── */}
            {task.id && (
              <div className="mt-2">
                {showQuickAdd ? (
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={quickAddInput}
                      onChange={(e) => setQuickAddInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const title = quickAddInput.trim();
                          if (!title) return;
                          const newSub: TaskSubtask = { id: newSubtaskId(), title, done: false, status: "todo", priority: "medium" };
                          updateTask(task.id!, { subtasks: [...(task.subtasks ?? []), newSub] });
                          setExpandedSubId(newSub.id);
                          setQuickAddInput("");
                          setShowQuickAdd(false);
                        }
                        if (e.key === "Escape") { setShowQuickAdd(false); setQuickAddInput(""); }
                      }}
                      placeholder="Subtask title… (Enter to add)"
                      className="h-8 rounded-xl flex-1 text-sm bg-muted/40 border border-border/50 px-3 outline-none focus:border-primary/60"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const title = quickAddInput.trim();
                        if (!title) return;
                        const newSub: TaskSubtask = { id: newSubtaskId(), title, done: false, status: "todo", priority: "medium" };
                        updateTask(task.id!, { subtasks: [...(task.subtasks ?? []), newSub] });
                        setExpandedSubId(newSub.id);
                        setQuickAddInput("");
                        setShowQuickAdd(false);
                      }}
                      className="h-8 rounded-xl px-3 text-xs"
                    >Add</Button>
                    <Button variant="ghost" size="sm" onClick={() => { setShowQuickAdd(false); setQuickAddInput(""); }} className="h-8 w-8 rounded-xl px-0">
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowQuickAdd(true)}
                    className="w-full flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary py-1.5 px-2 rounded-xl hover:bg-primary/5 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Add subtask
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          {task.notes?.trim() && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Notes</p>
              <div className="rounded-xl bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {task.notes}
              </div>
            </div>
          )}

          {/* Custom fields */}
          {settings.customFields.filter((f) => task.customFields?.[f.id]).length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Custom Fields</p>
              <div className="space-y-1.5">
                {settings.customFields
                  .filter((f) => task.customFields?.[f.id])
                  .map((f) => (
                    <div key={f.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{f.label}</span>
                      <span className="font-medium">{task.customFields![f.id]}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-border/50 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onToggleToday(); }}
            className={`flex-1 rounded-xl h-9 gap-1.5 ${task.isToday ? "border-amber-300 text-amber-600 bg-amber-50" : ""}`}
          >
            <Sun className="w-3.5 h-3.5" />
            {task.isToday ? "Remove from Today" : "Add to Today"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="flex-1 rounded-xl h-9"
          >
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="h-9 w-9 px-0 rounded-xl text-destructive hover:bg-destructive/10 hover:border-destructive/40"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Task Form ────────────────────────────────────────────────────────────────

const EMPTY_TASK: Omit<Task, "id" | "createdAt" | "updatedAt"> = defaultTaskDraft("Admin");

function TaskForm({
  initial,
  onSave,
  onCancel,
  saving,
  settings,
}: {
  initial: Omit<Task, "id" | "createdAt" | "updatedAt">;
  onSave: (t: Omit<Task, "id" | "createdAt" | "updatedAt">) => void;
  onCancel: () => void;
  saving: boolean;
  settings: TaskSettings;
}) {
  const [form, setForm] = useState({
    ...initial,
    customFields: initial.customFields ?? {},
    subtasks: initial.subtasks ?? [],
    notes: initial.notes ?? "",
  });
  const [tagInput, setTagInput] = useState("");
  const [subtaskInput, setSubtaskInput] = useState("");

  const set = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const setCustomField = (id: string, value: string) =>
    setForm((f) => ({ ...f, customFields: { ...(f.customFields ?? {}), [id]: value } }));

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) set("tags", [...form.tags, t]);
    setTagInput("");
  };

  const addSubtask = () => {
    const t = subtaskInput.trim();
    if (!t) return;
    const sub: TaskSubtask = { id: newSubtaskId(), title: t, done: false };
    set("subtasks", [...(form.subtasks ?? []), sub]);
    setSubtaskInput("");
  };

  const toggleSubtask = (id: string) =>
    set("subtasks", (form.subtasks ?? []).map((s) => s.id === id ? { ...s, done: !s.done } : s));

  const removeSubtask = (id: string) =>
    set("subtasks", (form.subtasks ?? []).filter((s) => s.id !== id));

  const safeCategory = settings.categories.includes(form.category) ? form.category : settings.categories[0] ?? "Other";

  return (
    <div className="pt-1 space-y-3.5">
      {/* Title */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Title *</Label>
        <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Task title" className="h-10 rounded-xl" />
      </div>

      {/* Description / Notes */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description / Notes</Label>
        <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Optional details, notes, links…" className="rounded-xl resize-none" rows={3} />
      </div>

      {/* Priority + Status */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Priority</Label>
          <Select value={form.priority} onValueChange={(v) => set("priority", v as TaskPriority)}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ background: p.hex }} />
                    {p.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</Label>
          <Select value={form.status} onValueChange={(v) => set("status", v as TaskStatus)}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Category + Due Date */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Category</Label>
          <Select value={safeCategory} onValueChange={(v) => set("category", v)}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {settings.categories.map((c) => (
                <SelectItem key={c} value={c}>
                  <span className="flex items-center gap-2">
                    {settings.categoryColors?.[c] && (
                      <span className="inline-block w-2 h-2 rounded-full" style={{ background: settings.categoryColors[c] }} />
                    )}
                    {c}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Due Date</Label>
          <Input type="date" value={form.dueDate || ""} onChange={(e) => set("dueDate", e.target.value)} className="h-10 rounded-xl" />
        </div>
      </div>

      {/* Company */}
      {settings.companies.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Company</Label>
          <Select value={form.company || "__none__"} onValueChange={(v) => set("company", v === "__none__" ? "" : v)}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {settings.companies.map((c) => (
                <SelectItem key={c} value={c}>
                  <span className="flex items-center gap-2">
                    {settings.companyColors?.[c] && (
                      <span className="inline-block w-2 h-2 rounded-full" style={{ background: settings.companyColors[c] }} />
                    )}
                    {c}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Custom fields */}
      {settings.customFields.map((field) => (
        <div key={field.id} className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{field.label}</Label>
          <Select value={form.customFields?.[field.id] || "__none__"} onValueChange={(v) => setCustomField(field.id, v === "__none__" ? "" : v)}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder={`Select ${field.label}…`} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {field.options.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      ))}

      {/* Tags */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tags</Label>
        <div className="flex gap-2">
          <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())} placeholder="Type tag + Enter" className="h-9 rounded-xl flex-1" />
          <Button type="button" variant="outline" onClick={addTag} className="h-9 rounded-xl px-3">Add</Button>
        </div>
        {form.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {form.tags.map((t) => (
              <span key={t} className="flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded-full">
                {t}
                <button onClick={() => set("tags", form.tags.filter((x) => x !== t))} className="text-muted-foreground hover:text-foreground">×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Subtasks */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Subtasks{form.subtasks?.length ? ` (${form.subtasks.length})` : ""}
        </Label>
        <div className="flex gap-2">
          <Input value={subtaskInput} onChange={(e) => setSubtaskInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSubtask())} placeholder="Add subtask…" className="h-9 rounded-xl flex-1" />
          <Button type="button" variant="outline" onClick={addSubtask} className="h-9 rounded-xl px-3">Add</Button>
        </div>
        {(form.subtasks ?? []).length > 0 && (
          <div className="space-y-1.5">
            {(form.subtasks ?? []).map((sub) => (
              <div key={sub.id} className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2">
                <button onClick={() => toggleSubtask(sub.id)} className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${sub.done ? "bg-green-500 border-green-500 text-white" : "border-border"}`}>
                  {sub.done && <CheckCircle2 className="w-3 h-3" />}
                </button>
                <span className={`flex-1 text-sm ${sub.done ? "line-through text-muted-foreground" : ""}`}>{sub.title}</span>
                <button onClick={() => removeSubtask(sub.id)} className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add to Today */}
      <button
        onClick={() => set("isToday", !form.isToday)}
        className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors ${
          form.isToday
            ? "bg-amber-500 border-amber-500 text-white shadow-sm"
            : "bg-amber-100 border-amber-200 text-amber-700 hover:bg-amber-200 hover:border-amber-300 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-400"
        }`}
      >
        <Sun className="w-3.5 h-3.5" />
        {form.isToday ? "Added to Today ✓" : "Add to Today"}
      </button>

      <div className="flex gap-2 pt-4 mt-2 border-t border-border/40">
        <Button variant="outline" onClick={onCancel} className="flex-1 h-10 rounded-xl">Cancel</Button>
        <Button onClick={() => onSave({ ...form, category: safeCategory, notes: form.notes || form.description })} disabled={!form.title.trim() || saving} className="flex-1 h-10 rounded-xl bg-gradient-primary">
          {saving ? "Saving…" : "Save Task"}
        </Button>
      </div>
    </div>
  );
}

// ─── Settings Dialog ──────────────────────────────────────────────────────────

const COLOUR_PRESETS = [
  // Indigo / Blue / Violet
  "#6366f1", "#4f46e5", "#3b82f6", "#0ea5e9", "#8b5cf6", "#7c3aed", "#a78bfa",
  // Green / Teal / Cyan
  "#22c55e", "#16a34a", "#14b8a6", "#0d9488", "#06b6d4", "#10b981",
  // Amber / Orange / Red
  "#f59e0b", "#f97316", "#ef4444", "#dc2626", "#fb7185", "#e11d48",
  // Pink / Rose / Fuchsia
  "#ec4899", "#db2777", "#d946ef", "#c026d3", "#a21caf",
  // Neutral
  "#64748b", "#475569", "#374151", "#1e293b",
];

function ColourPicker({ value, onChange, onClose }: { value: string; onChange: (c: string) => void; onClose?: () => void }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap pt-2 pb-1">
      {COLOUR_PRESETS.map((c) => (
        <button
          key={c}
          onClick={() => { onChange(c); onClose?.(); }}
          className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${value === c ? "border-foreground scale-110" : "border-transparent"}`}
          style={{ background: c }}
        />
      ))}
      <input
        type="color"
        value={value || "#6366f1"}
        onChange={(e) => onChange(e.target.value)}
        className="w-6 h-6 rounded-full cursor-pointer border-0 bg-transparent"
        title="Custom colour"
      />
    </div>
  );
}

function FieldEditor({ field, onRemoveField, onAddOption, onRemoveOption }: { field: TaskCustomField; onRemoveField: () => void; onAddOption: (opt: string) => void; onRemoveOption: (opt: string) => void }) {
  const [optInput, setOptInput] = useState("");
  const [expanded, setExpanded] = useState(false);
  const add = () => { const v = optInput.trim(); if (!v) return; onAddOption(v); setOptInput(""); };
  return (
    <div className="border border-border/60 rounded-xl overflow-hidden mb-2">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
        <button onClick={() => setExpanded((e) => !e)} className="flex-1 text-left text-sm font-semibold">
          {field.label}
          <span className="text-[10px] text-muted-foreground font-normal ml-2">({field.options.length} options)</span>
        </button>
        <button onClick={onRemoveField} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
      {expanded && (
        <div className="px-3 py-2 space-y-1.5">
          {field.options.map((opt) => (
            <div key={opt} className="flex items-center justify-between bg-muted/50 rounded-lg px-2.5 py-1">
              <span className="text-xs">{opt}</span>
              {opt !== "Other" && <button onClick={() => onRemoveOption(opt)} className="text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>}
            </div>
          ))}
          <div className="flex gap-2 mt-1">
            <Input value={optInput} onChange={(e) => setOptInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} placeholder="New option…" className="h-8 rounded-lg flex-1 text-xs" />
            <Button variant="outline" onClick={add} className="h-8 rounded-lg px-2.5 text-xs">Add</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskSettingsDialog({ open, onOpenChange, settings, onSave, colourBy, setColourBy }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  settings: TaskSettings; onSave: (s: TaskSettings) => Promise<void>;
  colourBy: ColourBy; setColourBy: (v: ColourBy) => void;
}) {
  const [draft, setDraft] = useState<TaskSettings>(() => JSON.parse(JSON.stringify(settings)));
  const [catInput, setCatInput] = useState("");
  const [coInput, setCoInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [addingField, setAddingField] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldOptions, setNewFieldOptions] = useState<string[]>([]);
  const [newOptionInput, setNewOptionInput] = useState("");
  const [expandedCatColour, setExpandedCatColour] = useState<string | null>(null);
  const [expandedCoColour, setExpandedCoColour] = useState<string | null>(null);

  const reset = () => { setAddingField(false); setNewFieldLabel(""); setNewFieldOptions([]); setNewOptionInput(""); setCatInput(""); setCoInput(""); setExpandedCatColour(null); setExpandedCoColour(null); };

  const handleOpenChange = (o: boolean) => {
    if (o) setDraft(JSON.parse(JSON.stringify(settings)));
    reset();
    onOpenChange(o);
  };

  const addCategory = () => {
    const val = catInput.trim();
    if (!val || draft.categories.includes(val)) return;
    setDraft((d) => ({ ...d, categories: [...d.categories, val] }));
    setCatInput("");
  };
  const removeCategory = (cat: string) => setDraft((d) => ({ ...d, categories: d.categories.filter((c) => c !== cat) }));

  const setCatColour = (cat: string, colour: string) =>
    setDraft((d) => ({ ...d, categoryColors: { ...(d.categoryColors ?? {}), [cat]: colour } }));

  const addCompany = () => {
    const val = coInput.trim();
    if (!val || draft.companies.includes(val)) return;
    setDraft((d) => ({ ...d, companies: [...d.companies, val] }));
    setCoInput("");
  };
  const removeCompany = (co: string) => setDraft((d) => ({ ...d, companies: d.companies.filter((c) => c !== co) }));

  const setCoColour = (co: string, colour: string) =>
    setDraft((d) => ({ ...d, companyColors: { ...(d.companyColors ?? {}), [co]: colour } }));

  const addOptionToNew = () => {
    const val = newOptionInput.trim();
    if (!val || newFieldOptions.includes(val)) return;
    setNewFieldOptions((o) => [...o, val]);
    setNewOptionInput("");
  };

  const commitNewField = () => {
    const label = newFieldLabel.trim();
    if (!label) return;
    const id = label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    const options = [...newFieldOptions];
    if (!options.includes("Other")) options.push("Other");
    const field: TaskCustomField = { id, label, options };
    setDraft((d) => ({ ...d, customFields: [...d.customFields, field] }));
    setAddingField(false);
    setNewFieldLabel("");
    setNewFieldOptions([]);
    setNewOptionInput("");
  };

  const removeField = (id: string) => setDraft((d) => ({ ...d, customFields: d.customFields.filter((f) => f.id !== id) }));
  const addOptionToField = (fieldId: string, opt: string) => {
    const trimmed = opt.trim();
    if (!trimmed) return;
    setDraft((d) => ({ ...d, customFields: d.customFields.map((f) => f.id === fieldId && !f.options.includes(trimmed) ? { ...f, options: [...f.options, trimmed] } : f) }));
  };
  const removeOptionFromField = (fieldId: string, opt: string) =>
    setDraft((d) => ({ ...d, customFields: d.customFields.map((f) => f.id === fieldId ? { ...f, options: f.options.filter((o) => o !== opt) } : f) }));

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(draft); onOpenChange(false); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm mx-4 max-h-[88vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="font-display text-base">Task Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pt-1">

          {/* Completed tasks visibility */}
          <section>
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Display</h3>
            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-muted/40">
              <div>
                <p className="text-xs font-medium text-card-foreground">Show completed tasks</p>
                <p className="text-[10px] text-muted-foreground">Off by default. Completed tasks stay hidden.</p>
              </div>
              <Switch
                checked={draft.showCompleted ?? false}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, showCompleted: v }))}
              />
            </div>
          </section>

          {/* Colour by */}
          <section>
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Colour Tasks By</h3>
            <div className="flex flex-wrap gap-1.5">
              {COLOUR_BY_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setColourBy(o.value)}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all duration-150 border ${
                    colourBy === o.value
                      ? "bg-primary text-primary-foreground border-transparent shadow-sm"
                      : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                  }`}
                >
                  {o.value === "none" && <Palette className="w-3 h-3" />}
                  {o.label}
                </button>
              ))}
            </div>
          </section>

          {/* Categories */}
          <section>
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Categories</h3>
            <div className="space-y-1">
              {draft.categories.map((cat) => {
                const colour = draft.categoryColors?.[cat] ?? "";
                const isOpen = expandedCatColour === cat;
                return (
                  <div key={cat}>
                    <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors">
                      {/* Colour swatch toggle */}
                      <button
                        onClick={() => setExpandedCatColour(isOpen ? null : cat)}
                        className="w-5 h-5 rounded-full border-2 flex-shrink-0 transition-transform hover:scale-110"
                        style={{ background: colour || "#e2e8f0", borderColor: colour ? colour : "hsl(var(--border))" }}
                        title="Pick colour"
                      />
                      <span className="flex-1 text-sm font-medium">{cat}</span>
                      <button onClick={() => removeCategory(cat)} className="p-1 text-muted-foreground hover:text-destructive transition-colors rounded-lg"><X className="w-3.5 h-3.5" /></button>
                    </div>
                    {isOpen && (
                      <div className="mx-2 px-2 pb-2 border-x border-b border-border/40 rounded-b-xl bg-muted/20">
                        <ColourPicker
                          value={colour}
                          onChange={(c) => setCatColour(cat, c)}
                          onClose={() => setExpandedCatColour(null)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 mt-2">
              <Input value={catInput} onChange={(e) => setCatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCategory())} placeholder="New category…" className="h-9 rounded-xl flex-1 text-sm" />
              <Button variant="outline" onClick={addCategory} className="h-9 rounded-xl px-3 text-sm">Add</Button>
            </div>
          </section>

          {/* Companies */}
          <section>
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Companies</h3>
            {draft.companies.length === 0 && <p className="text-xs text-muted-foreground mb-2">No companies yet.</p>}
            <div className="space-y-1">
              {draft.companies.map((co) => {
                const colour = draft.companyColors?.[co] ?? "";
                const isOpen = expandedCoColour === co;
                return (
                  <div key={co}>
                    <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors">
                      <button
                        onClick={() => setExpandedCoColour(isOpen ? null : co)}
                        className="w-5 h-5 rounded-full border-2 flex-shrink-0 transition-transform hover:scale-110"
                        style={{ background: colour || "#e2e8f0", borderColor: colour ? colour : "hsl(var(--border))" }}
                        title="Pick colour"
                      />
                      <span className="flex-1 text-sm font-medium">{co}</span>
                      <button onClick={() => removeCompany(co)} className="p-1 text-muted-foreground hover:text-destructive transition-colors rounded-lg"><X className="w-3.5 h-3.5" /></button>
                    </div>
                    {isOpen && (
                      <div className="mx-2 px-2 pb-2 border-x border-b border-border/40 rounded-b-xl bg-muted/20">
                        <ColourPicker
                          value={colour}
                          onChange={(c) => setCoColour(co, c)}
                          onClose={() => setExpandedCoColour(null)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 mt-2">
              <Input value={coInput} onChange={(e) => setCoInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCompany())} placeholder="New company…" className="h-9 rounded-xl flex-1 text-sm" />
              <Button variant="outline" onClick={addCompany} className="h-9 rounded-xl px-3 text-sm">Add</Button>
            </div>
          </section>

          {/* Custom Fields */}
          <section>
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Custom Dropdowns</h3>
            {draft.customFields.length === 0 && !addingField && <p className="text-xs text-muted-foreground mb-2">No custom fields yet.</p>}
            {draft.customFields.map((field) => (
              <FieldEditor key={field.id} field={field} onRemoveField={() => removeField(field.id)} onAddOption={(opt) => addOptionToField(field.id, opt)} onRemoveOption={(opt) => removeOptionFromField(field.id, opt)} />
            ))}
            {addingField ? (
              <div className="border border-border rounded-xl p-3 space-y-3 mt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Field Name</Label>
                  <Input value={newFieldLabel} onChange={(e) => setNewFieldLabel(e.target.value)} placeholder="e.g. Client, Project Type…" className="h-9 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Options</Label>
                  {newFieldOptions.map((opt) => (
                    <div key={opt} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-1.5 mb-1">
                      <span className="text-sm">{opt}</span>
                      <button onClick={() => setNewFieldOptions((o) => o.filter((x) => x !== opt))} className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input value={newOptionInput} onChange={(e) => setNewOptionInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addOptionToNew())} placeholder="Add option…" className="h-9 rounded-xl flex-1" />
                    <Button variant="outline" onClick={addOptionToNew} className="h-9 rounded-xl px-3">Add</Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">"Other" is added automatically.</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setAddingField(false); setNewFieldLabel(""); setNewFieldOptions([]); }} className="flex-1 h-9 rounded-xl">Cancel</Button>
                  <Button onClick={commitNewField} disabled={!newFieldLabel.trim()} className="flex-1 h-9 rounded-xl">Add Field</Button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingField(true)} className="mt-2 flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline">
                <Plus className="w-3.5 h-3.5" /> Add Custom Dropdown
              </button>
            )}
          </section>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 h-10 rounded-xl">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 h-10 rounded-xl bg-gradient-primary">{saving ? "Saving…" : "Save Settings"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── View Types ───────────────────────────────────────────────────────────────

// ─── Task Card (List view) ────────────────────────────────────────────────────

function TaskCard({ task, onOpen, onDelete, onToggleToday, onStatusChange, settings, colourBy, selected = false }: {
  task: Task; onOpen: () => void; onDelete: () => void;
  onToggleToday: () => void; onStatusChange: (s: TaskStatus) => void;
  settings: TaskSettings; colourBy: ColourBy;
  selected?: boolean;
}) {
  const isDone = task.status === "done";
  const isHighPriority = task.priority === "critical" || task.priority === "high";
  const subtaskCount = task.subtasks?.length ?? 0;
  const subtaskDone = task.subtasks?.filter((s) => s.done).length ?? 0;
  const hasNotes = !!task.notes?.trim() || !!task.description?.trim();
  const accentColour = getTaskColour(task, colourBy, settings);
  const catColour = settings.categoryColors?.[task.category];
  const overdue = isTaskOverdue(task);

  const toggleDone = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStatusChange(isDone ? "todo" : "done");
  };

  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onOpen}
      className={`group relative flex items-center gap-3 px-3.5 py-2.5 cursor-pointer transition-colors ${
        selected ? "bg-primary/8" : "hover:bg-muted/50"
      } ${isDone ? "opacity-50" : ""}`}
    >
      {accentColour && (
        <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full" style={{ background: accentColour }} />
      )}
      <DoneCheckbox done={isDone} onClick={toggleDone} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className={`text-sm font-medium leading-snug truncate ${isDone ? "line-through text-muted-foreground" : "text-card-foreground"}`}>{task.title}</p>
          {isHighPriority && !isDone && (
            <Flag className={`w-3 h-3 flex-shrink-0 ${task.priority === "critical" ? "text-red-500 fill-red-500" : "text-orange-400 fill-orange-400"}`} />
          )}
          {task.status === "in_progress" && !isDone && (
            <span className="text-[10px] font-semibold px-1.5 py-px rounded-full bg-sky-500/15 text-sky-800 dark:text-sky-200 flex-shrink-0">Doing</span>
          )}
          {overdue && (
            <span className="text-[10px] font-semibold px-1.5 py-px rounded-full bg-red-500/15 text-red-700 dark:text-red-300 flex-shrink-0">Overdue</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
          {task.category && (
            catColour ? (
              <span className="text-[10px] font-semibold px-1.5 py-px rounded-full flex-shrink-0" style={{ background: `${catColour}22`, color: catColour }}>{task.category}</span>
            ) : (
              <span className="text-[10px] text-muted-foreground flex-shrink-0">{task.category}</span>
            )
          )}
          {task.company && <span className="text-[10px] text-muted-foreground/70 truncate">· {task.company}</span>}
          {task.dueDate && (
            <span className={`text-[10px] flex-shrink-0 ${overdue ? "text-red-600 font-semibold" : "text-muted-foreground/70"}`}>
              · {formatTaskDue(task.dueDate)}
            </span>
          )}
          {subtaskCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70 flex-shrink-0">
              <ListChecks className="w-2.5 h-2.5" />
              {subtaskDone}/{subtaskCount}
              <span className="w-10 h-1 bg-muted rounded-full overflow-hidden">
                <span className="block h-full bg-emerald-400 rounded-full" style={{ width: `${(subtaskDone / subtaskCount) * 100}%` }} />
              </span>
            </span>
          )}
          {hasNotes && <StickyNote className="w-2.5 h-2.5 text-muted-foreground/40 flex-shrink-0" />}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleToday(); }}
          className={`p-1.5 rounded-lg transition-colors ${task.isToday ? "text-amber-500" : "text-muted-foreground hover:text-amber-400"}`}
          title={task.isToday ? "Remove from Today" : "Add to Today"}
        >
          <Sun className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive transition-colors"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
      </div>
    </motion.div>
  );
}

// ─── Tile Card (drag-reorderable) ─────────────────────────────────────────────

function TileCard({ task, onOpen, onDelete, onToggleToday, onStatusChange, onUrgencyChange, settings, colourBy, isDragging, onDragStart, onDragOver, onDrop }: {
  task: Task; onOpen: () => void; onDelete: () => void;
  onToggleToday: () => void; onStatusChange: (s: TaskStatus) => void;
  onUrgencyChange: (u: UrgencyLevel) => void;
  settings: TaskSettings; colourBy: ColourBy;
  isDragging: boolean;
  onDragStart: () => void; onDragOver: (e: React.DragEvent) => void; onDrop: () => void;
}) {
  const isHighPriority = task.priority === "critical" || task.priority === "high";
  const isDone = task.status === "done";
  const subtaskCount = task.subtasks?.length ?? 0;
  const subtaskDone = task.subtasks?.filter((s) => s.done).length ?? 0;
  const accentColour = getTaskColour(task, colourBy, settings);
  const urgency = (task.urgency ?? "none") as UrgencyLevel;

  const toggleDone = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStatusChange(isDone ? "todo" : "done");
  };

  const handleUrgency = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUrgencyChange(cycleUrgency(urgency));
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => { e.preventDefault(); onDragOver(e); }}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
      onClick={onOpen}
      className={`relative rounded-2xl border cursor-pointer hover:shadow-md transition-all group overflow-hidden ${isDone ? "opacity-55" : ""} ${isDragging ? "opacity-40 scale-95" : ""}`}
      style={accentColour ? {
        borderColor: `${accentColour}55`,
        background: `linear-gradient(135deg, ${accentColour}20 0%, ${accentColour}08 100%)`,
      } : { borderColor: undefined }}
    >
      {accentColour && <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${accentColour}, ${accentColour}88)` }} />}
      <div className="p-3">
        <div className="flex items-start gap-1.5 mb-2">
          <UrgencyDot urgency={urgency} done={isDone} onClick={handleUrgency} />
          <p className={`flex-1 text-xs font-semibold leading-snug ${isDone ? "line-through text-muted-foreground" : ""}`}>{task.title}</p>
          {isHighPriority && <Flag className={`w-2.5 h-2.5 flex-shrink-0 mt-0.5 ${task.priority === "critical" ? "text-red-500 fill-red-500" : "text-orange-400 fill-orange-400"}`} />}
        </div>
        <div className="flex flex-wrap gap-1 mb-1.5">
          {task.category && (() => {
            const catColour = settings.categoryColors?.[task.category];
            return catColour ? (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: `${catColour}25`, color: catColour }}>{task.category}</span>
            ) : (
              <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{task.category}</span>
            );
          })()}
          {task.dueDate && <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{new Date(task.dueDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
        </div>
        <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1.5">
            {subtaskCount > 0 && <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground"><ListChecks className="w-2.5 h-2.5" />{subtaskDone}/{subtaskCount}</span>}
          </div>
            <div className="flex gap-0.5 items-center">
              <button onClick={(e) => { e.stopPropagation(); onToggleToday(); }} className={`p-0.5 rounded ${task.isToday ? "text-amber-500" : "text-muted-foreground hover:text-amber-400"}`}><Sun className="w-2.5 h-2.5" /></button>
              <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-0.5 rounded text-muted-foreground hover:text-destructive"><Trash2 className="w-2.5 h-2.5" /></button>
              <DoneCheckbox done={isDone} onClick={toggleDone} size="sm" />
            </div>
        </div>
      </div>
      {subtaskCount > 0 && (
        <div className="h-0.5 bg-muted rounded-full overflow-hidden mx-3 mb-2">
          <div className="h-full bg-green-400 rounded-full" style={{ width: `${(subtaskDone / subtaskCount) * 100}%` }} />
        </div>
      )}
      {/* Drag handle indicator */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-30 transition-opacity pointer-events-none">
        <GripVertical className="w-3 h-3 text-muted-foreground" />
      </div>
    </div>
  );
}

// ─── KanbanCard ───────────────────────────────────────────────────────────────

function KanbanCard({ task, onOpen, onDelete, onToggleToday, onStatusChange, onUrgencyChange, settings, colourBy }: {
  task: Task; onOpen: () => void; onDelete: () => void;
  onToggleToday: () => void; onStatusChange: (s: TaskStatus) => void;
  onUrgencyChange: (u: UrgencyLevel) => void;
  settings: TaskSettings; colourBy: ColourBy;
}) {
  const isHighPriority = task.priority === "critical" || task.priority === "high";
  const isDone = task.status === "done";
  const subtaskCount = task.subtasks?.length ?? 0;
  const subtaskDone = task.subtasks?.filter((s) => s.done).length ?? 0;
  const accentColour = getTaskColour(task, colourBy, settings);
  const urgency = (task.urgency ?? "none") as UrgencyLevel;

  const toggleDone = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStatusChange(isDone ? "todo" : "done");
  };

  const handleUrgency = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUrgencyChange(cycleUrgency(urgency));
  };

  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
      onClick={onOpen}
      className={`rounded-xl border cursor-pointer hover:shadow-sm transition-all group overflow-hidden ${isDone ? "opacity-55" : ""}`}
      style={accentColour ? {
        borderColor: `${accentColour}55`,
        background: `linear-gradient(135deg, ${accentColour}18 0%, ${accentColour}08 100%)`,
      } : { borderColor: undefined }}
    >
      {accentColour && <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${accentColour}, ${accentColour}88)` }} />}
      <div className="p-2">
        <div className="flex items-start gap-1.5 mb-1">
          <UrgencyDot urgency={urgency} done={isDone} onClick={handleUrgency} />
          <p className={`flex-1 text-[11px] font-semibold leading-snug ${isDone ? "line-through text-muted-foreground" : ""}`}>{task.title}</p>
          {isHighPriority && <Flag className={`w-2.5 h-2.5 flex-shrink-0 mt-0.5 ${task.priority === "critical" ? "text-red-500 fill-red-500" : "text-orange-400 fill-orange-400"}`} />}
        </div>
        <div className="flex flex-wrap gap-1 mb-1">
          {task.category && (() => {
            const catColour = settings.categoryColors?.[task.category];
            return catColour ? (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: `${catColour}25`, color: catColour }}>{task.category}</span>
            ) : (
              <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{task.category}</span>
            );
          })()}
          {task.dueDate && <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{new Date(task.dueDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
        </div>
        <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1.5">
            {subtaskCount > 0 && <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground"><ListChecks className="w-2.5 h-2.5" />{subtaskDone}/{subtaskCount}</span>}
          </div>
            <div className="flex gap-0.5 items-center">
              <button onClick={(e) => { e.stopPropagation(); onToggleToday(); }} className={`p-0.5 rounded ${task.isToday ? "text-amber-500" : "text-muted-foreground hover:text-amber-400"}`}><Sun className="w-2.5 h-2.5" /></button>
              <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-0.5 rounded text-muted-foreground hover:text-destructive"><Trash2 className="w-2.5 h-2.5" /></button>
              <DoneCheckbox done={isDone} onClick={toggleDone} size="sm" />
            </div>
        </div>
      </div>
      {subtaskCount > 0 && (
        <div className="h-0.5 bg-muted rounded-full overflow-hidden mx-2 mb-1.5">
          <div className="h-full bg-green-400 rounded-full" style={{ width: `${(subtaskDone / subtaskCount) * 100}%` }} />
        </div>
      )}
    </motion.div>
  );
}

// ─── KanbanView ───────────────────────────────────────────────────────────────

function KanbanView({ tasks, settings, onOpen, onDelete, onToggleToday, onStatusChange, onUrgencyChange, colourBy }: {
  tasks: Task[]; settings: TaskSettings; colourBy: ColourBy;
  onOpen: (t: Task) => void; onDelete: (t: Task) => void;
  onToggleToday: (t: Task) => void; onStatusChange: (t: Task, s: TaskStatus) => void;
  onUrgencyChange: (t: Task, u: UrgencyLevel) => void;
}) {
  const [groupBy, setGroupBy] = useState<string>("status");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterCompany, setFilterCompany] = useState<string>("");
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [showColToggle, setShowColToggle] = useState(false);

  const groupOptions: { value: string; label: string }[] = [
    { value: "status", label: "Status" },
    { value: "priority", label: "Priority" },
    { value: "category", label: "Category" },
    ...(settings.companies.length > 0 ? [{ value: "company", label: "Company" }] : []),
    ...settings.customFields.map((f) => ({ value: `cf_${f.id}`, label: f.label })),
  ];

  const columns: { key: string; label: string; color: string }[] = useMemo(() => {
    if (groupBy === "status") return STATUSES.map((s) => ({ key: s.value, label: s.label, color: s.color }));
    if (groupBy === "priority") return PRIORITIES.map((p) => ({ key: p.value, label: p.label, color: p.color }));
    if (groupBy === "category") {
      const cats = [...new Set([...settings.categories, ...tasks.map((t) => t.category).filter(Boolean)])];
      return cats.map((c) => ({ key: c, label: c, color: "text-foreground" }));
    }
    if (groupBy === "company") {
      const cos = [...new Set([...settings.companies, ...tasks.map((t) => t.company ?? "").filter(Boolean)])];
      return [{ key: "", label: "No Company", color: "text-muted-foreground" }, ...cos.map((c) => ({ key: c, label: c, color: "text-foreground" }))];
    }
    const cfId = groupBy.replace("cf_", "");
    const field = settings.customFields.find((f) => f.id === cfId);
    if (field) return [{ key: "", label: "None", color: "text-muted-foreground" }, ...field.options.map((o) => ({ key: o, label: o, color: "text-foreground" }))];
    return [];
  }, [groupBy, settings, tasks]);

  const visibleTasks = useMemo(() => {
    let list = tasks;
    if (filterCategory) list = list.filter((t) => t.category === filterCategory);
    if (filterCompany) list = list.filter((t) => (t.company ?? "") === filterCompany);
    if (filterPriority) list = list.filter((t) => t.priority === filterPriority);
    return list;
  }, [tasks, filterCategory, filterCompany, filterPriority]);

  const getColTasks = (colKey: string) => {
    if (groupBy === "status") return visibleTasks.filter((t) => t.status === colKey);
    if (groupBy === "priority") return visibleTasks.filter((t) => t.priority === colKey);
    if (groupBy === "category") return visibleTasks.filter((t) => t.category === colKey);
    if (groupBy === "company") return visibleTasks.filter((t) => (t.company ?? "") === colKey);
    const cfId = groupBy.replace("cf_", "");
    return visibleTasks.filter((t) => (t.customFields?.[cfId] ?? "") === colKey);
  };

  const toggleCol = (key: string) =>
    setHiddenCols((prev) => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });

  const visibleColumns = columns.filter((c) => !hiddenCols.has(c.key));

  const hasActiveFilter = !!(filterCategory || filterCompany || filterPriority);

  return (
    <div>
      {/* Single compact controls row */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        {/* Group-by segmented pill */}
        <div className="flex items-center gap-0.5 bg-muted/50 rounded-full p-0.5">
          {groupOptions.map((o) => (
            <button key={o.value} onClick={() => setGroupBy(o.value)}
              className={`text-[10px] font-semibold px-2.5 py-1 rounded-full transition-all duration-150 whitespace-nowrap ${groupBy === o.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {o.label}
            </button>
          ))}
        </div>

        {/* Filter dropdown(s) — only show if options exist */}
        {(settings.categories.length > 0 || settings.companies.length > 0) && (
          <select
            value={filterCategory || filterCompany || filterPriority}
            onChange={(e) => {
              const val = e.target.value;
              setFilterCategory(settings.categories.includes(val) ? val : "");
              setFilterCompany(settings.companies.includes(val) ? val : "");
              setFilterPriority(PRIORITIES.find((p) => p.value === val) ? val : "");
            }}
            className="text-[10px] font-semibold bg-muted/50 rounded-full px-3 py-1.5 border-0 cursor-pointer text-muted-foreground focus:outline-none"
          >
            <option value="">All</option>
            {settings.categories.length > 0 && <optgroup label="Category">
              {settings.categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </optgroup>}
            {settings.companies.length > 0 && <optgroup label="Company">
              {settings.companies.map((c) => <option key={c} value={c}>{c}</option>)}
            </optgroup>}
            <optgroup label="Priority">
              {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </optgroup>
          </select>
        )}
        {/* Priority filter only (when no cats/cos) */}
        {settings.categories.length === 0 && settings.companies.length === 0 && (
          <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="text-[10px] font-semibold bg-muted/50 rounded-full px-3 py-1.5 border-0 cursor-pointer text-muted-foreground focus:outline-none">
            <option value="">All priorities</option>
            {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        )}

        {/* Clear filter dot */}
        {hasActiveFilter && (
          <button onClick={() => { setFilterCategory(""); setFilterCompany(""); setFilterPriority(""); }}
            className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center hover:bg-primary/80 transition-colors" title="Clear filter">
            ×
          </button>
        )}

        {/* Column toggle button */}
        <button onClick={() => setShowColToggle((v) => !v)}
          className={`ml-auto flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full transition-all duration-150 ${showColToggle ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground hover:text-foreground"}`}>
          {showColToggle ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          Columns
          {hiddenCols.size > 0 && <span className="ml-0.5 w-3.5 h-3.5 rounded-full bg-primary text-primary-foreground text-[8px] font-bold flex items-center justify-center">{hiddenCols.size}</span>}
        </button>
      </div>

      {/* Column show/hide toggles — collapsible */}
      <AnimatePresence>
        {showColToggle && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden mb-3">
            <div className="flex flex-wrap gap-1.5 p-2 bg-muted/30 rounded-2xl">
              {columns.map((col) => (
                <button key={col.key} onClick={() => toggleCol(col.key)}
                  className={`flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full transition-all duration-150 ${
                    hiddenCols.has(col.key) ? "bg-muted/40 text-muted-foreground/50" : "bg-primary/10 text-primary border border-primary/20"
                  }`}>
                  {hiddenCols.has(col.key) ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                  {col.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kanban columns */}
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(visibleColumns.length, 5)}, minmax(0, 1fr))` }}>
        {visibleColumns.map((col) => {
          const colTasks = getColTasks(col.key);
          return (
            <div key={col.key} className="flex flex-col gap-2 min-w-0">
              <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-full bg-muted/50">
                {groupBy === "status" && <span className={col.color}><StatusIcon status={col.key as TaskStatus} className="w-3 h-3" /></span>}
                {groupBy === "priority" && <Flag className={`w-3 h-3 ${col.color}`} />}
                <span className="text-[11px] font-bold flex-1 truncate">{col.label}</span>
                <span className="text-[9px] font-bold bg-background px-1.5 py-0.5 rounded-full text-muted-foreground">{colTasks.length}</span>
              </div>
              <div className="flex flex-col gap-1.5 min-h-[60px]">
                <AnimatePresence mode="popLayout">
                  {colTasks.length === 0 ? (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl bg-muted/40 px-3 py-6 text-center">
                      <p className="text-[11px] text-foreground/70">Nothing here yet</p>
                    </motion.div>
                  ) : (
                    colTasks.map((task) => (
                      <KanbanCard key={task.id} task={task} settings={settings} colourBy={colourBy}
                        onOpen={() => onOpen(task)} onDelete={() => onDelete(task)}
                        onToggleToday={() => onToggleToday(task)} onStatusChange={(s) => onStatusChange(task, s)}
                        onUrgencyChange={(u) => onUrgencyChange(task, u)}
                      />
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── CompanyGroupView ─────────────────────────────────────────────────────────

function CompanyGroupView({
  tasks,
  settings,
  onOpen,
  onEdit,
  onDelete,
  onToggleTaskToday,
  onStatusChange,
}: {
  tasks: Task[];
  settings: TaskSettings;
  onOpen: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  onToggleTaskToday: (t: Task) => void;
  onStatusChange: (t: Task, s: TaskStatus) => void;
}) {
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(() => new Set());

  const groups = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      const key = t.company || "__none__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return [...map.entries()].sort(([a], [b]) => {
      if (a === "__none__") return 1;
      if (b === "__none__") return -1;
      return a.localeCompare(b);
    });
  }, [tasks]);

  const toggleCompany = (key: string) =>
    setExpandedCompanies((prev) => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });

  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-10">No tasks match this filter.</p>;
  }

  return (
    <div className="space-y-3">
      {groups.map(([companyKey, companyTasks]) => {
        const label = companyKey === "__none__" ? "No Company" : companyKey;
        const isExpanded = expandedCompanies.has(companyKey);
        const colour = settings.companyColors?.[companyKey] ?? "";
        const doneCount = companyTasks.filter((t) => t.status === "done").length;

        return (
          <div key={companyKey} className="rounded-2xl border border-border/40 overflow-hidden bg-card shadow-soft">
            {/* Company header */}
            <button
              onClick={() => toggleCompany(companyKey)}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors"
              style={colour ? { borderLeftColor: colour, borderLeftWidth: 3 } : undefined}
            >
              {colour ? (
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: colour }} />
              ) : (
                <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )}
              <span className="flex-1 text-sm font-bold text-left">{label}</span>
              <span className="text-[11px] font-semibold text-muted-foreground mr-1">
                {doneCount}/{companyTasks.length}
              </span>
              <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
            </button>

            {/* Task list */}
            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  key="tasks"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-border/30 divide-y divide-border/20">
                    {companyTasks.map((task) => {
                      const subs = task.subtasks ?? [];
                      const subDone = subs.filter((s) => s.done).length;
                      const isDone = task.status === "done";
                      const pData = PRIORITIES.find((p) => p.value === task.priority)!;

                      return (
                        <div
                          key={task.id}
                          className={`flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/40 transition-colors group/task cursor-pointer ${isDone ? "opacity-50" : ""}`}
                          onClick={() => onOpen(task)}
                        >
                          <button
                            onClick={(e) => { e.stopPropagation(); onStatusChange(task, isDone ? "todo" : "done"); }}
                            className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isDone ? "bg-green-500 border-green-500 text-white" : "border-border hover:border-green-400"}`}
                          >
                            {isDone && <CheckCircle2 className="w-2.5 h-2.5" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${isDone ? "line-through text-muted-foreground" : ""}`}>{task.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: `${pData.hex}22`, color: pData.hex }}>{pData.label}</span>
                              {subs.length > 0 && (
                                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <ListChecks className="w-2.5 h-2.5" />{subDone}/{subs.length}
                                  <span className="w-10 h-1 bg-muted rounded-full overflow-hidden">
                                    <span className="block h-full bg-emerald-400 rounded-full" style={{ width: `${(subDone / subs.length) * 100}%` }} />
                                  </span>
                                </span>
                              )}
                              {task.dueDate && <span className="text-[10px] text-muted-foreground">{new Date(task.dueDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => onToggleTaskToday(task)} className={`p-1 rounded-lg transition-colors ${task.isToday ? "text-amber-500" : "text-muted-foreground hover:text-amber-400"}`} title="Add task to Today"><Sun className="w-3.5 h-3.5" /></button>
                            <button onClick={() => onEdit(task)} className="p-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors" title="Edit task"><Settings2 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => onDelete(task)} className="p-1 rounded-lg text-muted-foreground hover:text-destructive transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const Tasks = () => {
  const { scopeUserId, permission, pageTitle, isOwnScope } = useSharedScope("tasks");
  const canEdit = permission === "edit";
  const { tasks, loading: tasksLoading, addTask, updateTask, deleteTask, toggleToday, setStatus } = useTasks(scopeUserId ?? undefined);
  const { settings, loading: settingsLoading, saveSettings } = useTaskSettings();

  const [filter, setFilter] = useState<TaskFilter>("all");
  const [query, setQuery] = useState("");
  const [quickTitle, setQuickTitle] = useState("");
  const [showCompletedOverride, setShowCompletedOverride] = useState<boolean | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);
  const showCompleted = showCompletedOverride ?? !!settings.showCompleted;
  const [viewMode, setViewMode] = useState<TaskView>(readStoredView);
  const [colourBy, setColourBy] = useState<ColourBy>(readStoredColour);

  const [tileOrder, setTileOrder] = useState<string[]>([]);
  const dragId = useRef<string | null>(null);
  const dragOverId = useRef<string | null>(null);

  useEffect(() => {
    if (settings.tileOrder?.length) setTileOrder(settings.tileOrder);
  }, [settings.tileOrder]);

  const changeView = (mode: TaskView) => {
    setViewMode(mode);
    try { localStorage.setItem(VIEW_STORAGE, mode); } catch { /* ignore */ }
  };

  const changeColour = (value: ColourBy) => {
    setColourBy(value);
    try { localStorage.setItem(COLOUR_STORAGE, value); } catch { /* ignore */ }
  };

  const setUrgency = useCallback(async (id: string, urgency: UrgencyLevel) => {
    await updateTask(id, { urgency } as Partial<Task>);
  }, [updateTask]);

  const filtered = useMemo(
    () => sortTasks(filterTasks(tasks, { filter, query, showCompleted })),
    [tasks, filter, query, showCompleted],
  );

  const orderedTiles = useMemo(() => {
    if (tileOrder.length === 0) return filtered;
    const orderMap = new Map(tileOrder.map((id, i) => [id, i]));
    return [...filtered].sort((a, b) => {
      const ai = orderMap.has(a.id!) ? orderMap.get(a.id!)! : 999;
      const bi = orderMap.has(b.id!) ? orderMap.get(b.id!)! : 999;
      return ai - bi;
    });
  }, [filtered, tileOrder]);

  const handleDrop = useCallback((targetId: string) => {
    if (!dragId.current || dragId.current === targetId) return;
    const ids = orderedTiles.map((t) => t.id!);
    const fromIdx = ids.indexOf(dragId.current);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = [...ids];
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, dragId.current);
    setTileOrder(next);
    dragId.current = null;
    void saveSettings({ ...settings, tileOrder: next });
  }, [orderedTiles, saveSettings, settings]);

  const handleSave = async (form: Omit<Task, "id" | "createdAt" | "updatedAt">) => {
    setSaving(true);
    try {
      if (editTask?.id) {
        await updateTask(editTask.id, form);
        toast.success("Task updated");
      } else {
        await addTask(form);
        toast.success("Task added");
      }
      setDialogOpen(false);
      setEditTask(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save that task.");
    } finally {
      setSaving(false);
    }
  };

  const draftFromFilter = (title = "") => {
    const extras: Partial<Task> = { title };
    if (filter === "today") extras.isToday = true;
    if (filter === "critical") extras.priority = "critical";
    if (filter === "progress") extras.status = "in_progress";
    const category = filter.startsWith("category:") ? filter.slice("category:".length) : (settings.categories[0] ?? "Other");
    if (filter.startsWith("company:")) extras.company = filter.slice("company:".length);
    return defaultTaskDraft(category, extras);
  };

  const handleQuickAdd = async () => {
    const title = quickTitle.trim();
    if (!title || !canEdit) return;
    try {
      await addTask(draftFromFilter(title));
      setQuickTitle("");
      toast.success("Task added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add that task.");
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete?.id) return;
    try {
      await deleteTask(pendingDelete.id);
      if (detailTask?.id === pendingDelete.id) setDetailOpen(false);
      toast.success("Task deleted");
    } catch {
      toast.error("Could not delete that task.");
    } finally {
      setPendingDelete(null);
    }
  };

  const openAdd = () => { setEditTask(null); setDialogOpen(true); };
  const openDetail = (task: Task) => { setDetailTask(task); setDetailOpen(true); };
  const openEdit = (task: Task) => { setEditTask(task); setDetailOpen(false); setDialogOpen(true); };

  const liveDetailTask = detailTask ? tasks.find((t) => t.id === detailTask.id) ?? detailTask : null;

  const todayCount = tasks.filter((t) => t.isToday && t.status !== "done").length;
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const criticalCount = tasks.filter((t) => t.priority === "critical" && t.status !== "done").length;
  const overdueCount = tasks.filter((t) => isTaskOverdue(t)).length;

  const emptyCopy = tasks.length === 0
    ? "No tasks yet. Add one below or tap New."
    : showCompleted
      ? "Nothing matches this filter."
      : "No open tasks. Show completed to see finished ones.";

  const railItem = (id: TaskFilter, label: string, Icon: React.ElementType, count?: number, accent?: string) => {
    const on = filter === id;
    return (
      <button key={id} type="button" onClick={() => setFilter(id)} className={railBtnClass(on)}>
        {on && accent && <span className="absolute left-0 top-1.5 bottom-1.5 hidden w-1 rounded-full bg-white/80 sm:block" />}
        {!on && accent && <span className="absolute left-0 top-1.5 bottom-1.5 hidden w-1 rounded-full sm:block" style={{ background: accent }} />}
        <Icon className="h-4 w-4 shrink-0" />
        <span className="w-full truncate text-[10px] font-semibold leading-tight sm:text-sm">{label}</span>
        {count != null && count > 0 && (
          <span className={`text-[10px] font-bold px-1.5 py-px rounded-full ${on ? "bg-white/20" : "bg-card text-foreground/70"}`}>{count}</span>
        )}
      </button>
    );
  };

  if (tasksLoading || settingsLoading) {
    return (
      <FeaturePageShell title={pageTitle} subtitle="What needs doing" icon={<CheckSquare className="w-5 h-5" />} sharePage="tasks">
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </FeaturePageShell>
    );
  }

  return (
    <FeaturePageShell
      title={pageTitle}
      subtitle={isOwnScope ? "What needs doing" : "Shared with you"}
      icon={<CheckSquare className="w-5 h-5" />}
      sharePage="tasks"
      action={
        <div className="flex items-center gap-1.5">
          {canEdit && (
            <Button size="sm" className="rounded-xl bg-gradient-primary" onClick={openAdd}>
              <Plus className="mr-1 h-4 w-4" /> New
            </Button>
          )}
          <Button size="icon" variant="ghost" onClick={() => setSettingsOpen(true)} aria-label="Task settings">
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
      }
    >
      <div className="flex min-w-0 gap-3">
        <aside className="w-[4.5rem] shrink-0 sm:w-[10.75rem]">
          <div className="sticky top-2 space-y-1">
            {railItem("all", "All", CheckSquare, tasks.filter((t) => showCompleted || t.status !== "done").length)}
            {railItem("today", "Today", Sun, todayCount, "hsl(38, 92%, 50%)")}
            {railItem("overdue", "Overdue", AlertTriangle, overdueCount, "hsl(0, 72%, 51%)")}
            {railItem("progress", "Doing", Clock, tasks.filter((t) => t.status === "in_progress").length, "hsl(199, 89%, 48%)")}
            {railItem("critical", "Critical", Flag, criticalCount, "hsl(0, 72%, 51%)")}
            <p className="hidden sm:block pt-2 pb-1 px-2 text-[10px] font-bold uppercase tracking-widest text-foreground/55">Categories</p>
            {settings.categories.map((cat) =>
              railItem(`category:${cat}`, cat, Circle, tasks.filter((t) => t.category === cat && (showCompleted || t.status !== "done")).length, settings.categoryColors?.[cat])
            )}
            {settings.companies.length > 0 && (
              <>
                <p className="hidden sm:block pt-2 pb-1 px-2 text-[10px] font-bold uppercase tracking-widest text-foreground/55">Companies</p>
                {settings.companies.map((co) =>
                  railItem(`company:${co}`, co, Building2, tasks.filter((t) => t.company === co && (showCompleted || t.status !== "done")).length, settings.companyColors?.[co])
                )}
              </>
            )}
          </div>
        </aside>

        <div className="min-w-0 flex-1 overflow-x-hidden">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks" className="h-10 rounded-xl border-2 bg-card pl-9 shadow-soft" />
            </div>
            <div className="flex items-center gap-1 rounded-2xl border-2 border-border bg-card p-1 shadow-soft">
              {([["list", LayoutList, "List"], ["tile", LayoutGrid, "Tiles"], ["kanban", Columns2, "Board"], ["company", Building2, "By company"]] as [TaskView, React.ElementType, string][]).map(([mode, Icon, label]) => (
                <button key={mode} type="button" title={label} onClick={() => changeView(mode)}
                  className={`relative z-10 rounded-xl p-2 ${viewMode === mode ? "text-primary-foreground" : "text-foreground/70 hover:text-foreground"}`}
                >
                  {viewMode === mode && (
                    <motion.span layoutId="tasks-view-tab" className="absolute inset-0 -z-10 rounded-xl bg-gradient-primary shadow-sm" transition={{ type: "spring", stiffness: 500, damping: 35 }} />
                  )}
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                const next = !showCompleted;
                setShowCompletedOverride(next);
                void saveSettings({ ...settings, showCompleted: next });
              }}
              title={showCompleted ? "Hide completed tasks" : "Show completed tasks"}
              className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-2 rounded-xl border-2 transition-colors ${
                showCompleted
                  ? "border-emerald-400/40 bg-emerald-500/12 text-emerald-800 dark:text-emerald-200"
                  : "border-border bg-card text-foreground/70 hover:text-foreground"
              }`}
            >
              {showCompleted ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{showCompleted ? "Done shown" : "Done hidden"}</span>
              {!showCompleted && doneCount > 0 && (
                <span className="text-[10px] font-bold bg-card text-foreground px-1.5 py-px rounded-full border border-border">{doneCount}</span>
              )}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { id: "today" as TaskFilter, label: "Today", value: todayCount, text: "text-amber-800 dark:text-amber-200", bg: "bg-amber-500/15", border: "border-amber-400/40" },
              { id: "critical" as TaskFilter, label: "Critical", value: criticalCount, text: "text-red-800 dark:text-red-200", bg: "bg-red-500/15", border: "border-red-400/40" },
              { id: "overdue" as TaskFilter, label: "Overdue", value: overdueCount, text: "text-red-800 dark:text-red-200", bg: "bg-red-500/12", border: "border-red-400/35" },
            ].map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => setFilter(s.id)}
                className={`rounded-xl border-2 ${s.border} ${s.bg} px-3 py-2 text-center transition ${filter === s.id ? "ring-2 ring-primary/40" : "hover:brightness-[1.03]"}`}
              >
                <p className={`text-xl font-bold font-display leading-none ${s.text}`}>{s.value}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground/70 mt-1">{s.label}</p>
              </button>
            ))}
          </div>

          {canEdit && (
            <form
              className="mb-3 flex gap-2"
              onSubmit={(e) => { e.preventDefault(); void handleQuickAdd(); }}
            >
              <Input
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                placeholder={filter === "today" ? "Add something for today" : "Add a task and press Enter"}
                className="h-11 rounded-xl border-2 bg-card shadow-soft"
              />
              <Button type="submit" disabled={!quickTitle.trim()} className="h-11 rounded-xl bg-gradient-primary px-4">
                Add
              </Button>
            </form>
          )}

          {viewMode === "company" ? (
            <CompanyGroupView
              tasks={filtered}
              settings={settings}
              onOpen={openDetail}
              onEdit={openEdit}
              onDelete={(t) => setPendingDelete(t)}
              onToggleTaskToday={(t) => t.id && toggleToday(t.id, t.isToday)}
              onStatusChange={(t, s) => t.id && setStatus(t.id, s)}
            />
          ) : viewMode === "kanban" ? (
            <KanbanView tasks={filtered} settings={settings} colourBy={colourBy}
              onOpen={openDetail} onDelete={(t) => setPendingDelete(t)}
              onToggleToday={(t) => t.id && toggleToday(t.id, t.isToday)}
              onStatusChange={(t, s) => t.id && setStatus(t.id, s)}
              onUrgencyChange={(t, u) => t.id && setUrgency(t.id, u)}
            />
          ) : viewMode === "tile" ? (
            <div>
              {orderedTiles.length === 0 ? (
                <div className="rounded-2xl border-2 border-border bg-card px-6 py-14 text-center shadow-card">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
                    <CheckSquare className="h-6 w-6" />
                  </div>
                  <p className="font-display text-xl font-bold">{emptyCopy}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {orderedTiles.map((task) => (
                    <TileCard
                      key={task.id}
                      task={task}
                      settings={settings}
                      colourBy={colourBy}
                      isDragging={dragId.current === task.id}
                      onOpen={() => openDetail(task)}
                      onDelete={() => setPendingDelete(task)}
                      onToggleToday={() => task.id && toggleToday(task.id, task.isToday)}
                      onStatusChange={(s) => task.id && setStatus(task.id, s)}
                      onUrgencyChange={(u) => task.id && setUrgency(task.id, u)}
                      onDragStart={() => { dragId.current = task.id!; }}
                      onDragOver={() => { dragOverId.current = task.id!; }}
                      onDrop={() => handleDrop(task.id!)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-border bg-card overflow-hidden shadow-card">
              {filtered.length === 0 ? (
                <div className="px-6 py-14 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
                    <CheckSquare className="h-6 w-6" />
                  </div>
                  <p className="font-display text-xl font-bold">{emptyCopy}</p>
                  {canEdit && tasks.length === 0 && (
                    <Button className="mt-4 rounded-xl bg-gradient-primary" onClick={openAdd}>
                      <Plus className="mr-1 h-4 w-4" /> New task
                    </Button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {filtered.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      settings={settings}
                      colourBy={colourBy}
                      selected={detailOpen && detailTask?.id === task.id}
                      onOpen={() => openDetail(task)}
                      onDelete={() => setPendingDelete(task)}
                      onToggleToday={() => task.id && toggleToday(task.id, task.isToday)}
                      onStatusChange={(s) => task.id && setStatus(task.id, s)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <TaskDetailSheet
        task={liveDetailTask}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onEdit={() => liveDetailTask && openEdit(liveDetailTask)}
        onDelete={() => liveDetailTask && setPendingDelete(liveDetailTask)}
        onToggleToday={() => liveDetailTask?.id && toggleToday(liveDetailTask.id, liveDetailTask.isToday)}
        onStatusChange={(s) => liveDetailTask?.id && setStatus(liveDetailTask.id, s)}
        updateTask={updateTask}
        settings={settings}
        showCompleted={showCompleted}
      />

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditTask(null); }}>
        <DialogContent className="max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="font-display text-base">{editTask ? "Edit task" : "New task"}</DialogTitle>
          </DialogHeader>
          <TaskForm
            settings={settings}
            initial={editTask ? {
              title: editTask.title,
              description: editTask.description || editTask.notes || "",
              notes: editTask.notes || editTask.description || "",
              priority: editTask.priority,
              status: editTask.status,
              category: editTask.category,
              company: editTask.company || "",
              dueDate: editTask.dueDate || "",
              isToday: editTask.isToday,
              tags: editTask.tags || [],
              subtasks: editTask.subtasks ?? [],
              customFields: editTask.customFields ?? {},
            } : draftFromFilter()}
            onSave={handleSave}
            onCancel={() => { setDialogOpen(false); setEditTask(null); }}
            saving={saving}
          />
        </DialogContent>
      </Dialog>

      <TaskSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onSave={async (next) => {
          await saveSettings(next);
          setShowCompletedOverride(next.showCompleted ?? false);
        }}
        colourBy={colourBy}
        setColourBy={changeColour}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => { if (!o) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete ? `"${pendingDelete.title}" will be removed. This cannot be undone.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FeaturePageShell>
  );
};


export default Tasks;
