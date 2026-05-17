import { useState } from "react";
import { Check, Plus, Trash2, Pencil, X } from "lucide-react";
import { useTodayPage } from "@/hooks/useTodayPage";

export function TdHabitsWidget() {
  const { config, daily, saveConfig, saveDaily } = useTodayPage();
  const [editing, setEditing] = useState(false);
  const [newHabit, setNewHabit] = useState("");

  const done = config.habits.filter((h) => daily.habitsDone[h]).length;

  const toggle = (h: string) =>
    saveDaily({ habitsDone: { ...daily.habitsDone, [h]: !daily.habitsDone[h] } });

  const addHabit = () => {
    if (!newHabit.trim() || config.habits.includes(newHabit.trim())) return;
    saveConfig({ habits: [...config.habits, newHabit.trim()] });
    setNewHabit("");
  };

  const removeHabit = (h: string) =>
    saveConfig({ habits: config.habits.filter((x) => x !== h) });

  return (
    <div className="h-full flex flex-col p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-base">🔥</span>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Habits</p>
        </div>
        <button onClick={() => setEditing((v) => !v)} className="p-1 rounded-lg hover:bg-muted/50 transition-colors">
          {editing ? <X className="w-3.5 h-3.5 text-muted-foreground" /> : <Pencil className="w-3.5 h-3.5 text-muted-foreground" />}
        </button>
      </div>

      {/* Progress strip */}
      {config.habits.length > 0 && (
        <div className="flex gap-px h-1 rounded-full overflow-hidden mb-2 flex-shrink-0">
          {config.habits.map((h, i) => (
            <div key={i} className={`flex-1 transition-colors ${daily.habitsDone[h] ? "bg-orange-400" : "bg-muted"}`} />
          ))}
        </div>
      )}

      {/* Habits list */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
        {config.habits.length === 0 && !editing && (
          <button onClick={() => setEditing(true)}
            className="w-full py-3 text-xs text-primary font-medium border border-dashed border-primary/30 rounded-xl">
            + Add habits
          </button>
        )}
        {config.habits.map((habit) => {
          const isDone = !!daily.habitsDone[habit];
          return (
            <div key={habit} className={`flex items-center gap-2 p-2 rounded-xl border transition-colors ${isDone ? "bg-orange-50 border-orange-200" : "bg-background/60 border-border/40"}`}>
              <button onClick={() => toggle(habit)}
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isDone ? "bg-orange-400 border-orange-400" : "border-muted-foreground/30"}`}
              >
                {isDone && <Check className="w-2.5 h-2.5 text-white" />}
              </button>
              <span className={`flex-1 text-xs font-medium ${isDone ? "line-through text-orange-600" : ""}`}>{habit}</span>
              {editing && (
                <button onClick={() => removeHabit(habit)} className="flex-shrink-0">
                  <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive transition-colors" />
                </button>
              )}
            </div>
          );
        })}
        {editing && (
          <div className="flex gap-1.5 mt-1">
            <input value={newHabit} onChange={(e) => setNewHabit(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addHabit(); }}
              placeholder="New habit…"
              className="flex-1 text-xs bg-muted/40 rounded-xl px-2.5 py-1.5 border border-border/40 focus:outline-none" />
            <button onClick={addHabit} disabled={!newHabit.trim()}
              className="w-7 h-7 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {config.habits.length > 0 && (
        <p className="text-[10px] text-muted-foreground text-right mt-1 flex-shrink-0">{done}/{config.habits.length}</p>
      )}
    </div>
  );
}
