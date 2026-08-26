import { useState } from "react";
import { addHours, formatISO } from "date-fns";
import { useTasks } from "@/hooks/useTasks";
import { useNotes } from "@/hooks/useNotes";
import { useCalendar } from "@/hooks/useCalendar";
import { TdHead } from "./TdHead";

const KINDS = [
  { id: "task", label: "Task" },
  { id: "note", label: "Note" },
  { id: "event", label: "Event" },
] as const;

export function TdQuickAddWidget() {
  const { addTask } = useTasks();
  const { addNote } = useNotes();
  const { addEvent } = useCalendar();
  const [kind, setKind] = useState<(typeof KINDS)[number]["id"]>("task");
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);

  const submit = async () => {
    const title = text.trim();
    if (!title) return;
    if (kind === "task") {
      await addTask({ title, priority: "medium", status: "todo", category: "Personal", isToday: true, tags: [] });
    } else if (kind === "note") {
      await addNote({ title, body: "" });
    } else {
      const start = new Date();
      await addEvent({
        title,
        category: "family",
        startDate: formatISO(start),
        endDate: formatISO(addHours(start, 1)),
        allDay: false,
      });
    }
    setText("");
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  };

  return (
    <div className="h-full flex flex-col p-3">
      <TdHead emoji="⚡" title="Quick add" />
      <div className="flex gap-1 mb-2 flex-shrink-0">
        {KINDS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setKind(item.id)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
              kind === item.id ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <form
        className="flex gap-1.5 mt-auto"
        onSubmit={(e) => { e.preventDefault(); void submit(); }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={kind === "task" ? "Add a task…" : kind === "note" ? "Note title…" : "Event title…"}
          className="h-9 flex-1 min-w-0 rounded-xl border border-border bg-background px-2.5 text-xs"
        />
        <button type="submit" className="h-9 px-3 rounded-xl bg-gradient-primary text-primary-foreground text-xs font-semibold">
          {saved ? "Saved" : "Add"}
        </button>
      </form>
    </div>
  );
}
