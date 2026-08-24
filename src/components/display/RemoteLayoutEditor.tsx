import {
  CalendarDays, Clock3, Image, ListChecks, MessageSquareQuote, Plus, Settings2, Sun, Timer, Trash2,
  CloudSun,
} from "lucide-react";
import {
  PAGE_LAYOUTS,
  WIDGET_DESCRIPTIONS,
  WIDGET_LABELS,
  WIDGET_ORDER,
  applyPageLayout,
  createDisplayWidget,
  layoutIsResizable,
  layoutSlots,
  type DisplayPage,
  type DisplayPageLayout,
  type DisplayWidgetType,
} from "@/lib/displayPages";

const ICONS: Record<DisplayWidgetType, typeof Clock3> = {
  today: Sun,
  clock: Clock3,
  photos: Image,
  calendar: CalendarDays,
  tasks: ListChecks,
  weather: CloudSun,
  message: MessageSquareQuote,
  countdown: Timer,
};

const TINTS: Record<DisplayWidgetType, string> = {
  today: "border-amber-400/40 bg-amber-400/15 text-amber-100",
  clock: "border-sky-400/40 bg-sky-400/15 text-sky-100",
  photos: "border-fuchsia-400/40 bg-fuchsia-400/15 text-fuchsia-100",
  calendar: "border-violet-400/40 bg-violet-400/15 text-violet-100",
  tasks: "border-teal-400/40 bg-teal-400/15 text-teal-100",
  weather: "border-cyan-400/40 bg-cyan-400/15 text-cyan-100",
  message: "border-rose-400/40 bg-rose-400/15 text-rose-100",
  countdown: "border-lime-400/40 bg-lime-400/15 text-lime-100",
};

function LayoutThumbnail({ layout, ratio }: { layout: DisplayPageLayout; ratio?: number }) {
  return (
    <span className="grid h-8 w-12 shrink-0 grid-cols-12 grid-rows-12 gap-[2px]">
      {layoutSlots(layout, ratio).map((slot, index) => (
        <span
          key={index}
          className="rounded-[2px] bg-current opacity-70"
          style={{ gridColumn: `${slot.x + 1} / span ${slot.w}`, gridRow: `${slot.y + 1} / span ${slot.h}` }}
        />
      ))}
    </span>
  );
}

