import { useEffect, useMemo, useState } from "react";
import {
  differenceInCalendarDays, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth,
  isToday, parseISO, startOfMonth, startOfWeek,
} from "date-fns";
import {
  CalendarDays, CheckCircle2, Circle, Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow,
  CornerDownRight, ListChecks, Moon, Sun, Timer,
} from "lucide-react";
import type { CalendarEvent, Task } from "@/types/app";
import type { DisplayPage, DisplayWidgetLayout, PhotoFrameSettings } from "@/hooks/useDeviceSettings";
import { displayTheme } from "@/lib/displayPages";
import type { RemoteDisplayPhoto } from "@/hooks/useRemoteDisplayPhotos";
import { visibleDisplayPhotos } from "@/lib/displayPhotos";
import { PhotoFrameScene } from "@/components/display/PhotoFrameScene";
import { DisplayBackdrop } from "@/components/display/DisplayBackdrop";
import { useDisplayWeather } from "@/hooks/useDisplayWeather";

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/**
 * Wall displays have no scrollbar and often no touchscreen, so a list longer
 * than its box moves on by itself instead of silently hiding the rest.
 */
function useCyclingChunk<T>(items: T[], perPage: number, seconds: number) {
  const size = Math.max(1, perPage);
  const pages = Math.max(1, Math.ceil(items.length / size));
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (pages < 2) {
      setIndex(0);
      return;
    }
    const timer = setInterval(() => setIndex((current) => (current + 1) % pages), Math.max(5, seconds) * 1000);
    return () => clearInterval(timer);
  }, [pages, seconds]);

  const safeIndex = index % pages;
  return {
    visible: items.slice(safeIndex * size, safeIndex * size + size),
    pages,
    index: safeIndex,
  };
}

function PageDots({ pages, index, accent }: { pages: number; index: number; accent: string }) {
  if (pages < 2) return null;
  return (
    <div className="mt-[0.8vmin] flex shrink-0 justify-center gap-[0.6vmin]">
      {Array.from({ length: pages }, (_, dot) => (
        <span
          key={dot}
          className="h-[0.5vmin] w-[0.5vmin] min-h-[3px] min-w-[3px] rounded-full transition-all"
          style={{ backgroundColor: dot === index ? accent : "rgba(255,255,255,.22)" }}
        />
      ))}
    </div>
  );
}

function WidgetHeading({ icon, title, accent }: { icon: React.ReactNode; title: string; accent: string }) {
  return (
    <div className="mb-[1.2vmin] flex shrink-0 items-center gap-[1vmin]" style={{ color: accent }}>
      {icon}
      <h2 className="truncate font-display font-bold text-white" style={{ fontSize: "clamp(13px, 2.3vmin, 30px)" }}>
        {title}
      </h2>
    </div>
  );
}

