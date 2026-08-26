import { format } from "date-fns";
import { useNotes } from "@/hooks/useNotes";
import { useTasks } from "@/hooks/useTasks";
import { daysUntilDate } from "@/lib/todayInsights";
import { TdHead } from "./TdHead";

export function TdRemindersWidget() {
  const { notes } = useNotes();
  const { tasks } = useTasks();
  const noteReminders = notes
    .filter((n) => n.dueDate && !n.archived && !n.locked)
    .map((n) => ({ id: n.id, title: n.title || "Untitled note", date: n.dueDate!, kind: "note" as const }))
    .filter((n) => daysUntilDate(n.date) <= 14)
    .sort((a, b) => daysUntilDate(a.date) - daysUntilDate(b.date));
  const taskReminders = tasks
    .filter((t) => t.dueDate && t.status !== "done")
    .map((t) => ({ id: t.id || t.title, title: t.title, date: t.dueDate!, kind: "task" as const }))
    .filter((t) => daysUntilDate(t.date) >= 0 && daysUntilDate(t.date) <= 14)
    .sort((a, b) => daysUntilDate(a.date) - daysUntilDate(b.date));
  const items = [...noteReminders, ...taskReminders].sort((a, b) => daysUntilDate(a.date) - daysUntilDate(b.date)).slice(0, 8);

  return (
    <div className="h-full flex flex-col p-3">
      <TdHead emoji="🔔" title="Reminders" />
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
        {items.length === 0 && <p className="text-xs text-muted-foreground">No notes or tasks due soon.</p>}
        {items.map((item) => {
          const days = daysUntilDate(item.date);
          return (
            <div key={`${item.kind}-${item.id}`} className="flex items-center justify-between gap-2 rounded-xl bg-background/60 border border-border/40 px-2.5 py-1.5">
              <p className="text-xs font-medium truncate">{item.title}</p>
              <span className={`text-[10px] flex-shrink-0 ${days < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                {days < 0 ? "Overdue" : days === 0 ? "Today" : format(new Date(item.date), "d MMM")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
