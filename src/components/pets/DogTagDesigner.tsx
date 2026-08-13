import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import QRCodeSVG from "react-qr-code";
import { toPng } from "html-to-image";
import {
  ArrowLeft,
  Printer,
  Download,
  Save,
  RefreshCw,
  Trash2,
  Link as LinkIcon,
  Check,
  Palette,
  Ruler,
  Type,
  Users,
  QrCode as QrCodeIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Pet } from "@/hooks/usePets";
import type { DogTag, DogTagProfile, DogTagShape } from "@/hooks/useDogTags";
import { normalizeSlug } from "@/hooks/useDogTags";
import { getDogTagNotifyRecipients, type DogTagNotifyRecipient } from "@/lib/dogTagApi";
import { DOG_TAG_SHAPES, dogTagAspectRatio, dogTagShapeStyle } from "@/lib/dogTagShapes";
import { APP_BASE_URL } from "@/lib/appUrl";
import { DogTagProfilePanel } from "@/components/pets/DogTagProfilePanel";

type Side = "front" | "back";

type TagDraft = {
  label: string;
  shape: DogTagShape;
  bgColor: string;
  fgColor: string;
  stickerText: string;
  sizeCm: number;
  qrSizeCm: number;
  stickerTextSizeCm: number;
  backText: string;
  backTextSizeCm: number;
  profile: DogTagProfile;
};

const PRINT_PX_PER_CM = 96 / 2.54; // standard 96dpi browser print assumption

export function publicTagUrl(tag: DogTag): string {
  if (tag.slug) return `${APP_BASE_URL}/p/${tag.slug}`;
  return `${APP_BASE_URL}/tag/${tag.petId}/${tag.id}?c=${tag.code}`;
}

function sectionLabel(icon: React.ReactNode, color: string, text: string) {
  return (
    <Label className="text-xs font-semibold flex items-center gap-1.5">
      <span className={`w-5 h-5 rounded-md ${color} flex items-center justify-center text-white flex-shrink-0`}>
        {icon}
      </span>
      {text}
    </Label>
  );
}

/** widthCm/heightCm respect the shape's aspect ratio around a single "size". */
function faceDimensionsCm(shape: DogTagShape, sizeCm: number) {
  const aspect = dogTagAspectRatio(shape);
  return {
    widthCm: aspect >= 1 ? sizeCm : sizeCm * aspect,
    heightCm: aspect >= 1 ? sizeCm / aspect : sizeCm,
  };
}

/** One tag face, rendered at real cm dimensions — shared by the on-screen preview (scaled via CSS zoom) and the print sheet (1:1). */
function TagFace({
  tag,
  draft,
  side,
  pxPerCm,
}: {
  tag: DogTag;
  draft: TagDraft;
  side: Side;
  pxPerCm: number;
}) {
  const { widthCm, heightCm } = faceDimensionsCm(draft.shape, draft.sizeCm);
  const qrPx = draft.qrSizeCm * pxPerCm;

  return (
    <div
      className="flex flex-col items-center justify-center gap-[2%] shadow-lg border border-black/10 overflow-hidden"
      style={{
        width: widthCm * pxPerCm,
        height: heightCm * pxPerCm,
        backgroundColor: draft.bgColor,
        ...dogTagShapeStyle(draft.shape),
      }}
    >
      {side === "front" ? (
        <>
          <div className="dog-tag-qr" style={{ width: qrPx, height: qrPx }}>
            <QRCodeSVG value={publicTagUrl(tag)} fgColor={draft.fgColor} bgColor="transparent" size={qrPx} style={{ width: "100%", height: "100%" }} />
          </div>
          {draft.stickerText.trim() && (
            <p
              className="text-center font-bold leading-tight break-words px-1"
              style={{ color: draft.fgColor, fontSize: draft.stickerTextSizeCm * pxPerCm }}
            >
              {draft.stickerText}
            </p>
          )}
        </>
      ) : (
        <p
          className="text-center font-bold leading-snug break-words whitespace-pre-line px-2"
          style={{ color: draft.fgColor, fontSize: draft.backTextSizeCm * pxPerCm }}
        >
          {draft.backText.trim() || "IF FOUND\nPlease scan the QR code\non the front"}
        </p>
      )}
    </div>
  );
}