function WidgetClock({ widget, accent }: { widget: DisplayWidgetLayout; accent: string }) {
  const now = useNow(1000);
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

function matchesCategories(categories: string[] | undefined, event: CalendarEvent) {
  return !categories?.length || categories.includes(event.category);
}

function eventsByDay(events: CalendarEvent[], categories: string[] | undefined) {
  const map = new Map<string, CalendarEvent[]>();
  events.filter((event) => matchesCategories(categories, event)).forEach((event) => {
    const key = event.startDate.slice(0, 10);
    map.set(key, [...(map.get(key) || []), event]);
  });
  return map;
}

function DayEvents({ events, style, colour }: { events: CalendarEvent[]; style: string; colour: string }) {
  if (events.length === 0) return null;
  if (style === "dots") {
    return (
      <div className="mt-auto flex flex-wrap items-end gap-[0.4vmin]">
        {events.slice(0, 6).map((event) => (
          <span key={event.id} className="h-[1vmin] w-[1vmin] min-h-[5px] min-w-[5px] rounded-full" style={{ backgroundColor: colour }} />
        ))}
      </div>
    );
  }
  if (style === "compact") {
    return (
      <p className="mt-auto font-bold" style={{ color: colour, fontSize: "clamp(.5rem,1vw,.9rem)" }}>
        {events.length} {events.length === 1 ? "event" : "events"}
      </p>
    );
  }
  return (
    <div className="mt-[0.3vmin] min-h-0 flex-1 space-y-[0.3vmin] overflow-hidden">
      {events.slice(0, 3).map((event) => (
        <p
          key={event.id}
          className="truncate rounded-[0.6vmin] px-[0.5vmin] leading-tight text-white/95"
          style={{ backgroundColor: `${colour}44`, fontSize: "clamp(.45rem,.85vw,.8rem)" }}
        >
          {!event.allDay && `${format(parseISO(event.startDate), "HH:mm")} `}{event.title}
        </p>
      ))}
      {events.length > 3 && (
        <p className="text-white/45" style={{ fontSize: "clamp(.4rem,.8vw,.7rem)" }}>+{events.length - 3} more</p>
      )}
    </div>
  );
}

function MonthCalendarWidget({ widget, events, accent }: { widget: DisplayWidgetLayout; events: CalendarEvent[]; accent: string }) {
  const today = useNow(60_000);
  const monthKey = format(today, "yyyy-MM");
  const categories = widget.calendarCategories;
  const colour = widget.eventColor || accent;
  const style = widget.calendarEventStyle || "titles";

  const days = useMemo(() => {
    const anchor = parseISO(`${monthKey}-01`);
    return eachDayOfInterval({
      start: startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }),
    });
  }, [monthKey]);
  const byDay = useMemo(() => eventsByDay(events, categories), [events, categories]);

  return (
    <div className="flex h-full flex-col p-[1.5vmin] text-white">
      <div className="mb-[1vmin] flex shrink-0 items-baseline gap-[1.5vmin]">
        <h2 className="font-display font-bold" style={{ fontSize: "clamp(1rem,2.6vw,2.25rem)" }}>
          {widget.title || format(today, "MMMM yyyy")}
        </h2>
        <p className="text-white/55" style={{ fontSize: "clamp(.6rem,1.2vw,1rem)" }}>{format(today, "EEEE d MMMM")}</p>
      </div>
      <div className="grid shrink-0 grid-cols-7 gap-[0.6vmin] pb-[0.6vmin]">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
          <p key={label} className="text-center font-bold uppercase tracking-wider text-white/45" style={{ fontSize: "clamp(.5rem,1vw,.85rem)" }}>
            {label}
          </p>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 gap-[0.6vmin]" style={{ gridTemplateRows: `repeat(${days.length / 7}, minmax(0, 1fr))` }}>
        {days.map((day) => {
          const dayEvents = byDay.get(format(day, "yyyy-MM-dd")) || [];
          const current = isSameMonth(day, today);
          const now = isSameDay(day, today);
          return (
            <div
              key={day.toISOString()}
              className={`flex min-h-0 flex-col overflow-hidden rounded-[1vmin] p-[0.7vmin] ${
                now ? "bg-white/[.16] ring-1 ring-white/40" : current ? "bg-white/[.06]" : "bg-white/[.02]"
              }`}
            >
              <p className={`font-bold ${current ? "text-white/85" : "text-white/30"}`} style={{ fontSize: "clamp(.55rem,1.1vw,1rem)" }}>
                {format(day, "d")}
              </p>
              <DayEvents events={dayEvents} style={style} colour={colour} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekCalendarWidget({ widget, events, accent }: { widget: DisplayWidgetLayout; events: CalendarEvent[]; accent: string }) {
  const today = useNow(60_000);
  const categories = widget.calendarCategories;
  const colour = widget.eventColor || accent;
  const style = widget.calendarEventStyle || "titles";
  const weekKey = format(today, "yyyy-ww");
  const days = useMemo(() => {
    const anchor = new Date(today);
    return eachDayOfInterval({
      start: startOfWeek(anchor, { weekStartsOn: 1 }),
      end: endOfWeek(anchor, { weekStartsOn: 1 }),
    });
    // Recalculated once a week rather than on every clock tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKey]);
  const byDay = useMemo(() => eventsByDay(events, categories), [events, categories]);

  return (
    <div className="flex h-full flex-col p-[1.5vmin] text-white">
      <WidgetHeading
        icon={<CalendarDays style={{ width: "2.4vmin", height: "2.4vmin", minWidth: 16, minHeight: 16 }} />}
        title={widget.title || "This week"}
        accent={accent}
      />
      <div className="grid min-h-0 flex-1 grid-cols-7 gap-[0.6vmin]">
        {days.map((day) => {
          const dayEvents = byDay.get(format(day, "yyyy-MM-dd")) || [];
          return (
            <div
              key={day.toISOString()}
              className={`flex min-h-0 flex-col overflow-hidden rounded-[1vmin] p-[0.8vmin] ${isToday(day) ? "bg-white/[.16] ring-1 ring-white/40" : "bg-white/[.05]"}`}
            >
              <p className="shrink-0 font-bold uppercase tracking-wide text-white/50" style={{ fontSize: "clamp(.45rem,.9vw,.8rem)" }}>
                {format(day, "EEE")}
              </p>
              <p className="shrink-0 font-bold text-white/90" style={{ fontSize: "clamp(.7rem,1.5vw,1.4rem)" }}>{format(day, "d")}</p>
              <DayEvents events={dayEvents} style={style} colour={colour} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgendaCalendarWidget({ widget, events, accent }: { widget: DisplayWidgetLayout; events: CalendarEvent[]; accent: string }) {
  const categories = widget.calendarCategories;
  const colour = widget.eventColor || accent;
  const daysAhead = widget.calendarDaysAhead || 14;
  const visible = useMemo(() => {
    const now = Date.now();
    const limit = now + daysAhead * 86_400_000;
    return events
      .filter((event) => {
        const start = new Date(event.startDate).getTime();
        return matchesCategories(categories, event) && start >= now - 86_400_000 && start <= limit;
      })
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [events, categories, daysAhead]);
  const { visible: page, pages, index } = useCyclingChunk(visible, 8, widget.autoCycleSeconds || 20);

  return (
    <div className="flex h-full flex-col p-[1.5vmin] text-white">
      <WidgetHeading
        icon={<CalendarDays style={{ width: "2.4vmin", height: "2.4vmin", minWidth: 16, minHeight: 16 }} />}
        title={widget.title || "Coming up"}
        accent={accent}
      />
      <div className="min-h-0 flex-1 space-y-[0.8vmin] overflow-hidden">
        {page.length === 0 && <p className="text-white/45" style={{ fontSize: "clamp(.7rem,1.4vw,1.1rem)" }}>Nothing coming up.</p>}
        {page.map((event) => {
          const start = parseISO(event.startDate);
          return (
            <div key={event.id} className="flex items-start gap-[1vmin] rounded-[1vmin] bg-white/[.07] px-[1.2vmin] py-[0.8vmin]">
              <span className="mt-[0.6vmin] h-[1vmin] w-[1vmin] min-h-[6px] min-w-[6px] shrink-0 rounded-full" style={{ backgroundColor: colour }} />
              <div className="min-w-0">
                <p className="truncate font-semibold" style={{ fontSize: "clamp(.7rem,1.5vw,1.3rem)" }}>{event.title}</p>
                <p className="text-white/55" style={{ fontSize: "clamp(.55rem,1.1vw,1rem)" }}>
                  {isToday(start) ? "Today" : format(start, "EEE d MMM")}
                  {!event.allDay ? ` · ${format(start, "HH:mm")}` : " · All day"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <PageDots pages={pages} index={index} accent={accent} />
    </div>
  );
}

interface TaskRow {
  key: string;
  title: string;
  done: boolean;
  child: boolean;
  meta: string;
}

function taskRows(tasks: Task[], widget: DisplayWidgetLayout): TaskRow[] {
  const mode = widget.subtaskMode || "open";
  const chosen = tasks.filter((task) => {
    if (widget.taskIds?.length && (!task.id || !widget.taskIds.includes(task.id))) return false;
    if (widget.taskFilter === "today") return task.isToday && task.status !== "done";
    if (widget.taskFilter === "all") return true;
    return task.status !== "done";
  });

  return chosen.flatMap((task) => {
    const subtasks = task.subtasks || [];
    const outstanding = subtasks.filter((subtask) => !subtask.done);
    const done = subtasks.length - outstanding.length;
    const parent: TaskRow = {
      key: task.id || task.title,
      title: task.title,
      done: task.status === "done",
      child: false,
      // A parent used as a heading looks finished unless its progress shows.
      meta: subtasks.length > 0
        ? `${done} of ${subtasks.length} done`
        : [task.dueDate, task.category].filter(Boolean).join(" · "),
    };
    if (mode === "hide" || subtasks.length === 0) return [parent];
    const shown = mode === "all" ? subtasks : outstanding;
    return [
      parent,
      ...shown.map((subtask) => ({
        key: `${task.id}-${subtask.id}`,
        title: subtask.title,
        done: !!subtask.done,
        child: true,
        meta: subtask.dueDate || "",
      })),
    ];
  });
}

function TasksWidget({ widget, tasks, accent }: { widget: DisplayWidgetLayout; tasks: Task[]; accent: string }) {
  const rows = useMemo(() => taskRows(tasks, widget), [tasks, widget]);
  const { visible, pages, index } = useCyclingChunk(rows, widget.taskLimit || 8, widget.autoCycleSeconds || 20);

  return (
    <div className="flex h-full flex-col p-[1.5vmin] text-white">
      <WidgetHeading
        icon={<ListChecks style={{ width: "2.4vmin", height: "2.4vmin", minWidth: 16, minHeight: 16 }} />}
        title={widget.title || "To do"}
        accent={accent}
      />
      <div className="min-h-0 flex-1 space-y-[0.6vmin] overflow-hidden">
        {visible.length === 0 && <p className="text-white/45" style={{ fontSize: "clamp(.7rem,1.4vw,1.1rem)" }}>Nothing to do.</p>}
        {visible.map((row) => (
          <div
            key={row.key}
            className={`flex items-center gap-[1vmin] rounded-[1vmin] px-[1.2vmin] py-[0.7vmin] ${row.child ? "bg-white/[.035]" : "bg-white/[.09]"}`}
            style={row.child ? { marginLeft: "2.4vmin" } : undefined}
          >
            {row.child
              ? <CornerDownRight className="shrink-0 text-white/30" style={{ width: "1.6vmin", height: "1.6vmin", minWidth: 11, minHeight: 11 }} />
              : row.done
                ? <CheckCircle2 className="shrink-0 text-emerald-400" style={{ width: "2vmin", height: "2vmin", minWidth: 13, minHeight: 13 }} />
                : <Circle className="shrink-0" style={{ width: "2vmin", height: "2vmin", minWidth: 13, minHeight: 13, color: accent }} />}
            <div className="min-w-0 flex-1">
              <p
                className={`truncate ${row.child ? "font-medium text-white/80" : "font-semibold"} ${row.done ? "text-white/40 line-through" : ""}`}
                style={{ fontSize: row.child ? "clamp(.6rem,1.25vw,1.05rem)" : "clamp(.7rem,1.5vw,1.25rem)" }}
              >
                {row.title}
              </p>
              {row.meta && (
                <p className="truncate text-white/45" style={{ fontSize: "clamp(.5rem,1vw,.85rem)" }}>{row.meta}</p>
              )}
            </div>
          </div>
        ))}
      </div>
      <PageDots pages={pages} index={index} accent={accent} />
    </div>
  );
}

function TodayWidget({
  widget, events, tasks, accent,
}: { widget: DisplayWidgetLayout; events: CalendarEvent[]; tasks: Task[]; accent: string }) {
  const now = useNow(30_000);
  const dayKey = format(now, "yyyy-MM-dd");
  const categories = widget.calendarCategories;
  const colour = widget.eventColor || accent;

  const upcoming = useMemo(() => {
    const from = parseISO(dayKey).getTime();
    return events
      .filter((event) => matchesCategories(categories, event) && new Date(event.startDate).getTime() >= from)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .slice(0, 5);
  }, [events, categories, dayKey]);

  const rows = useMemo(() => taskRows(tasks, widget), [tasks, widget]);
  const { visible, pages, index } = useCyclingChunk(rows, widget.taskLimit || 6, widget.autoCycleSeconds || 20);

  return (
    <div className="flex h-full flex-col gap-[1.5vmin] p-[2vmin] text-white">
      <div className="shrink-0">
        <p className="font-display font-bold leading-none tabular-nums" style={{ color: accent, fontSize: "clamp(1.75rem,6vw,5rem)" }}>
          {format(now, widget.format24h === false ? "h:mm a" : "HH:mm")}
        </p>
        <p className="mt-[0.5vmin] font-medium text-white/70" style={{ fontSize: "clamp(.75rem,2vw,1.75rem)" }}>
          {format(now, "EEEE d MMMM")}
        </p>
      </div>
      <div className="grid min-h-0 flex-1 gap-[1.5vmin] sm:grid-cols-2">
        <div className="flex min-h-0 flex-col">
          <p className="mb-[0.8vmin] flex shrink-0 items-center gap-[0.8vmin] font-bold uppercase tracking-wider text-white/50" style={{ fontSize: "clamp(.6rem,1.3vw,1.1rem)" }}>
            <CalendarDays style={{ width: "1.8vmin", height: "1.8vmin", minWidth: 12, minHeight: 12 }} /> What’s on
          </p>
          <div className="min-h-0 flex-1 space-y-[0.7vmin] overflow-hidden">
            {upcoming.length === 0 && <p className="text-white/40" style={{ fontSize: "clamp(.65rem,1.3vw,1.1rem)" }}>Nothing coming up.</p>}
            {upcoming.map((event) => {
              const start = parseISO(event.startDate);
              return (
                <div key={event.id} className="flex items-start gap-[0.8vmin] rounded-[1vmin] bg-white/[.07] px-[1.2vmin] py-[0.8vmin]">
                  <span className="mt-[0.7vmin] h-[0.9vmin] w-[0.9vmin] min-h-[5px] min-w-[5px] shrink-0 rounded-full" style={{ backgroundColor: colour }} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold" style={{ fontSize: "clamp(.7rem,1.5vw,1.25rem)" }}>{event.title}</p>
                    <p className="text-white/55" style={{ fontSize: "clamp(.55rem,1.1vw,.95rem)" }}>
                      {isToday(start) ? "Today" : format(start, "EEE d MMM")}{event.allDay ? " · All day" : ` · ${format(start, "HH:mm")}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex min-h-0 flex-col">
          <p className="mb-[0.8vmin] flex shrink-0 items-center gap-[0.8vmin] font-bold uppercase tracking-wider text-white/50" style={{ fontSize: "clamp(.6rem,1.3vw,1.1rem)" }}>
            <ListChecks style={{ width: "1.8vmin", height: "1.8vmin", minWidth: 12, minHeight: 12 }} /> To do
          </p>
          <div className="min-h-0 flex-1 space-y-[0.6vmin] overflow-hidden">
            {visible.length === 0 && <p className="text-white/40" style={{ fontSize: "clamp(.65rem,1.3vw,1.1rem)" }}>All clear.</p>}
            {visible.map((row) => (
              <div
                key={row.key}
                className={`flex items-center gap-[0.8vmin] rounded-[1vmin] px-[1.2vmin] py-[0.6vmin] ${row.child ? "bg-white/[.035]" : "bg-white/[.08]"}`}
                style={row.child ? { marginLeft: "2vmin" } : undefined}
              >
                {row.child
                  ? <CornerDownRight className="shrink-0 text-white/30" style={{ width: "1.4vmin", height: "1.4vmin", minWidth: 10, minHeight: 10 }} />
                  : <Circle className="shrink-0" style={{ width: "1.6vmin", height: "1.6vmin", minWidth: 11, minHeight: 11, color: accent }} />}
                <div className="min-w-0 flex-1">
                  <p className={`truncate ${row.child ? "text-white/80" : "font-medium"}`} style={{ fontSize: row.child ? "clamp(.6rem,1.2vw,1rem)" : "clamp(.7rem,1.45vw,1.2rem)" }}>
                    {row.title}
                  </p>
                  {row.meta && !row.child && (
                    <p className="truncate text-white/45" style={{ fontSize: "clamp(.5rem,.95vw,.8rem)" }}>{row.meta}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <PageDots pages={pages} index={index} accent={accent} />
        </div>
      </div>
    </div>
  );
}

function weatherIcon(code: number, isDay: boolean) {
  if ([71, 73, 75, 77, 85, 86].includes(code)) return CloudSnow;
  if ([95, 96, 99].includes(code)) return CloudLightning;
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return CloudRain;
  if ([45, 48].includes(code)) return CloudFog;
  if (code === 3) return Cloud;
  return isDay ? Sun : Moon;
}

function WeatherWidget({ widget, accent }: { widget: DisplayWidgetLayout; accent: string }) {
  const { weather, failed } = useDisplayWeather(widget.weatherLatitude, widget.weatherLongitude);
  const Icon = weather ? weatherIcon(weather.code, weather.isDay) : Cloud;

  if (!weather) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-[1vmin] p-[2vmin] text-center text-white/45">
        <Cloud style={{ width: "6vmin", height: "6vmin", minWidth: 24, minHeight: 24 }} />
        <p style={{ fontSize: "clamp(.65rem,1.3vw,1.1rem)" }}>
          {failed ? "Choose a location for this widget in Remote Displays." : "Checking the forecast…"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col justify-center p-[2vmin] text-white">
      <div className="flex items-center gap-[2vmin]">
        <Icon style={{ width: "9vmin", height: "9vmin", minWidth: 34, minHeight: 34, color: accent }} />
        <div className="min-w-0">
          <p className="font-display font-bold leading-none tabular-nums" style={{ fontSize: "clamp(1.75rem,5.5vw,4.5rem)" }}>
            {weather.temperature}°
          </p>
          <p className="truncate font-medium text-white/70" style={{ fontSize: "clamp(.7rem,1.6vw,1.4rem)" }}>{weather.description}</p>
        </div>
      </div>
      <p className="mt-[1.2vmin] text-white/50" style={{ fontSize: "clamp(.6rem,1.2vw,1.1rem)" }}>
        High {weather.high}° · Low {weather.low}°{widget.weatherPlace ? ` · ${widget.weatherPlace}` : ""}
      </p>
    </div>
  );
}

function MessageWidget({ widget, accent }: { widget: DisplayWidgetLayout; accent: string }) {
  const text = (widget.message || "").trim();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-[1.5vmin] p-[2.5vmin] text-center">
      {widget.title && (
        <p className="font-bold uppercase tracking-[0.2em]" style={{ color: accent, fontSize: "clamp(.6rem,1.2vw,1.1rem)" }}>
          {widget.title}
        </p>
      )}
      <p
        className="font-display font-bold leading-tight text-white"
        style={{ fontSize: text.length > 90 ? "clamp(.85rem,2.2vw,2rem)" : "clamp(1.1rem,3.4vw,3.5rem)" }}
      >
        {text || "Add a message in Remote Displays."}
      </p>
    </div>
  );
}

function CountdownWidget({ widget, accent }: { widget: DisplayWidgetLayout; accent: string }) {
  const now = useNow(60_000);
  const target = widget.countdownTo ? parseISO(widget.countdownTo) : null;
  const days = target && !Number.isNaN(target.getTime()) ? differenceInCalendarDays(target, now) : null;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-[1vmin] p-[2vmin] text-center text-white">
      <Timer style={{ width: "4vmin", height: "4vmin", minWidth: 18, minHeight: 18, color: accent }} />
      {days === null ? (
        <p className="text-white/45" style={{ fontSize: "clamp(.65rem,1.3vw,1.1rem)" }}>Pick a date in Remote Displays.</p>
      ) : (
        <>
          <p className="font-display font-bold leading-none tabular-nums" style={{ color: accent, fontSize: "clamp(2rem,7vw,6rem)" }}>
            {Math.abs(days)}
          </p>
          <p className="font-semibold" style={{ fontSize: "clamp(.75rem,1.8vw,1.6rem)" }}>
            {days === 0 ? "Today" : days > 0 ? `day${days === 1 ? "" : "s"} to go` : `day${days === -1 ? "" : "s"} ago`}
          </p>
          <p className="text-white/60" style={{ fontSize: "clamp(.6rem,1.3vw,1.2rem)" }}>
            {widget.countdownLabel || (target ? format(target, "EEEE d MMMM") : "")}
          </p>
        </>
      )}
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
  const theme = displayTheme(page);

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ backgroundColor: theme.background }}>
      <DisplayBackdrop kind={page.backdrop} accent={theme.accent} />
      {page.widgets.map((widget) => {
        const accent = widget.accentColor || theme.accent;
        const selectedPhotos = visibleDisplayPhotos(
          widget.photoIds?.length ? photos.filter((photo) => widget.photoIds!.includes(photo.id)) : photos,
        );
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
            className="absolute overflow-hidden rounded-[clamp(.75rem,1.5vw,1.5rem)] border border-white/10 shadow-2xl"
            style={{
              left: `${(widget.x / 12) * 100}%`,
              top: `${(widget.y / 12) * 100}%`,
              width: `${(widget.w / 12) * 100}%`,
              height: `${(widget.h / 12) * 100}%`,
              backgroundColor: theme.panel,
            }}
          >
            {widget.type === "clock" && <WidgetClock widget={widget} accent={accent} />}
            {widget.type === "photos" && (
              selectedPhotos.length > 0
                ? <PhotoFrameScene photos={selectedPhotos} settings={photoSettings} />
                : <div className="flex h-full items-center justify-center p-4 text-center text-sm text-white/45">Add photos from Remote Displays.</div>
            )}
            {widget.type === "calendar" && (
              widget.calendarView === "agenda" ? <AgendaCalendarWidget widget={widget} events={calendarEvents} accent={accent} />
                : widget.calendarView === "week" ? <WeekCalendarWidget widget={widget} events={calendarEvents} accent={accent} />
                  : <MonthCalendarWidget widget={widget} events={calendarEvents} accent={accent} />
            )}
            {widget.type === "tasks" && <TasksWidget widget={widget} tasks={tasks} accent={accent} />}
            {widget.type === "today" && <TodayWidget widget={widget} events={calendarEvents} tasks={tasks} accent={accent} />}
            {widget.type === "weather" && <WeatherWidget widget={widget} accent={accent} />}
            {widget.type === "message" && <MessageWidget widget={widget} accent={accent} />}
            {widget.type === "countdown" && <CountdownWidget widget={widget} accent={accent} />}
          </div>
        );
      })}
    </div>
  );
}
