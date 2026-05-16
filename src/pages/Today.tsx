import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sun, Settings, ChevronRight, Check, X, Plus,
  Circle, CheckCircle2, Clock, AlertCircle,
  GripVertical, Eye, EyeOff, ChevronUp, ChevronDown,
  Trash2, Pencil,
} from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import { useTodayPage } from "@/hooks/useTodayPage";
import type { BlockType, ChecklistItem } from "@/hooks/useTodayPage";
import { BLOCK_META } from "@/hooks/useTodayPage";
import type { Task, TaskStatus } from "@/types/app";

// ─── Shared helpers ───────────────────────────────────────────────────────────

const STATUSES: { value: TaskStatus; icon: any; color: string }[] = [
  { value: "todo",        icon: Circle,       color: "text-muted-foreground" },
  { value: "in_progress", icon: Clock,        color: "text-blue-500" },
  { value: "done",        icon: CheckCircle2, color: "text-green-500" },
];

const MOODS = ["😩", "😕", "😐", "🙂", "😄"];
const ENERGY_LABELS = ["Low", "Tired", "OK", "Good", "Great"];

// ─── Block shells ─────────────────────────────────────────────────────────────

function BlockCard({
  type,
  editMode,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onHide,
  children,
}: {
  type: BlockType;
  editMode: boolean;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onHide: () => void;
  children: React.ReactNode;
}) {
  const meta = BLOCK_META[type];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className={`rounded-2xl border bg-card shadow-soft overflow-hidden ${editMode ? "border-primary/30 ring-1 ring-primary/15" : "border-border/50"}`}
    >
      {editMode && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-primary/5 border-b border-primary/10 select-none">
          <div className="flex items-center gap-2">
            <span>{meta.icon}</span>
            <span className="text-[11px] font-semibold text-primary/70">{meta.label}</span>
          </div>
          <div className="flex items-center gap-0.5">
            <button onClick={onMoveUp} disabled={isFirst} className="p-1 rounded hover:bg-primary/10 disabled:opacity-30 transition-colors">
              <ChevronUp className="w-3.5 h-3.5 text-primary/60" />
            </button>
            <button onClick={onMoveDown} disabled={isLast} className="p-1 rounded hover:bg-primary/10 disabled:opacity-30 transition-colors">
              <ChevronDown className="w-3.5 h-3.5 text-primary/60" />
            </button>
            <button onClick={onHide} className="p-1 rounded hover:bg-red-50 transition-colors" title="Hide block">
              <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}
      <div className="p-4">{children}</div>
    </motion.div>
  );
}

function BlockLabel({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-base">{icon}</span>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
    </div>
  );
}

// ─── Individual block components ──────────────────────────────────────────────

