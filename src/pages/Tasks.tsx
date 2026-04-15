import { useState, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import {
  CheckSquare, Plus, Trash2, Sun, Circle, CheckCircle2,
  Clock, Settings2, X, Flag,
  LayoutList, LayoutGrid, Columns2, ListChecks, StickyNote,
  Eye, EyeOff, Palette, ChevronRight, GripVertical,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useTasks } from "@/hooks/useTasks";
import { useTaskSettings } from "@/hooks/useTaskSettings";
import { Task, TaskPriority, TaskStatus, TaskUrgency, TaskSettings, TaskCustomField, TaskSubtask } from "@/types/app";

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

const BASE_FILTER_TABS = ["All", "Today", "Priority", "Status", "Category", "Company"];

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
      title={done ? "Done" : urgency === "none" ? "No urgency — click to set amber" : urgency === "amber" ? "Amber urgency — click for red" : "Red urgency — click to clear"}
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
}: {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleToday: () => void;
  onStatusChange: (s: TaskStatus) => void;
  settings: TaskSettings;
}) {
  if (!task) return null;

  const priority = PRIORITIES.find((p) => p.value === task.priority)!;
  const status = STATUSES.find((s) => s.value === task.status)!;
  const subtaskCount = task.subtasks?.length ?? 0;
  const subtaskDone = task.subtasks?.filter((s) => s.done).length ?? 0;
  const isDone = task.status === "done";

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border/50">
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

          {/* Subtasks */}
          {subtaskCount > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Subtasks
                </p>
                <span className="text-xs text-muted-foreground">{subtaskDone}/{subtaskCount}</span>
              </div>
              {/* Progress bar */}
              <div className="h-1 bg-muted rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-green-400 rounded-full transition-all"
                  style={{ width: `${subtaskCount > 0 ? (subtaskDone / subtaskCount) * 100 : 0}%` }}
                />
              </div>
              <div className="space-y-1.5">
                {task.subtasks!.map((sub) => (
                  <div key={sub.id} className={`flex items-center gap-2.5 rounded-lg px-3 py-2 ${sub.done ? "bg-muted/30" : "bg-muted/50"}`}>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${sub.done ? "bg-green-500 border-green-500 text-white" : "border-border"}`}>
                      {sub.done && <CheckCircle2 className="w-3 h-3" />}
                    </div>
                    <span className={`text-sm flex-1 ${sub.done ? "line-through text-muted-foreground" : ""}`}>{sub.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

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

const EMPTY_TASK: Omit<Task, "id" | "createdAt" | "updatedAt"> = {
  title: "",
  description: "",
  notes: "",
  priority: "medium",
  status: "todo",
  urgency: "none",
  category: "Admin",
  company: "",
  dueDate: "",
  isToday: false,
  tags: [],
  subtasks: [],
  customFields: {},
};

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
  const [formTab, setFormTab] = useState<"details" | "subtasks" | "notes">("details");

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
    const sub: TaskSubtask = { id: Date.now().toString(), title: t, done: false };
    set("subtasks", [...(form.subtasks ?? []), sub]);
    setSubtaskInput("");
  };

  const toggleSubtask = (id: string) =>
    set("subtasks", (form.subtasks ?? []).map((s) => s.id === id ? { ...s, done: !s.done } : s));

  const removeSubtask = (id: string) =>
    set("subtasks", (form.subtasks ?? []).filter((s) => s.id !== id));

  const safeCategory = settings.categories.includes(form.category) ? form.category : settings.categories[0] ?? "Other";

  return (
    <div className="pt-1">
      {/* Form tabs */}
      <div className="flex gap-1 mb-4 bg-muted rounded-2xl p-1">
        {(["details", "subtasks", "notes"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFormTab(t)}
            className={`flex-1 text-xs font-semibold py-2 rounded-xl capitalize transition-all ${
              formTab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "subtasks" ? `Subtasks${form.subtasks?.length ? ` (${form.subtasks.length})` : ""}` : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {formTab === "details" && (
        <div className="space-y-3.5">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Title *</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Task title" className="h-10 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</Label>
            <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Optional details…" className="rounded-xl resize-none" rows={2} />
          </div>
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
          {settings.companies.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Company</Label>
              <Select value={form.company || ""} onValueChange={(v) => set("company", v === "__none__" ? "" : v)}>
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
          {settings.customFields.map((field) => (
            <div key={field.id} className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{field.label}</Label>
              <Select value={form.customFields?.[field.id] ?? ""} onValueChange={(v) => setCustomField(field.id, v)}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder={`Select ${field.label}…`} /></SelectTrigger>
                <SelectContent>
                  {field.options.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ))}
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
          <button
            onClick={() => set("isToday", !form.isToday)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors ${
              form.isToday ? "bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950/30 dark:border-amber-700" : "border-border text-muted-foreground hover:bg-muted/50"
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            {form.isToday ? "Added to Today ✓" : "Add to Today"}
          </button>
        </div>
      )}

      {formTab === "subtasks" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input value={subtaskInput} onChange={(e) => setSubtaskInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSubtask())} placeholder="Add subtask…" className="h-9 rounded-xl flex-1" />
            <Button type="button" variant="outline" onClick={addSubtask} className="h-9 rounded-xl px-3">Add</Button>
          </div>
          {(form.subtasks ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No subtasks yet.</p>
          ) : (
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
      )}

      {formTab === "notes" && (
        <div className="space-y-2">
          <Textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} placeholder="Private notes, links, context…" className="rounded-xl resize-none" rows={10} />
          <p className="text-[10px] text-muted-foreground">Notes are only visible to you.</p>
        </div>
      )}

      <div className="flex gap-2 pt-4 mt-2 border-t border-border/40">
        <Button variant="outline" onClick={onCancel} className="flex-1 h-10 rounded-xl">Cancel</Button>
        <Button onClick={() => onSave({ ...form, category: safeCategory })} disabled={!form.title.trim() || saving} className="flex-1 h-10 rounded-xl bg-gradient-primary">
          {saving ? "Saving…" : "Save Task"}
        </Button>
      </div>
    </div>
  );
}

// ─── SubFilter ────────────────────────────────────────────────────────────────

function SubFilter({ items, active, onSelect }: { items: { value: string; label: string }[]; active: string; onSelect: (v: string) => void }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 no-scrollbar">
      <button onClick={() => onSelect("")} className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${!active ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>All</button>
      {items.map((item) => (
        <button key={item.value} onClick={() => onSelect(item.value)} className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${active === item.value ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>{item.label}</button>
      ))}
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

type TaskView = "list" | "tile" | "kanban";

// ─── Task Card (List view) ────────────────────────────────────────────────────

function TaskCard({ task, onOpen, onDelete, onToggleToday, onStatusChange, onUrgencyChange, settings, colourBy }: {
  task: Task; onOpen: () => void; onDelete: () => void;
  onToggleToday: () => void; onStatusChange: (s: TaskStatus) => void;
  onUrgencyChange: (u: UrgencyLevel) => void;
  settings: TaskSettings; colourBy: ColourBy;
}) {
  const isDone = task.status === "done";
  const isHighPriority = task.priority === "critical" || task.priority === "high";
  const subtaskCount = task.subtasks?.length ?? 0;
  const subtaskDone = task.subtasks?.filter((s) => s.done).length ?? 0;
  const hasNotes = !!task.notes?.trim();
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
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
      onClick={onOpen}
      className={`group rounded-2xl border shadow-soft overflow-hidden cursor-pointer hover:shadow-md transition-all ${isDone ? "opacity-55" : ""}`}
      style={accentColour ? {
        borderColor: `${accentColour}55`,
        background: `linear-gradient(135deg, ${accentColour}18 0%, ${accentColour}08 100%)`,
      } : { borderColor: undefined }}
    >
      {accentColour && <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg, ${accentColour}, ${accentColour}88)` }} />}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        {/* Urgency dot */}
        <UrgencyDot urgency={urgency} done={isDone} onClick={handleUrgency} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className={`text-sm font-semibold leading-snug truncate ${isDone ? "line-through text-muted-foreground" : "text-card-foreground"}`}>{task.title}</p>
            {isHighPriority && !isDone && (
              <Flag className={`w-3 h-3 flex-shrink-0 ${task.priority === "critical" ? "text-red-500 fill-red-500" : "text-orange-400 fill-orange-400"}`} />
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {(() => {
              const catColour = settings.categoryColors?.[task.category];
              return catColour ? (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: `${catColour}22`, color: catColour }}>{task.category}</span>
              ) : (
                <span className="text-[10px] text-muted-foreground">{task.category}</span>
              );
            })()}
            {task.company && <span className="text-[10px] text-muted-foreground/70">· {task.company}</span>}
            {task.dueDate && <span className="text-[10px] text-muted-foreground/70">· {new Date(task.dueDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
            {subtaskCount > 0 && <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/70"><ListChecks className="w-2.5 h-2.5" />{subtaskDone}/{subtaskCount}</span>}
            {hasNotes && <StickyNote className="w-2.5 h-2.5 text-muted-foreground/50" />}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={(e) => { e.stopPropagation(); onToggleToday(); }} className={`p-1.5 rounded-lg transition-colors ${task.isToday ? "text-amber-500" : "text-muted-foreground hover:text-amber-400"}`} title="Toggle Today"><Sun className="w-3.5 h-3.5" /></button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          {task.isToday && <Sun className="w-3 h-3 text-amber-500 flex-shrink-0" />}
          {/* Done checkbox — always visible */}
          <DoneCheckbox done={isDone} onClick={toggleDone} />
        </div>
      </div>
      {subtaskCount > 0 && (
        <div className="h-0.5 bg-muted mx-3 mb-2 rounded-full overflow-hidden">
          <div className="h-full bg-green-400 rounded-full transition-all" style={{ width: `${(subtaskDone / subtaskCount) * 100}%` }} />
        </div>
      )}
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
            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={(e) => { e.stopPropagation(); onToggleToday(); }} className={`p-0.5 rounded ${task.isToday ? "text-amber-500" : "text-muted-foreground hover:text-amber-400"}`}><Sun className="w-2.5 h-2.5" /></button>
              <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-0.5 rounded text-muted-foreground hover:text-destructive"><Trash2 className="w-2.5 h-2.5" /></button>
            </div>
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
            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={(e) => { e.stopPropagation(); onToggleToday(); }} className={`p-0.5 rounded ${task.isToday ? "text-amber-500" : "text-muted-foreground hover:text-amber-400"}`}><Sun className="w-2.5 h-2.5" /></button>
              <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-0.5 rounded text-muted-foreground hover:text-destructive"><Trash2 className="w-2.5 h-2.5" /></button>
            </div>
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
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border-2 border-dashed border-border/40 py-5 text-center">
                      <p className="text-[10px] text-muted-foreground">Empty</p>
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

// ─── Main Page ────────────────────────────────────────────────────────────────

const Tasks = () => {
  const { tasks, loading: tasksLoading, addTask, updateTask, deleteTask, toggleToday, setStatus } = useTasks();
  const { settings, loading: settingsLoading, saveSettings } = useTaskSettings();

  const [activeTab, setActiveTab] = useState("All");
  const [filterValue, setFilterValue] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<TaskView>("list");
  const [colourBy, setColourBy] = useState<ColourBy>("none");

  // Tile drag state
  const [tileOrder, setTileOrder] = useState<string[]>([]);
  const dragId = useRef<string | null>(null);
  const dragOverId = useRef<string | null>(null);

  const setUrgency = useCallback(async (id: string, urgency: UrgencyLevel) => {
    await updateTask(id, { urgency } as Partial<Task>);
  }, [updateTask]);

  const filterTabs = useMemo(() => [...BASE_FILTER_TABS, ...settings.customFields.map((f) => f.label)], [settings.customFields]);

  const companyFilterOptions = useMemo(() => {
    const merged = [...new Set([...settings.companies, ...tasks.map((t) => t.company).filter(Boolean) as string[]])].sort();
    return merged;
  }, [settings.companies, tasks]);

  const filtered = useMemo(() => {
    let list = [...tasks];
    if (activeTab === "Today") list = list.filter((t) => t.isToday);
    if (activeTab === "Priority" && filterValue) list = list.filter((t) => t.priority === filterValue);
    if (activeTab === "Status" && filterValue) list = list.filter((t) => t.status === filterValue);
    if (activeTab === "Category" && filterValue) list = list.filter((t) => t.category === filterValue);
    if (activeTab === "Company" && filterValue) list = list.filter((t) => t.company === filterValue);
    const customField = settings.customFields.find((f) => f.label === activeTab);
    if (customField && filterValue) list = list.filter((t) => t.customFields?.[customField.id] === filterValue);
    const pw: Record<TaskPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    list.sort((a, b) => {
      const aDone = a.status === "done" ? 1 : 0;
      const bDone = b.status === "done" ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return pw[a.priority] - pw[b.priority];
    });
    return list;
  }, [tasks, activeTab, filterValue, settings.customFields]);

  // Tile view: apply custom order
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
  }, [orderedTiles]);

  const handleSave = async (form: Omit<Task, "id" | "createdAt" | "updatedAt">) => {
    setSaving(true);
    try {
      if (editTask?.id) { await updateTask(editTask.id, form); }
      else { await addTask(form); }
      setDialogOpen(false);
      setEditTask(null);
    } finally {
      setSaving(false);
    }
  };

  const openAdd = () => { setEditTask(null); setDialogOpen(true); };
  const openDetail = (task: Task) => { setDetailTask(task); setDetailOpen(true); };
  const openEdit = (task: Task) => { setEditTask(task); setDetailOpen(false); setDialogOpen(true); };

  // Sync detailTask with latest from tasks list
  const liveDetailTask = detailTask ? tasks.find((t) => t.id === detailTask.id) ?? detailTask : null;

  const todayCount = tasks.filter((t) => t.isToday && t.status !== "done").length;
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const criticalCount = tasks.filter((t) => t.priority === "critical" && t.status !== "done").length;

  if (tasksLoading || settingsLoading) {
    return (
      <FeaturePageShell title="Tasks" subtitle="Track everything" icon={<CheckSquare className="w-5 h-5" />}>
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </FeaturePageShell>
    );
  }

  return (
    <FeaturePageShell
      title="Tasks"
      subtitle="Track everything"
      icon={<CheckSquare className="w-5 h-5" />}
    >
      {/* Toolbar: view toggles + settings + new */}
      <div className="flex items-center justify-between gap-2 mb-4">
        {/* Left: view toggles */}
        <div className="flex items-center gap-0.5 bg-muted/70 rounded-full p-0.5">
          {([["list", LayoutList, "List"], ["tile", LayoutGrid, "Tile"], ["kanban", Columns2, "Kanban"]] as [TaskView, React.ElementType, string][]).map(([mode, Icon, label]) => (
            <button key={mode} onClick={() => setViewMode(mode)} aria-label={label}
              className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-full transition-all duration-150 ${viewMode === mode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">{label}</span>
            </button>
          ))}
        </div>
        {/* Right: settings + new */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={() => setSettingsOpen(true)} className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors" aria-label="Settings">
            <Settings2 className="w-4 h-4" />
          </button>
          <button onClick={openAdd} className="flex items-center gap-1.5 text-xs font-bold bg-primary text-primary-foreground px-3 py-2 rounded-full hover:bg-primary/90 transition-colors shadow-sm">
            <Plus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>
        </div>
      </div>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        {[
          { label: "Today",    value: todayCount,    gradient: "from-amber-500/15 to-amber-500/5", border: "border-amber-400/30", text: "text-amber-600 dark:text-amber-400", icon: "☀️" },
          { label: "Critical", value: criticalCount, gradient: "from-red-500/15 to-red-500/5",    border: "border-red-400/30",   text: "text-red-600 dark:text-red-400",   icon: "🔴" },
          { label: "Done",     value: doneCount,     gradient: "from-emerald-500/15 to-emerald-500/5", border: "border-emerald-400/30", text: "text-emerald-600 dark:text-emerald-400", icon: "✓" },
        ].map((s) => (
          <div key={s.label} className={`relative rounded-2xl border ${s.border} bg-gradient-to-br ${s.gradient} px-3 py-3 text-center overflow-hidden`}>
            <p className={`text-2xl font-bold font-display ${s.text}`}>{s.value}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {filterTabs.map((tab) => {
          const isActive = activeTab === tab;
          const catColour = settings.categoryColors?.[tab];
          return (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setFilterValue(""); }}
              style={catColour ? {
                background: isActive ? catColour : `${catColour}18`,
                color: isActive ? "#fff" : catColour,
                borderColor: `${catColour}44`,
              } : undefined}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all duration-150 border ${
                catColour
                  ? "border-transparent"
                  : isActive
                    ? "bg-primary text-primary-foreground shadow-sm border-transparent"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border-transparent"
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Sub-filters */}
      {activeTab === "Priority" && <SubFilter items={PRIORITIES.map((p) => ({ value: p.value, label: p.label }))} active={filterValue} onSelect={setFilterValue} />}
      {activeTab === "Status" && <SubFilter items={STATUSES.map((s) => ({ value: s.value, label: s.label }))} active={filterValue} onSelect={setFilterValue} />}
      {activeTab === "Category" && <SubFilter items={settings.categories.map((c) => ({ value: c, label: c }))} active={filterValue} onSelect={setFilterValue} />}
      {activeTab === "Company" && <SubFilter items={companyFilterOptions.map((c) => ({ value: c, label: c }))} active={filterValue} onSelect={setFilterValue} />}
      {settings.customFields.map((field) =>
        activeTab === field.label ? <SubFilter key={field.id} items={field.options.map((o) => ({ value: o, label: o }))} active={filterValue} onSelect={setFilterValue} /> : null
      )}

      {/* Views */}
      {viewMode === "kanban" ? (
        <KanbanView tasks={filtered} settings={settings} colourBy={colourBy}
          onOpen={openDetail} onDelete={(t) => t.id && deleteTask(t.id)}
          onToggleToday={(t) => t.id && toggleToday(t.id, t.isToday)}
          onStatusChange={(t, s) => t.id && setStatus(t.id, s)}
          onUrgencyChange={(t, u) => t.id && setUrgency(t.id, u)}
        />
      ) : viewMode === "tile" ? (
        <div>
          {orderedTiles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">{tasks.length === 0 ? "No tasks yet — add your first one." : "No tasks match this filter."}</p>
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
                  onDelete={() => task.id && deleteTask(task.id)}
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
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {filtered.length === 0 ? (
              <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-muted-foreground text-center py-10">
                {tasks.length === 0 ? "No tasks yet — add your first one." : "No tasks match this filter."}
              </motion.p>
            ) : (
              filtered.map((task) => (
                <TaskCard key={task.id} task={task} settings={settings} colourBy={colourBy}
                  onOpen={() => openDetail(task)}
                  onDelete={() => task.id && deleteTask(task.id)}
                  onToggleToday={() => task.id && toggleToday(task.id, task.isToday)}
                  onStatusChange={(s) => task.id && setStatus(task.id, s)}
                  onUrgencyChange={(u) => task.id && setUrgency(task.id, u)}
                />
              ))
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Task detail side panel */}
      <TaskDetailSheet
        task={liveDetailTask}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onEdit={() => liveDetailTask && openEdit(liveDetailTask)}
        onDelete={() => {
          if (liveDetailTask?.id) deleteTask(liveDetailTask.id);
          setDetailOpen(false);
        }}
        onToggleToday={() => liveDetailTask?.id && toggleToday(liveDetailTask.id, liveDetailTask.isToday)}
        onStatusChange={(s) => liveDetailTask?.id && setStatus(liveDetailTask.id, s)}
        settings={settings}
      />

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditTask(null); }}>
        <DialogContent className="max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="font-display text-base">{editTask ? "Edit Task" : "New Task"}</DialogTitle>
          </DialogHeader>
          <TaskForm
            settings={settings}
            initial={editTask ? {
              title: editTask.title,
              description: editTask.description || "",
              notes: editTask.notes || "",
              priority: editTask.priority,
              status: editTask.status,
              category: editTask.category,
              company: editTask.company || "",
              dueDate: editTask.dueDate || "",
              isToday: editTask.isToday,
              tags: editTask.tags,
              subtasks: editTask.subtasks ?? [],
              customFields: editTask.customFields ?? {},
            } : { ...EMPTY_TASK, category: settings.categories[0] ?? "Other" }}
            onSave={handleSave}
            onCancel={() => { setDialogOpen(false); setEditTask(null); }}
            saving={saving}
          />
        </DialogContent>
      </Dialog>

      {/* Settings */}
      <TaskSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} settings={settings} onSave={saveSettings} colourBy={colourBy} setColourBy={setColourBy} />
    </FeaturePageShell>
  );
};

export default Tasks;
