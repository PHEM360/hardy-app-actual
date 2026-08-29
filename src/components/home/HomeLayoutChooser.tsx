import { LayoutGrid, Sun } from "lucide-react";
import type { HomeLayoutMode } from "@/lib/homeLayout";

export function HomeLayoutChooser({
  value,
  onChoose,
  title = "How should Home look?",
  description = "Pick a starting layout. You can change this later in Settings.",
}: {
  value?: HomeLayoutMode;
  onChoose: (mode: HomeLayoutMode) => void;
  title?: string;
  description?: string;
}) {
  return (
    <div className="w-full">
      {title && (
        <div className="mb-4 text-center">
          <h1 className="font-display text-xl font-bold">{title}</h1>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onChoose("today")}
          className={`rounded-2xl border p-4 text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-elevated ${
            value === "today"
              ? "border-primary bg-[color-mix(in_srgb,hsl(var(--primary))_14%,hsl(var(--card)))]"
              : "border-border/50 bg-card"
          }`}
          style={{ borderLeftWidth: 4, borderLeftColor: "hsl(38,92%,50%)" }}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
            <Sun className="h-5 w-5" />
          </span>
          <p className="mt-3 font-display text-base font-bold">Today</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your daily planner — weather, tasks, calendar and the bits that matter this morning.
          </p>
        </button>
        <button
          type="button"
          onClick={() => onChoose("tiles")}
          className={`rounded-2xl border p-4 text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-elevated ${
            value === "tiles"
              ? "border-primary bg-[color-mix(in_srgb,hsl(var(--primary))_14%,hsl(var(--card)))]"
              : "border-border/50 bg-card"
          }`}
          style={{ borderLeftWidth: 4, borderLeftColor: "hsl(178,55%,36%)" }}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
            <LayoutGrid className="h-5 w-5" />
          </span>
          <p className="mt-3 font-display text-base font-bold">Tiles</p>
          <p className="mt-1 text-sm text-muted-foreground">
            A welcome, quick links, then a grid of pages you can rearrange and resize.
          </p>
        </button>
      </div>
    </div>
  );
}
