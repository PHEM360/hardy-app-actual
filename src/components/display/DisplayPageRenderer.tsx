import { useEffect, useMemo, useState } from "react";
import { format, isToday, parseISO } from "date-fns";
import { CalendarDays, CheckCircle2, Circle, ListChecks } from "lucide-react";
import type { CalendarEvent, Task } from "@/types/app";
import type { DisplayPage, DisplayWidgetLayout, PhotoFrameSettings } from "@/hooks/useDeviceSettings";
import type { RemoteDisplayPhoto } from "@/hooks/useRemoteDisplayPhotos";
import { PhotoFrameScene } from "@/components/display/PhotoFrameScene";

function WidgetClock({ widget }: { widget: DisplayWidgetLayout }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const accent = widget.accentColor || "#7dd3fc";
  if (widget.clockStyle === "analog") {
    const hours = now.getHours() % 12;
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    return (
      <div className="flex h-full flex-col items-center justify-center p-3">
        <svg viewBox="0 0 200 200" className="min-h-0 max-h-[78%] max-w-full flex-1">
          <circle cx="100" cy="100" r="94" fill="rgba(255,255,255,.035)" stroke="rgba(255,255,255,.25)" strokeWidth="3" />
          {Array.from({ length: 12 }, (_, index) => {
            const angle = index * Math.PI / 6;
            return <line key={index} x1={100 + 78 * Math.sin(angle)} y1={100 - 78 * Math.cos(angle)} x2={100 + 88 * Math.sin(angle)} y2={100 - 88 * Math.cos(angle)} stroke="rgba(255,255,255,.55)" strokeWidth="3" strokeLinecap="round" />;
          })}
          <line x1="100" y1="100" x2={100 + 48 * Math.sin((hours * 30 + minutes * .5) * Math.PI / 180)} y2={100 - 48 * Math.cos((hours * 30 + minutes * .5) * Math.PI / 180)} stroke="white" strokeWidth="7" strokeLinecap="round" />
          <line x1="100" y1="100" x2={100 + 70 * Math.sin(minutes * 6 * Math.PI / 180)} y2={100 - 70 * Math.cos(minutes * 6 * Math.PI / 180)} stroke="white" strokeWidth="4" strokeLinecap="round" />
          {widget.showSeconds && <line x1="100" y1="100" x2={100 + 76 * Math.sin(seconds * 6 * Math.PI / 180)} y2={100 - 76 * Math.cos(seconds * 6 * Math.PI / 180)} stroke={accent} strokeWidth="2" />}
          <circle cx="100" cy="100" r="5" fill={accent} />
        </svg>
        {widget.showDate !== false && <p className="mt-2 text-[clamp(.65rem,1.5vw,1.25rem)] font-medium text-white/70">{format(now, "EEEE d MMMM")}</p>}
      </div>
    );
  }
  const time = widget.format24h === false
    ? format(now, widget.showSeconds ? "h:mm:ss a" : "h:mm a")
    : format(now, widget.showSeconds ? "HH:mm:ss" : "HH:mm");
  return (
    <div className="flex h-full flex-col items-center justify-center p-3 text-center">
      <p className="font-display text-[clamp(2rem,9vw,8rem)] font-bold leading-none tabular-nums" style={{ color: accent }}>
        {time}
      </p>
      {widget.showDate !== false && <p className="mt-2 text-[clamp(.7rem,1.8vw,1.5rem)] font-medium text-white/70">{format(now, "EEEE d MMMM")}</p>}
    </div>
  );
}

