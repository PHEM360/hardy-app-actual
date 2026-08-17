import { useState } from "react";
import { Plus, Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_ACCOUNT_TYPES, accountTypeLabel, withOtherLast } from "@/lib/financeAccounts";

export default function AccountTypesSettings({
  types,
  canEdit,
  onSave,
  onRenameType,
}: {
  types: string[];
  canEdit: boolean;
  onSave: (next: string[]) => Promise<void>;
  onRenameType?: (from: string, to: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const editable = types.filter((t) => t !== "Other");

  const commit = async (next: string[]) => {
    setSaving(true);
    try {
      await onSave(withOtherLast(next));
    } finally {
      setSaving(false);
    }
  };

  const rename = async (index: number, value: string) => {
    const next = [...editable];
    next[index] = value;
    await commit(next);
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= editable.length) return;
    const next = [...editable];
    [next[index], next[target]] = [next[target], next[index]];
    await commit(next);
  };

  const remove = async (index: number) => {
    await commit(editable.filter((_, i) => i !== index));
  };

  const add = async () => {
    const name = draft.trim();
    if (!name || types.includes(name)) return;
    setDraft("");
    await commit([...editable, name]);
  };

  return (
    <div className="p-4 sm:p-5 rounded-3xl bg-card border-2 border-border shadow-card mb-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Account types</h3>
          <p className="text-xs text-muted-foreground mt-1">
            These appear when you add or edit an account. Choose Other to type a one-off name.
          </p>
        </div>
        {canEdit && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-lg text-xs gap-1.5 flex-shrink-0"
            onClick={() => void commit([...DEFAULT_ACCOUNT_TYPES])}
            disabled={saving}
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </Button>
        )}
      </div>

      <div className="space-y-1.5">
        {editable.map((type, i) => (
          <div key={`${type}-${i}`} className="flex items-center gap-1.5 rounded-xl border border-border/50 bg-muted/20 px-2 py-1.5">
            {canEdit ? (
              <Input
                defaultValue={type}
                className="h-9 rounded-lg text-sm bg-background"
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (!next || next === type) {
                    e.target.value = type;
                    return;
                  }
                  void rename(i, next);
                  onRenameType?.(type, next);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
              />
            ) : (
              <span className="flex-1 text-sm px-2">{accountTypeLabel(type)}</span>
            )}
            {canEdit && (
              <div className="flex items-center flex-shrink-0">
                <button
                  type="button"
                  className="px-1.5 h-8 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={i === 0 || saving}
                  onClick={() => void move(i, -1)}
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="px-1.5 h-8 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={i === editable.length - 1 || saving}
                  onClick={() => void move(i, 1)}
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive disabled:opacity-30"
                  disabled={saving}
                  onClick={() => void remove(i)}
                  title="Remove type"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
        <div className="flex items-center gap-1.5 rounded-xl border border-dashed border-border/70 bg-muted/10 px-3 py-2">
          <span className="text-sm text-muted-foreground">Other</span>
          <span className="text-[11px] text-muted-foreground ml-auto">Always available — opens a text box</span>
        </div>
      </div>

      {canEdit && (
        <div className="flex gap-2 mt-4">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a type…"
            className="h-10 rounded-xl"
            onKeyDown={(e) => {
              if (e.key === "Enter") void add();
            }}
          />
          <Button
            type="button"
            className="h-10 rounded-xl gap-1.5 bg-gradient-primary"
            disabled={!draft.trim() || types.includes(draft.trim()) || saving}
            onClick={() => void add()}
          >
            <Plus className="w-4 h-4" /> Add
          </Button>
        </div>
      )}
    </div>
  );
}
