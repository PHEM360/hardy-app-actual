import { useState } from "react";
import { Plus, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTodayPage } from "@/hooks/useTodayPage";
import type { ChecklistItem } from "@/hooks/useTodayPage";

export function TdChecklistWidget() {
  const { daily, saveDaily } = useTodayPage();
  const [newText, setNewText] = useState("");

  const items = daily.checklist;

  const add = () => {
    if (!newText.trim()) return;
    saveDaily({ checklist: [...items, { id: `ci-${Date.now()}`, text: newText.trim(), done: false }] });
    setNewText("");
  };

  const toggle = (id: string) =>
    saveDaily({ checklist: items.map((i) => i.id === id ? { ...i, done: !i.done } : i) });

  const remove = (id: string) =>
    saveDaily({ checklist: items.filter((i) => i.id !== id) });

  return (
    <div className="h-full flex flex-col p-3">
      <div className="flex items-center gap-2 mb-2 flex-shrink-0">
        <span className="text-base">☑️</span>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Checklist</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 mb-2">
        {items.length === 0 && <p className="text-xs text-muted-foreground">Add items below…</p>}
        <AnimatePresence>
          {items.map((item) => (
            <motion.div key={item.id} layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2"
            >
              <button onClick={() => toggle(item.id)}
                className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${item.done ? "bg-primary border-primary" : "border-border"}`}
              >
                {item.done && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
              </button>
              <p className={`flex-1 text-xs ${item.done ? "line-through text-muted-foreground" : ""}`}>{item.text}</p>
              <button onClick={() => remove(item.id)} className="flex-shrink-0">
                <X className="w-3 h-3 text-muted-foreground hover:text-destructive transition-colors" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex gap-2 flex-shrink-0">
        <input value={newText} onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          placeholder="Add item…"
          className="flex-1 text-xs bg-muted/40 rounded-xl px-3 py-1.5 border border-border/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button onClick={add} disabled={!newText.trim()}
          className="w-7 h-7 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 flex-shrink-0">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
