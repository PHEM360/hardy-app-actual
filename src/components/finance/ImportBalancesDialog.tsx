import { useRef, useState } from "react";
import { Download, Upload, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Account, BalanceEntry } from "@/hooks/useFinance";
import { buildTemplateCsv, downloadTextFile, parseBalanceCsv, type ImportPreview } from "@/lib/financeImport";

interface ImportBalancesDialogProps {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
  entries: BalanceEntry[];
  onImport: (rows: ImportPreview["rows"]) => Promise<void>;
}

export default function ImportBalancesDialog({ open, onClose, accounts, entries, onImport }: ImportBalancesDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);

  const reset = () => {
    setFileName(null);
    setPreview(null);
    setError(null);
    setImporting(false);
    setDone(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleDownloadTemplate = () => {
    if (accounts.length === 0) {
      setError("Add at least one account before downloading a template.");
      return;
    }
    downloadTextFile("finance-balances-template.csv", buildTemplateCsv(accounts));
  };

  const handleFileChange = async (file: File | null) => {
    setError(null);
    setPreview(null);
    setDone(false);
    if (!file) return;
    setFileName(file.name);

    if (!/\.csv$/i.test(file.name)) {
      setError("Please upload a .csv file (in Excel, use File → Save As → CSV).");
      return;
    }

    const text = await file.text();
    const result = parseBalanceCsv(text, accounts, entries);

    if (result.matchedAccountNames.length === 0) {
      setError("No column headers matched an existing account name. Download the template to see the expected format.");
      return;
    }
    if (result.rows.length === 0) {
      setError("No valid balance entries were found in this file.");
      return;
    }
    setPreview(result);
  };

  const handleConfirm = async () => {
    if (!preview || preview.rows.length === 0) return;
    setImporting(true);
    try {
      await onImport(preview.rows);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent aria-describedby={undefined} className="max-w-md mx-4">
        <DialogHeader>
          <DialogTitle className="font-display">Import Past Balances</DialogTitle>
          <DialogDescription>Bulk-upload historical balances from a spreadsheet.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <Button variant="outline" size="sm" className="w-full h-10 rounded-xl gap-2" onClick={handleDownloadTemplate}>
            <Download className="w-4 h-4" /> Download CSV template
          </Button>

          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
            <Button
              size="sm"
              className="w-full h-10 rounded-xl gap-2 bg-gradient-primary"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4" /> {fileName ? "Choose a different file" : "Choose CSV file"}
            </Button>
            {fileName && <p className="text-xs text-muted-foreground text-center">{fileName}</p>}
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-xs">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {preview && !done && (
            <div className="space-y-2 p-3 rounded-xl bg-muted/40 text-xs">
              <p className="font-semibold text-card-foreground">
                {preview.rows.length} entr{preview.rows.length === 1 ? "y" : "ies"} found
                {preview.updatingCount > 0 && ` (${preview.updatingCount} will update existing values)`}
              </p>
              {preview.dateRange && (
                <p className="text-muted-foreground">
                  {new Date(preview.dateRange.start).toLocaleDateString("en-GB")} – {new Date(preview.dateRange.end).toLocaleDateString("en-GB")}
                </p>
              )}
              <p className="text-muted-foreground">Matched accounts: {preview.matchedAccountNames.join(", ")}</p>
              {preview.unmatchedColumns.length > 0 && (
                <p className="text-amber-600 dark:text-amber-400">
                  Skipped columns (no matching account): {preview.unmatchedColumns.join(", ")}
                </p>
              )}
              {preview.skippedCells > 0 && (
                <p className="text-amber-600 dark:text-amber-400">{preview.skippedCells} cell(s) could not be read and were skipped.</p>
              )}
            </div>
          )}

          {done && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
              <CheckCircle2 className="w-4 h-4" /> Import complete — {preview?.rows.length ?? 0} entries saved.
            </div>
          )}

          {preview && !done && (
            <Button className="w-full h-11 rounded-xl bg-gradient-primary" onClick={handleConfirm} disabled={importing}>
              {importing ? "Importing…" : `Import ${preview.rows.length} entries`}
            </Button>
          )}
          {done && (
            <Button className="w-full h-11 rounded-xl" variant="outline" onClick={handleClose}>
              Done
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
