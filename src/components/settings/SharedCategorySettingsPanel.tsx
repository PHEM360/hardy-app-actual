import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSharedCategorySettings } from "@/hooks/useSharedCategorySettings";
import { sortCategoriesOtherLast, type SharedCategorySettings } from "@/types/app";
import { toast } from "sonner";

const FIELDS: { key: keyof SharedCategorySettings; label: string; tint: string; ink: string; border: string }[] = [
  {
    key: "incomeCategories",
    label: "Income categories",
    tint: "bg-emerald-50",
    ink: "text-emerald-800",
    border: "border-emerald-200",
  },
  {
    key: "expenseCategories",
    label: "Expense categories",
    tint: "bg-rose-50",
    ink: "text-rose-800",
    border: "border-rose-200",
  },
  {
    key: "documentCategories",
    label: "Document categories",
    tint: "bg-sky-50",
    ink: "text-sky-800",
    border: "border-sky-200",
  },
];

export function SharedCategorySettingsPanel({
  showDocuments = false,
}: {
  showDocuments?: boolean;
}) {
  const { settings, loading, saveSettings } = useSharedCategorySettings();
  const [local, setLocal] = useState(settings);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocal(settings);
  }, [settings]);

  const persist = async (next: SharedCategorySettings) => {
    setSaving(true);
    try {
      await saveSettings(next);
    } catch {
      toast.error("Couldn’t save categories.");
    } finally {
      setSaving(false);
    }
  };

  const addItem = (field: keyof SharedCategorySettings, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const next = {
      ...local,
      [field]: sortCategoriesOtherLast([...local[field].filter((item) => item !== trimmed), trimmed]),
    };
    setLocal(next);
    setDrafts((current) => ({ ...current, [field]: "" }));
    void persist(next);
  };

  const removeItem = (field: keyof SharedCategorySettings, value: string) => {
    const next = { ...local, [field]: local[field].filter((item) => item !== value) };
    setLocal(next);
    void persist(next);
  };

  if (loading) return <p className="py-6 text-center text-sm text-muted-foreground">Loading categories…</p>;

  return (
    <div className="space-y-5">
      {FIELDS.filter((field) => showDocuments || field.key !== "documentCategories").map((field) => (
        <div key={field.key} className="rounded-xl border border-border/50 bg-card p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{field.label}</p>
          <div className="mb-3 flex flex-wrap gap-2">
            {local[field.key].map((cat) => (
              <span
                key={cat}
                className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${field.tint} ${field.ink} ${field.border}`}
              >
                {cat}
                <button
                  type="button"
                  onClick={() => removeItem(field.key, cat)}
                  className="transition-colors hover:text-red-500"
                  aria-label={`Remove ${cat}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={drafts[field.key] || ""}
              onChange={(e) => setDrafts((current) => ({ ...current, [field.key]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem(field.key, drafts[field.key] || "");
                }
              }}
              placeholder="Add category…"
              className="h-8 rounded-xl text-xs"
            />
            <Button
              type="button"
              variant="outline"
              className="h-8 rounded-xl px-3 text-xs"
              onClick={() => addItem(field.key, drafts[field.key] || "")}
              disabled={saving}
            >
              Add
            </Button>
          </div>
        </div>
      ))}
      <p className="text-[11px] leading-snug text-muted-foreground">
        These lists are shared. Change them here or on {showDocuments ? "Companies" : "Unallocated"} and both pages stay in step.
      </p>
    </div>
  );
}
