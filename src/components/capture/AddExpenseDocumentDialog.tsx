import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  Camera,
  CheckCircle2,
  FileText,
  Heart,
  Home,
  Inbox,
  Paperclip,
  Receipt,
  StickyNote,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReceiptThumb } from "@/components/receipts/ReceiptPreview";
import { useCompanies } from "@/hooks/useCompanies";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useMyHouseholds } from "@/hooks/useHouseholds";
import { useFlatsList } from "@/hooks/useFlats";
import { usePets } from "@/hooks/usePets";
import { useCaptureInbox } from "@/hooks/useCaptureInbox";
import {
  captureExpenseAllowed,
  captureItemThumb,
  capturePagesLabel,
  categoriesForCapture,
  todayIsoDate,
  type CaptureDestType,
  type CaptureDraft,
  type CaptureItem,
  type CaptureKind,
} from "@/lib/captureInbox";

type DestChoice = { type: CaptureDestType; id: string; label: string };

function blankDraft(): CaptureDraft {
  return {
    kind: "expense",
    destType: "unallocated",
    destId: "",
    destLabel: "Unallocated",
    name: "",
    description: "",
    amount: "",
    date: todayIsoDate(),
    category: "Other",
  };
}

function FileChip({ file, page, onRemove }: { file: File; page: number; onRemove: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card">
      <ReceiptThumb source={{ file }} className="h-20 w-full rounded-none border-0" />
      <p className="truncate px-1.5 py-1 text-[10px] font-medium">Page {page}</p>
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-card/90 text-muted-foreground shadow"
        aria-label={`Remove page ${page}`}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export function AddExpenseDocumentDialog({
  open,
  onOpenChange,
  allocateItem,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allocateItem?: CaptureItem | null;
}) {
  const navigate = useNavigate();
  const { companies } = useCompanies();
  const { households } = useMyHouseholds();
  const { flats } = useFlatsList();
  const { pets } = usePets();
  const { items, saveCapture, allocateItem: allocate, loading } = useCaptureInbox();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<CaptureDraft>(blankDraft());
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [savedSummary, setSavedSummary] = useState("");

  const { settings: companySettings } = useCompanySettings(draft.destType === "company" ? draft.destId : "");
  const categories = categoriesForCapture(
    draft.destType,
    draft.destType === "company" ? companySettings.expenseCategories : undefined,
  );

  const dest: DestChoice = {
    type: draft.destType,
    id: draft.destId,
    label: draft.destLabel,
  };

  useEffect(() => {
    if (!open) return;
    if (allocateItem) {
      setDraft({
        kind: allocateItem.kind === "expense" ? "expense" : "document",
        destType: "unallocated",
        destId: "",
        destLabel: "Unallocated",
        name: allocateItem.name || "",
        description: allocateItem.description || allocateItem.name || "",
        amount: allocateItem.amount != null ? String(allocateItem.amount) : "",
        date: allocateItem.date || todayIsoDate(),
        category: allocateItem.category || "Other",
      });
      setFiles([]);
      setSavedOk(false);
      return;
    }
    setDraft(blankDraft());
    setFiles([]);
    setSavedOk(false);
    setSavedSummary("");
  }, [open, allocateItem]);

  const recentUnallocated = useMemo(() => items.slice(0, 4), [items]);
  const kind: CaptureKind = draft.kind;
  const expenseOk = captureExpenseAllowed(dest.type);
  const showDetails = dest.type !== "unallocated";
  const showExpenseFields = kind === "expense" && expenseOk;
  const canSave = allocateItem
    ? dest.type !== "unallocated" && (showExpenseFields ? Boolean(draft.description.trim() && (dest.type !== "company" || draft.amount.trim())) : Boolean(draft.name.trim()))
    : dest.type === "unallocated"
      ? files.length > 0
      : files.length > 0 && (showExpenseFields
        ? Boolean(draft.description.trim() && (dest.type !== "company" || draft.amount.trim()))
        : Boolean(draft.name.trim()));

  const pickDest = (next: DestChoice) => {
    const nextKind = next.type !== "unallocated" && draft.kind === "expense" && !captureExpenseAllowed(next.type)
      ? "document"
      : draft.kind;
    setDraft((current) => ({
      ...current,
      kind: nextKind,
      destType: next.type,
      destId: next.id,
      destLabel: next.label,
      category: categoriesForCapture(next.type)[0] || "Other",
    }));
  };

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    setFiles((current) => [...current, ...Array.from(list)]);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (allocateItem) {
        await allocate(allocateItem, draft);
        setSavedSummary(`Saved to ${draft.destLabel}.`);
      } else {
        const result = await saveCapture(draft, files);
        const noun = draft.kind === "expense" ? "receipt" : "document";
        const pages = result.pages ?? files.length;
        setSavedSummary(
          result.unallocated
            ? `1 ${noun} with ${capturePagesLabel(pages)} saved to Unallocated.`
            : `1 ${noun} with ${capturePagesLabel(pages)} saved to ${draft.destLabel}.`,
        );
      }
      setSavedOk(true);
      toast.success(allocateItem ? "Allocated" : dest.type === "unallocated" ? "Saved to Unallocated" : "Saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn’t save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const destChip = (next: DestChoice, icon: ReactNode) => {
    const on = dest.type === next.type && dest.id === next.id;
    return (
      <button
        key={`${next.type}-${next.id || "root"}`}
        type="button"
        onClick={() => pickDest(next)}
        className={`flex min-w-0 items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-left text-[11px] font-semibold transition ${
          on
            ? "border-primary/50 bg-primary/10 text-foreground"
            : "border-border/60 bg-card text-muted-foreground hover:bg-muted/50"
        }`}
      >
        {icon}
        <span className="truncate">{next.label}</span>
      </button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-md mx-4">
        {savedOk ? (
          <div className="px-1 py-4 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-center font-display">Saved</DialogTitle>
            </DialogHeader>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{savedSummary}</p>
            <div className="mt-5 flex flex-col gap-2">
              {!allocateItem && (
                <Button
                  className="h-10 w-full rounded-xl bg-gradient-primary"
                  onClick={() => {
                    setDraft(blankDraft());
                    setFiles([]);
                    setSavedOk(false);
                    setSavedSummary("");
                  }}
                >
                  Add another
                </Button>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="h-10 flex-1 rounded-xl"
                  onClick={() => {
                    onOpenChange(false);
                  }}
                >
                  Done
                </Button>
                {dest.type === "unallocated" && (
                  <Button
                    variant={allocateItem ? "default" : "outline"}
                    className={`h-10 flex-1 rounded-xl ${allocateItem ? "bg-gradient-primary" : ""}`}
                    onClick={() => {
                      onOpenChange(false);
                      navigate("/unallocated");
                    }}
                  >
                    View all
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-display">Add expense or document</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-border/50 bg-card p-1">
                {(["expense", "document"] as CaptureKind[]).map((id) => {
                  const on = kind === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          kind: id,
                          ...(id === "expense" && !captureExpenseAllowed(current.destType)
                            ? { destType: "unallocated" as const, destId: "", destLabel: "Unallocated" }
                            : {}),
                        }))
                      }
                      className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold transition ${
                        on ? "bg-gradient-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/60"
                      }`}
                    >
                      {id === "expense" ? <Receipt className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                      {id === "expense" ? "Expense" : "Document"}
                    </button>
                  );
                })}
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Save to</p>
                <div className="flex flex-wrap gap-1.5">
                  {!allocateItem &&
                    destChip(
                      { type: "unallocated", id: "", label: "Unallocated" },
                      <Inbox className="h-3.5 w-3.5 shrink-0" />,
                    )}
                  {companies.map((company) =>
                    destChip(
                      { type: "company", id: company.id || "", label: company.name },
                      <Building2 className="h-3.5 w-3.5 shrink-0" />,
                    ),
                  )}
                  {households.map((household) =>
                    destChip(
                      { type: "household", id: household.id, label: household.name },
                      <Home className="h-3.5 w-3.5 shrink-0" />,
                    ),
                  )}
                  {flats.map((flat) =>
                    destChip(
                      { type: "flat", id: flat.id, label: flat.name },
                      <Building2 className="h-3.5 w-3.5 shrink-0" />,
                    ),
                  )}
                  {kind === "document" &&
                    destChip({ type: "pets", id: "", label: "All pets" }, <Heart className="h-3.5 w-3.5 shrink-0" />)}
                  {kind === "document" &&
                    pets.map((pet) =>
                      destChip(
                        { type: "pets", id: pet.id, label: pet.name },
                        <Heart className="h-3.5 w-3.5 shrink-0" />,
                      ),
                    )}
                  {kind === "document" &&
                    destChip({ type: "notes", id: "", label: "Notes" }, <StickyNote className="h-3.5 w-3.5 shrink-0" />)}
                </div>
                {kind === "expense" && !expenseOk && (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">Expenses go to a company, household, flat, or Unallocated.</p>
                )}
                {allocateItem && dest.type === "unallocated" && (
                  <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                    Pick a company, household, flat, pets or notes to file this.
                  </p>
                )}
                {!allocateItem && dest.type === "unallocated" && (
                  <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                    Snap lots of receipts now and fill in the details later from the Unallocated page.
                  </p>
                )}
              </div>

              {!allocateItem && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Pages</Label>
                    {files.length > 0 && (
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {capturePagesLabel(files.length)} in this {kind === "expense" ? "receipt" : "document"}
                      </span>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf,.doc,.docx"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  {files.length > 0 && (
                    <div className="grid grid-cols-3 gap-1.5">
                      {files.map((file, index) => (
                        <FileChip
                          key={`${file.name}-${index}`}
                          file={file}
                          page={index + 1}
                          onRemove={() => setFiles((current) => current.filter((_, i) => i !== index))}
                        />
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/30 text-xs font-semibold text-foreground hover:bg-muted/60"
                    >
                      <Camera className="h-3.5 w-3.5" /> {files.length ? "Add another page" : "Take photo"}
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/30 text-xs text-muted-foreground hover:bg-muted/60"
                    >
                      <Paperclip className="h-3.5 w-3.5" /> {files.length ? "Add files" : "Upload"}
                    </button>
                  </div>
                </div>
              )}

              {allocateItem && (
                <div className="overflow-hidden rounded-xl border border-border/50">
                  {allocateItem.files?.length > 1 ? (
                    <div className="grid grid-cols-3 gap-px bg-border/40">
                      {allocateItem.files.slice(0, 6).map((file, index) => (
                        <div key={`${file.storagePath}-${index}`} className="relative bg-card">
                          {(file.mimeType || "").startsWith("image/") ? (
                            <img src={file.url} alt="" className="h-20 w-full object-cover" />
                          ) : (
                            <div className="flex h-20 items-center justify-center bg-muted/40">
                              <FileText className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                          <span className="absolute bottom-1 left-1 rounded-md bg-card/90 px-1 text-[9px] font-semibold">
                            {index + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : captureItemThumb(allocateItem) ? (
                    <img src={captureItemThumb(allocateItem) || ""} alt="" className="h-36 w-full object-cover" />
                  ) : (
                    <div className="flex h-24 items-center justify-center bg-muted/40">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <p className="truncate px-3 py-2 text-xs text-muted-foreground">
                    {capturePagesLabel(allocateItem.files?.length || 0)} waiting
                  </p>
                </div>
              )}

              {(showDetails || showExpenseFields || dest.type === "unallocated") && (
                <div className="space-y-1">
                  <Label>
                    {kind === "document" || dest.type === "unallocated" ? "Name" : "Description"}
                    {dest.type !== "unallocated" && (kind === "document" || showExpenseFields) ? " *" : ""}
                  </Label>
                  <Input
                    value={kind === "document" || dest.type === "unallocated" ? draft.name : draft.description}
                    onChange={(e) => {
                      const value = e.target.value;
                      setDraft((current) =>
                        kind === "document" || dest.type === "unallocated"
                          ? { ...current, name: value }
                          : { ...current, description: value, name: current.name || value },
                      );
                    }}
                    placeholder={dest.type === "unallocated" ? "Optional — you can name these later" : kind === "document" ? "e.g. Boiler certificate" : "e.g. Office supplies"}
                    className="h-9 rounded-xl"
                  />
                </div>
              )}

              {showExpenseFields && dest.type !== "unallocated" && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Amount (£){dest.type === "company" ? " *" : ""}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={draft.amount}
                        onChange={(e) => setDraft((current) => ({ ...current, amount: e.target.value }))}
                        className="h-9 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={draft.date}
                        onChange={(e) => setDraft((current) => ({ ...current, date: e.target.value }))}
                        className="h-9 rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Category</Label>
                    <Select value={draft.category} onValueChange={(value) => setDraft((current) => ({ ...current, category: value }))}>
                      <SelectTrigger className="h-9 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category} value={category}>{category}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => onOpenChange(false)} className="h-9 flex-1 rounded-xl">Cancel</Button>
                <Button onClick={save} disabled={!canSave || saving} className="h-9 flex-1 rounded-xl bg-gradient-primary">
                  {saving ? "Saving…" : allocateItem ? "Allocate" : dest.type === "unallocated" ? "Save to Unallocated" : "Save"}
                </Button>
              </div>

              {!allocateItem && (
                <div
                  className="rounded-2xl border border-border/50 p-2.5 shadow-card"
                  style={{ background: "color-mix(in srgb, hsl(var(--primary)) 10%, hsl(var(--card)))" }}
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide">Unallocated</p>
                    <button type="button" onClick={() => { onOpenChange(false); navigate("/unallocated"); }} className="text-[11px] font-semibold text-primary">
                      View all
                    </button>
                  </div>
                  {loading && !items.length ? (
                    <p className="text-xs text-muted-foreground">Loading…</p>
                  ) : recentUnallocated.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nothing waiting. Dump receipts here, then tidy them later.</p>
                  ) : (
                    <div className="space-y-1">
                      {recentUnallocated.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => { onOpenChange(false); navigate(`/unallocated?item=${item.id}`); }}
                          className="flex w-full items-center gap-2 rounded-xl bg-card/80 px-2 py-1.5 text-left"
                        >
                          <div className="h-8 w-8 overflow-hidden rounded-lg bg-muted">
                            {captureItemThumb(item) ? (
                              <img src={captureItemThumb(item) || ""} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <FileText className="m-1.5 h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <span className="min-w-0 flex-1 truncate text-xs font-semibold">{item.name || "Untitled"}</span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {capturePagesLabel(item.files?.length || 0)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
