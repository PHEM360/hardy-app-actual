import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, ExternalLink, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { receiptKind, receiptLabel, type ReceiptSource } from "@/lib/receipts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function useObjectUrl(file?: File) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file) { setUrl(""); return; }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

/** Turn a remote PDF into a blob URL so it previews in-page instead of opening a tab. */
function usePreviewSrc(source: ReceiptSource) {
  const fileUrl = useObjectUrl(source.file);
  const [blobUrl, setBlobUrl] = useState("");
  const kind = receiptKind(source);

  useEffect(() => {
    if (source.file || !source.url || kind !== "pdf") {
      setBlobUrl("");
      return;
    }
    let alive = true;
    let created = "";
    fetch(source.url)
      .then((res) => res.blob())
      .then((blob) => {
        if (!alive) return;
        created = URL.createObjectURL(blob);
        setBlobUrl(created);
      })
      .catch(() => { if (alive) setBlobUrl(""); });
    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [source.file, source.url, kind]);

  return source.file ? fileUrl : (blobUrl || source.url || "");
}

function PdfFrame({ src, className, interactive }: { src: string; className?: string; interactive?: boolean }) {
  const framed = src.includes("#") ? src : `${src}#page=1&toolbar=0&navpanes=0&scrollbar=0`;
  return (
    <iframe
      title="Document preview"
      src={framed}
      className={cn("h-full w-full border-0 bg-white", !interactive && "pointer-events-none", className)}
    />
  );
}

export function ReceiptThumb({
  source,
  className,
  onClick,
}: {
  source: ReceiptSource;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const src = usePreviewSrc(source);
  const kind = receiptKind(source);
  const label = receiptLabel(source);

  const inner = !src ? (
    <div className="flex h-full w-full items-center justify-center bg-muted">
      <FileText className="h-5 w-5 text-muted-foreground" />
    </div>
  ) : kind === "image" ? (
    <img src={src} alt={label} className="h-full w-full object-cover object-top" />
  ) : kind === "pdf" ? (
    <div className="relative h-full w-full overflow-hidden bg-white">
      <div className="absolute left-0 top-0 h-[280%] w-[180%] origin-top-left scale-[0.56]">
        <PdfFrame src={src} />
      </div>
    </div>
  ) : (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-card px-1">
      <FileText className="h-5 w-5 text-primary" />
      <span className="line-clamp-2 text-center text-[9px] font-semibold leading-tight text-foreground">{label}</span>
    </div>
  );

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative block overflow-hidden rounded-xl border border-border/50 bg-white shadow-soft",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      aria-label={`Preview ${label}`}
    >
      {inner}
    </button>
  );
}

export function ReceiptLightbox({
  source,
  sources,
  index = 0,
  onIndexChange,
  open,
  onClose,
}: {
  /** Single-page mode (unchanged behaviour). Ignored when `sources` has entries. */
  source: ReceiptSource | null;
  /** Multi-page mode: pass every page of the document to enable prev/next paging. */
  sources?: ReceiptSource[];
  index?: number;
  onIndexChange?: (index: number) => void;
  open: boolean;
  onClose: () => void;
}) {
  const pages = sources && sources.length > 0 ? sources : source ? [source] : [];
  const pageCount = pages.length;
  const safeIndex = pageCount > 0 ? Math.min(Math.max(index, 0), pageCount - 1) : 0;
  const current = pages[safeIndex] ?? null;
  const hasMultiple = pageCount > 1;

  const src = usePreviewSrc(current ?? {});
  const kind = current ? receiptKind(current) : "other";
  const label = current ? receiptLabel(current) : "Receipt";

  const goTo = (next: number) => {
    if (!hasMultiple) return;
    onIndexChange?.((next + pageCount) % pageCount);
  };

  useEffect(() => {
    if (!open || !hasMultiple) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goTo(safeIndex + 1);
      else if (e.key === "ArrowLeft") goTo(safeIndex - 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hasMultiple, safeIndex, pageCount]);

  return (
    <Dialog open={open && pageCount > 0} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent aria-describedby={undefined} className="max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="flex-row items-center justify-between gap-2 space-y-0 border-b border-border/50 px-4 py-3 pr-12">
          <div className="flex min-w-0 items-center gap-2">
            <DialogTitle className="min-w-0 truncate font-display text-sm">{label}</DialogTitle>
            {hasMultiple && (
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                {safeIndex + 1} / {pageCount}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {current?.url && (
              <a
                href={current.url}
                target="_blank"
                rel="noreferrer"
                className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground hover:bg-muted"
                title="Open in a new tab"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            {/* Explicit, always-reachable close button — the PDF frame below can
                swallow clicks/keystrokes meant for the generic dialog close, since
                it's a separate document context that doesn't bubble events up. */}
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 items-center gap-1 rounded-lg bg-muted px-2.5 text-xs font-semibold text-foreground hover:bg-muted/70"
            >
              <X className="h-3.5 w-3.5" /> Close
            </button>
          </div>
        </DialogHeader>
        <div className="relative min-h-0 bg-muted/30">
          {kind === "image" && src ? (
            <img src={src} alt={label} className="mx-auto max-h-[80vh] w-full object-contain" />
          ) : src ? (
            <iframe title={label} src={src} className="h-[70vh] w-full border-0 bg-white" />
          ) : (
            <p className="p-6 text-sm text-muted-foreground">No preview available.</p>
          )}
          {hasMultiple && (
            <>
              <button
                type="button"
                onClick={() => goTo(safeIndex - 1)}
                aria-label="Previous page"
                className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-card/90 text-foreground shadow-card hover:bg-card"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => goTo(safeIndex + 1)}
                aria-label="Next page"
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-card/90 text-foreground shadow-card hover:bg-card"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
                {pages.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Go to page ${i + 1}`}
                    onClick={() => goTo(i)}
                    className={`h-1.5 rounded-full transition-all ${i === safeIndex ? "w-4 bg-primary" : "w-1.5 bg-card/80"}`}
                  />
                ))}
              </div>
            </>
          )}
          {kind === "pdf" && src && (
            <div className="flex items-center justify-between gap-2 border-t border-border/50 px-4 py-2">
              <p className="text-[11px] text-muted-foreground">Preview not showing?</p>
              <a
                href={current?.url || src}
                target="_blank"
                rel="noreferrer"
                download={kind === "pdf" ? label : undefined}
                className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
              >
                <Download className="h-3 w-3" /> Open / download instead
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ReceiptAttachCard({
  file,
  onRemove,
  onPreview,
}: {
  file: File;
  onRemove: () => void;
  onPreview: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-card shadow-soft">
      <ReceiptThumb source={{ file }} onClick={onPreview} className="h-36 w-full rounded-none border-0" />
      <div className="flex items-center gap-2 px-2.5 py-2">
        <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">{file.name}</p>
        <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-destructive" aria-label="Remove">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function ReceiptManageCard({
  url,
  name,
  onPreview,
  onRename,
  onReplace,
  onRemove,
  busy,
}: {
  url: string;
  name: string;
  onPreview: () => void;
  onRename: (name: string) => void;
  onReplace: (file: File) => void;
  onRemove: () => void;
  busy?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const source = useMemo(() => ({ url, name }), [url, name]);

  useEffect(() => { setDraft(name); }, [name]);

  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-card shadow-soft">
      <ReceiptThumb source={source} onClick={onPreview} className="h-40 w-full rounded-none border-0" />
      <div className="space-y-2 p-2.5">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              const next = draft.trim();
              setEditing(false);
              if (next && next !== name) onRename(next);
              else setDraft(name);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") { setDraft(name); setEditing(false); }
            }}
            className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs"
          />
        ) : (
          <p className="truncate text-[11px] font-medium text-foreground">{name}</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setEditing(true)} className="rounded-lg bg-muted px-2 py-1 text-[10px] font-semibold text-foreground">
            Rename
          </button>
          <label className={`rounded-lg bg-muted px-2 py-1 text-[10px] font-semibold text-foreground ${busy ? "opacity-50" : "cursor-pointer"}`}>
            Replace
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) onReplace(f);
              }}
            />
          </label>
          <button type="button" onClick={onRemove} className="rounded-lg bg-destructive/10 px-2 py-1 text-[10px] font-semibold text-destructive">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
