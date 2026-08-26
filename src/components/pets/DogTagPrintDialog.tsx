import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { Printer, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import type { DogTag } from "@/hooks/useDogTags";
import type { Pet } from "@/hooks/usePets";
import { TagFace } from "@/components/pets/DogTagFace";
import {
  A4_HEIGHT_CM,
  A4_WIDTH_CM,
  PRINT_PX_PER_CM,
  buildPrintFaces,
  layoutPrintFaces,
  nextTopAfterPrint,
  normalizePrintPlacement,
  printTagKey,
  readStoredPrintPlacement,
  storePrintPlacement,
  type PrintPlacement,
} from "@/lib/dogTagPrint";

export type TagPrintDraft = Partial<Pick<
  DogTag,
  | "label"
  | "shape"
  | "bgColor"
  | "fgColor"
  | "stickerText"
  | "sizeCm"
  | "qrSizeCm"
  | "stickerTextSizeCm"
  | "backText"
  | "backTextSizeCm"
>>;

type SideChoice = { front: boolean; back: boolean };

function isStandalone() {
  return (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;
}

function applyDrafts(tag: DogTag, drafts?: Record<string, TagPrintDraft>): DogTag {
  const draft = drafts?.[printTagKey(tag.petId, tag.id)];
  return draft ? { ...tag, ...draft } : tag;
}

function PrintSheet({
  tags,
  placement,
}: {
  tags: Array<{ tag: DogTag; petName: string; front: boolean; back: boolean }>;
  placement: PrintPlacement;
}) {
  const placed = layoutPrintFaces(buildPrintFaces(tags), placement);
  const pages = [...new Set(placed.map((face) => face.page))];
  const tagMap = new Map(tags.map((item) => [printTagKey(item.tag.petId, item.tag.id), item.tag]));

  return createPortal(
    <div id="dog-tag-print-root" className="hidden">
      {pages.map((page) => (
        <div
          key={page}
          className="dog-tag-print-page"
          style={{ position: "relative", width: `${A4_WIDTH_CM}cm`, height: `${A4_HEIGHT_CM}cm` }}
        >
          {placed.filter((face) => face.page === page).map((face) => {
            const tag = tagMap.get(printTagKey(face.petId, face.tagId));
            if (!tag) return null;
            return (
              <div
                key={face.key}
                style={{ position: "absolute", left: `${face.xCm}cm`, top: `${face.yCm}cm` }}
              >
                <TagFace tag={tag} side={face.side} pxPerCm={PRINT_PX_PER_CM} />
              </div>
            );
          })}
        </div>
      ))}
    </div>,
    document.body,
  );
}

export function DogTagPrintDialog({
  open,
  onClose,
  pets,
  tagsByPet,
  preselectedKeys,
  drafts,
}: {
  open: boolean;
  onClose: () => void;
  pets: Pet[];
  tagsByPet: Record<string, DogTag[]>;
  preselectedKeys?: string[];
  drafts?: Record<string, TagPrintDraft>;
}) {
  const [placement, setPlacement] = useState<PrintPlacement>(() => readStoredPrintPlacement());
  const [selected, setSelected] = useState<Record<string, SideChoice>>({});
  const [advanceStart, setAdvanceStart] = useState(true);

  useEffect(() => {
    if (!open) return;
    setPlacement(readStoredPrintPlacement());
    const initial: Record<string, SideChoice> = {};
    const keys = new Set(preselectedKeys || []);
    if (keys.size === 0) {
      const only = pets.flatMap((pet) => (tagsByPet[pet.id] || []).map((tag) => printTagKey(pet.id, tag.id)));
      if (only.length === 1) keys.add(only[0]);
    }
    keys.forEach((key) => { initial[key] = { front: true, back: true }; });
    setSelected(initial);
  }, [open, pets, preselectedKeys, tagsByPet]);

  const catalog = useMemo(() => {
    return pets.flatMap((pet) =>
      (tagsByPet[pet.id] || []).map((tag) => ({
        pet,
        tag: applyDrafts(tag, drafts),
        key: printTagKey(pet.id, tag.id),
      })),
    );
  }, [drafts, pets, tagsByPet]);

  const printItems = catalog
    .filter((item) => selected[item.key]?.front || selected[item.key]?.back)
    .map((item) => ({
      tag: item.tag,
      petName: item.pet.name,
      front: !!selected[item.key]?.front,
      back: !!selected[item.key]?.back,
    }));

  const placed = layoutPrintFaces(buildPrintFaces(printItems), placement);
  const pageCount = placed.reduce((max, face) => Math.max(max, face.page), 1);

  const setTop = (topCm: number) => setPlacement((prev) => normalizePrintPlacement({ ...prev, topCm }));
  const setLeft = (leftCm: number) => setPlacement((prev) => normalizePrintPlacement({ ...prev, leftCm }));
  const setGap = (gapCm: number) => setPlacement((prev) => normalizePrintPlacement({ ...prev, gapCm }));

  const toggleTag = (key: string, on: boolean) => {
    setSelected((prev) => {
      if (!on) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: prev[key] || { front: true, back: true } };
    });
  };

  const toggleSide = (key: string, side: keyof SideChoice) => {
    setSelected((prev) => {
      const current = prev[key] || { front: true, back: true };
      const next = { ...current, [side]: !current[side] };
      if (!next.front && !next.back) {
        const cleared = { ...prev };
        delete cleared[key];
        return cleared;
      }
      return { ...prev, [key]: next };
    });
  };

  const placeFromPreview = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * A4_WIDTH_CM;
    const y = ((event.clientY - rect.top) / rect.height) * A4_HEIGHT_CM;
    setPlacement(normalizePrintPlacement({ ...placement, leftCm: x, topCm: y }));
  };

  const handlePrint = () => {
    if (printItems.length === 0) return;
    if (isStandalone()) {
      toast.error("Printing isn't available from the Home Screen app", {
        description: "Open hardyapp.co.uk in Safari or Chrome to print.",
      });
      return;
    }
    storePrintPlacement(placement);
    const styleId = "dog-tag-print-style";
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = `
      @page { size: A4; margin: 0; }
      @media print {
        body > *:not(#dog-tag-print-root) { display: none !important; }
        #dog-tag-print-root { display: block !important; }
        .dog-tag-print-page { page-break-after: always; }
        .dog-tag-print-page:last-child { page-break-after: auto; }
      }
    `;
    window.print();
    if (advanceStart) {
      const nextTop = nextTopAfterPrint(placed, placement.gapCm);
      const next = normalizePrintPlacement({ ...placement, topCm: nextTop });
      setPlacement(next);
      storePrintPlacement(next);
      toast.success(`Next print will start ${next.topCm.toFixed(1)} cm down.`);
    }
    setTimeout(() => style?.remove(), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      {open && <PrintSheet tags={printItems} placement={placement} />}
      <DialogContent aria-describedby={undefined} className="max-w-3xl max-h-[90dvh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="font-display">Print tags</DialogTitle>
          <DialogDescription>
            Place this print on the leftover part of an A4 sticker sheet, and pick tags from any pet.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_11.5rem] lg:items-start">
          <div className="space-y-4 min-w-0">
            <div
              className="rounded-2xl border border-border/50 bg-card p-4 shadow-card"
              style={{
                background: "color-mix(in srgb, hsl(32 92% 50%) 12%, hsl(var(--card)))",
                borderLeft: "3px solid hsl(32, 92%, 50%)",
              }}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white">
                  <MapPin className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Where on the sheet</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Skip the strip you already used, or tap the page preview.
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="print-top">From the top</Label>
                    <span className="text-xs font-semibold">{placement.topCm.toFixed(1)} cm</span>
                  </div>
                  <Slider
                    id="print-top"
                    value={[placement.topCm]}
                    min={0}
                    max={24}
                    step={0.1}
                    onValueChange={([value]) => setTop(value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="print-left">From the left</Label>
                    <span className="text-xs font-semibold">{placement.leftCm.toFixed(1)} cm</span>
                  </div>
                  <Slider
                    id="print-left"
                    value={[placement.leftCm]}
                    min={0}
                    max={16}
                    step={0.1}
                    onValueChange={([value]) => setLeft(value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => setTop(0)}>
                    Top of sheet
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => setTop(placement.topCm + 4)}>
                    Skip 4 cm
                  </Button>
                </div>
                <label className="flex items-start gap-2 text-xs">
                  <Checkbox checked={advanceStart} onCheckedChange={(value) => setAdvanceStart(value === true)} />
                  <span>After printing, move the start down past these stickers</span>
                </label>
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer font-medium text-foreground">Using leftover sticker paper</summary>
                  <p className="mt-1.5 leading-relaxed">
                    Print, then cut off that used strip. Put the remaining sheet back in the tray and tap Skip for how much you cut — or Top of sheet if the printer now feeds from the new edge. Keep scale at 100%, not fit to page.
                  </p>
                </details>
              </div>
            </div>

            <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-card">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold">Tags to print</h3>
                {catalog.length > 1 && (
                  <button
                    type="button"
                    className="text-xs font-medium text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      const allOn = catalog.every((item) => selected[item.key]);
                      if (allOn) setSelected({});
                      else {
                        const next: Record<string, SideChoice> = {};
                        catalog.forEach((item) => { next[item.key] = { front: true, back: true }; });
                        setSelected(next);
                      }
                    }}
                  >
                    {catalog.every((item) => selected[item.key]) ? "Clear" : "Select all"}
                  </button>
                )}
              </div>
              {catalog.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No tags yet.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {pets.map((pet) => {
                    const tags = catalog.filter((item) => item.pet.id === pet.id);
                    if (tags.length === 0) return null;
                    return (
                      <div key={pet.id}>
                        <p className="mb-1.5 text-xs font-semibold">
                          {pet.avatar} {pet.name}
                        </p>
                        <div className="space-y-1.5">
                          {tags.map((item) => {
                            const choice = selected[item.key];
                            const on = !!choice;
                            return (
                              <div
                                key={item.key}
                                className={`flex items-center gap-2 rounded-xl border p-2.5 ${
                                  on
                                    ? "border-amber-500/40 bg-[color-mix(in_srgb,hsl(32_92%_50%)_14%,hsl(var(--card)))]"
                                    : "border-border/50 bg-card"
                                }`}
                              >
                                <Checkbox
                                  checked={on}
                                  onCheckedChange={(value) => toggleTag(item.key, value === true)}
                                  aria-label={`Print ${pet.name} ${item.tag.label}`}
                                />
                                <div
                                  className="h-8 w-8 shrink-0 border border-black/10"
                                  style={{ backgroundColor: item.tag.bgColor, borderRadius: item.tag.shape === "circle" ? "50%" : "18%" }}
                                />
                                <p className="min-w-0 flex-1 truncate text-sm font-medium">{item.tag.label}</p>
                                <div className="flex gap-1">
                                  {(["front", "back"] as const).map((side) => (
                                    <button
                                      key={side}
                                      type="button"
                                      disabled={!on}
                                      onClick={() => toggleSide(item.key, side)}
                                      className={`rounded-lg px-2 py-1 text-[10px] font-semibold capitalize ${
                                        choice?.[side]
                                          ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white"
                                          : "bg-muted/40 text-muted-foreground"
                                      }`}
                                    >
                                      {side}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="mx-auto w-full max-w-[12rem] lg:mx-0">
            <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">A4 preview</p>
            <button
              type="button"
              aria-label="Choose where the first sticker starts"
              onClick={placeFromPreview}
              className="relative block w-full overflow-hidden rounded-md border border-amber-900/20 shadow-card"
              style={{
                background: "#f4efe4",
                aspectRatio: `${A4_WIDTH_CM} / ${A4_HEIGHT_CM}`,
              }}
            >
              {placement.topCm > 0 && (
                <span
                  className="absolute inset-x-0 top-0 bg-rose-500/20"
                  style={{ height: `${(placement.topCm / A4_HEIGHT_CM) * 100}%` }}
                />
              )}
              {placed.filter((face) => face.page === 1).map((face) => (
                <span
                  key={face.key}
                  className="absolute border border-amber-800/40 bg-white shadow-sm"
                  style={{
                    left: `${(face.xCm / A4_WIDTH_CM) * 100}%`,
                    top: `${(face.yCm / A4_HEIGHT_CM) * 100}%`,
                    width: `${(face.widthCm / A4_WIDTH_CM) * 100}%`,
                    height: `${(face.heightCm / A4_HEIGHT_CM) * 100}%`,
                    borderRadius: face.widthCm === face.heightCm ? "20%" : "12%",
                  }}
                />
              ))}
            </button>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              {printItems.length === 0
                ? "Pick at least one tag"
                : `${placed.length} sticker${placed.length === 1 ? "" : "s"}${pageCount > 1 ? ` · ${pageCount} pages` : ""}`}
            </p>
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Gap</span>
                <span className="font-semibold text-foreground">{placement.gapCm.toFixed(1)} cm</span>
              </div>
              <Slider value={[placement.gapCm]} min={0} max={1.5} step={0.1} onValueChange={([value]) => setGap(value)} />
            </div>
          </div>
        </div>

        <Button
          className="h-11 w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600"
          disabled={printItems.length === 0}
          onClick={handlePrint}
        >
          <Printer className="mr-2 h-4 w-4" />
          Print {placed.length || ""} sticker{placed.length === 1 ? "" : "s"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
