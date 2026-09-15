import { useRef, useState } from "react";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Loader2,
  Paperclip,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompanyDocuments } from "@/hooks/useCompanies";
import { useSharedCategorySettings } from "@/hooks/useSharedCategorySettings";
import { categoriesForCapture } from "@/lib/captureInbox";
import { getCategoryColorClasses } from "@/lib/documentCategoryColors";
import { ReceiptLightbox } from "@/components/receipts/ReceiptPreview";
import type { ReceiptSource } from "@/lib/receipts";
import type { CompanyDocument } from "@/types/app";

type Page = { url: string; name: string; type: string };

function formatBytes(bytes?: number) {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageType(type?: string) {
  return (type || "").startsWith("image/");
}

function docPages(doc: CompanyDocument): Page[] {
  const urls = doc.fileUrls?.length ? doc.fileUrls : doc.fileUrl ? [doc.fileUrl] : [];
  const names = doc.fileNames?.length ? doc.fileNames : doc.fileName ? [doc.fileName] : [];
  const types = doc.fileTypes?.length ? doc.fileTypes : doc.fileType ? [doc.fileType] : [];
  return urls.map((url, i) => ({ url, name: names[i] || doc.name || `Page ${i + 1}`, type: types[i] || "" }));
}

function CategoryPill({ category }: { category?: string }) {
  if (!category) return null;
  const colors = getCategoryColorClasses(category);
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${colors.text} ${colors.bg}`}>
      {category}
    </span>
  );
}

// ─── Tile ────────────────────────────────────────────────────────────────────

function DocTile({ doc, onClick }: { doc: CompanyDocument; onClick: () => void }) {
  const pages = docPages(doc);
  const cover = pages[0];
  const coverIsImage = cover && isImageType(cover.type);

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col overflow-hidden rounded-2xl border border-border/50 bg-card text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative h-28 w-full shrink-0 bg-muted/40">
        {coverIsImage ? (
          <img src={cover.url} alt="" className="h-28 w-full object-cover" />
        ) : (
          <div className="flex h-28 w-full items-center justify-center">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        {pages.length > 1 && (
          <span className="absolute right-1.5 top-1.5 rounded-full bg-card/95 px-1.5 py-0.5 text-[10px] font-semibold text-foreground shadow-card">
            {pages.length} pages
          </span>
        )}
      </div>
      <div className="space-y-1.5 p-3">
        <p className="line-clamp-2 break-words text-sm font-semibold leading-snug text-foreground">{doc.name || "Document"}</p>
        <CategoryPill category={doc.category} />
      </div>
    </button>
  );
}

// ─── Detail sheet ──────────────────────────────────────────────────────────────

function DetailSheet({
  doc,
  onClose,
  onEdit,
  onDelete,
}: {
  doc: CompanyDocument | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const pages = doc ? docPages(doc) : [];
  const safeIndex = Math.min(pageIndex, Math.max(pages.length - 1, 0));
  const page = pages[safeIndex];
  const sources: ReceiptSource[] = pages.map((p) => ({ url: p.url, name: p.name }));

  return (
    <>
      <Sheet
        open={!!doc}
        onOpenChange={(open) => {
          if (!open) {
            setPageIndex(0);
            onClose();
          }
        }}
      >
        <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-2xl pb-safe">
          {doc && (
            <>
              <SheetHeader className="mb-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <SheetTitle className="whitespace-normal break-words text-left leading-snug">{doc.name || "Document"}</SheetTitle>
                    <CategoryPill category={doc.category} />
                  </div>
                </div>
              </SheetHeader>

              <div className="space-y-4">
                {page && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setLightboxOpen(true)}
                      className="block w-full overflow-hidden rounded-2xl border border-border/50 bg-muted/20"
                      aria-label="Open larger preview"
                    >
                      {isImageType(page.type) ? (
                        <img src={page.url} alt={page.name} className="mx-auto max-h-72 w-full object-contain" />
                      ) : (
                        <div className="flex h-36 flex-col items-center justify-center gap-1.5 text-muted-foreground">
                          <FileText className="h-8 w-8" />
                          <span className="text-xs font-semibold">Tap to view</span>
                        </div>
                      )}
                    </button>
                    {pages.length > 1 && (
                      <div className="flex items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => setPageIndex((i) => (i - 1 + pages.length) % pages.length)}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-foreground hover:bg-muted"
                          aria-label="Previous page"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="text-xs font-medium tabular-nums text-muted-foreground">
                          Page {safeIndex + 1} of {pages.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPageIndex((i) => (i + 1) % pages.length)}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-foreground hover:bg-muted"
                          aria-label="Next page"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {doc.notes && (
                  <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{doc.notes}</p>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {doc.createdAt?.toDate && (
                    <span>Added {doc.createdAt.toDate().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                  )}
                  {doc.fileSize ? <span>{formatBytes(doc.fileSize)}</span> : null}
                </div>

                {page && (
                  <div className="flex gap-2">
                    <a href={page.url} target="_blank" rel="noopener noreferrer" className="flex-1">
                      <Button variant="outline" className="w-full gap-1.5 rounded-xl">
                        <Eye className="h-4 w-4" /> View
                      </Button>
                    </a>
                    <a href={page.url} download={page.name} className="flex-1">
                      <Button variant="outline" className="w-full gap-1.5 rounded-xl">
                        <Download className="h-4 w-4" /> Download
                      </Button>
                    </a>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 gap-1.5 rounded-xl" onClick={onEdit}>
                    <Pencil className="h-4 w-4" /> Edit
                  </Button>
                  <Button variant="destructive" className="flex-1 gap-1.5 rounded-xl" onClick={onDelete}>
                    <Trash2 className="h-4 w-4" /> Delete
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      <ReceiptLightbox
        source={sources[safeIndex] ?? null}
        sources={sources}
        index={safeIndex}
        onIndexChange={setPageIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
}

// ─── Edit sheet ────────────────────────────────────────────────────────────────

type PendingFile = { file: File; preview: string | null };

function EditSheet({
  doc,
  categories,
  onClose,
  onSave,
}: {
  doc: CompanyDocument | null;
  categories: string[];
  onClose: () => void;
  onSave: (data: { name: string; category: string; notes: string }, keptPages: Page[], newFiles: File[]) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [keptPages, setKeptPages] = useState<Page[]>([]);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const prevDoc = useRef<CompanyDocument | null>(null);
  if (prevDoc.current !== doc) {
    prevDoc.current = doc;
    pendingFiles.forEach((p) => p.preview && URL.revokeObjectURL(p.preview));
    if (doc) {
      setName(doc.name || "");
      setCategory(doc.category || "Other");
      setNotes(doc.notes || "");
      setKeptPages(docPages(doc));
      setPendingFiles([]);
    }
  }

  if (!doc) return null;
  const categoryOptions = categories.includes(category) || !category ? categories : [...categories, category];
  const totalPages = keptPages.length + pendingFiles.length;

  const addFiles = (files: File[]) => {
    if (!files.length) return;
    setPendingFiles((current) => [
      ...current,
      ...files.map((file) => ({ file, preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null })),
    ]);
  };

  const removeKeptPage = (index: number) => {
    if (totalPages <= 1) return;
    setKeptPages((current) => current.filter((_, i) => i !== index));
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((current) => {
      const target = current[index];
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return current.filter((_, i) => i !== index);
    });
  };

  const close = () => {
    pendingFiles.forEach((p) => p.preview && URL.revokeObjectURL(p.preview));
    onClose();
  };

  const handleSubmit = async () => {
    if (!name.trim() || totalPages === 0) return;
    setSaving(true);
    try {
      await onSave({ name, category, notes }, keptPages, pendingFiles.map((p) => p.file));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={!!doc} onOpenChange={(open) => !open && close()}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-2xl pb-safe">
        <SheetHeader className="mb-4">
          <SheetTitle>Edit document</SheetTitle>
        </SheetHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Pages</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {keptPages.map((p, i) => (
                <div key={`kept-${p.url}`} className="relative overflow-hidden rounded-xl border border-border/50 bg-muted/30">
                  {isImageType(p.type) ? (
                    <img src={p.url} alt="" className="h-16 w-full object-cover" />
                  ) : (
                    <div className="flex h-16 w-full items-center justify-center">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  {totalPages > 1 && (
                    <button
                      type="button"
                      onClick={() => removeKeptPage(i)}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-card/90 text-muted-foreground shadow"
                      aria-label={`Remove page ${i + 1}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
              {pendingFiles.map((p, i) => (
                <div key={`pending-${i}`} className="relative overflow-hidden rounded-xl border border-primary/50 bg-muted/30">
                  {p.preview ? (
                    <img src={p.preview} alt="" className="h-16 w-full object-cover" />
                  ) : (
                    <div className="flex h-16 w-full items-center justify-center">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removePendingFile(i)}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-card/90 text-muted-foreground shadow"
                    aria-label="Remove new page"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <span className="absolute bottom-0.5 left-0.5 rounded bg-primary px-1 text-[8px] font-semibold text-primary-foreground">New</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed border-muted-foreground/30 py-2.5 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary"
              >
                <Camera className="h-3.5 w-3.5" /> Add page
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed border-muted-foreground/30 py-2.5 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary"
              >
                <Paperclip className="h-3.5 w-3.5" /> Add file
              </button>
            </div>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) addFiles([e.target.files[0]]);
                e.target.value = "";
              }}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf,.doc,.docx"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" />
          </div>

          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${getCategoryColorClasses(c).dot}`} />
                      {c}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional notes…"
              className="resize-none rounded-xl"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={close} disabled={saving}>
              Cancel
            </Button>
            <Button className="flex-1 rounded-xl bg-gradient-primary" onClick={handleSubmit} disabled={saving || !name.trim() || totalPages === 0}>
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main panel ────────────────────────────────────────────────────────────────

export function CompanyDocumentsPanel({ companyId }: { companyId: string }) {
  const { documents, loading, updateDocument, deleteDocument } = useCompanyDocuments(companyId);
  const { settings: sharedCats } = useSharedCategorySettings();
  const [detailDoc, setDetailDoc] = useState<CompanyDocument | null>(null);
  const [editDoc, setEditDoc] = useState<CompanyDocument | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CompanyDocument | null>(null);

  const categories = categoriesForCapture("company", { kind: "document", document: sharedCats.documentCategories });

  if (loading && !documents.length) {
    return <p className="text-sm text-muted-foreground">Loading documents…</p>;
  }

  if (!documents.length) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card p-8 text-center shadow-card">
        <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
        <p className="font-semibold">No documents yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Add them from Home → Add expense or document, and pick this company.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2">
        {documents.map((docItem) => (
          <DocTile key={docItem.id} doc={docItem} onClick={() => setDetailDoc(docItem)} />
        ))}
      </div>

      <DetailSheet
        doc={detailDoc}
        onClose={() => setDetailDoc(null)}
        onEdit={() => {
          setEditDoc(detailDoc);
          setDetailDoc(null);
        }}
        onDelete={() => {
          setDeleteTarget(detailDoc);
          setDetailDoc(null);
        }}
      />

      <EditSheet
        doc={editDoc}
        categories={categories}
        onClose={() => setEditDoc(null)}
        onSave={async (data, keptPages, newFiles) => {
          if (!editDoc?.id) return;
          await updateDocument(editDoc.id, data, keptPages, newFiles);
        }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{deleteTarget?.name}</strong>
              {deleteTarget && docPages(deleteTarget).length > 1 ? ` and all ${docPages(deleteTarget).length} pages` : ""}. The file
              {deleteTarget && docPages(deleteTarget).length > 1 ? "s" : ""} cannot be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deleteTarget) await deleteDocument(deleteTarget);
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
