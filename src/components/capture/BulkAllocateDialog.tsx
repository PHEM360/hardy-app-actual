import { useEffect, useState } from "react";
import { Check, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AddExpenseDocumentDialog } from "@/components/capture/AddExpenseDocumentDialog";
import { useCaptureInbox } from "@/hooks/useCaptureInbox";
import type { CaptureDraft, CaptureItem } from "@/lib/captureInbox";

/**
 * Click-through allocation: steps through `items` one at a time using the
 * real AddExpenseDocumentDialog (same image preview/lightbox, same fields
 * as allocating a single item) so this never drifts out of parity with it.
 * Nothing is uploaded per-step — each "Stage & next" just records the draft
 * locally; only "Finish" actually files whatever was staged, in one batch.
 */
export function BulkAllocateDialog({
  open,
  onOpenChange,
  items,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CaptureItem[];
}) {
  const { allocateItem: performAllocate } = useCaptureInbox();

  // Snapshotted once when the dialog opens — a live inbox update elsewhere
  // mid-flow must not reshuffle which item "index" points to underneath the user.
  const [roster, setRoster] = useState<CaptureItem[]>(items);
  const [index, setIndex] = useState(0);
  const [staged, setStaged] = useState<Record<string, CaptureDraft>>({});
  const [phase, setPhase] = useState<"step" | "review" | "done">("step");
  const [committing, setCommitting] = useState(false);
  const [commitProgress, setCommitProgress] = useState<{ done: number; total: number } | null>(null);
  const [filedCount, setFiledCount] = useState(0);

  useEffect(() => {
    if (!open) return;
    setRoster(items);
    setIndex(0);
    setStaged({});
    setPhase("step");
    setCommitProgress(null);
    setFiledCount(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const current = roster[index];
  const stagedCount = Object.keys(staged).length;

  const advance = () => {
    if (index + 1 >= roster.length) setPhase("review");
    else setIndex(index + 1);
  };

  const stageCurrent = (draft: CaptureDraft) => {
    if (!current) return;
    setStaged((prev) => ({ ...prev, [current.id]: draft }));
    advance();
  };

  const skipCurrent = () => {
    if (!current) return;
    setStaged((prev) => {
      const next = { ...prev };
      delete next[current.id];
      return next;
    });
    advance();
  };

  const commitStaged = async () => {
    const entries = Object.entries(staged);
    if (entries.length === 0) {
      onOpenChange(false);
      return;
    }
    setCommitting(true);
    setCommitProgress({ done: 0, total: entries.length });
    let ok = 0;
    for (let i = 0; i < entries.length; i += 1) {
      const [itemId, itemDraft] = entries[i];
      const item = roster.find((it) => it.id === itemId);
      if (item) {
        try {
          await performAllocate(item, itemDraft);
          ok += 1;
        } catch (err) {
          toast.error(`Couldn't file "${item.name || "an item"}": ${err instanceof Error ? err.message : "unknown error"}`);
        }
      }
      setCommitProgress({ done: i + 1, total: entries.length });
    }
    setCommitting(false);
    setFiledCount(ok);
    setPhase("done");
  };

  if (phase === "step") {
    return (
      <AddExpenseDocumentDialog
        open={open && !!current}
        onOpenChange={(next) => { if (!next) onOpenChange(false); }}
        allocateItem={current}
        bulk={{
          index,
          total: roster.length,
          stagedCount,
          onStage: stageCurrent,
          onSkip: skipCurrent,
          onFinish: () => setPhase("review"),
        }}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && committing) return; onOpenChange(next); }}>
      <DialogContent aria-describedby={undefined} className="mx-4 max-h-[85dvh] max-w-md overflow-y-auto">
        {phase === "review" && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display">Ready to file {stagedCount}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-1">
              {stagedCount === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Nothing staged yet — go back and stage at least one item.</p>
              ) : (
                <div className="max-h-64 space-y-1.5 overflow-y-auto">
                  {Object.entries(staged).map(([itemId, d]) => {
                    const item = roster.find((it) => it.id === itemId);
                    return (
                      <div key={itemId} className="flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-card px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{(d.kind === "document" ? d.name : d.description) || item?.name || "Untitled"}</p>
                          <p className="text-[11px] text-muted-foreground">→ {d.destLabel}</p>
                        </div>
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                      </div>
                    );
                  })}
                </div>
              )}

              {committing && commitProgress ? (
                <div className="space-y-1.5">
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-primary transition-[width] duration-300"
                      style={{ width: `${Math.max(4, Math.round((commitProgress.done / commitProgress.total) * 100))}%` }}
                    />
                  </div>
                  <p className="text-center text-xs text-muted-foreground">Filing {commitProgress.done} of {commitProgress.total}…</p>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" className="h-10 flex-1 rounded-xl" onClick={() => setPhase("step")}>
                    Back to editing
                  </Button>
                  <Button className="h-10 flex-1 rounded-xl bg-gradient-primary" disabled={stagedCount === 0} onClick={() => void commitStaged()}>
                    File {stagedCount}
                  </Button>
                </div>
              )}
            </div>
          </>
        )}

        {phase === "done" && (
          <div className="px-1 py-4 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-center font-display">Filed</DialogTitle>
            </DialogHeader>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {filedCount} item{filedCount === 1 ? "" : "s"} filed. {roster.length - stagedCount > 0 ? "The rest are still waiting in Unallocated." : ""}
            </p>
            <Button className="mt-5 h-10 w-full rounded-xl bg-gradient-primary" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
