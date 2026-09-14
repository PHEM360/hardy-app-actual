import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FileText, Inbox, Plus, Receipt, Settings2, Trash2 } from "lucide-react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { AddExpenseDocumentDialog } from "@/components/capture/AddExpenseDocumentDialog";
import { SharedCategorySettingsPanel } from "@/components/settings/SharedCategorySettingsPanel";
import { Button } from "@/components/ui/button";
import { useCaptureInbox } from "@/hooks/useCaptureInbox";
import { capturePagesLabel, type CaptureItem } from "@/lib/captureInbox";
import { toast } from "sonner";

type Filter = "all" | "expense" | "document" | "settings";

function InboxPhoto({ item }: { item: CaptureItem }) {
  const files = item.files || [];
  if (!files.length) {
    return (
      <div className="flex h-28 items-center justify-center bg-muted/30">
        {item.kind === "expense" ? <Receipt className="h-8 w-8 text-muted-foreground" /> : <FileText className="h-8 w-8 text-muted-foreground" />}
      </div>
    );
  }

  return (
    <div className="relative space-y-1 bg-muted/30 p-2">
      {files.map((file, index) =>
        (file.mimeType || "").startsWith("image/") ? (
          <img
            key={`${file.storagePath}-${index}`}
            src={file.url}
            alt=""
            className="mx-auto max-h-80 w-full object-contain"
          />
        ) : (
          <div key={`${file.storagePath}-${index}`} className="flex h-24 items-center justify-center rounded-lg bg-card">
            <FileText className="h-7 w-7 text-muted-foreground" />
          </div>
        ),
      )}
      {files.length > 1 && (
        <span className="absolute bottom-3 right-3 rounded-lg bg-card/95 px-1.5 py-0.5 text-[10px] font-semibold shadow-sm">
          {capturePagesLabel(files.length)}
        </span>
      )}
    </div>
  );
}

export default function Unallocated() {
  const [params, setParams] = useSearchParams();
  const { items, loading, removeItem } = useCaptureInbox();
  const [filter, setFilter] = useState<Filter>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [allocating, setAllocating] = useState<CaptureItem | null>(null);

  const focusId = params.get("item");
  useEffect(() => {
    if (!focusId || !items.length) return;
    const match = items.find((item) => item.id === focusId);
    if (match) setAllocating(match);
  }, [focusId, items]);

  const visible = useMemo(
    () => items.filter((item) => filter === "all" || item.kind === filter),
    [items, filter],
  );

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "expense", label: "Expenses" },
    { id: "document", label: "Documents" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <FeaturePageShell
      title="Unallocated"
      subtitle="Receipts and files waiting to be filed."
      icon={<Inbox className="h-5 w-5" />}
      action={
        <Button className="h-9 rounded-xl bg-gradient-primary" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Add
        </Button>
      }
    >
      <div className="flex min-w-0 gap-3">
        <aside className="hidden w-[11rem] shrink-0 lg:block">
          <nav className="sticky top-2 space-y-1 rounded-2xl border border-border/50 bg-card p-1.5 shadow-card">
            {filters.map((item) => {
              const on = filter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={`flex w-full items-center gap-2 rounded-xl border px-2 py-2 text-left text-xs font-semibold transition ${
                    on
                      ? "border-primary/45 bg-primary/10 text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  {item.id === "settings" && <Settings2 className="h-3.5 w-3.5 shrink-0" />}
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap gap-1.5 lg:hidden">
            {filters.map((item) => {
              const on = filter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${
                    on ? "border-primary/45 bg-primary/10" : "border-border/50 bg-card text-muted-foreground"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {filter === "settings" ? (
            <div
              className="rounded-2xl border border-border/50 p-4 shadow-card"
              style={{
                background: "color-mix(in srgb, hsl(var(--primary)) 10%, hsl(var(--card)))",
                borderLeft: "4px solid hsl(var(--primary))",
              }}
            >
              <p className="font-display text-base font-bold">Categories</p>
              <p className="mb-4 mt-1 text-sm text-muted-foreground">
                Income and expense lists are shared with Companies. Document categories are used when you add or allocate a file.
              </p>
              <SharedCategorySettingsPanel showDocuments />
            </div>
          ) : loading && !items.length ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : visible.length === 0 ? (
            <div
              className="rounded-2xl border border-border/50 p-8 text-center shadow-card"
              style={{ background: "color-mix(in srgb, hsl(var(--primary)) 10%, hsl(var(--card)))" }}
            >
              <Inbox className="mx-auto mb-2 h-8 w-8 text-primary" />
              <p className="font-display text-base font-semibold">Inbox is clear</p>
              <p className="mt-1 text-sm text-muted-foreground">
                From your phone, add expense or document → Unallocated, snap the pile, then finish them here.
              </p>
              <Button className="mt-4 h-9 rounded-xl bg-gradient-primary" onClick={() => setAddOpen(true)}>
                Add receipts
              </Button>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {visible.map((item) => (
                <div
                  key={item.id}
                  className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-card"
                  style={{ borderLeftWidth: 3, borderLeftColor: "hsl(var(--primary))" }}
                >
                  <button type="button" className="block w-full text-left" onClick={() => setAllocating(item)}>
                    <InboxPhoto item={item} />
                    <div className="p-3">
                      <p className="truncate font-semibold">{item.name || "Untitled"}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.kind === "expense" ? "Expense" : "Document"}
                        {item.category ? ` · ${item.category}` : ""}
                        {` · ${capturePagesLabel(item.files?.length || 0)}`}
                        {item.amount != null ? ` · £${item.amount}` : ""}
                        {item.date ? ` · ${item.date}` : ""}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center justify-between border-t border-border/40 px-3 py-2">
                    <button
                      type="button"
                      className="text-xs font-semibold text-primary"
                      onClick={() => setAllocating(item)}
                    >
                      Allocate
                    </button>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Delete"
                      onClick={async () => {
                        await removeItem(item);
                        toast.success("Removed");
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AddExpenseDocumentDialog
        open={addOpen}
        onOpenChange={setAddOpen}
      />
      <AddExpenseDocumentDialog
        open={!!allocating}
        allocateItem={allocating}
        onOpenChange={(open) => {
          if (!open) {
            setAllocating(null);
            if (focusId) {
              params.delete("item");
              setParams(params, { replace: true });
            }
          }
        }}
      />
    </FeaturePageShell>
  );
}
