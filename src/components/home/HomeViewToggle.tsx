import { LayoutGrid, Sun } from "lucide-react";
import type { HomeLayoutMode } from "@/lib/homeLayout";

export function HomeViewToggle({
  mode,
  onChange,
}: {
  mode: HomeLayoutMode;
  onChange: (mode: HomeLayoutMode) => void;
}) {
  return (
    <div
      className="flex rounded-xl border border-border/60 bg-card p-0.5 shadow-sm"
      role="tablist"
      aria-label="Home view"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === "tiles"}
        onClick={() => onChange("tiles")}
        className={`flex h-8 items-center gap-1 rounded-[10px] px-2 sm:px-2.5 text-[11px] font-semibold transition-colors ${
          mode === "tiles"
            ? "bg-gradient-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
        title="Tiles view"
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Tiles</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "today"}
        onClick={() => onChange("today")}
        className={`flex h-8 items-center gap-1 rounded-[10px] px-2 sm:px-2.5 text-[11px] font-semibold transition-colors ${
          mode === "today"
            ? "bg-gradient-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
        title="Today view"
      >
        <Sun className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Today</span>
      </button>
    </div>
  );
}
