import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { FileUp, Receipt, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HOME_TILES } from "@/lib/homeLayout";
import { AddExpenseDocumentDialog } from "@/components/capture/AddExpenseDocumentDialog";
import { UploadDocumentDialog } from "@/components/documents/UploadDocumentDialog";
import { TdHead } from "./TdHead";

type PickableTile = {
  id: string;
  label: string;
  icon: LucideIcon;
  gradient: string;
  route?: string;
  action?: "expense" | "upload";
};

// HOME_TILES only covers navigable pages — "Add expense or document" and
// "Upload" are dialog actions (see QuickLinksWidget.ALL_LINKS), so without
// these they could never appear as pickable quick links here even though
// they're already available as buttons in that other quick-links widget.
const ACTION_TILES: PickableTile[] = [
  { id: "expense", label: "Add expense or document", icon: Receipt, gradient: "linear-gradient(135deg,hsl(350,70%,55%),hsl(340,60%,46%))", action: "expense" },
  { id: "upload", label: "Upload document", icon: FileUp, gradient: "linear-gradient(135deg,hsl(200,70%,55%),hsl(210,60%,46%))", action: "upload" },
];

const PICKABLE: PickableTile[] = [...HOME_TILES.filter((t) => t.id !== "quick_links" && t.route), ...ACTION_TILES];
const MAX_LINKS = 8;

interface QuickLinksConfig {
  tileIds?: string[];
}

export function TdQuickLinksWidget({
  config,
  onConfigChange,
}: {
  config?: Record<string, unknown>;
  onConfigChange: (config: Record<string, unknown>) => void;
}) {
  const cfg = (config ?? {}) as QuickLinksConfig;
  const tileIds = cfg.tileIds ?? [];
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const selected = tileIds.map((id) => PICKABLE.find((t) => t.id === id)).filter(Boolean) as PickableTile[];

  const toggleTile = (id: string) => {
    const next = tileIds.includes(id) ? tileIds.filter((t) => t !== id) : [...tileIds, id].slice(0, MAX_LINKS);
    onConfigChange({ ...cfg, tileIds: next });
  };

  const runTile = (tile: PickableTile) => {
    if (tile.action === "expense") setExpenseOpen(true);
    else if (tile.action === "upload") setUploadOpen(true);
    else if (tile.route) navigate(tile.route);
  };

  return (
    <div className="h-full flex flex-col p-3">
      <TdHead
        emoji="🔗"
        title="Quick Links"
        action={
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Choose links"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
        }
      />
      <div className="flex-1 min-h-0 overflow-y-auto">
        {selected.length === 0 ? (
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border/60 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
          >
            Tap to choose pages
          </button>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {selected.map((tile) => {
              const Icon = tile.icon;
              return (
                <button
                  key={tile.id}
                  type="button"
                  onClick={() => runTile(tile)}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-border/50 bg-background/60 px-2 py-2.5 text-center hover:border-primary/40 hover:bg-primary/5"
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
                    style={{ background: tile.gradient }}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="truncate text-[10px] font-semibold text-foreground">{tile.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="mx-4 max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Choose quick links</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Pick up to {MAX_LINKS} pages ({tileIds.length}/{MAX_LINKS}).</p>
          <div className="grid max-h-[55vh] grid-cols-2 gap-2 overflow-y-auto pt-1">
            {PICKABLE.map((tile) => {
              const Icon = tile.icon;
              const active = tileIds.includes(tile.id);
              const disabled = !active && tileIds.length >= MAX_LINKS;
              return (
                <button
                  key={tile.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleTile(tile.id)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
                    active
                      ? "border-primary/50 bg-primary/10 text-foreground"
                      : disabled
                      ? "cursor-not-allowed border-border/40 bg-muted/40 text-muted-foreground/60"
                      : "border-border bg-card text-foreground hover:border-primary/40"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 truncate">{tile.label}</span>
                  {active && <X className="ml-auto h-3 w-3 shrink-0" />}
                </button>
              );
            })}
          </div>
          <Button className="mt-2 w-full rounded-xl bg-gradient-primary" onClick={() => setSettingsOpen(false)}>
            Done
          </Button>
        </DialogContent>
      </Dialog>

      <AddExpenseDocumentDialog open={expenseOpen} onOpenChange={setExpenseOpen} />
      <UploadDocumentDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  );
}