function TasksBlock({
  tasks, loading, setStatus, toggleToday,
}: {
  tasks: Task[];
  loading: boolean;
  setStatus: (id: string, s: TaskStatus) => void;
  toggleToday: (id: string, v: boolean) => void;
}) {
  const navigate = useNavigate();
  const todayTasks = tasks
    .filter((t) => t.isToday)
    .sort((a, b) => {
      const pw: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      const aDone = a.status === "done" ? 1 : 0;
      const bDone = b.status === "done" ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return (pw[a.priority] ?? 2) - (pw[b.priority] ?? 2);
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

  return (
    <>
      <BlockLabel icon="✅" label="Today's Tasks" />
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <>
          {total > 0 && (
            <div className="mb-3">
              <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                <span>{done}/{total} done</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-amber-400 transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {todayTasks.length === 0 ? (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-6">
                  <p className="text-2xl mb-1">☀️</p>
                  <p className="text-xs text-muted-foreground">No tasks flagged for today</p>
                  <button onClick={() => navigate("/tasks")} className="text-xs text-primary mt-1 underline">Go to Tasks</button>
                </motion.div>
              ) : (
                todayTasks.map((task) => {
                  const s = STATUSES.find((x) => x.value === task.status)!;
                  const Icon = s.icon;
                  const isDone = task.status === "done";
                  return (
                    <motion.div key={task.id} layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border border-border/40 bg-background/50 transition-opacity ${isDone ? "opacity-50" : ""}`}
                    >
                      <button onClick={() => cycleStatus(task)} className="flex-shrink-0">
                        <Icon className={`w-4 h-4 ${s.color}`} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium leading-snug ${isDone ? "line-through text-muted-foreground" : ""}`}>{task.title}</p>
                        {task.dueDate && (
                          <p className="text-[10px] text-muted-foreground">Due {new Date(task.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
                        )}
                      </div>
                      <button onClick={() => task.id && toggleToday(task.id, false)} title="Remove from today"
                        className="flex-shrink-0 p-1 rounded-md text-amber-300 hover:text-muted-foreground transition-colors">
                        <Sun className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
          <button onClick={() => navigate("/tasks")} className="flex items-center gap-1 mt-3 text-xs text-primary font-medium">
            All tasks <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </>
  );
}

function FocusBlock({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <>
      <BlockLabel icon="🎯" label="Today's Focus" />
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="What's the one big thing you want to accomplish today?"
        className="w-full text-sm text-foreground placeholder:text-muted-foreground bg-muted/40 rounded-xl px-3 py-2.5 resize-none border border-border/40 focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[64px]"
        rows={3}
      />
    </>
  );
}

function IntentionsBlock({ intentions, onChange }: { intentions: [string, string, string]; onChange: (v: [string, string, string]) => void }) {
  const placeholders = [
    "I intend to…",
    "I also want to…",
    "One more thing…",
  ];
  return (
    <>
      <BlockLabel icon="🌅" label="Morning Intentions" />
      <div className="space-y-2">
        {intentions.map((val, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
            <input
              value={val}
              onChange={(e) => {
                const next = [...intentions] as [string, string, string];
                next[i] = e.target.value;
                onChange(next);
              }}
              placeholder={placeholders[i]}
              className="flex-1 text-sm text-foreground placeholder:text-muted-foreground bg-muted/40 rounded-xl px-3 py-2 border border-border/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        ))}
      </div>
    </>
  );
}

function HabitsBlock({
  habits,
  habitsDone,
  onToggle,
  onEditHabits,
  editMode,
}: {
  habits: string[];
  habitsDone: Record<string, boolean>;
  onToggle: (habit: string) => void;
  onEditHabits: () => void;
  editMode: boolean;
}) {
  const done = habits.filter((h) => habitsDone[h]).length;

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">🔥</span>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Habit Tracker</p>
        </div>
        <button onClick={onEditHabits} className="text-[11px] text-primary font-medium flex items-center gap-0.5">
          <Pencil className="w-3 h-3" /> Edit habits
        </button>
      </div>

      {habits.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground mb-2">No habits set up yet</p>
          <button onClick={onEditHabits} className="text-xs text-primary font-medium border border-primary/30 rounded-xl px-3 py-1.5">
            + Add habits
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-px w-full h-1.5 rounded-full overflow-hidden bg-muted">
              {habits.map((h, i) => (
                <div key={i} className={`flex-1 transition-colors ${habitsDone[h] ? "bg-orange-400" : "bg-muted"}`} />
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground ml-2 flex-shrink-0">{done}/{habits.length}</span>
          </div>
          <div className="space-y-2">
            {habits.map((habit) => {
              const done = !!habitsDone[habit];
              return (
                <button key={habit} onClick={() => onToggle(habit)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-colors text-left ${done ? "bg-orange-50 border-orange-200" : "bg-background/50 border-border/40 hover:bg-muted/30"}`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${done ? "bg-orange-400 border-orange-400" : "border-muted-foreground/30"}`}>
                    {done && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className={`text-sm font-medium ${done ? "text-orange-700 line-through" : "text-foreground"}`}>{habit}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

function WaterBlock({ count, onChange }: { count: number; onChange: (n: number) => void }) {
  const GLASSES = 8;
  return (
    <>
      <BlockLabel icon="💧" label="Water Tracker" />
      <div className="flex items-center gap-2">
        <div className="flex gap-1.5 flex-wrap flex-1">
          {Array.from({ length: GLASSES }).map((_, i) => (
            <button key={i} onClick={() => onChange(i < count ? i : i + 1)}
              className={`w-8 h-10 rounded-xl border-2 transition-all flex items-center justify-center text-lg ${i < count ? "bg-blue-100 border-blue-300 shadow-sm" : "border-border/40 text-muted-foreground/30"}`}
            >
              {i < count ? "💧" : "○"}
            </button>
          ))}
        </div>
        <div className="text-right">
          <p className="text-xl font-bold font-display text-blue-500">{count}</p>
          <p className="text-[10px] text-muted-foreground">of {GLASSES}</p>
          {count > 0 && (
            <button onClick={() => onChange(count - 1)} className="text-[10px] text-muted-foreground underline mt-1">undo</button>
          )}
        </div>
      </div>
    </>
  );
}

function MoodBlock({
  mood, energy,
  onMoodChange, onEnergyChange,
}: {
  mood: string; energy: number;
  onMoodChange: (m: string) => void;
  onEnergyChange: (n: number) => void;
}) {
  return (
    <>
      <BlockLabel icon="😊" label="Mood Check-in" />
      <div className="space-y-3">
        <div>
          <p className="text-[11px] text-muted-foreground mb-2">How are you feeling?</p>
          <div className="flex justify-between gap-1">
            {MOODS.map((m) => (
              <button key={m} onClick={() => onMoodChange(m === mood ? "" : m)}
                className={`text-2xl p-1.5 rounded-xl transition-all ${m === mood ? "bg-yellow-100 scale-125 shadow-sm" : "opacity-50 hover:opacity-80"}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground mb-2">Energy level: <span className="font-semibold text-foreground">{ENERGY_LABELS[energy - 1]}</span></p>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => onEnergyChange(n)}
                className={`flex-1 h-2 rounded-full transition-colors ${n <= energy ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function NoteBlock({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <>
      <BlockLabel icon="📝" label="Daily Note" />
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Jot down anything on your mind today…"
        className="w-full text-sm text-foreground placeholder:text-muted-foreground bg-muted/40 rounded-xl px-3 py-2.5 resize-none border border-border/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
        rows={5}
      />
    </>
  );
}

function ChecklistBlock({
  items, onChange,
}: {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
}) {
  const [newText, setNewText] = useState("");

  const addItem = () => {
    if (!newText.trim()) return;
    onChange([...items, { id: `ci-${Date.now()}`, text: newText.trim(), done: false }]);
    setNewText("");
  };

  const toggleItem = (id: string) => {
    onChange(items.map((i) => i.id === id ? { ...i, done: !i.done } : i));
  };

  const deleteItem = (id: string) => {
    onChange(items.filter((i) => i.id !== id));
  };

  return (
    <>
      <BlockLabel icon="☑️" label="Quick Checklist" />
      <div className="space-y-1.5 mb-3">
        <AnimatePresence>
          {items.map((item) => (
            <motion.div key={item.id} layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2"
            >
              <button onClick={() => toggleItem(item.id)}
                className={`w-4.5 h-4.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${item.done ? "bg-primary border-primary" : "border-border"}`}
              >
                {item.done && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
              </button>
              <p className={`flex-1 text-sm ${item.done ? "line-through text-muted-foreground" : "text-foreground"}`}>{item.text}</p>
              <button onClick={() => deleteItem(item.id)} className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground">Nothing yet — add items below</p>
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); }}}
          placeholder="Add item…"
          className="flex-1 text-sm bg-muted/40 rounded-xl px-3 py-2 border border-border/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button onClick={addItem} disabled={!newText.trim()}
          className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 transition-opacity flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </>
  );
}

function ReflectionBlock({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <>
      <BlockLabel icon="🌙" label="Evening Reflection" />
      <div className="space-y-3">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="How did today go? What went well? What could be better tomorrow?"
          className="w-full text-sm text-foreground placeholder:text-muted-foreground bg-muted/40 rounded-xl px-3 py-2.5 resize-none border border-border/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
          rows={5}
        />
      </div>
    </>
  );
}

// ─── Habit editor sheet ───────────────────────────────────────────────────────

function HabitEditor({ habits, onSave, onClose }: { habits: string[]; onSave: (h: string[]) => void; onClose: () => void }) {
  const [local, setLocal] = useState(habits);
  const [newHabit, setNewHabit] = useState("");

  const add = () => {
    if (!newHabit.trim() || local.includes(newHabit.trim())) return;
    setLocal([...local, newHabit.trim()]);
    setNewHabit("");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end">
      <motion.div initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }}
        className="w-full bg-card rounded-t-3xl p-5 pb-10 max-h-[80vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold font-display">Edit Habits</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        <div className="space-y-2 mb-4">
          {local.map((h, i) => (
            <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/40 border border-border/40">
              <span className="flex-1 text-sm font-medium">{h}</span>
              <button onClick={() => setLocal(local.filter((_, j) => j !== i))}><Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive transition-colors" /></button>
            </div>
          ))}
          {local.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No habits yet</p>}
        </div>

        <div className="flex gap-2 mb-4">
          <input
            value={newHabit}
            onChange={(e) => setNewHabit(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); }}}
            placeholder="e.g. Morning walk, Read 20 mins…"
            className="flex-1 text-sm bg-muted/40 rounded-xl px-3 py-2.5 border border-border/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button onClick={add} disabled={!newHabit.trim()}
            className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <button onClick={() => { onSave(local); onClose(); }}
          className="w-full h-11 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold text-sm"
        >
          Save habits
        </button>
      </motion.div>
    </div>
  );
}

// ─── Block library panel ──────────────────────────────────────────────────────

function BlockLibrary({
  config,
  onToggle,
  onClose,
}: {
  config: { id: string; type: BlockType; enabled: boolean }[];
  onToggle: (id: string, enabled: boolean) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end">
      <motion.div initial={{ y: 400 }} animate={{ y: 0 }} exit={{ y: 400 }}
        className="w-full bg-card rounded-t-3xl p-5 pb-10 max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold font-display">Customise Today</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Choose which blocks appear on your Today page. Reorder them using the arrows on each block.</p>
        <div className="space-y-2">
          {config.map((block) => {
            const meta = BLOCK_META[block.type];
            return (
              <button key={block.id} onClick={() => onToggle(block.id, !block.enabled)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border transition-all text-left ${block.enabled ? "bg-primary/5 border-primary/30" : "bg-muted/30 border-border/40"}`}
              >
                <span className="text-xl">{meta.icon}</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{meta.label}</p>
                  <p className="text-[11px] text-muted-foreground">{meta.description}</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${block.enabled ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                  {block.enabled && <Check className="w-3 h-3 text-primary-foreground" />}
                </div>
              </button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const Today = () => {
  const { tasks, loading: tasksLoading, setStatus, toggleToday } = useTasks();
  const { config, daily, saveConfig, saveDaily, setBlockEnabled, reorderBlocks } = useTodayPage();

  const [editMode, setEditMode] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showHabitEditor, setShowHabitEditor] = useState(false);

  const today = new Date();
  const dateLabel = today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  const enabledBlocks = config.blocks.filter((b) => b.enabled);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveWithDebounce = (updates: Parameters<typeof saveDaily>[0]) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => saveDaily(updates), 600);
  };

  return (
    <div className="pb-28 min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/30">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <div className="flex items-center gap-2">
              <Sun className="w-4.5 h-4.5 text-amber-500" />
              <p className="text-sm font-bold text-foreground">Today</p>
            </div>
            <p className="text-[11px] text-muted-foreground ml-6">{dateLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLibrary(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground border border-border rounded-xl px-2.5 py-1.5 hover:bg-muted/50 transition-colors"
            >
              <Settings className="w-3.5 h-3.5" /> Blocks
            </button>
            <button
              onClick={() => setEditMode((v) => !v)}
              className={`flex items-center gap-1.5 text-xs font-medium rounded-xl px-3 py-1.5 transition-colors ${
                editMode ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {editMode ? <><Check className="w-3.5 h-3.5" /> Done</> : <><Pencil className="w-3.5 h-3.5" /> Edit</>}
            </button>
          </div>
        </div>
      </div>

      {/* Edit mode tip */}
      <AnimatePresence>
        {editMode && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="mx-4 mt-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/20 text-xs text-primary/80"
          >
            Use ↑↓ arrows to reorder blocks · tap 👁️ to hide a block
          </motion.div>
        )}
      </AnimatePresence>

      {/* Blocks */}
      <div className="px-4 pt-3 space-y-3">
        <AnimatePresence>
          {enabledBlocks.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20 gap-3 text-center"
            >
              <span className="text-4xl">✨</span>
              <p className="text-sm font-medium">Your Today page is empty</p>
              <p className="text-xs text-muted-foreground">Tap "Blocks" to add content to your day</p>
              <button onClick={() => setShowLibrary(true)}
                className="mt-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
              >
                Add blocks
              </button>
            </motion.div>
          ) : (
            enabledBlocks.map((block, idx) => (
              <BlockCard
                key={block.id}
                type={block.type}
                editMode={editMode}
                isFirst={idx === 0}
                isLast={idx === enabledBlocks.length - 1}
                onMoveUp={() => {
                  const globalIdx = config.blocks.findIndex((b) => b.id === block.id);
                  const prevEnabled = config.blocks.slice(0, globalIdx).reverse().find((b) => b.enabled);
                  if (prevEnabled) {
                    const prevGlobal = config.blocks.findIndex((b) => b.id === prevEnabled.id);
                    reorderBlocks(globalIdx, prevGlobal);
                  }
                }}
                onMoveDown={() => {
                  const globalIdx = config.blocks.findIndex((b) => b.id === block.id);
                  const nextEnabled = config.blocks.slice(globalIdx + 1).find((b) => b.enabled);
                  if (nextEnabled) {
                    const nextGlobal = config.blocks.findIndex((b) => b.id === nextEnabled.id);
                    reorderBlocks(globalIdx, nextGlobal);
                  }
                }}
                onHide={() => setBlockEnabled(block.id, false)}
              >
                {block.type === "tasks" && (
                  <TasksBlock tasks={tasks} loading={tasksLoading} setStatus={setStatus} toggleToday={toggleToday} />
                )}
                {block.type === "focus" && (
                  <FocusBlock value={daily.focus} onChange={(v) => { saveDaily({ focus: v }); }} />
                )}
                {block.type === "intentions" && (
                  <IntentionsBlock intentions={daily.intentions} onChange={(v) => saveDaily({ intentions: v })} />
                )}
                {block.type === "habits" && (
                  <HabitsBlock
                    habits={config.habits}
                    habitsDone={daily.habitsDone}
                    editMode={editMode}
                    onToggle={(h) => saveDaily({ habitsDone: { ...daily.habitsDone, [h]: !daily.habitsDone[h] } })}
                    onEditHabits={() => setShowHabitEditor(true)}
                  />
                )}
                {block.type === "water" && (
                  <WaterBlock count={daily.waterCount} onChange={(n) => saveDaily({ waterCount: n })} />
                )}
                {block.type === "mood" && (
                  <MoodBlock
                    mood={daily.mood}
                    energy={daily.energy}
                    onMoodChange={(m) => saveDaily({ mood: m })}
                    onEnergyChange={(n) => saveDaily({ energy: n })}
                  />
                )}
                {block.type === "note" && (
                  <NoteBlock value={daily.note} onChange={(v) => saveWithDebounce({ note: v })} />
                )}
                {block.type === "checklist" && (
                  <ChecklistBlock items={daily.checklist} onChange={(items) => saveDaily({ checklist: items })} />
                )}
                {block.type === "reflection" && (
                  <ReflectionBlock value={daily.reflection} onChange={(v) => saveWithDebounce({ reflection: v })} />
                )}
              </BlockCard>
            ))
          )}
        </AnimatePresence>

        {/* Add blocks shortcut */}
        {enabledBlocks.length > 0 && config.blocks.some((b) => !b.enabled) && (
          <button onClick={() => setShowLibrary(true)}
            className="w-full py-3 rounded-2xl border border-dashed border-border text-xs text-muted-foreground flex items-center justify-center gap-2 hover:bg-muted/30 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add another block
          </button>
        )}
      </div>

      {/* Panels */}
      <AnimatePresence>
        {showLibrary && (
          <BlockLibrary
            config={config.blocks}
            onToggle={setBlockEnabled}
            onClose={() => setShowLibrary(false)}
          />
        )}
        {showHabitEditor && (
          <HabitEditor
            habits={config.habits}
            onSave={(h) => saveConfig({ habits: h })}
            onClose={() => setShowHabitEditor(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Today;
