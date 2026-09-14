import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { NoteCategoryOption, NotesPrefs } from "@/types/notes";
import { NOTE_CATEGORIES, noteCategoryOptions, slugifyNoteCategory } from "@/types/notes";

const SWATCHES = ["#fde68a", "#fdba74", "#fca5a5", "#f9a8d4", "#d8b4fe", "#93c5fd", "#5eead4", "#86efac", "#e2e8f0"];

export function NoteCategorySettings({
  prefs,
  onChange,
}: {
  prefs: Pick<NotesPrefs, "customCategories" | "hiddenCategoryIds">;
  onChange: (next: Pick<NotesPrefs, "customCategories" | "hiddenCategoryIds">) => void;
}) {
  const [label, setLabel] = useState("");
  const options = noteCategoryOptions(prefs);

  const persist = (customCategories: NoteCategoryOption[], hiddenCategoryIds: string[]) => {
    onChange({ customCategories, hiddenCategoryIds });
  };

  const upsert = (next: NoteCategoryOption) => {
    persist(
      [...(prefs.customCategories ?? []).filter((item) => item.id !== next.id), next],
      prefs.hiddenCategoryIds ?? [],
    );
  };

  const add = () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const id = slugifyNoteCategory(trimmed);
    if (options.some((item) => item.id === id || item.label.toLowerCase() === trimmed.toLowerCase())) {
      setLabel("");
      return;
    }
    persist(
      [...(prefs.customCategories ?? []), { id, label: trimmed, swatch: SWATCHES[(options.length) % SWATCHES.length] }],
      prefs.hiddenCategoryIds ?? [],
    );
    setLabel("");
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Note categories</p>
        <p className="text-[11px] text-muted-foreground">Tap a colour to retint, or remove ones you do not use.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((category) => {
          const builtIn = NOTE_CATEGORIES.some((item) => item.id === category.id);
          return (
            <span
              key={category.id}
              className="flex items-center gap-1.5 rounded-full border border-border/60 px-2 py-1 text-xs font-semibold"
              style={{ background: `color-mix(in srgb, ${category.swatch} 42%, hsl(var(--card)))` }}
            >
              <input
                aria-label={`${category.label} colour`}
                type="color"
                value={category.swatch}
                onChange={(event) => upsert({ ...category, swatch: event.target.value })}
                className="h-4 w-4 cursor-pointer rounded-full border-0 bg-transparent p-0"
              />
              <input
                value={category.label}
                aria-label={`${category.label} name`}
                onChange={(event) => upsert({ ...category, label: event.target.value })}
                className="w-20 border-0 bg-transparent p-0 text-xs font-semibold outline-none"
              />
              <button
                type="button"
                aria-label={`Remove ${category.label}`}
                onClick={() => {
                  if (builtIn) {
                    persist(
                      (prefs.customCategories ?? []).filter((item) => item.id !== category.id),
                      [...new Set([...(prefs.hiddenCategoryIds ?? []), category.id])],
                    );
                    return;
                  }
                  persist(
                    (prefs.customCategories ?? []).filter((item) => item.id !== category.id),
                    prefs.hiddenCategoryIds ?? [],
                  );
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
      </div>
      <div className="flex gap-2">
        <Input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder="Add a category…"
          className="h-8 rounded-xl text-xs"
        />
        <Button type="button" variant="outline" className="h-8 rounded-xl px-3 text-xs" onClick={add}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add
        </Button>
      </div>
    </div>
  );
}
