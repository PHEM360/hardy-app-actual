import { useCallback, useState } from "react";
import QRCodeSVG from "react-qr-code";
import { toPng } from "html-to-image";
import { ArrowLeft, Printer, Download, Save, RefreshCw, Trash2, Link as LinkIcon, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { DOG_TAG_SHAPES, dogTagAspectRatio, dogTagShapeStyle } from "@/lib/dogTagShapes";
import { DogTagProfilePanel } from "@/components/pets/DogTagProfilePanel";

type TagDraft = {
  label: string;
  shape: DogTagShape;
  bgColor: string;
  fgColor: string;
  stickerText: string;
  profile: DogTagProfile;
};

export function publicTagUrl(tag: DogTag): string {
  if (tag.slug) return `${window.location.origin}/p/${tag.slug}`;
  return `${window.location.origin}/tag/${tag.petId}/${tag.id}?c=${tag.code}`;
}

function StickerPreview({ tag, draft, size }: { tag: DogTag; draft: TagDraft; size: number }) {
  const aspect = dogTagAspectRatio(draft.shape);
  const width = aspect >= 1 ? size : size * aspect;
  const height = aspect >= 1 ? size / aspect : size;

  return (
    <div
      id="dog-tag-print-target"
      className="flex flex-col items-center justify-center gap-1.5 p-4 shadow-sm border border-border/40"
      style={{ width, height, backgroundColor: draft.bgColor, ...dogTagShapeStyle(draft.shape) }}
    >
      <QRCodeSVG value={publicTagUrl(tag)} fgColor={draft.fgColor} bgColor="transparent" size={Math.min(width, height) * 0.5} />
      {draft.stickerText.trim() && (
        <p
          className="text-center font-bold leading-tight break-words"
          style={{ color: draft.fgColor, fontSize: Math.max(10, Math.min(width, height) * 0.09) }}
        >
          {draft.stickerText}
        </p>
      )}
    </div>
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
    profile: tag.profile,
  });
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [regenConfirmOpen, setRegenConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [slugInput, setSlugInput] = useState(tag.slug);
  const [slugSaving, setSlugSaving] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [slugSaved, setSlugSaved] = useState(false);

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
    const el = document.getElementById("dog-tag-print-target");
    if (!el) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(el, { cacheBust: true, pixelRatio: 3 });
      const a = document.createElement("a");
      a.download = `${pet.name.replace(/\s+/g, "-").toLowerCase()}-${tag.label.replace(/\s+/g, "-").toLowerCase()}-tag.png`;
      a.href = dataUrl;
      a.click();
    } finally {
      setExporting(false);
    }
  }, [pet.name, tag.label]);

  const handlePrint = useCallback(() => {
    const styleId = "dog-tag-print-style";
    let s = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!s) {
      s = document.createElement("style");
      s.id = styleId;
      document.head.appendChild(s);
    }
    s.textContent = `
      @media print {
        * { visibility: hidden !important; }
        #dog-tag-print-target, #dog-tag-print-target * { visibility: visible !important; }
        #dog-tag-print-target {
          position: fixed !important; top: 50% !important; left: 50% !important;
          transform: translate(-50%, -50%) !important;
        }
      }
    `;
    window.print();
    setTimeout(() => s?.remove(), 2000);
  }, []);

  return (
    <div className="fixed inset-0 z-[200] bg-background flex flex-col">
      {/* Top bar */}
      <div className="h-14 flex-shrink-0 flex items-center gap-3 px-4 border-b border-border bg-card shadow-sm">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mr-1"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">Dog Tag — {pet.name}</p>
          <p className="text-[11px] text-muted-foreground">{draft.label}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handlePrint} className="h-8 rounded-xl gap-1.5 text-xs hidden sm:flex">
          <Printer className="w-3.5 h-3.5" /> Print
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting} className="h-8 rounded-xl gap-1.5 text-xs hidden sm:flex">
          <Download className="w-3.5 h-3.5" /> {exporting ? "Saving…" : "PNG"}
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving} className="h-8 rounded-xl gap-1.5 text-xs">
          <Save className="w-3.5 h-3.5" /> {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col sm:flex-row min-h-0 overflow-y-auto sm:overflow-hidden">
        {/* Preview */}
        <div className="sm:flex-1 flex flex-col items-center justify-center gap-4 p-8 bg-[#dde1e7] flex-shrink-0">
          <StickerPreview tag={tag} draft={draft} size={220} />
          <p className="text-xs text-muted-foreground font-mono bg-card px-2 py-1 rounded-lg border border-border">
            {publicTagUrl(tag).replace(/^https?:\/\//, "")}
          </p>
          <button
            onClick={() => setRegenConfirmOpen(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-card border border-border rounded-xl px-3 py-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Regenerate QR code
          </button>
        </div>

        {/* Form */}
        <div className="w-full sm:w-96 flex-shrink-0 border-t sm:border-t-0 sm:border-l border-border bg-card overflow-y-auto p-4 space-y-5">
          <div className="space-y-1.5">
            <Label className="text-xs">Tag name</Label>
            <Input value={draft.label} onChange={(e) => setField("label", e.target.value)} className="h-10 rounded-xl" placeholder="e.g. Collar tag" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Text on sticker</Label>
            <Input value={draft.stickerText} onChange={(e) => setField("stickerText", e.target.value)} className="h-10 rounded-xl" placeholder={pet.name} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Shape</Label>
            <div className="grid grid-cols-4 gap-2">
              {DOG_TAG_SHAPES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setField("shape", s.value)}
                  className={`flex flex-col items-center gap-1 py-2 rounded-xl border transition-colors ${
                    draft.shape === s.value ? "border-primary bg-primary/10" : "border-border bg-muted/30 hover:bg-muted/60"
                  }`}
                >
                  <div className="w-6 h-6 bg-foreground/70" style={dogTagShapeStyle(s.value)} />
                  <span className="text-[9px] font-medium text-muted-foreground">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Colours</Label>
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

          {/* Public URL / slug */}
          <div className="space-y-1.5 pt-1">
            <Label className="text-xs flex items-center gap-1.5"><LinkIcon className="w-3.5 h-3.5 text-primary" /> Friendly URL (optional)</Label>
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
            {!slugError && tag.slug && (
              <p className="text-[11px] text-muted-foreground">
                QR and print now use hardyapp.co.uk/p/{tag.slug}
              </p>
            )}
          </div>

          <div className="pt-1 border-t border-border">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 pt-3">When scanned</p>
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