/** Mounted straight under <body> (bypassing the whole app tree) so print CSS can hide #root entirely — a position:fixed target nested inside the still-laid-out (if invisible) Designer was getting repeated once per paginated page, producing multiple copies. */
function PrintSheet({ tag, draft }: { tag: DogTag; draft: TagDraft }) {
  return createPortal(
    <div id="dog-tag-print-root" className="hidden print:flex flex-col items-center gap-8 py-8">
      <TagFace tag={tag} draft={draft} side="front" pxPerCm={PRINT_PX_PER_CM} />
      <TagFace tag={tag} draft={draft} side="back" pxPerCm={PRINT_PX_PER_CM} />
    </div>,
    document.body
  );
}

export function DogTagDesigner({
  pet,
  tag,
  onClose,
  onSave,
  onRegenerate,
  onDelete,
  onClaimSlug,
}: {
  pet: Pet;
  tag: DogTag;
  onClose: () => void;
  onSave: (patch: TagDraft) => Promise<void>;
  onRegenerate: () => Promise<void>;
  onDelete: () => void;
  onClaimSlug: (rawSlug: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const [draft, setDraft] = useState<TagDraft>({
    label: tag.label,
    shape: tag.shape,
    bgColor: tag.bgColor,
    fgColor: tag.fgColor,
    stickerText: tag.stickerText,
    sizeCm: tag.sizeCm,
    qrSizeCm: tag.qrSizeCm,
    stickerTextSizeCm: tag.stickerTextSizeCm,
    backText: tag.backText,
    backTextSizeCm: tag.backTextSizeCm,
    profile: tag.profile,
  });
  const [side, setSide] = useState<Side>("front");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [regenConfirmOpen, setRegenConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [slugInput, setSlugInput] = useState(tag.slug);
  const [slugSaving, setSlugSaving] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [slugSaved, setSlugSaved] = useState(false);
  const [recipients, setRecipients] = useState<DogTagNotifyRecipient[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDogTagNotifyRecipients(pet.id)
      .then((r) => { if (!cancelled) setRecipients(r); })
      .catch(() => { if (!cancelled) setRecipients([]); });
    return () => { cancelled = true; };
  }, [pet.id]);

  const setField = <K extends keyof TagDraft>(key: K, value: TagDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  };

  const handleClaimSlug = async () => {
    setSlugSaving(true);
    setSlugError(null);
    setSlugSaved(false);
    try {
      const result = await onClaimSlug(slugInput);
      if (result.ok) {
        setSlugSaved(true);
        setTimeout(() => setSlugSaved(false), 2000);
      } else {
        setSlugError(result.error);
      }
    } finally {
      setSlugSaving(false);
    }
  };

  const handleExport = useCallback(async () => {
    const el = document.getElementById("dog-tag-preview-current");
    if (!el) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(el, { cacheBust: true, pixelRatio: 3 });
      const a = document.createElement("a");
      a.download = `${pet.name.replace(/\s+/g, "-").toLowerCase()}-${tag.label.replace(/\s+/g, "-").toLowerCase()}-${side}.png`;
      a.href = dataUrl;
      a.click();
    } finally {
      setExporting(false);
    }
  }, [pet.name, tag.label, side]);

  const handlePrint = useCallback(() => {
    const styleId = "dog-tag-print-style";
    let s = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!s) {
      s = document.createElement("style");
      s.id = styleId;
      document.head.appendChild(s);
    }
    // #root (the whole app, incl. this Designer) is fully removed from layout
    // during print — not just hidden — so the print sheet is the only thing
    // with any height and the page count comes out to exactly what its own
    // content needs, instead of the Designer's own (much taller) layout.
    s.textContent = `
      @media print {
        #root { display: none !important; }
        #dog-tag-print-root { display: flex !important; }
      }
    `;
    window.print();
    setTimeout(() => s?.remove(), 2000);
  }, []);

  const recipientNames = recipients?.map((r) => r.name).join(", ");
  const previewPxPerCm = 220 / draft.sizeCm;

  return (
    <div className="fixed inset-0 z-[200] bg-background flex flex-col">
      <PrintSheet tag={tag} draft={draft} />

      {/* Top bar */}
      <div className="h-14 flex-shrink-0 flex items-center gap-3 px-4 shadow-md bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm font-medium text-white/90 hover:text-white transition-colors mr-1"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">🐾 Dog Tag — {pet.name}</p>
          <p className="text-[11px] text-white/80">{draft.label}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={handlePrint} className="h-8 rounded-xl gap-1.5 text-xs hidden sm:flex">
          <Printer className="w-3.5 h-3.5" /> Print both sides
        </Button>
        <Button variant="secondary" size="sm" onClick={handleExport} disabled={exporting} className="h-8 rounded-xl gap-1.5 text-xs hidden sm:flex">
          <Download className="w-3.5 h-3.5" /> {exporting ? "Saving…" : "PNG"}
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving} className="h-8 rounded-xl gap-1.5 text-xs bg-white text-orange-600 hover:bg-white/90">
          <Save className="w-3.5 h-3.5" /> {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col sm:flex-row min-h-0 overflow-y-auto sm:overflow-hidden">
        {/* Preview */}
        <div className="sm:flex-1 flex flex-col items-center justify-center gap-4 p-8 bg-gradient-to-br from-sky-100 via-indigo-50 to-amber-100 flex-shrink-0">
          <div className="flex items-center gap-1 bg-white/70 backdrop-blur-sm rounded-full p-1 shadow-sm">
            {(["front", "back"] as Side[]).map((s) => (
              <button
                key={s}
                onClick={() => setSide(s)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${
                  side === s ? "bg-orange-500 text-white shadow-sm" : "text-muted-foreground hover:bg-white"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div id="dog-tag-preview-current">
            <TagFace tag={tag} draft={draft} side={side} pxPerCm={previewPxPerCm} />
          </div>
          <p className="text-xs text-muted-foreground font-mono bg-white/80 px-2 py-1 rounded-lg border border-border">
            {publicTagUrl(tag).replace(/^https?:\/\//, "")}
          </p>
          <button
            onClick={() => setRegenConfirmOpen(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-white/80 border border-border rounded-xl px-3 py-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Regenerate QR code
          </button>
        </div>

        {/* Form */}
        <div className="w-full sm:w-96 flex-shrink-0 border-t sm:border-t-0 sm:border-l border-border bg-card overflow-y-auto p-4 space-y-6">
          <div className="space-y-1.5">
            {sectionLabel(<Type className="w-3 h-3" />, "bg-sky-500", "Tag name")}
            <Input value={draft.label} onChange={(e) => setField("label", e.target.value)} className="h-10 rounded-xl" placeholder="e.g. Collar tag" />
          </div>

          <div className="space-y-3">
            {sectionLabel(<QrCodeIcon className="w-3 h-3" />, "bg-violet-500", "Front")}
            <div className="space-y-1.5 pl-1">
              <Label className="text-[11px] text-muted-foreground">Front text</Label>
              <Input value={draft.stickerText} onChange={(e) => setField("stickerText", e.target.value)} className="h-10 rounded-xl" placeholder={pet.name} />
            </div>
            <div className="space-y-1.5 pl-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Front text size</span>
                <span className="text-xs font-semibold">{draft.stickerTextSizeCm.toFixed(2)} cm</span>
              </div>
              <Slider value={[draft.stickerTextSizeCm]} min={0.15} max={1.2} step={0.05} onValueChange={([v]) => setField("stickerTextSizeCm", v)} />
            </div>
          </div>

          <div className="space-y-3">
            {sectionLabel(<Type className="w-3 h-3" />, "bg-indigo-500", "Back")}
            <div className="space-y-1.5 pl-1">
              <Label className="text-[11px] text-muted-foreground">Back text</Label>
              <Textarea
                value={draft.backText}
                onChange={(e) => setField("backText", e.target.value)}
                placeholder={"IF FOUND\nPlease scan QR code"}
                className="rounded-xl resize-none text-sm"
                rows={3}
              />
            </div>
            <div className="space-y-1.5 pl-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Back text size</span>
                <span className="text-xs font-semibold">{draft.backTextSizeCm.toFixed(2)} cm</span>
              </div>
              <Slider value={[draft.backTextSizeCm]} min={0.15} max={1.2} step={0.05} onValueChange={([v]) => setField("backTextSizeCm", v)} />
            </div>
          </div>

          <div className="space-y-1.5">
            {sectionLabel(<QrCodeIcon className="w-3 h-3" />, "bg-fuchsia-500", "Shape")}
            <div className="grid grid-cols-4 gap-2">
              {DOG_TAG_SHAPES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setField("shape", s.value)}
                  className={`flex flex-col items-center gap-1 py-2 rounded-xl border-2 transition-colors ${
                    draft.shape === s.value ? "border-fuchsia-500 bg-fuchsia-50" : "border-border bg-muted/30 hover:bg-muted/60"
                  }`}
                >
                  <div className="w-6 h-6 bg-foreground/70" style={dogTagShapeStyle(s.value)} />
                  <span className="text-[9px] font-medium text-muted-foreground">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            {sectionLabel(<Palette className="w-3 h-3" />, "bg-pink-500", "Colours")}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-muted/30">
                <div className="w-5 h-5 rounded-md border border-border/50 flex-shrink-0" style={{ backgroundColor: draft.bgColor }} />
                <span className="text-[11px] font-mono flex-1 truncate">{draft.bgColor}</span>
                <input type="color" value={draft.bgColor} onChange={(e) => setField("bgColor", e.target.value)} className="w-7 h-7 rounded-lg border border-border cursor-pointer" />
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-muted/30">
                <div className="w-5 h-5 rounded-md border border-border/50 flex-shrink-0" style={{ backgroundColor: draft.fgColor }} />
                <span className="text-[11px] font-mono flex-1 truncate">{draft.fgColor}</span>
                <input type="color" value={draft.fgColor} onChange={(e) => setField("fgColor", e.target.value)} className="w-7 h-7 rounded-lg border border-border cursor-pointer" />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {sectionLabel(<Ruler className="w-3 h-3" />, "bg-amber-500", "Print size")}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Tag size</span>
                <span className="text-xs font-semibold">{draft.sizeCm.toFixed(1)} cm</span>
              </div>
              <Slider
                value={[draft.sizeCm]}
                min={2}
                max={8}
                step={0.1}
                onValueChange={([v]) => setField("sizeCm", Math.max(v, draft.qrSizeCm + 0.5))}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">QR code size</span>
                <span className="text-xs font-semibold">{draft.qrSizeCm.toFixed(1)} cm</span>
              </div>
              <Slider
                value={[draft.qrSizeCm]}
                min={1}
                max={Math.max(1, draft.sizeCm - 0.5)}
                step={0.1}
                onValueChange={([v]) => setField("qrSizeCm", v)}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Set your printer to 100% scale (not "fit to page") for these sizes to print accurately. "Print
              both sides" prints one front and one back, at true size.
            </p>
          </div>

          {/* Public URL / slug */}
          <div className="space-y-1.5">
            {sectionLabel(<LinkIcon className="w-3 h-3" />, "bg-emerald-500", "Link when scanned")}
            <p className="text-[11px] text-muted-foreground -mt-0.5">
              Scanning this tag opens a web page. Give it a friendly address below, or leave it blank
              and we'll use an automatically generated one instead.
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground flex-shrink-0">hardyapp.co.uk/p/</span>
              <Input
                value={slugInput}
                onChange={(e) => { setSlugInput(normalizeSlug(e.target.value)); setSlugError(null); }}
                placeholder="billy-lost"
                className="h-9 rounded-lg text-xs flex-1"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleClaimSlug}
                disabled={slugSaving || !slugInput || slugInput === tag.slug}
                className="h-9 rounded-lg text-xs px-2.5 flex-shrink-0"
              >
                {slugSaved ? <Check className="w-3.5 h-3.5" /> : slugSaving ? "…" : "Claim"}
              </Button>
            </div>
            {slugError && <p className="text-[11px] text-destructive">{slugError}</p>}
            {!slugError && (
              tag.slug ? (
                <p className="text-[11px] text-success flex items-center gap-1">
                  <Check className="w-3 h-3 flex-shrink-0" />
                  Using your friendly address — QR and print use hardyapp.co.uk/p/{tag.slug}
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  No friendly address set — this tag currently uses an automatically generated link.
                </p>
              )
            )}
          </div>

          <div className="pt-1 border-t border-border space-y-3">
            <div className="pt-3">{sectionLabel(<Users className="w-3 h-3" />, "bg-orange-500", "When scanned")}</div>
            {recipients && recipients.length > 0 && (
              <p className="text-[11px] text-muted-foreground -mt-1.5">
                Notifies your household: <span className="font-medium text-foreground">{recipientNames}</span>
              </p>
            )}
            <DogTagProfilePanel profile={draft.profile} onChange={(patch) => setField("profile", { ...draft.profile, ...patch })} petName={pet.name} />
          </div>

          <div className="pt-3 border-t border-border">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(true)}
              className="w-full rounded-xl text-destructive gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete this tag
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={regenConfirmOpen} onOpenChange={setRegenConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate QR code?</AlertDialogTitle>
            <AlertDialogDescription>
              Any tag already printed with the current QR code will stop working — scanning it will show
              "not active" instead. Your friendly URL (if set) keeps working. Only do this if a tag was lost
              or you want to retire it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => onRegenerate()}>Regenerate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this tag?</AlertDialogTitle>
            <AlertDialogDescription>
              This can't be undone, and any printed sticker or friendly URL for it will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