function CalendarWidget({ widget, events }: { widget: DisplayWidgetLayout; events: CalendarEvent[] }) {
  const visible = useMemo(() => {
    const now = Date.now();
    const limit = now + (widget.calendarDaysAhead || 14) * 86_400_000;
    return events
      .filter((event) => {
        const start = new Date(event.startDate).getTime();
        const categoryMatches = !widget.calendarCategories?.length || widget.calendarCategories.includes(event.category);
        return categoryMatches && start >= now - 86_400_000 && start <= limit;
      })
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .slice(0, 8);
  }, [events, widget.calendarDaysAhead, widget.calendarCategories]);
  return (
    <div className="flex h-full flex-col p-4 text-white">
      <div className="mb-3 flex items-center gap-2">
        <CalendarDays className="h-5 w-5" style={{ color: widget.accentColor }} />
        <h2 className="truncate font-display text-lg font-bold">{widget.title || "Calendar"}</h2>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-hidden">
        {visible.length === 0 && <p className="text-sm text-white/45">Nothing coming up.</p>}
        {visible.map((event) => {
          const start = parseISO(event.startDate);
          return (
            <div key={event.id} className="flex items-start gap-2 rounded-xl bg-white/[.07] px-3 py-2">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: widget.accentColor }} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{event.title}</p>
                <p className="text-[11px] text-white/55">
                  {isToday(start) ? "Today" : format(start, "EEE d MMM")}
                  {!event.allDay ? ` · ${format(start, "HH:mm")}` : " · All day"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TasksWidget({ widget, tasks }: { widget: DisplayWidgetLayout; tasks: Task[] }) {
  const visible = tasks
    .filter((task) => {
      if (widget.taskIds?.length && (!task.id || !widget.taskIds.includes(task.id))) return false;
      if (widget.taskFilter === "today") return task.isToday && task.status !== "done";
      if (widget.taskFilter === "all") return true;
      return task.status !== "done";
    })
    .slice(0, widget.taskLimit || 8);
  return (
    <div className="flex h-full flex-col p-4 text-white">
      <div className="mb-3 flex items-center gap-2">
        <ListChecks className="h-5 w-5" style={{ color: widget.accentColor }} />
        <h2 className="truncate font-display text-lg font-bold">{widget.title || "Tasks"}</h2>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-hidden">
        {visible.length === 0 && <p className="text-sm text-white/45">Nothing to do.</p>}
        {visible.map((task) => (
          <div key={task.id} className="flex items-center gap-2 rounded-xl bg-white/[.07] px-3 py-2">
            {task.status === "done" ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" /> : <Circle className="h-4 w-4 shrink-0" style={{ color: widget.accentColor }} />}
            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm font-medium ${task.status === "done" ? "text-white/45 line-through" : ""}`}>{task.title}</p>
              {(task.dueDate || task.category) && <p className="truncate text-[10px] text-white/45">{task.dueDate || task.category}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DisplayPageRenderer({
  page,
  photos,
  calendarEvents,
  tasks,
}: {
  page: DisplayPage;
  photos: RemoteDisplayPhoto[];
  calendarEvents: CalendarEvent[];
  tasks: Task[];
}) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ backgroundColor: page.background }}>
      {page.widgets.map((widget) => {
        const selectedPhotos = widget.photoIds?.length ? photos.filter((photo) => widget.photoIds!.includes(photo.id)) : photos;
        const photoSettings: PhotoFrameSettings = {
          enabled: true,
          intervalSeconds: widget.photoIntervalSeconds || 20,
          shuffle: true,
          showCaptions: true,
          photoIds: widget.photoIds || [],
        };
        return (
          <div
            key={widget.id}
            className="absolute overflow-hidden rounded-[clamp(.75rem,1.5vw,1.5rem)] border border-white/10 bg-white/[.055] shadow-2xl"
            style={{
              left: `${(widget.x / 12) * 100}%`,
              top: `${(widget.y / 12) * 100}%`,
              width: `${(widget.w / 12) * 100}%`,
              height: `${(widget.h / 12) * 100}%`,
            }}
          >
            {widget.type === "clock" && <WidgetClock widget={widget} />}
            {widget.type === "photos" && (
              selectedPhotos.length > 0
                ? <PhotoFrameScene photos={selectedPhotos} settings={photoSettings} />
                : <div className="flex h-full items-center justify-center p-4 text-center text-sm text-white/45">Add photos from Remote Displays.</div>
            )}
            {widget.type === "calendar" && <CalendarWidget widget={widget} events={calendarEvents} />}
            {widget.type === "tasks" && <TasksWidget widget={widget} tasks={tasks} />}
          </div>
        );
      })}
    </div>
  );
}
