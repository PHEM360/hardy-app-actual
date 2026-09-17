import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  List,
  MapPin,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCalendar } from "@/hooks/useCalendar";
import { useSharedScope } from "@/hooks/useSharedScope";
import { allDayEventCoversDate, londonDateFromIso, londonDayEndIso, londonDayStartIso } from "@/lib/londonCalendarDate";
import type { CalendarEvent, CalendarEventCategory } from "@/types/app";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CATEGORIES: Array<{ id: CalendarEventCategory; label: string; dot: string }> = [
  { id: "personal", label: "Personal", dot: "#6366f1" },
  { id: "family", label: "Family", dot: "#f59e0b" },
  { id: "work", label: "Work", dot: "#3b82f6" },
  { id: "health", label: "Health", dot: "#10b981" },
  { id: "social", label: "Social", dot: "#ec4899" },
  { id: "birthday", label: "Birthday", dot: "#f43f5e" },
  { id: "other", label: "Other", dot: "#8b5cf6" },
];

type ViewMode = "month" | "week" | "agenda";
type Draft = {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  category: CalendarEventCategory;
  location: string;
  description: string;
};

const freshDraft = (day = new Date()): Draft => ({
  title: "",
  date: format(day, "yyyy-MM-dd"),
  startTime: "09:00",
  endTime: "10:00",
  allDay: false,
  category: "personal",
  location: "",
  description: "",
});

function categoryFor(event: CalendarEvent) {
  return CATEGORIES.find((item) => item.id === event.category) ?? CATEGORIES[CATEGORIES.length - 1];
}

function eventTime(event: CalendarEvent) {
  if (event.allDay) return "All day";
  return format(parseISO(event.startDate), "HH:mm");
}

