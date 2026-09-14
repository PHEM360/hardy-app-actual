import { Palette } from "lucide-react";
import {
  BACKDROP_GROUPS,
  BACKDROP_HINTS,
  BACKDROP_LABELS,
  BACKDROP_THUMBS,
  DISPLAY_THEMES,
  type DisplayPage,
} from "@/lib/displayPages";

const FIELD_LABEL = "text-[11px] font-bold uppercase tracking-wider text-muted-foreground";

export function DisplayAppearance({
  page,
  pageCount,
  onChange,
  onApplyLookToAll,
}: {
  page: DisplayPage;
  pageCount: number;
  onChange: (next: DisplayPage) => void;
  onApplyLookToAll: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className={`flex items-center gap-1.5 ${FIELD_LABEL}`}>
          <Palette className="h-3.5 w-3.5" /> Theme
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {DISPLAY_THEMES.map((theme) => (
            <button
              key={theme.id}
              type="button"
              onClick={() => onChange({ ...page, theme: theme.id, background: theme.background })}
              aria-label={`${theme.label} theme`}
              title={theme.label}
              className={`h-9 w-9 rounded-xl border-2 transition ${
                page.theme === theme.id ? "scale-105 border-primary shadow-sm" : "border-border hover:border-primary/50"
              }`}
              style={{ background: `linear-gradient(140deg, ${theme.background} 45%, ${theme.accent} 160%)` }}
            />
          ))}
          <input
            type="color"
            value={page.background}
            onChange={(event) => onChange({ ...page, theme: "custom", background: event.target.value })}
            aria-label="Custom background"
            className="h-9 w-12 cursor-pointer rounded-xl border border-border bg-transparent p-1"
          />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold">Background animation</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {BACKDROP_HINTS[page.backdrop || "none"]}
        </p>
        <div className="mt-2 space-y-2.5">
          {BACKDROP_GROUPS.map((group) => (
            <div key={group.id}>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{group.label}</p>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                {group.options.map((kind) => {
                  const active = (page.backdrop || "none") === kind;
                  return (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => onChange({ ...page, backdrop: kind })}
                      aria-pressed={active}
                      className={`overflow-hidden rounded-xl border text-left transition ${
                        active
                          ? "border-primary ring-2 ring-primary/40"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <span
                        className="block h-9 w-full"
                        style={{ background: BACKDROP_THUMBS[kind] }}
                      />
                      <span className={`block truncate bg-card px-1.5 py-1 text-[10px] font-semibold ${active ? "text-foreground" : "text-muted-foreground"}`}>
                        {BACKDROP_LABELS[kind]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {page.backdrop === "weather" && (
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            Uses this page’s weather place if you’ve set one, otherwise the screen’s own location.
          </p>
        )}
      </div>

      {pageCount > 1 && (
        <button
          type="button"
          onClick={onApplyLookToAll}
          className="h-9 rounded-xl border border-border bg-background px-3 text-xs font-semibold transition hover:border-primary/40"
        >
          Use this look on every page
        </button>
      )}
    </div>
  );
}
