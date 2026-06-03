import { useState, useRef } from "react";
import {
  FileText,
  Receipt,
  ShieldCheck,
  Award,
  BookOpen,
  FileSignature,
  Folder,
  Plus,
  LayoutGrid,
  List,
  Trash2,
  Download,
  Eye,
  Camera,
  Paperclip,
  X,
  Loader2,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage, auth } from "@/lib/firebase";
import { useHouseholdDocuments } from "@/hooks/useHousehold";
import { HouseholdDocument, HouseholdDocCategory } from "@/types/app";

// ─── Category metadata ──────────────────────────────────────────────────────

const CATEGORY_META: Record<
  HouseholdDocCategory,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string }
> = {
  receipt:     { label: "Receipt",     icon: Receipt,       color: "text-emerald-600", bg: "bg-emerald-100" },
  warranty:    { label: "Warranty",    icon: ShieldCheck,   color: "text-blue-600",    bg: "bg-blue-100" },
  certificate: { label: "Certificate", icon: Award,         color: "text-amber-600",   bg: "bg-amber-100" },
  manual:      { label: "Manual",      icon: BookOpen,      color: "text-violet-600",  bg: "bg-violet-100" },
  insurance:   { label: "Insurance",   icon: ShieldCheck,   color: "text-sky-600",     bg: "bg-sky-100" },
  contract:    { label: "Contract",    icon: FileSignature, color: "text-rose-600",    bg: "bg-rose-100" },
  other:       { label: "Other",       icon: FileText,      color: "text-gray-500",    bg: "bg-gray-100" },
};

