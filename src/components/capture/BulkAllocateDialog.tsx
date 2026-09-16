import { useEffect, useState } from "react";
import {
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Heart,
  Home,
  Receipt,
  SkipForward,
  StickyNote,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReceiptThumb } from "@/components/receipts/ReceiptPreview";
import { useCompanies } from "@/hooks/useCompanies";
import { useSharedCategorySettings } from "@/hooks/useSharedCategorySettings";
import { useMyHouseholds } from "@/hooks/useHouseholds";
import { useFlatsList } from "@/hooks/useFlats";
import { usePets } from "@/hooks/usePets";
import { useCaptureInbox } from "@/hooks/useCaptureInbox";
import {
  capturePagesLabel,
  captureExpenseAllowed,
  categoriesForCapture,
  todayIsoDate,
  type CaptureDestType,
  type CaptureDraft,
  type CaptureItem,
  type CaptureKind,
} from "@/lib/captureInbox";

type DestChoice = { type: CaptureDestType; id: string; label: string };

function draftFor(item: CaptureItem): CaptureDraft {
  return {
    kind: item.kind === "expense" ? "expense" : "document",
    destType: "unallocated",
    destId: "",
    destLabel: "Unallocated",
    name: item.name || "",
    description: item.description || "",
    amount: item.amount != null ? String(item.amount) : "",
    date: item.date || todayIsoDate(),
    category: item.category || "Other",
  };
}

