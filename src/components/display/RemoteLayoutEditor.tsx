import { useEffect, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import { CalendarDays, Clock3, Image, ListChecks, Plus, Trash2 } from "lucide-react";
import type { DisplayPage, DisplayWidgetLayout, DisplayWidgetType } from "@/hooks/useDeviceSettings";
import { Button } from "@/components/ui/button";

const ICONS: Record<DisplayWidgetType, typeof Clock3> = {
  clock: Clock3,
  photos: Image,
  calendar: CalendarDays,
  tasks: ListChecks,
};

const LABELS: Record<DisplayWidgetType, string> = {
  clock: "Alarm clock",
  photos: "Photo frame",
  calendar: "Calendar",
  tasks: "Task summary",
};

function id() {
  return crypto.randomUUID();
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
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 720, height: 450 });

  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      setSize({ width, height: Math.max(320, width * 0.625) });
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const col = size.width / 12;
  const row = size.height / 12;

  const updateWidget = (widgetId: string, patch: Partial<DisplayWidgetLayout>) => {
    onChange({ ...page, widgets: page.widgets.map((widget) => widget.id === widgetId ? { ...widget, ...patch } : widget) });
  };

  const addWidget = (type: DisplayWidgetType) => {
    const offset = page.widgets.length % 6;
    const widget: DisplayWidgetLayout = {
      id: id(),
      type,
      x: (offset * 2) % 8,
      y: (offset * 2) % 8,
      w: type === "clock" || type === "photos" ? 6 : 5,
      h: type === "photos" ? 6 : 4,
      title: LABELS[type],
      accentColor: type === "clock" ? "#7dd3fc" : "#14b8a6",
      clockStyle: "digital",
      format24h: true,
      showSeconds: false,
      showDate: true,
      photoIds: [],
      photoIntervalSeconds: 20,
      calendarDaysAhead: 14,
      calendarCategories: [],
      taskFilter: "open",
      taskLimit: 8,
      taskIds: [],
    };
    onChange({ ...page, widgets: [...page.widgets, widget] });
    onSelectWidget(widget.id);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Add widget</span>
        {(Object.keys(LABELS) as DisplayWidgetType[]).map((type) => {
          const Icon = ICONS[type];
          return (
            <Button key={type} type="button" variant="outline" size="sm" className="h-8 rounded-xl" onClick={() => addWidget(type)}>
              <Icon className="mr-1.5 h-3.5 w-3.5" /> {LABELS[type]}
            </Button>
          );
        })}
      </div>

      <div
        ref={ref}
        className="relative w-full overflow-hidden rounded-2xl border-2 border-border bg-zinc-950 shadow-inner"
        style={{
          height: size.height,
          backgroundColor: page.background,
          backgroundImage: "linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px)",
          backgroundSize: `${col}px ${row}px`,
        }}
        onClick={() => onSelectWidget(null)}
      >
        {page.widgets.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white/35">
            <Plus className="h-8 w-8" />
            <p className="mt-2 text-sm">Add a widget to this page</p>
          </div>
        )}
        {page.widgets.map((widget) => {
          const Icon = ICONS[widget.type];
          const selected = widget.id === selectedWidgetId;
          return (
            <Rnd
              key={widget.id}
              bounds="parent"
              position={{ x: widget.x * col, y: widget.y * row }}
              size={{ width: widget.w * col, height: widget.h * row }}
              minWidth={2 * col}
              minHeight={2 * row}
              dragGrid={[col, row]}
              resizeGrid={[col, row]}
              onDragStop={(_event, data) => updateWidget(widget.id, {
                x: Math.max(0, Math.min(11, Math.round(data.x / col))),
                y: Math.max(0, Math.min(11, Math.round(data.y / row))),
              })}
              onResizeStop={(_event, _direction, element, _delta, position) => updateWidget(widget.id, {
                x: Math.max(0, Math.round(position.x / col)),
                y: Math.max(0, Math.round(position.y / row)),
                w: Math.max(2, Math.min(12, Math.round(element.offsetWidth / col))),
                h: Math.max(2, Math.min(12, Math.round(element.offsetHeight / row))),
              })}
              onClick={(event: MouseEvent) => {
                event.stopPropagation();
                onSelectWidget(widget.id);
              }}
              className={`group rounded-2xl border bg-card/95 shadow-card ${selected ? "border-primary ring-2 ring-primary" : "border-white/20"}`}
            >
              <div className="flex h-full flex-col items-center justify-center overflow-hidden p-3 text-center">
                <Icon className="h-6 w-6 text-primary" />
                <p className="mt-1 text-xs font-bold">{widget.title || LABELS[widget.type]}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{widget.w} × {widget.h}</p>
              </div>
              <button
                type="button"
                className="absolute right-1.5 top-1.5 rounded-lg bg-destructive p-1 text-destructive-foreground opacity-0 transition group-hover:opacity-100"
                onClick={(event) => {
                  event.stopPropagation();
                  onChange({ ...page, widgets: page.widgets.filter((item) => item.id !== widget.id) });
                  onSelectWidget(null);
                }}
                aria-label={`Remove ${LABELS[widget.type]}`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </Rnd>
          );
        })}
      </div>
    </div>
  );
}