const CATEGORIES: HouseholdDocCategory[] = [
  "receipt", "warranty", "certificate", "manual", "insurance", "contract", "other"
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatBytes(bytes?: number) {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(fileType?: string) {
  return fileType?.startsWith("image/");
}

function isPdf(fileType?: string) {
  return fileType === "application/pdf";
}

// ─── Add / Edit sheet ───────────────────────────────────────────────────────

interface DocFormData {
  name: string;
  category: HouseholdDocCategory;
  notes: string;
}

interface PendingFile {
  file: File;
  preview: string | null; // object URL for images
}

function AddEditSheet({
  open,
  existing,
  onClose,
  onSave,
}: {
  open: boolean;
  existing: HouseholdDocument | null;
  onClose: () => void;
  onSave: (data: DocFormData, files: File[]) => Promise<void>;
}) {
  const [form, setForm] = useState<DocFormData>({
    name: existing?.name ?? "",
    category: existing?.category ?? "other",
    notes: existing?.notes ?? "",
  });
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedName, setSavedName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Reset form when sheet opens/closes
  const prevOpen = useRef(open);
  if (prevOpen.current !== open) {
    prevOpen.current = open;
    if (open) {
      setForm({
        name: existing?.name ?? "",
        category: existing?.category ?? "other",
        notes: existing?.notes ?? "",
      });
      setPendingFiles([]);
      setSaving(false);
      setSavedName(null);
    }
  }

  const resetForAnother = () => {
    setForm({ name: "", category: "other", notes: "" });
    setPendingFiles([]);
    setSavedName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const addFile = (f: File) => {
    const preview = f.type.startsWith("image/") ? URL.createObjectURL(f) : null;
    setPendingFiles((prev) => [...prev, { file: f, preview }]);
    // Auto-fill name from first file only
    if (!form.name) {
      setForm((p) => ({ ...p, name: f.name.replace(/\.[^.]+$/, "") }));
    }
    // Reset the input so same file can be picked again
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setPendingFiles((prev) => {
      const next = [...prev];
      // Revoke object URL to avoid memory leaks
      if (next[index].preview) URL.revokeObjectURL(next[index].preview!);
      next.splice(index, 1);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await onSave(form, pendingFiles.map((p) => p.file));
      if (!existing) setSavedName(form.name);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[92dvh] overflow-y-auto pb-safe">
        <SheetHeader className="mb-4">
          <SheetTitle>{existing ? "Edit Document" : "Add Document"}</SheetTitle>
        </SheetHeader>

        {/* ── "Add another?" confirmation screen ── */}
        {savedName && (
          <div className="flex flex-col items-center gap-5 py-6 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <span className="text-3xl">✅</span>
            </div>
            <div>
              <p className="font-semibold text-base">"{savedName}" saved!</p>
              <p className="text-sm text-muted-foreground mt-1">Would you like to add another document?</p>
            </div>
            <div className="flex gap-3 w-full">
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-xl border text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
              >
                No, I'm done
              </button>
              <button
                onClick={resetForAnother}
                className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                Yes, add another
              </button>
            </div>
          </div>
        )}

        {/* ── Normal form ── */}
        {!savedName && (
        <div className="space-y-4">
          {/* File / photo section */}
          <div className="space-y-2">
            <Label>Photos / Files</Label>

            {/* Previews of already-selected files */}
            {pendingFiles.length > 0 && (
              <div className="space-y-2">
                {pendingFiles.map((pf, i) => (
                  pf.preview ? (
                    <div key={i} className="relative rounded-xl overflow-hidden border">
                      <img src={pf.preview} alt={pf.file.name} className="w-full h-40 object-cover" />
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <span className="absolute bottom-2 left-2 text-xs text-white bg-black/50 rounded-md px-2 py-0.5 truncate max-w-[70%]">{pf.file.name}</span>
                    </div>
                  ) : (
                    <div key={i} className="flex items-center gap-2 rounded-xl border px-3 py-2 bg-muted/40">
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate flex-1">{pf.file.name}</span>
                      <button type="button" onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )
                ))}
              </div>
            )}

            {/* Show existing file when editing */}
            {existing?.fileName && pendingFiles.length === 0 && (
              <div className="flex items-center gap-2 rounded-xl border px-3 py-2 bg-muted/40">
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm truncate flex-1 text-muted-foreground">{existing.fileName} (current)</span>
              </div>
            )}

            {/* Add buttons — always visible */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-dashed border-muted-foreground/30 py-3 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <Paperclip className="w-4 h-4" />
                {pendingFiles.length > 0 ? "Add another file" : "Upload file"}
              </button>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-dashed border-muted-foreground/30 py-3 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <Camera className="w-4 h-4" />
                {pendingFiles.length > 0 ? "Add another photo" : "Take photo"}
              </button>
            </div>
            <input ref={fileInputRef} type="file" className="hidden" accept="*/*" onChange={(e) => { if (e.target.files?.[0]) addFile(e.target.files[0]); }} />
            <input ref={cameraInputRef} type="file" className="hidden" accept="image/*" capture="environment" onChange={(e) => { if (e.target.files?.[0]) addFile(e.target.files[0]); }} />
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input
              placeholder="e.g. Boiler warranty, Tesco receipt"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v as HouseholdDocCategory }))}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => {
                  const meta = CATEGORY_META[c];
                  const Icon = meta.icon;
                  return (
                    <SelectItem key={c} value={c}>
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${meta.color}`} />
                        {meta.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <textarea
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none"
              rows={3}
              placeholder="Optional notes…"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button className="flex-1 rounded-xl" onClick={handleSubmit} disabled={saving || !form.name.trim()}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {existing ? "Save changes" : "Add document"}
            </Button>
          </div>
        </div>
        )} {/* end !savedName */}
      </SheetContent>
    </Sheet>
  );
}

// ─── Detail sheet ───────────────────────────────────────────────────────────

function DetailSheet({
  doc,
  onClose,
  onEdit,
  onDelete,
}: {
  doc: HouseholdDocument | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  if (!doc) return null;
  const meta = CATEGORY_META[doc.category] ?? CATEGORY_META.other;
  const Icon = meta.icon;

  return (
    <Sheet open={!!doc} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[92dvh] overflow-y-auto pb-safe">
        <SheetHeader className="mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${meta.bg}`}>
              <Icon className={`w-5 h-5 ${meta.color}`} />
            </div>
            <div>
              <SheetTitle className="text-left leading-snug">{doc.name}</SheetTitle>
              <p className="text-sm text-muted-foreground">{meta.label}</p>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-4">
          {/* File previews — show all files if multiple, otherwise just the one */}
          {(() => {
            const urls = doc.fileUrls ?? (doc.fileUrl ? [doc.fileUrl] : []);
            const names = doc.fileNames ?? (doc.fileName ? [doc.fileName] : []);
            const types = doc.fileTypes ?? (doc.fileType ? [doc.fileType] : []);
            return urls.map((url, i) => {
              const name = names[i] ?? `File ${i + 1}`;
              const type = types[i];
              if (isImage(type)) {
                return (
                  <div key={i} className="rounded-2xl overflow-hidden border">
                    <img src={url} alt={name} className="w-full max-h-72 object-contain bg-muted/30" />
                    <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/20">
                      <span className="text-xs text-muted-foreground truncate">{name}</span>
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline ml-2 shrink-0 flex items-center gap-1">
                        <Eye className="w-3 h-3" /> View
                      </a>
                    </div>
                  </div>
                );
              }
              return (
                <div key={i} className="flex items-center gap-3 rounded-xl border p-3 bg-muted/40">
                  <FileText className={`w-6 h-6 shrink-0 ${isPdf(type) ? "text-rose-500" : "text-muted-foreground"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{name}</p>
                  </div>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline shrink-0 flex items-center gap-1">
                    <Eye className="w-3 h-3" /> View
                  </a>
                </div>
              );
            });
          })()}

          {/* Notes */}
          {doc.notes && (
            <div className="rounded-xl border p-3 bg-muted/30">
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{doc.notes}</p>
            </div>
          )}

          {/* Date */}
          {doc.createdAt?.toDate && (
            <p className="text-xs text-muted-foreground">
              Added {doc.createdAt.toDate().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {doc.fileUrl && (
              <a
                href={doc.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button variant="outline" className="w-full rounded-xl gap-1.5">
                  <Eye className="w-4 h-4" /> View
                </Button>
              </a>
            )}
            {doc.fileUrl && (
              <a
                href={doc.fileUrl}
                download={doc.fileName ?? doc.name}
                className="flex-1"
              >
                <Button variant="outline" className="w-full rounded-xl gap-1.5">
                  <Download className="w-4 h-4" /> Download
                </Button>
              </a>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 rounded-xl gap-1.5" onClick={onEdit}>
              <Pencil className="w-4 h-4" /> Edit
            </Button>
            <Button variant="destructive" className="flex-1 rounded-xl gap-1.5" onClick={onDelete}>
              <Trash2 className="w-4 h-4" /> Delete
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Tile ────────────────────────────────────────────────────────────────────

function DocTile({ doc, onClick }: { doc: HouseholdDocument; onClick: () => void }) {
  const meta = CATEGORY_META[doc.category] ?? CATEGORY_META.other;
  const Icon = meta.icon;
  const thumb = doc.fileUrl && isImage(doc.fileType) ? doc.fileUrl : null;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl border shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col bg-card"
    >
      {/* Thumbnail or icon placeholder */}
      <div className={`w-full h-28 flex items-center justify-center ${thumb ? "" : meta.bg}`}>
        {thumb ? (
          <img src={thumb} alt={doc.name} className="w-full h-28 object-cover" />
        ) : (
          <Icon className={`w-10 h-10 ${meta.color} opacity-60`} />
        )}
      </div>
      {/* Footer */}
      <div className="p-3 space-y-0.5">
        <p className="text-sm font-semibold leading-snug line-clamp-2">{doc.name}</p>
        <p className="text-xs text-muted-foreground">{meta.label}</p>
        {doc.fileSize && (
          <p className="text-xs text-muted-foreground">{formatBytes(doc.fileSize)}</p>
        )}
      </div>
    </button>
  );
}

// ─── List row ────────────────────────────────────────────────────────────────

function DocRow({ doc, onClick }: { doc: HouseholdDocument; onClick: () => void }) {
  const meta = CATEGORY_META[doc.category] ?? CATEGORY_META.other;
  const Icon = meta.icon;
  const thumb = doc.fileUrl && isImage(doc.fileType) ? doc.fileUrl : null;

  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 rounded-2xl border p-3 shadow-sm hover:shadow-md transition-shadow bg-card"
    >
      {/* Icon / thumb */}
      <div className={`w-12 h-12 rounded-xl shrink-0 overflow-hidden flex items-center justify-center ${thumb ? "" : meta.bg}`}>
        {thumb ? (
          <img src={thumb} alt={doc.name} className="w-12 h-12 object-cover" />
        ) : (
          <Icon className={`w-6 h-6 ${meta.color}`} />
        )}
      </div>
      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{doc.name}</p>
        <p className="text-xs text-muted-foreground">{meta.label}{doc.fileSize ? ` · ${formatBytes(doc.fileSize)}` : ""}</p>
        {doc.notes && <p className="text-xs text-muted-foreground truncate mt-0.5">{doc.notes}</p>}
      </div>
      {/* Chevron hint */}
      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
    </button>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <button
      onClick={onAdd}
      className="w-full rounded-2xl border-2 border-dashed border-muted p-10 flex flex-col items-center gap-3 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
    >
      <Folder className="w-10 h-10" />
      <div className="text-center">
        <p className="font-semibold text-sm">No documents yet</p>
        <p className="text-xs mt-0.5">Tap to add your first receipt, warranty or document</p>
      </div>
    </button>
  );
}

// ─── Main section ─────────────────────────────────────────────────────────────

export default function DocumentsSection() {
  const { documents, loading, addDocument, updateDocument, deleteDocument } = useHouseholdDocuments();
  const [viewMode, setViewMode] = useState<"tiles" | "list">("tiles");
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<HouseholdDocument | null>(null);
  const [detailDoc, setDetailDoc] = useState<HouseholdDocument | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HouseholdDocument | null>(null);
  const [filterCat, setFilterCat] = useState<HouseholdDocCategory | "all">("all");

  const uploadFile = async (file: File): Promise<{ url: string; name: string; type: string; size: number }> => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("Not logged in");
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `household/${uid}/documents/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const ref = storageRef(storage, path);
    await uploadBytes(ref, file);
    const url = await getDownloadURL(ref);
    return { url, name: file.name, type: file.type, size: file.size };
  };

  const handleSave = async (data: { name: string; category: HouseholdDocCategory; notes: string }, files: File[]) => {
    let fileFields: Partial<HouseholdDocument> = {};
    if (files.length > 0) {
      const uploaded = await Promise.all(files.map(uploadFile));
      fileFields = {
        fileUrl: uploaded[0].url,
        fileName: uploaded[0].name,
        fileType: uploaded[0].type,
        fileSize: uploaded[0].size,
        fileUrls: uploaded.map((u) => u.url),
        fileNames: uploaded.map((u) => u.name),
        fileTypes: uploaded.map((u) => u.type),
      };
    }
    if (editTarget?.id) {
      await updateDocument(editTarget.id, { ...data, ...fileFields });
      setEditTarget(null);
    } else {
      await addDocument({ ...data, ...fileFields });
    }
    setAddOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    await deleteDocument(deleteTarget.id);
    setDeleteTarget(null);
    setDetailDoc(null);
  };

  const openEdit = (doc: HouseholdDocument) => {
    setDetailDoc(null);
    setEditTarget(doc);
    setAddOpen(true);
  };

  const filtered = filterCat === "all" ? documents : documents.filter((d) => d.category === filterCat);

  // Category counts for filter pills
  const counts = documents.reduce<Record<string, number>>((acc, d) => {
    acc[d.category] = (acc[d.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <Button size="sm" className="rounded-full gap-1" onClick={() => { setEditTarget(null); setAddOpen(true); }}>
          <Plus className="w-4 h-4" /> Add
        </Button>
        {/* View toggle */}
        <div className="flex items-center gap-1 p-0.5 bg-muted/50 rounded-lg">
          <button
            onClick={() => setViewMode("tiles")}
            className={`p-1.5 rounded-md transition-colors ${viewMode === "tiles" ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}
            title="Tile view"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}
            title="List view"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Category filter pills */}
      {documents.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
          <button
            onClick={() => setFilterCat("all")}
            className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors border ${filterCat === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-muted hover:border-primary hover:text-primary"}`}
          >
            All ({documents.length})
          </button>
          {(Object.keys(counts) as HouseholdDocCategory[]).map((cat) => {
            const meta = CATEGORY_META[cat];
            const Icon = meta.icon;
            return (
              <button
                key={cat}
                onClick={() => setFilterCat(cat)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors border ${filterCat === cat ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-muted hover:border-primary hover:text-primary"}`}
              >
                <Icon className="w-3 h-3" />
                {meta.label} ({counts[cat]})
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState onAdd={() => { setEditTarget(null); setAddOpen(true); }} />
      ) : viewMode === "tiles" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filtered.map((d) => (
            <DocTile key={d.id} doc={d} onClick={() => setDetailDoc(d)} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((d) => (
            <DocRow key={d.id} doc={d} onClick={() => setDetailDoc(d)} />
          ))}
        </div>
      )}

      {/* Add / Edit sheet */}
      <AddEditSheet
        open={addOpen}
        existing={editTarget}
        onClose={() => { setAddOpen(false); setEditTarget(null); }}
        onSave={handleSave}
      />

      {/* Detail sheet */}
      <DetailSheet
        doc={detailDoc}
        onClose={() => setDetailDoc(null)}
        onEdit={() => detailDoc && openEdit(detailDoc)}
        onDelete={() => { setDeleteTarget(detailDoc); setDetailDoc(null); }}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{deleteTarget?.name}</strong>. The file cannot be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
