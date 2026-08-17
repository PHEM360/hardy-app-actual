import { useState, useRef, useCallback } from "react";
import {
  Camera, Paperclip, ScanLine, FileText, CheckCircle2,
  Home, Building2, Dumbbell, Heart, Activity, Folder,
  X, ChevronLeft, Upload, Plus,
} from "lucide-react";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";
import { useDocuments } from "@/hooks/useDocuments";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

type UploadMethod = "photo" | "file" | "scan";
type Step = "method" | "preview" | "destination" | "uploading" | "success";

interface Destination {
  key: string;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
}

interface PageFile {
  file: File;
  previewUrl: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DESTINATIONS: Destination[] = [
  { key: "general",    label: "General",    icon: Folder,    color: "text-slate-600",    bg: "bg-slate-100 dark:bg-slate-800" },
  { key: "households", label: "Households", icon: Home,      color: "text-blue-600",     bg: "bg-blue-50 dark:bg-blue-950/40" },
  { key: "tattersalls",label: "Tattersalls",icon: Building2, color: "text-purple-600",   bg: "bg-purple-50 dark:bg-purple-950/40" },
  { key: "pets",       label: "Pets",       icon: Heart,     color: "text-pink-600",     bg: "bg-pink-50 dark:bg-pink-950/40" },
  { key: "health",     label: "Health",     icon: Activity,  color: "text-emerald-600",  bg: "bg-emerald-50 dark:bg-emerald-950/40" },
  { key: "fitness",    label: "Fitness",    icon: Dumbbell,  color: "text-orange-600",   bg: "bg-orange-50 dark:bg-orange-950/40" },
];

const DESTINATION_LABELS: Record<string, string> = {
  general:     "General Documents",
  households:  "Household Documents",
  tattersalls: "Tattersalls Documents",
  pets:        "Pet Documents",
  health:      "Health Documents",
  fitness:     "Fitness Documents",
};

const ACCEPT_IMAGE = "image/*";
const ACCEPT_FILE  = "image/*,application/pdf,.doc,.docx";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isImage(file: File) {
  return file.type.startsWith("image/");
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FilePreviewThumb({ file, onRemove }: { file: File; previewUrl?: string; onRemove?: () => void }) {
  const url = isImage(file) ? URL.createObjectURL(file) : null;
  return (
    <div className="relative flex flex-col items-center gap-1.5">
      {url ? (
        <img src={url} alt={file.name} className="w-full h-40 object-cover rounded-xl border border-border" onLoad={() => URL.revokeObjectURL(url!)} />
      ) : (
        <div className="w-full h-40 flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-muted/30">
          <FileText className="w-10 h-10 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground font-medium px-2 text-center truncate max-w-full">{file.name}</span>
        </div>
      )}
      <span className="text-[10px] text-muted-foreground">{formatSize(file.size)}</span>
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function UploadDocumentDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { dataUid } = useAuth();
  const { addDocument } = useDocuments();

  // State
  const [step, setStep] = useState<Step>("method");
  const [method, setMethod] = useState<UploadMethod | null>(null);
  const [pages, setPages] = useState<PageFile[]>([]);
  const [selectedDest, setSelectedDest] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Hidden file inputs
  const photoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const scanInputRef  = useRef<HTMLInputElement>(null);

  // ── Reset ────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    setStep("method");
    setMethod(null);
    setPages([]);
    setSelectedDest(null);
    setUploadProgress(0);
    setErrorMsg(null);
  }, []);

  const handleClose = useCallback((v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  }, [reset, onOpenChange]);

  // ── File selection ────────────────────────────────────────────────────────

  const handleFilesChosen = useCallback((files: FileList | null, chosenMethod: UploadMethod) => {
    if (!files || files.length === 0) return;
    setMethod(chosenMethod);
    const newPages: PageFile[] = Array.from(files).map((f) => ({
      file: f,
      previewUrl: isImage(f) ? URL.createObjectURL(f) : "",
    }));
    setPages(newPages);
    setStep("preview");
  }, []);

  const addScanPage = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newPages: PageFile[] = Array.from(files).map((f) => ({
      file: f,
      previewUrl: isImage(f) ? URL.createObjectURL(f) : "",
    }));
    setPages((prev) => [...prev, ...newPages]);
  }, []);

  const removePage = useCallback((index: number) => {
    setPages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ── Upload ────────────────────────────────────────────────────────────────

  const handleUpload = useCallback(async () => {
    if (!dataUid || !selectedDest || pages.length === 0) return;
    setStep("uploading");
    setErrorMsg(null);

    const dest = selectedDest;
    const destLabel = DESTINATION_LABELS[dest] ?? dest;
    const total = pages.length;

    try {
      for (let i = 0; i < total; i++) {
        const { file } = pages[i];
        const timestamp = Date.now();
        const pageSuffix = total > 1 ? `_page${i + 1}` : "";
        const storageName = `${timestamp}${pageSuffix}_${file.name}`;
        const path = `documents/${dataUid}/${dest}/${storageName}`;

        const sRef = storageRef(storage, path);
        await uploadBytes(sRef, file);
        const url = await getDownloadURL(sRef);

        const docName = total > 1
          ? `${file.name.replace(/\.[^.]+$/, "")} (page ${i + 1})`
          : file.name;

        await addDocument({
          name: docName,
          url,
          mimeType: file.type,
          destination: dest,
          destinationLabel: destLabel,
          size: file.size,
        });

        setUploadProgress(Math.round(((i + 1) / total) * 100));
      }
      setStep("success");
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Upload failed. Please try again.");
      setStep("preview");
    }
  }, [dataUid, selectedDest, pages, addDocument]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (!dataUid) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
          <DialogHeader><DialogTitle className="font-display">Upload Document</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-4 text-center">Please sign in to upload documents.</p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      {/* Hidden file inputs */}
      <input
        ref={photoInputRef}
        type="file"
        accept={ACCEPT_IMAGE}
        capture="environment"
        className="hidden"
        onChange={(e) => handleFilesChosen(e.target.files, "photo")}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_FILE}
        className="hidden"
        onChange={(e) => handleFilesChosen(e.target.files, "file")}
      />
      <input
        ref={scanInputRef}
        type="file"
        accept={ACCEPT_IMAGE}
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (step === "method") {
            handleFilesChosen(e.target.files, "scan");
          } else {
            addScanPage(e.target.files);
          }
          // reset value so same file can be re-selected if needed
          if (scanInputRef.current) scanInputRef.current.value = "";
        }}
      />

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4 p-0 overflow-hidden">

          {/* ── Step: method ────────────────────────────────────────────── */}
          {step === "method" && (
            <div className="p-5">
              <DialogHeader className="mb-4">
                <DialogTitle className="font-display">Upload Document</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => photoInputRef.current?.click()}
                  className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:bg-muted/50 active:scale-[0.98] transition-all text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center flex-shrink-0">
                    <Camera className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Take Photo</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Use your camera to capture a document</p>
                  </div>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:bg-muted/50 active:scale-[0.98] transition-all text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center flex-shrink-0">
                    <Paperclip className="w-6 h-6 text-violet-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Upload File</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Choose an image or PDF from your device</p>
                  </div>
                </button>

                <button
                  onClick={() => { setMethod("scan"); scanInputRef.current?.click(); }}
                  className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:bg-muted/50 active:scale-[0.98] transition-all text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center flex-shrink-0">
                    <ScanLine className="w-6 h-6 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Scan Pages</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Capture multiple pages one by one</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ── Step: preview ───────────────────────────────────────────── */}
          {step === "preview" && (
            <div className="p-5">
              <DialogHeader className="mb-4">
                <div className="flex items-center gap-2">
                  <button onClick={() => { setPages([]); setStep("method"); }} className="text-muted-foreground hover:text-foreground transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <DialogTitle className="font-display">
                    {method === "scan" ? `Pages (${pages.length})` : "Preview"}
                  </DialogTitle>
                </div>
              </DialogHeader>

              {errorMsg && (
                <div className="mb-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                  {errorMsg}
                </div>
              )}

              {/* File previews */}
              {method === "scan" && pages.length > 1 ? (
                <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto mb-4">
                  {pages.map((p, i) => (
                    <FilePreviewThumb key={i} file={p.file} previewUrl={p.previewUrl} onRemove={() => removePage(i)} />
                  ))}
                </div>
              ) : pages.length === 1 ? (
                <div className="mb-4">
                  <FilePreviewThumb file={pages[0].file} previewUrl={pages[0].previewUrl} />
                </div>
              ) : null}

              {/* Add more pages (scan mode) */}
              {method === "scan" && (
                <button
                  onClick={() => scanInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 h-10 mb-4 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:bg-muted/40 transition-all"
                >
                  <Plus className="w-4 h-4" /> Add another page
                </button>
              )}

              {/* Destination picker */}
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Save to</p>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {DESTINATIONS.map((d) => {
                  const Icon = d.icon;
                  const selected = selectedDest === d.key;
                  return (
                    <button
                      key={d.key}
                      onClick={() => setSelectedDest(d.key)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all active:scale-[0.97] ${
                        selected
                          ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                          : "border-border bg-card hover:bg-muted/40"
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${d.bg}`}>
                        <Icon className={`w-4.5 h-4.5 ${d.color}`} />
                      </div>
                      <span className="text-[10px] font-semibold text-card-foreground leading-tight text-center">{d.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleClose(false)} className="flex-1 h-10 rounded-xl">
                  Cancel
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={!selectedDest || pages.length === 0}
                  className="flex-1 h-10 rounded-xl bg-gradient-primary"
                >
                  <Upload className="w-4 h-4 mr-1.5" />
                  Upload{pages.length > 1 ? ` (${pages.length})` : ""}
                </Button>
              </div>
            </div>
          )}

          {/* ── Step: uploading ─────────────────────────────────────────── */}
          {step === "uploading" && (
            <div className="p-8 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Upload className="w-8 h-8 text-primary animate-pulse" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">Uploading…</p>
                <p className="text-xs text-muted-foreground mt-1">{uploadProgress}% complete</p>
              </div>
              {pages.length > 1 && (
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* ── Step: success ───────────────────────────────────────────── */}
          {step === "success" && (
            <div className="p-8 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">
                  {pages.length > 1 ? `${pages.length} pages uploaded!` : "Document uploaded!"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Saved to {selectedDest ? DESTINATION_LABELS[selectedDest] : "Documents"}
                </p>
              </div>
              <div className="flex gap-2 w-full">
                <Button variant="outline" onClick={() => handleClose(false)} className="flex-1 h-10 rounded-xl">
                  Done
                </Button>
                <Button onClick={reset} className="flex-1 h-10 rounded-xl bg-gradient-primary">
                  Upload Another
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