export function BulkAllocateDialog({
  open,
  onOpenChange,
  items,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CaptureItem[];
}) {
  const { companies } = useCompanies();
  const { households } = useMyHouseholds();
  const { flats } = useFlatsList();
  const { pets } = usePets();
  const { allocateItem } = useCaptureInbox();
  const { settings: sharedCats } = useSharedCategorySettings();

  // Snapshotted once when the dialog opens — a live Firestore update to the
  // real inbox mid-flow (someone else adds a new item, another tab files
  // one) must not reshuffle which item "index" points to underneath the user.
  const [roster, setRoster] = useState<CaptureItem[]>(items);
  const [index, setIndex] = useState(0);
  const [staged, setStaged] = useState<Record<string, CaptureDraft>>({});
  const [draft, setDraft] = useState<CaptureDraft>(() => draftFor(items[0] ?? ({} as CaptureItem)));
  const [phase, setPhase] = useState<"step" | "review" | "done">("step");
  const [committing, setCommitting] = useState(false);
  const [commitProgress, setCommitProgress] = useState<{ done: number; total: number } | null>(null);
  const [filedCount, setFiledCount] = useState(0);

  // Reset everything each time the dialog is (re)opened with a fresh item list.
  useEffect(() => {
    if (!open) return;
    setRoster(items);
    setIndex(0);
    setStaged({});
    setDraft(items[0] ? draftFor(items[0]) : draftFor({} as CaptureItem));
    setPhase("step");
    setCommitProgress(null);
    setFiledCount(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const current = roster[index];
  const stagedCount = Object.keys(staged).length;
  const remaining = roster.length - index;

  const dest: DestChoice = { type: draft.destType, id: draft.destId, label: draft.destLabel };
  const kind: CaptureKind = draft.kind;
  const expenseOk = captureExpenseAllowed(dest.type) && dest.type !== "unallocated";
  const showExpenseFields = kind === "expense" && expenseOk;
  const categories = categoriesForCapture(dest.type, {
    kind,
    expense: sharedCats.expenseCategories,
    document: sharedCats.documentCategories,
  });
  const categoryOptions = categories.includes(draft.category) || !draft.category ? categories : [...categories, draft.category];
  const hasDest = dest.type !== "unallocated" && (dest.type === "pets" || dest.type === "notes" || Boolean(dest.id));
  const canStage = hasDest && (showExpenseFields
    ? Boolean(draft.description.trim() && (dest.type !== "company" || draft.amount.trim()))
    : Boolean(draft.name.trim()));

  const pickDest = (next: DestChoice) => {
    const nextKind: CaptureKind = next.type !== "unallocated" && draft.kind === "expense" && !captureExpenseAllowed(next.type)
      ? "document"
      : draft.kind;
    setDraft((cur) => {
      const nextCats = categoriesForCapture(next.type, {
        kind: nextKind,
        expense: sharedCats.expenseCategories,
        document: sharedCats.documentCategories,
      });
      return {
        ...cur,
        kind: nextKind,
        destType: next.type,
        destId: next.id,
        destLabel: next.label,
        category: nextCats.includes(cur.category) ? cur.category : (nextCats[0] || "Other"),
      };
    });
  };

  const goToIndex = (nextIndex: number, nextStaged = staged) => {
    if (nextIndex >= roster.length) {
      setPhase("review");
      return;
    }
    setIndex(nextIndex);
    const nextItem = roster[nextIndex];
    setDraft(nextStaged[nextItem.id] ?? draftFor(nextItem));
  };

  const stageAndNext = () => {
    if (!current || !canStage) return;
    const nextStaged = { ...staged, [current.id]: draft };
    setStaged(nextStaged);
    goToIndex(index + 1, nextStaged);
  };

  const skip = () => {
    if (!current) return;
    const nextStaged = { ...staged };
    delete nextStaged[current.id];
    setStaged(nextStaged);
    goToIndex(index + 1, nextStaged);
  };

  const goBack = () => {
    if (index === 0) return;
    goToIndex(index - 1);
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
          await allocateItem(item, itemDraft);
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

  const destChip = (next: DestChoice, icon: React.ReactNode) => {
    const on = dest.type === next.type && dest.id === next.id;
    return (
      <button
        key={`${next.type}-${next.id || "root"}`}
        type="button"
        onClick={() => pickDest(next)}
        className={`flex min-w-0 items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-left text-[11px] font-semibold transition ${
          on ? "border-primary/50 bg-primary/10 text-foreground" : "border-border/60 bg-card text-muted-foreground hover:bg-muted/50"
        }`}
      >
        {icon}
        <span className="truncate">{next.label}</span>
      </button>
    );
  };

  const namePresets = ["Receipt", "Invoice", "Letter", "Certificate", "Statement"];

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && committing) return; onOpenChange(next); }}>
      <DialogContent aria-describedby={undefined} className="mx-4 max-h-[85dvh] max-w-md overflow-y-auto">
        {phase === "step" && current && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between font-display">
                <span>Allocate</span>
                <span className="text-xs font-semibold text-muted-foreground">
                  {index + 1} of {roster.length}
                </span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 pt-1">
              {current.files?.[0] && (
                <ReceiptThumb source={{ url: current.files[0].url, name: current.files[0].name }} className="h-28 w-full rounded-xl" />
              )}
              {(current.files?.length || 0) > 1 && (
                <p className="text-center text-[11px] text-muted-foreground">{capturePagesLabel(current.files!.length)} on this item</p>
              )}

              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Send to</p>
                <div className="flex flex-wrap gap-1.5">
                  {companies.map((c) => destChip({ type: "company", id: c.id || "", label: c.name }, <Building2 className="h-3.5 w-3.5 shrink-0" />))}
                  {households.map((h) => destChip({ type: "household", id: h.id, label: h.name }, <Home className="h-3.5 w-3.5 shrink-0" />))}
                  {flats.map((f) => destChip({ type: "flat", id: f.id, label: f.name }, <Building2 className="h-3.5 w-3.5 shrink-0" />))}
                  {destChip({ type: "pets", id: "", label: "All pets" }, <Heart className="h-3.5 w-3.5 shrink-0" />)}
                  {pets.map((p) => destChip({ type: "pets", id: p.id, label: p.name }, <Heart className="h-3.5 w-3.5 shrink-0" />))}
                  {destChip({ type: "notes", id: "", label: "Notes" }, <StickyNote className="h-3.5 w-3.5 shrink-0" />)}
                </div>
              </div>

              {hasDest && (
                <>
                  <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-border/50 bg-card p-1">
                    {(["expense", "document"] as CaptureKind[]).map((id) => {
                      const on = kind === id;
                      const disabled = id === "expense" && !captureExpenseAllowed(dest.type);
                      return (
                        <button
                          key={id}
                          type="button"
                          disabled={disabled}
                          onClick={() => setDraft((cur) => ({ ...cur, kind: id }))}
                          className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${
                            on ? "bg-gradient-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/60"
                          }`}
                        >
                          {id === "expense" ? <Receipt className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                          {id === "expense" ? "Expense" : "Document"}
                        </button>
                      );
                    })}
                  </div>

                  <div className="space-y-1">
                    <Label>{showExpenseFields ? "Description" : "Name"}{" *"}</Label>
                    <Input
                      value={showExpenseFields ? draft.description : draft.name}
                      onChange={(e) => {
                        const value = e.target.value;
                        setDraft((cur) => (showExpenseFields ? { ...cur, description: value, name: cur.name || value } : { ...cur, name: value }));
                      }}
                      placeholder={showExpenseFields ? "e.g. Office supplies" : "e.g. Boiler certificate"}
                      className="h-9 rounded-xl"
                    />
                    {!showExpenseFields && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {namePresets.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setDraft((cur) => ({ ...cur, name: preset }))}
                            className="rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-foreground"
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {showExpenseFields && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label>Amount (£){dest.type === "company" ? " *" : ""}</Label>
                        <Input type="number" step="0.01" value={draft.amount} onChange={(e) => setDraft((cur) => ({ ...cur, amount: e.target.value }))} className="h-9 rounded-xl" />
                      </div>
                      <div className="space-y-1">
                        <Label>Date</Label>
                        <Input type="date" value={draft.date} onChange={(e) => setDraft((cur) => ({ ...cur, date: e.target.value }))} className="h-9 rounded-xl" />
                      </div>
                    </div>
                  )}

                  {!showExpenseFields && (
                    <div className="space-y-1">
                      <Label>Notes</Label>
                      <Textarea
                        value={draft.description}
                        onChange={(e) => setDraft((cur) => ({ ...cur, description: e.target.value }))}
                        placeholder="Optional…"
                        className="min-h-[60px] rounded-xl"
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label>Category</Label>
                    <Select value={draft.category} onValueChange={(v) => setDraft((cur) => ({ ...cur, category: v }))}>
                      <SelectTrigger className="h-9 rounded-xl"><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="h-10 flex-1 rounded-xl gap-1.5" onClick={skip}>
                  <SkipForward className="h-4 w-4" /> Skip
                </Button>
                <Button className="h-10 flex-1 rounded-xl bg-gradient-primary gap-1.5" disabled={!canStage} onClick={stageAndNext}>
                  {index + 1 >= roster.length ? "Stage & review" : "Stage & next"}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={index === 0}
                  className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Back
                </button>
                <button
                  type="button"
                  onClick={() => setPhase("review")}
                  disabled={stagedCount === 0}
                  className="text-[11px] font-semibold text-primary disabled:opacity-30"
                >
                  Finish now — file {stagedCount} staged
                </button>
              </div>
              <p className="text-center text-[11px] leading-snug text-muted-foreground">
                Nothing is filed until you confirm. {remaining > 1 ? `${remaining - 1} more after this one — stop whenever you like.` : "This is the last one."}
              </p>
            </div>
          </>
        )}

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
