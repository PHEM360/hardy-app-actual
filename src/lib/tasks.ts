import { stripUndefined } from "@/lib/displayPages";
import type { Task, TaskPriority, TaskSubtask, TaskTracking } from "@/types/app";

const OPTIONAL_STRINGS = new Set(["description", "notes", "company", "dueDate", "tracking"]);

/** Tracking states in order from best to worst, with the solid colour each one shows as. */
export const TASK_TRACKING: { value: TaskTracking; label: string; hex: string }[] = [
  { value: "on_track", label: "On track", hex: "#1F6B4F" },
  { value: "adjusted", label: "Adjusted", hex: "#22407A" },
  { value: "needs_adjusting", label: "Needs adjusting", hex: "#B7791F" },
  { value: "off_track", label: "Off track", hex: "#9B2C2C" },
];

export function taskTrackingInfo(value?: string) {
  return TASK_TRACKING.find((t) => t.value === value);
}

export function localYmd(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isTaskOverdue(task: Pick<Task, "dueDate" | "status">, today = localYmd()) {
  if (!task.dueDate || task.status === "done") return false;
  return task.dueDate < today;
}

export function formatTaskDue(iso?: string) {
  if (!iso) return "";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function newSubtaskId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function cleanStringMap(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const next = Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => [key, typeof item === "string" ? item.trim() : item])
      .filter(([, item]) => item && item !== "__none__"),
  );
  return Object.keys(next).length ? next : undefined;
}

function cleanSubtask(sub: TaskSubtask): TaskSubtask {
  const cleaned = sanitizeTaskWrite(sub as unknown as Record<string, unknown>) as TaskSubtask;
  return {
    id: String(cleaned.id || newSubtaskId()),
    title: String(cleaned.title || "").trim(),
    done: Boolean(cleaned.done),
    ...(cleaned.status ? { status: cleaned.status } : {}),
    ...(cleaned.priority ? { priority: cleaned.priority } : {}),
    ...(cleaned.notes ? { notes: cleaned.notes } : {}),
    ...(cleaned.dueDate ? { dueDate: cleaned.dueDate } : {}),
    ...(cleaned.isToday ? { isToday: true } : {}),
  };
}

/** Drop empty optional fields so Firestore never sees `undefined` or blank selects. */
export function sanitizeTaskWrite<T extends Record<string, unknown>>(value: T): T {
  const next: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (raw === undefined || raw === "__none__") continue;
    if (typeof raw === "string" && OPTIONAL_STRINGS.has(key) && !raw.trim()) continue;
    if (key === "customFields") {
      const fields = cleanStringMap(raw);
      if (fields) next.customFields = fields;
      continue;
    }
    if (key === "subtasks" && Array.isArray(raw)) {
      next.subtasks = raw
        .map((item) => cleanSubtask(item as TaskSubtask))
        .filter((item) => item.title);
      continue;
    }
    if (key === "tags" && Array.isArray(raw)) {
      next.tags = raw.map((item) => String(item).trim()).filter(Boolean);
      continue;
    }
    next[key] = raw;
  }
  return stripUndefined(next) as T;
}

export function taskMatchesQuery(task: Task, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    task.title,
    task.description,
    task.notes,
    task.category,
    task.company,
    ...(task.tags || []),
    ...(task.subtasks || []).map((s) => s.title),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export const TASK_PRIORITY_ORDER: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const EMPTY_TASK: Omit<Task, "id" | "createdAt" | "updatedAt"> = {
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

export function defaultTaskDraft(category: string, extras?: Partial<Task>): Omit<Task, "id" | "createdAt" | "updatedAt"> {
  return {
    ...EMPTY_TASK,
    category,
    ...extras,
  };
}

export type TaskFilter = "all" | "today" | "overdue" | "progress" | "critical" | `tracking:${string}` | `category:${string}` | `company:${string}`;

export function filterTasks(
  tasks: Task[],
  args: { filter: TaskFilter; query: string; showCompleted: boolean; today?: string },
) {
  const today = args.today ?? localYmd();
  return tasks.filter((task) => {
    if (!args.showCompleted && task.status === "done") return false;
    if (!taskMatchesQuery(task, args.query)) return false;
    if (args.filter === "today") return task.isToday || Boolean(task.subtasks?.some((s) => s.isToday && !s.done));
    if (args.filter === "overdue") return isTaskOverdue(task, today);
    if (args.filter === "progress") return task.status === "in_progress";
    if (args.filter === "critical") return task.priority === "critical" && task.status !== "done";
    if (args.filter.startsWith("tracking:")) return task.tracking === args.filter.slice("tracking:".length);
    if (args.filter.startsWith("category:")) return task.category === args.filter.slice("category:".length);
    if (args.filter.startsWith("company:")) return (task.company ?? "") === args.filter.slice("company:".length);
    return true;
  });
}

export function sortTasks(tasks: Task[]) {
  return [...tasks].sort((a, b) => {
    const aDone = a.status === "done" ? 1 : 0;
    const bDone = b.status === "done" ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    const aOver = isTaskOverdue(a) ? 0 : 1;
    const bOver = isTaskOverdue(b) ? 0 : 1;
    if (aOver !== bOver) return aOver - bOver;
    return TASK_PRIORITY_ORDER[a.priority] - TASK_PRIORITY_ORDER[b.priority];
  });
}