export function RemoteLayoutEditor({
  page,
  selectedWidgetId,
  onSelectWidget,
  onChange,
}: {
  page: DisplayPage;
  selectedWidgetId: string | null;
  onSelectWidget: (id: string | null) => void;
  onChange: (page: DisplayPage) => void;
}) {
  const layout = page.layout ?? "full";
  const slots = layoutSlots(layout, page.splitRatio);
  const resizable = layoutIsResizable(layout);
  const ratioPercent = Math.round((page.splitRatio ?? (layout === "main-side" ? 0.66 : 0.5)) * 100);

  const setLayout = (next: DisplayPageLayout) => {
    onChange(applyPageLayout({ ...page, layout: next }));
  };

  const setSlotWidget = (index: number, type: DisplayWidgetType | "") => {
    const widgets = [...page.widgets];
    if (type === "") {
      widgets.splice(index, 1);
    } else if (widgets[index]) {
      // Keep the id so the settings panel stays open on the same area.
      widgets[index] = { ...createDisplayWidget(type), id: widgets[index].id };
    } else {
      while (widgets.length < index) widgets.push(createDisplayWidget("today"));
      widgets[index] = createDisplayWidget(type);
    }
    const next = applyPageLayout({ ...page, widgets });
    onChange(next);
    onSelectWidget(type === "" ? null : next.widgets[index]?.id ?? null);
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-white/45">1. Choose the layout</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {PAGE_LAYOUTS.map((option) => {
            const active = layout === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setLayout(option.id)}
                aria-pressed={active}
                className={`flex min-w-0 items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition ${
                  active
                    ? "border-primary bg-gradient-primary text-primary-foreground shadow-lg"
                    : "border-white/12 bg-white/[0.06] text-white hover:border-white/30 hover:bg-white/10"
                }`}
              >
                <LayoutThumbnail layout={option.id} ratio={active ? page.splitRatio : undefined} />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold">{option.label}</span>
                  <span className={`block text-[10px] ${active ? "text-primary-foreground/75" : "text-white/45"}`}>
                    {option.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {resizable && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="area-size" className="text-xs font-semibold text-white">
              {layout === "stack" ? "Height of the top area" : "Width of the main area"}
            </label>
            <span className="rounded-lg bg-white/10 px-2 py-0.5 text-[11px] font-bold tabular-nums text-white/80">
              {ratioPercent}%
            </span>
          </div>
          <input
            id="area-size"
            type="range"
            min={25}
            max={75}
            step={5}
            value={ratioPercent}
            onChange={(event) => onChange(applyPageLayout({ ...page, splitRatio: Number(event.target.value) / 100 }))}
            className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-primary"
          />
          <p className="mt-1.5 text-[10px] text-white/40">Drag to resize the areas. The preview updates as you go.</p>
        </div>
      )}

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-white/45">2. Fill each area</p>
        <p className="mt-0.5 text-[11px] text-white/45">Pick what shows where, then open its settings to fine-tune it.</p>
        <div
          className="mt-2 grid aspect-[16/9] w-full gap-2 rounded-2xl border border-white/10 bg-black/40 p-2"
          style={{ gridTemplateColumns: "repeat(12, 1fr)", gridTemplateRows: "repeat(12, 1fr)" }}
        >
          {slots.map((slot, index) => {
            const widget = page.widgets[index];
            const Icon = widget ? ICONS[widget.type] : Plus;
            const selected = !!widget && widget.id === selectedWidgetId;
            return (
              <div
                key={index}
                className={`flex min-w-0 flex-col overflow-hidden rounded-xl border p-2 transition ${
                  widget
                    ? `${TINTS[widget.type]} ${selected ? "ring-2 ring-primary" : ""}`
                    : "border-dashed border-white/20 bg-white/[0.03]"
                }`}
                style={{ gridColumn: `${slot.x + 1} / span ${slot.w}`, gridRow: `${slot.y + 1} / span ${slot.h}` }}
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className={`min-w-0 flex-1 truncate text-xs font-bold ${widget ? "" : "text-white/50"}`}>
                    {widget ? widget.title || WIDGET_LABELS[widget.type] : "Empty area"}
                  </span>
                  {widget && (
                    <button
                      type="button"
                      onClick={() => setSlotWidget(index, "")}
                      aria-label={`Clear area ${index + 1}`}
                      className="rounded-lg p-1 text-white/50 transition hover:bg-red-500/20 hover:text-red-200"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {widget && slot.h > 4 && (
                  <p className="mt-1 hidden text-[10px] leading-snug opacity-75 sm:block">
                    {WIDGET_DESCRIPTIONS[widget.type]}
                  </p>
                )}

                <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1.5">
                  <select
                    value={widget?.type ?? ""}
                    onChange={(event) => setSlotWidget(index, event.target.value as DisplayWidgetType | "")}
                    aria-label={`Widget for area ${index + 1}`}
                    className="h-8 min-w-0 flex-1 rounded-lg border border-white/15 bg-zinc-900 px-2 text-xs font-medium text-white"
                  >
                    <option value="">Choose a widget…</option>
                    {WIDGET_ORDER.map((type) => (
                      <option key={type} value={type}>{WIDGET_LABELS[type]}</option>
                    ))}
                  </select>
                  {widget && (
                    <button
                      type="button"
                      onClick={() => onSelectWidget(widget.id)}
                      className={`flex h-8 items-center gap-1 rounded-lg border px-2 text-xs font-semibold transition ${
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-white/15 bg-white/10 text-white hover:bg-white/20"
                      }`}
                    >
                      <Settings2 className="h-3.5 w-3.5" /> Settings
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