export default function CalendarFocus() {
  const navigate = useNavigate();
  const { scopeUserId, permission, pageTitle } = useSharedScope("calendar");
  const canEdit = permission === "edit";
  const { events, addEvent, updateEvent, deleteEvent } = useCalendar(scopeUserId ?? undefined);
  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [draft, setDraft] = useState<Draft>(() => freshDraft());
  const [saving, setSaving] = useState(false);

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const weekDays = useMemo(
    () => eachDayOfInterval({
      start: startOfWeek(cursor, { weekStartsOn: 1 }),
      end: endOfWeek(cursor, { weekStartsOn: 1 }),
    }),
    [cursor],
  );

  const eventsForDay = (day: Date) => events
    .filter((event) => {
      if (event.allDay) return allDayEventCoversDate(event, day);
      const start = parseISO(event.startDate);
      const end = parseISO(event.endDate || event.startDate);
      const target = startOfDay(day).getTime();
      return target >= startOfDay(start).getTime() && target <= startOfDay(end).getTime();
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const selectedEvents = useMemo(() => eventsForDay(selectedDay), [events, selectedDay]);
  const upcoming = useMemo(() => events
    .filter((event) => parseISO(event.endDate || event.startDate).getTime() >= startOfDay(new Date()).getTime())
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 8), [events]);

  const openCreate = (day = selectedDay) => {
    if (!canEdit) return;
    setEditing(null);
    setDraft(freshDraft(day));
    setEditorOpen(true);
  };

  const openEdit = (event: CalendarEvent) => {
    if (!canEdit) return;
    setEditing(event);
    const date = event.allDay ? londonDateFromIso(event.startDate) : format(parseISO(event.startDate), "yyyy-MM-dd");
    setDraft({
      title: event.title,
      date,
      startTime: event.allDay ? "09:00" : format(parseISO(event.startDate), "HH:mm"),
      endTime: event.allDay ? "10:00" : format(parseISO(event.endDate || event.startDate), "HH:mm"),
      allDay: !!event.allDay,
      category: event.category || "other",
      location: event.location || "",
      description: event.description || "",
    });
    setEditorOpen(true);
  };

  const save = async () => {
    if (!draft.title.trim()) {
      toast.error("Give the event a title");
      return;
    }
    setSaving(true);
    try {
      const startDate = draft.allDay
        ? londonDayStartIso(draft.date)
        : new Date(`${draft.date}T${draft.startTime}:00`).toISOString();
      const endDate = draft.allDay
        ? londonDayEndIso(draft.date)
        : new Date(`${draft.date}T${draft.endTime}:00`).toISOString();
      const payload: Partial<CalendarEvent> = {
        title: draft.title.trim(),
        description: draft.description.trim(),
        location: draft.location.trim(),
        category: draft.category,
        startDate,
        endDate,
        allDay: draft.allDay,
      };
      if (editing?.id) await updateEvent(editing.id, payload);
      else await addEvent(payload as Omit<CalendarEvent, "id">);
      setEditorOpen(false);
      toast.success(editing ? "Event updated" : "Event added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the event");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing?.id) return;
    try {
      await deleteEvent(editing.id);
      setEditorOpen(false);
      toast.success("Event deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the event");
    }
  };

  const previous = () => setCursor((date) => view === "month" ? subMonths(date, 1) : subWeeks(date, 1));
  const next = () => setCursor((date) => view === "month" ? addMonths(date, 1) : addWeeks(date, 1));
  const goToday = () => {
    const today = new Date();
    setCursor(today);
    setSelectedDay(today);
  };

  const eventRow = (event: CalendarEvent, compact = false) => {
    const category = categoryFor(event);
    return (
      <button
        key={event.id || `${event.title}-${event.startDate}`}
        type="button"
        onClick={() => openEdit(event)}
        className={`group flex w-full min-w-0 items-center gap-2 rounded-xl text-left transition hover:bg-muted/65 ${compact ? "px-2 py-1.5" : "px-3 py-2.5"}`}
      >
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: category.dot }} />
        <span className="min-w-0 flex-1">
          <span className={`block truncate font-semibold text-foreground ${compact ? "text-[11px]" : "text-sm"}`}>{event.title}</span>
          {!compact && (
            <span className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
              <span className="shrink-0">{eventTime(event)}</span>
              {event.location && <span className="truncate">{event.location}</span>}
            </span>
          )}
        </span>
        {!compact && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition group-hover:translate-x-0.5" />}
      </button>
    );
  };

  return (
    <FeaturePageShell
      title={pageTitle}
      subtitle="A faster, calmer calendar view"
      icon={<CalendarDays className="h-5 w-5" />}
      sharePage="calendar"
      action={
        <div className="flex items-center gap-1.5">
          {canEdit && (
            <Button size="sm" className="rounded-xl bg-gradient-primary" onClick={() => openCreate()}>
              <Plus className="mr-1 h-4 w-4" /> New
            </Button>
          )}
          <Button size="icon" variant="ghost" aria-label="Calendar settings" onClick={() => navigate("/calendar")}>
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
      }
    >
      <div className="space-y-3 sm:space-y-4">
        <div className="sticky top-[3.35rem] z-20 -mx-1 rounded-2xl border border-border/45 bg-background/90 p-2 shadow-soft backdrop-blur-xl sm:static sm:mx-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1">
              <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl" onClick={previous}><ChevronLeft className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl" onClick={next}><ChevronRight className="h-4 w-4" /></Button>
              <button type="button" onClick={goToday} className="ml-1 rounded-xl px-2 py-1 text-left transition hover:bg-muted">
                <span className="block font-display text-base font-bold leading-tight sm:text-lg">
                  {view === "week" ? `Week of ${format(startOfWeek(cursor, { weekStartsOn: 1 }), "d MMM")}` : format(cursor, "MMMM yyyy")}
                </span>
                <span className="text-[11px] font-medium text-primary">Today</span>
              </button>
            </div>
            <div className="flex rounded-xl bg-muted/70 p-1">
              {([
                ["month", CalendarDays, "Month"],
                ["week", Clock3, "Week"],
                ["agenda", List, "Agenda"],
              ] as const).map(([id, Icon, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setView(id)}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${view === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Icon className="h-3.5 w-3.5" /> <span className="hidden xs:inline sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {view === "month" && (
          <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_19rem]">
            <section className="min-w-0 overflow-hidden rounded-2xl border border-border/50 bg-card shadow-card">
              <div className="grid grid-cols-7 border-b border-border/40 bg-muted/25">
                {DAYS.map((day, index) => (
                  <div key={day} className={`py-2 text-center text-[10px] font-bold uppercase tracking-wider ${index > 4 ? "text-primary/70" : "text-muted-foreground"}`}>{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthDays.map((day) => {
                  const dayEvents = eventsForDay(day);
                  const selected = isSameDay(day, selectedDay);
                  const today = isToday(day);
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => setSelectedDay(day)}
                      onDoubleClick={() => openCreate(day)}
                      className={`relative min-h-[3.65rem] min-w-0 border-b border-r border-border/30 p-1.5 text-left transition hover:bg-muted/35 sm:min-h-[7.8rem] sm:p-2 ${!isSameMonth(day, cursor) ? "bg-muted/15 text-muted-foreground/45" : ""} ${selected ? "bg-primary/[0.055]" : ""}`}
                    >
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold sm:h-7 sm:w-7 ${today ? "bg-primary text-primary-foreground shadow-sm" : selected ? "bg-primary/12 text-primary" : ""}`}>{format(day, "d")}</span>
                      <div className="mt-1 flex gap-0.5 sm:hidden">
                        {dayEvents.slice(0, 4).map((event) => <span key={event.id} className="h-1.5 w-1.5 rounded-full" style={{ background: categoryFor(event).dot }} />)}
                      </div>
                      <div className="mt-1 hidden space-y-0.5 sm:block">
                        {dayEvents.slice(0, 3).map((event) => eventRow(event, true))}
                        {dayEvents.length > 3 && <span className="block px-2 text-[10px] font-semibold text-muted-foreground">+{dayEvents.length - 3} more</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <aside className="space-y-3">
              <section className="rounded-2xl border border-border/50 bg-card p-3 shadow-card">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Selected day</p>
                    <h2 className="font-display text-lg font-bold">{isToday(selectedDay) ? "Today" : format(selectedDay, "EEEE")}</h2>
                    <p className="text-xs text-muted-foreground">{format(selectedDay, "d MMMM yyyy")}</p>
                  </div>
                  {canEdit && <Button size="icon" variant="outline" className="h-9 w-9 rounded-xl" onClick={() => openCreate(selectedDay)}><Plus className="h-4 w-4" /></Button>}
                </div>
                {selectedEvents.length ? <div className="space-y-0.5">{selectedEvents.map((event) => eventRow(event))}</div> : (
                  <button type="button" onClick={() => openCreate(selectedDay)} className="w-full rounded-xl border border-dashed border-border px-3 py-5 text-center text-sm text-muted-foreground transition hover:border-primary/40 hover:text-foreground">Nothing planned</button>
                )}
              </section>

              <section className="hidden rounded-2xl border border-border/50 bg-card p-3 shadow-card lg:block">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Up next</p>
                <div className="space-y-0.5">
                  {upcoming.slice(0, 5).map((event) => (
                    <div key={event.id}>
                      <p className="px-3 pt-1 text-[10px] font-semibold text-muted-foreground">{format(parseISO(event.startDate), "EEE d MMM")}</p>
                      {eventRow(event)}
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        )}

        {view === "week" && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
            {weekDays.map((day) => {
              const dayEvents = eventsForDay(day);
              return (
                <section key={day.toISOString()} className={`min-w-0 rounded-2xl border bg-card p-2.5 shadow-soft ${isToday(day) ? "border-primary/45" : "border-border/50"}`}>
                  <button type="button" onClick={() => { setSelectedDay(day); if (canEdit && !dayEvents.length) openCreate(day); }} className="mb-2 flex w-full items-center justify-between text-left">
                    <span>
                      <span className={`block text-[10px] font-bold uppercase tracking-wider ${isToday(day) ? "text-primary" : "text-muted-foreground"}`}>{format(day, "EEE")}</span>
                      <span className="font-display text-xl font-bold">{format(day, "d")}</span>
                    </span>
                    {canEdit && <Plus className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  <div className="space-y-1">{dayEvents.length ? dayEvents.map((event) => eventRow(event)) : <p className="rounded-xl bg-muted/25 px-2 py-4 text-center text-xs text-muted-foreground">Free</p>}</div>
                </section>
              );
            })}
          </div>
        )}

        {view === "agenda" && (
          <div className="mx-auto max-w-3xl space-y-2">
            {Array.from({ length: 30 }, (_, index) => addDays(startOfDay(cursor), index)).map((day) => {
              const dayEvents = eventsForDay(day);
              if (!dayEvents.length && !isToday(day)) return null;
              return (
                <section key={day.toISOString()} className="grid gap-2 rounded-2xl border border-border/50 bg-card p-3 shadow-soft sm:grid-cols-[7rem_1fr]">
                  <div className="sm:border-r sm:border-border/40 sm:pr-3">
                    <p className={`text-xs font-bold uppercase tracking-wide ${isToday(day) ? "text-primary" : "text-muted-foreground"}`}>{isToday(day) ? "Today" : format(day, "EEE")}</p>
                    <p className="font-display text-lg font-bold">{format(day, "d MMM")}</p>
                  </div>
                  <div>{dayEvents.length ? dayEvents.map((event) => eventRow(event)) : <p className="px-3 py-2 text-sm text-muted-foreground">Nothing planned</p>}</div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto rounded-2xl">
          <DialogHeader><DialogTitle>{editing ? "Edit event" : "New event"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label htmlFor="focus-event-title">Title</Label><Input id="focus-event-title" autoFocus value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} className="mt-1 h-11 rounded-xl" placeholder="What’s happening?" /></div>
            <div className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2.5"><div><p className="text-sm font-semibold">All day</p><p className="text-xs text-muted-foreground">Hide start and finish times</p></div><Switch checked={draft.allDay} onCheckedChange={(allDay) => setDraft((d) => ({ ...d, allDay }))} /></div>
            <div className={`grid gap-3 ${draft.allDay ? "grid-cols-1" : "grid-cols-3"}`}>
              <div className={draft.allDay ? "" : "col-span-1"}><Label>Date</Label><Input type="date" value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} className="mt-1 rounded-xl" /></div>
              {!draft.allDay && <><div><Label>Starts</Label><Input type="time" value={draft.startTime} onChange={(e) => setDraft((d) => ({ ...d, startTime: e.target.value }))} className="mt-1 rounded-xl" /></div><div><Label>Ends</Label><Input type="time" value={draft.endTime} onChange={(e) => setDraft((d) => ({ ...d, endTime: e.target.value }))} className="mt-1 rounded-xl" /></div></>}
            </div>
            <div><Label>Calendar</Label><Select value={draft.category} onValueChange={(category) => setDraft((d) => ({ ...d, category: category as CalendarEventCategory }))}><SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map((category) => <SelectItem key={category.id} value={category.id}><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: category.dot }} />{category.label}</span></SelectItem>)}</SelectContent></Select></div>
            <div><Label>Location</Label><div className="relative mt-1"><MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={draft.location} onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))} className="rounded-xl pl-9" placeholder="Optional" /></div></div>
            <div><Label>Notes</Label><Textarea value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} className="mt-1 min-h-24 rounded-xl" placeholder="Add details" /></div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <div>{editing?.id && canEdit && <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={remove}><Trash2 className="mr-1 h-4 w-4" /> Delete</Button>}</div>
            <div className="flex gap-2"><Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button><Button className="bg-gradient-primary" disabled={saving || !canEdit} onClick={save}>{saving ? "Saving…" : "Save"}</Button></div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FeaturePageShell>
  );
}
