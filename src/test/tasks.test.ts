import { describe, expect, it } from "vitest";
import {
  defaultTaskDraft,
  filterTasks,
  formatTaskDue,
  isTaskOverdue,
  sanitizeTaskWrite,
  sortTasks,
  taskMatchesQuery,
} from "@/lib/tasks";
import type { Task } from "@/types/app";

const task = (partial: Partial<Task>): Task => ({
  id: "1",
  title: "Call plumber",
  priority: "medium",
  status: "todo",
  category: "Admin",
  isToday: false,
  tags: [],
  ...partial,
});

describe("sanitizeTaskWrite", () => {
  it("drops blank optional fields and none placeholders", () => {
    const cleaned = sanitizeTaskWrite({
      title: "Pay council tax",
      description: "  ",
      notes: "",
      company: "__none__",
      dueDate: "",
      customFields: { client: "__none__", site: "Home" },
      tags: [" bills ", ""],
      subtasks: [{ id: "a", title: "  ", done: false }, { id: "b", title: "Print form", done: false, dueDate: undefined }],
    });
    expect(cleaned).toEqual({
      title: "Pay council tax",
      customFields: { site: "Home" },
      tags: ["bills"],
      subtasks: [{ id: "b", title: "Print form", done: false }],
    });
    expect("dueDate" in cleaned).toBe(false);
    expect("company" in cleaned).toBe(false);
  });
});

describe("task list helpers", () => {
  it("treats a past due date as overdue only when the task is still open", () => {
    expect(isTaskOverdue(task({ dueDate: "2020-01-01" }), "2026-09-21")).toBe(true);
    expect(isTaskOverdue(task({ dueDate: "2020-01-01", status: "done" }), "2026-09-21")).toBe(false);
    expect(isTaskOverdue(task({ dueDate: "2026-09-21" }), "2026-09-21")).toBe(false);
    expect(formatTaskDue("2026-09-21")).toMatch(/21/);
  });

  it("filters today, overdue, and search together", () => {
    const rows = [
      task({ id: "a", title: "Garden", isToday: true }),
      task({ id: "b", title: "Invoice client", dueDate: "2020-01-01", category: "Finance" }),
      task({ id: "c", title: "Old done", status: "done", dueDate: "2020-01-01" }),
    ];
    expect(filterTasks(rows, { filter: "today", query: "", showCompleted: false }).map((t) => t.id)).toEqual(["a"]);
    expect(filterTasks(rows, { filter: "overdue", query: "", showCompleted: false, today: "2026-09-21" }).map((t) => t.id)).toEqual(["b"]);
    expect(filterTasks(rows, { filter: "category:Finance", query: "invoice", showCompleted: true }).map((t) => t.id)).toEqual(["b"]);
    expect(taskMatchesQuery(rows[0], "garden")).toBe(true);
  });

  it("sorts overdue and critical work above the rest", () => {
    const rows = [
      task({ id: "low", priority: "low" }),
      task({ id: "late", priority: "medium", dueDate: "2020-01-01" }),
      task({ id: "done", status: "done", priority: "critical" }),
    ];
    expect(sortTasks(rows).map((t) => t.id)).toEqual(["late", "low", "done"]);
  });

  it("fills a quick-add draft from the active filter", () => {
    const draft = defaultTaskDraft("Personal", { title: "Walk the dog", isToday: true, priority: "high" });
    expect(draft.category).toBe("Personal");
    expect(draft.isToday).toBe(true);
    expect(draft.priority).toBe("high");
  });
});
