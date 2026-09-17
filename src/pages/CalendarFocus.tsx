import { useEffect, useMemo, useRef, useState } from "react";
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
  Bell,
  CalendarDays,
  Check,
  CheckSquare2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  List,
  MapPin,
  Navigation,
  Plus,
  Settings2,
  Trash2,
  UserRoundPlus,
  X,
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
import { useAuth } from "@/auth/AuthContext";
import { useAppUsers } from "@/hooks/useAppUsers";
import { useCalendar } from "@/hooks/useCalendar";
import { useSharedScope } from "@/hooks/useSharedScope";
import {
  appleMapsDirectionsUrl,
  computeDrivingTravelTime,
  createPlacesSessionToken,
  getBrowserLocation,
  getPlaceDetails,
  getPlaceSuggestions,
  googleMapsConfigured,
  googleMapsDirectionsUrl,
  type PlaceSuggestion,
} from "@/lib/googleMapsClient";
import { allDayEventCoversDate, londonDateFromIso, londonDayEndIso, londonDayStartIso } from "@/lib/londonCalendarDate";
import type { CalendarEvent, CalendarEventCategory, CalendarNotificationPref } from "@/types/app";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DEFAULT_CALENDAR_COLOR = "#6366f1";

type ViewMode = "month" | "week" | "agenda";
type FocusItemType = "event" | "task" | "reminder";
type ReminderPreset = Pick<CalendarNotificationPref, "via" | "amount" | "unit">;

type FocusCalendar = {
  id: string;
  name: string;
  color: string;
  visible?: boolean;
};

type FocusDefaults = {
  timedEvent: ReminderPreset[];
  allDayEvent: ReminderPreset[];
  task: ReminderPreset[];
  reminder: ReminderPreset[];
};

type FocusSettings = {
  focusCalendars?: FocusCalendar[];
  focusDefaults?: Partial<FocusDefaults>;
};

type FocusEvent = CalendarEvent & {
  itemType?: FocusItemType;
  calendarId?: string;
  sharedWithUids?: string[];
  mirroredToUids?: string[];
  sharedMirror?: boolean;
  sharedOriginOwnerId?: string;
  sharedOriginEventId?: string;
  placeId?: string;
  locationLat?: number;
  locationLng?: number;
  travelMinutes?: number;
  travelDistanceMeters?: number;
  completed?: boolean;
};

type Draft = {
  itemType: FocusItemType;
  title: string;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  calendarId: string;
  category: CalendarEventCategory;
  location: string;
  placeId: string;
  locationLat?: number;
  locationLng?: number;
  travelMinutes?: number;
  travelDistanceMeters?: number;
  description: string;
  notifications: CalendarNotificationPref[];
  sharedWithUids: string[];
  completed: boolean;
};

const BASE_DEFAULTS: FocusDefaults = {
  timedEvent: [{ via: "push", amount: 30, unit: "minutes" }],
  allDayEvent: [{ via: "push", amount: 12, unit: "hours" }],
  task: [{ via: "push", amount: 30, unit: "minutes" }],
  reminder: [{ via: "push", amount: 0, unit: "minutes" }],
};

function reminderWithIds(items: ReminderPreset[]): CalendarNotificationPref[] {
  return items.map((item) => ({ ...item, id: crypto.randomUUID() }));
}

function calendarList(settings: FocusSettings): FocusCalendar[] {
  const stored = Array.isArray(settings.focusCalendars) ? settings.focusCalendars.filter((cal) => cal?.id && cal?.name) : [];
  if (!stored.length) return [{ id: "personal", name: "Personal", color: DEFAULT_CALENDAR_COLOR, visible: true }];
  if (stored.some((cal) => cal.id === "personal")) return stored;
  return [{ id: "personal", name: "Personal", color: DEFAULT_CALENDAR_COLOR, visible: true }, ...stored];
}

function defaultRules(settings: FocusSettings): FocusDefaults {
  return {
    timedEvent: settings.focusDefaults?.timedEvent?.length ? settings.focusDefaults.timedEvent : BASE_DEFAULTS.timedEvent,
    allDayEvent: settings.focusDefaults?.allDayEvent?.length ? settings.focusDefaults.allDayEvent : BASE_DEFAULTS.allDayEvent,
    task: settings.focusDefaults?.task?.length ? settings.focusDefaults.task : BASE_DEFAULTS.task,
    reminder: settings.focusDefaults?.reminder?.length ? settings.focusDefaults.reminder : BASE_DEFAULTS.reminder,
  };
}

function defaultNotifications(type: FocusItemType, allDay: boolean, defaults: FocusDefaults) {
  if (type === "task") return reminderWithIds(defaults.task);
  if (type === "reminder") return reminderWithIds(defaults.reminder);
  return reminderWithIds(allDay ? defaults.allDayEvent : defaults.timedEvent);
}

function freshDraft(day: Date, defaults: FocusDefaults, itemType: FocusItemType = "event"): Draft {
  const date = format(day, "yyyy-MM-dd");
  return {
    itemType,
    title: "",
    date,
    endDate: date,
    startTime: "09:00",
    endTime: "10:00",
    allDay: false,
    calendarId: "personal",
    category: "personal",
    location: "",
    placeId: "",
    description: "",
    notifications: defaultNotifications(itemType, false, defaults),
    sharedWithUids: [],
    completed: false,
  };
}

function typeIcon(type: FocusItemType, className = "h-3 w-3") {
  if (type === "task") return <CheckSquare2 className={className} />;
  if (type === "reminder") return <Bell className={className} />;
  return <CalendarDays className={className} />;
}

function typeLabel(type: FocusItemType) {
  if (type === "task") return "Task";
  if (type === "reminder") return "Reminder";
  return "Event";
}

function eventType(event: FocusEvent): FocusItemType {
  return event.itemType || "event";
}

function eventTime(event: FocusEvent) {
  if (event.allDay) return "All day";
  const start = format(parseISO(event.startDate), "HH:mm");
  if (eventType(event) !== "event") return start;
  const end = event.endDate ? format(parseISO(event.endDate), "HH:mm") : "";
  return end && end !== start ? `${start}–${end}` : start;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";
}

function distanceLabel(metres?: number) {
  if (!metres) return "";
  const miles = metres / 1609.344;
  return miles < 0.1 ? `${Math.round(metres)} m` : `${miles.toFixed(miles < 10 ? 1 : 0)} mi`;
}

export default function CalendarFocus() {
  const navigate = useNavigate();
  const { dataUid } = useAuth();
  const appUsers = useAppUsers();
  const { scopeUserId, permission, pageTitle, isOwnScope } = useSharedScope("calendar");
  const canEdit = permission === "edit";
  const { events: rawEvents, settings: rawSettings, addEvent, updateEvent, deleteEvent } = useCalendar(scopeUserId ?? undefined);
  const settings = rawSettings as typeof rawSettings & FocusSettings;
  const events = rawEvents as FocusEvent[];
  const calendars = useMemo(() => calendarList(settings), [settings.focusCalendars]);
  const defaults = useMemo(() => defaultRules(settings), [settings.focusDefaults]);
  const visibleCalendarIds = useMemo(() => new Set(calendars.filter((cal) => cal.visible !== false).map((cal) => cal.id)), [calendars]);

  const [view, setView] = useState<ViewMode>((rawSettings.defaultView as ViewMode) || "month");
  const [cursor, setCursor] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<FocusEvent | null>(null);
  const [draft, setDraft] = useState<Draft>(() => freshDraft(new Date(), defaults));
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [travelLoading, setTravelLoading] = useState(false);
  const placesToken = useRef<any>(null);

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

  const visibleEvents = useMemo(
    () => events.filter((event) => visibleCalendarIds.has(event.calendarId || "personal")),
    [events, visibleCalendarIds],
  );

  const eventsForDay = (day: Date) => visibleEvents
    .filter((event) => {
      if (event.allDay) return allDayEventCoversDate(event, day);
      const start = parseISO(event.startDate);
      const end = parseISO(event.endDate || event.startDate);
      const target = startOfDay(day).getTime();
      return target >= startOfDay(start).getTime() && target <= startOfDay(end).getTime();
    })
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.startDate.localeCompare(b.startDate));

  const selectedEvents = useMemo(
    () => visibleEvents.filter((event) => {
      if (event.allDay) return allDayEventCoversDate(event, selectedDay);
      const target = startOfDay(selectedDay).getTime();
      return target >= startOfDay(parseISO(event.startDate)).getTime() && target <= startOfDay(parseISO(event.endDate || event.startDate)).getTime();
    }).sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.startDate.localeCompare(b.startDate)),
    [selectedDay, visibleEvents],
  );

  const agendaEvents = useMemo(() => {
    const today = startOfDay(new Date()).getTime();
    const horizon = addDays(new Date(), 45).getTime();
    return visibleEvents
      .filter((event) => {
        const end = parseISO(event.endDate || event.startDate).getTime();
        return end >= today && parseISO(event.startDate).getTime() <= horizon;
      })
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [visibleEvents]);

  useEffect(() => {
    if (!editorOpen || !googleMapsConfigured() || draft.placeId || draft.location.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setPlaceLoading(true);
      try {
        if (!placesToken.current) placesToken.current = await createPlacesSessionToken();
        setSuggestions(await getPlaceSuggestions(draft.location, placesToken.current));
      } catch {
        setSuggestions([]);
      } finally {
        setPlaceLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [draft.location, draft.placeId, editorOpen]);

  const calendarFor = (event: FocusEvent) => calendars.find((calendar) => calendar.id === (event.calendarId || "personal")) || calendars[0];

  const startPlaces = () => {
    placesToken.current = null;
    if (googleMapsConfigured()) void createPlacesSessionToken().then((token) => { placesToken.current = token; }).catch(() => undefined);
  };

  const openCreate = (day = selectedDay, type: FocusItemType = "event") => {
    if (!canEdit) return;
    setEditing(null);
    setDraft(freshDraft(day, defaults, type));
    setSuggestions([]);
    startPlaces();
    setEditorOpen(true);
  };

  const openEdit = (event: FocusEvent) => {
    setEditing(event);
    const date = event.allDay ? londonDateFromIso(event.startDate) : format(parseISO(event.startDate), "yyyy-MM-dd");
    const endDate = event.allDay ? londonDateFromIso(event.endDate || event.startDate) : format(parseISO(event.endDate || event.startDate), "yyyy-MM-dd");
    setDraft({
      itemType: eventType(event),
      title: event.title,
      date,
      endDate,
      startTime: event.allDay ? "09:00" : format(parseISO(event.startDate), "HH:mm"),
      endTime: event.allDay ? "10:00" : format(parseISO(event.endDate || event.startDate), "HH:mm"),
      allDay: !!event.allDay,
      calendarId: event.calendarId || "personal",
      category: event.category || "personal",
      location: event.location || "",
      placeId: event.placeId || "",
      locationLat: event.locationLat,
      locationLng: event.locationLng,
      travelMinutes: event.travelMinutes,
      travelDistanceMeters: event.travelDistanceMeters,
      description: event.description || "",
      notifications: event.notifications?.map((item) => ({ ...item })) || [],
      sharedWithUids: event.sharedWithUids || [],
      completed: !!event.completed,
    });
    setSuggestions([]);
    startPlaces();
    setEditorOpen(true);
  };

  const readOnly = !!editing && (editing.sharedMirror || editing.source === "google" || !canEdit);

  const selectType = (itemType: FocusItemType) => {
    if (readOnly) return;
    setDraft((current) => ({
      ...current,
      itemType,
      notifications: defaultNotifications(itemType, current.allDay, defaults),
    }));
  };

  const setAllDay = (allDay: boolean) => {
    setDraft((current) => ({
      ...current,
      allDay,
      notifications: defaultNotifications(current.itemType, allDay, defaults),
    }));
  };

  const selectPlace = async (suggestion: PlaceSuggestion) => {
    try {
      const place = await getPlaceDetails(suggestion);
      setDraft((current) => ({
        ...current,
        location: place.address || place.name,
        placeId: place.placeId,
        locationLat: place.lat,
        locationLng: place.lng,
        travelMinutes: undefined,
        travelDistanceMeters: undefined,
      }));
      setSuggestions([]);
      placesToken.current = null;
    } catch {
      toast.error("Could not load that address");
    }
  };

  const calculateTravel = async () => {
    if (!draft.location.trim()) return;
    if (!googleMapsConfigured()) {
      toast.message("Add a Google Maps browser API key to enable live travel-time estimates.");
      return;
    }
    setTravelLoading(true);
    try {
      const origin = await getBrowserLocation();
      const destination = draft.locationLat != null && draft.locationLng != null
        ? { lat: draft.locationLat, lng: draft.locationLng }
        : draft.location;
      const estimate = await computeDrivingTravelTime(origin, destination);
      setDraft((current) => ({ ...current, travelMinutes: estimate.minutes, travelDistanceMeters: estimate.distanceMeters }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not calculate travel time");
    } finally {
      setTravelLoading(false);
    }
  };

  const save = async () => {
    if (readOnly) return;
    if (!draft.title.trim()) {
      toast.error(`Give the ${typeLabel(draft.itemType).toLowerCase()} a title`);
      return;
    }
    setSaving(true);
    try {
      const startDate = draft.allDay
        ? londonDayStartIso(draft.date)
        : new Date(`${draft.date}T${draft.startTime}:00`).toISOString();
      let endDate: string;
      if (draft.allDay) {
        endDate = londonDayEndIso(draft.itemType === "event" ? draft.endDate : draft.date);
      } else if (draft.itemType === "event") {
        endDate = new Date(`${draft.endDate}T${draft.endTime}:00`).toISOString();
      } else {
        endDate = startDate;
      }
      if (new Date(endDate).getTime() < new Date(startDate).getTime()) {
        toast.error("The end needs to be after the start");
        setSaving(false);
        return;
      }
      const payload = {
        title: draft.title.trim(),
        description: draft.description.trim(),
        location: draft.location.trim(),
        category: draft.category,
        startDate,
        endDate,
        allDay: draft.allDay,
        notifications: draft.notifications,
        itemType: draft.itemType,
        calendarId: draft.calendarId,
        sharedWithUids: isOwnScope ? draft.sharedWithUids : [],
        placeId: draft.placeId || undefined,
        locationLat: draft.locationLat,
        locationLng: draft.locationLng,
        travelMinutes: draft.travelMinutes,
        travelDistanceMeters: draft.travelDistanceMeters,
        completed: draft.itemType === "task" ? draft.completed : false,
        source: editing?.source || "local",
      } as Partial<FocusEvent>;
      if (editing?.id) await updateEvent(editing.id, payload as Partial<CalendarEvent>);
      else await addEvent(payload as Omit<CalendarEvent, "id">);
      setEditorOpen(false);
      toast.success(editing ? `${typeLabel(draft.itemType)} updated` : `${typeLabel(draft.itemType)} added`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save this calendar item");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing?.id || readOnly) return;
    try {
      await deleteEvent(editing.id);
      setEditorOpen(false);
      toast.success(`${typeLabel(eventType(editing))} deleted`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete this calendar item");
    }
  };

  const changeView = (next: ViewMode) => {
    setView(next);
  };

  const previous = () => setCursor((date) => view === "month" ? subMonths(date, 1) : subWeeks(date, 1));
  const next = () => setCursor((date) => view === "month" ? addMonths(date, 1) : addWeeks(date, 1));
  const goToday = () => {
    const today = new Date();
    setCursor(today);
    setSelectedDay(today);
  };

  const chip = (event: FocusEvent, density: "month" | "row" = "row", index = 0) => {
    const calendar = calendarFor(event);
    const type = eventType(event);
    const time = eventTime(event);
    const compact = density === "month";
    return (
      <button
        key={event.id || `${event.title}-${event.startDate}-${index}`}
        type="button"
        onClick={(e) => { e.stopPropagation(); openEdit(event); }}
        className={`group flex min-w-0 items-center text-left transition ${compact
          ? `h-[17px] w-full gap-1 rounded-[4px] border-l-2 px-1 text-[8px] leading-none hover:brightness-95 sm:h-[22px] sm:gap-1.5 sm:px-1.5 sm:text-[10px] ${index >= 3 ? "hidden sm:flex" : "flex"}`
          : "w-full gap-2.5 rounded-xl border border-border/35 bg-background/45 px-3 py-2.5 hover:border-primary/25 hover:bg-muted/55"}`}
        style={compact ? {
          borderLeftColor: calendar.color,
          background: `color-mix(in srgb, ${calendar.color} 16%, hsl(var(--card)))`,
        } : undefined}
      >
        {!compact && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: calendar.color }} />}
        <span className={`shrink-0 ${compact ? "opacity-65" : "text-muted-foreground"}`}>{typeIcon(type, compact ? "h-2.5 w-2.5 sm:h-3 sm:w-3" : "h-4 w-4")}</span>
        <span className={`shrink-0 font-semibold tabular-nums ${compact ? "max-w-[30px] sm:max-w-[42px]" : "w-[72px] text-xs text-muted-foreground"}`}>{event.allDay ? "" : time}</span>
        <span className={`min-w-0 flex-1 truncate font-semibold ${event.completed ? "line-through opacity-55" : ""}`}>{event.title}</span>
        {!compact && event.location && <span className="hidden max-w-[30%] truncate text-xs text-muted-foreground md:inline">{event.location}</span>}
        {!compact && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/35 transition group-hover:translate-x-0.5" />}
      </button>
    );
  };

  const editorTypeOptions: Array<{ id: FocusItemType; label: string; hint: string }> = [
    { id: "event", label: "Event", hint: "A time or place" },
    { id: "task", label: "Task", hint: "Something to do" },
    { id: "reminder", label: "Reminder", hint: "Prompt me later" },
  ];

  const shareUsers = appUsers.filter((user) => user.id !== dataUid && user.id !== scopeUserId);

  return (
    <FeaturePageShell
      title={pageTitle}
      subtitle="Calendar, tasks and reminders at a glance"
      icon={<CalendarDays className="h-5 w-5" />}
      sharePage="calendar"
      action={
        <div className="flex items-center gap-1.5">
          {canEdit && (
            <Button size="sm" className="rounded-xl bg-gradient-primary shadow-sm" onClick={() => openCreate()}>
              <Plus className="mr-1 h-4 w-4" /> New
            </Button>
          )}
          <Button size="icon" variant="ghost" aria-label="Calendar settings" onClick={() => navigate("/calendar-focus/settings")}>
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
      }
    >
      <div className="space-y-3 sm:space-y-4">
        <div className="sticky top-[3.35rem] z-20 -mx-1 rounded-2xl border border-border/45 bg-background/92 p-2 shadow-soft backdrop-blur-xl sm:static sm:mx-0">
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
                  onClick={() => changeView(id)}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${view === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Icon className="h-3.5 w-3.5" /><span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>
          {calendars.length > 1 && (
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
              {calendars.map((calendar) => (
                <span key={calendar.id} className={`flex shrink-0 items-center gap-1.5 rounded-lg border border-border/45 bg-card px-2 py-1 text-[10px] font-semibold ${calendar.visible === false ? "opacity-40" : ""}`}>
                  <span className="h-2 w-2 rounded-full" style={{ background: calendar.color }} />{calendar.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {view === "month" && (
          <>
            <section className="min-w-0 overflow-hidden rounded-2xl border border-border/50 bg-card shadow-card">
              <div className="grid grid-cols-7 border-b border-border/40 bg-muted/25">
                {DAYS.map((day, index) => (
                  <div key={day} className={`py-2 text-center text-[9px] font-bold uppercase tracking-wider sm:text-[10px] ${index > 4 ? "text-primary/70" : "text-muted-foreground"}`}>{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthDays.map((day) => {
                  const dayEvents = eventsForDay(day);
                  const selected = isSameDay(day, selectedDay);
                  const today = isToday(day);
                  const mobileHidden = Math.max(0, dayEvents.length - 3);
                  const desktopHidden = Math.max(0, dayEvents.length - 5);
                  return (
                    <div
                      key={day.toISOString()}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedDay(day)}
                      onDoubleClick={() => openCreate(day)}
                      onKeyDown={(event) => { if (event.key === "Enter") setSelectedDay(day); }}
                      className={`relative h-[104px] min-w-0 cursor-pointer overflow-hidden border-b border-r border-border/30 p-1 text-left transition hover:bg-muted/35 sm:h-[154px] sm:p-1.5 ${!isSameMonth(day, cursor) ? "bg-muted/15 text-muted-foreground/45" : ""} ${selected ? "bg-primary/[0.045] ring-1 ring-inset ring-primary/20" : ""}`}
                    >
                      <span className={`absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold sm:right-2 sm:top-2 sm:h-7 sm:w-7 sm:text-xs ${today ? "bg-primary text-primary-foreground shadow-sm" : selected ? "bg-primary/12 text-primary" : "bg-card/85"}`}>{format(day, "d")}</span>
                      <div className="space-y-[2px] pt-7 sm:space-y-1 sm:pt-9">
                        {dayEvents.slice(0, 5).map((event, index) => chip(event, "month", index))}
                        {mobileHidden > 0 && <span className="block truncate px-1 text-[8px] font-bold text-muted-foreground sm:hidden">+{mobileHidden} more</span>}
                        {desktopHidden > 0 && <span className="hidden truncate px-1 text-[10px] font-bold text-muted-foreground sm:block">+{desktopHidden} more</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-border/45 bg-card p-3 shadow-card sm:p-4">
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{isToday(selectedDay) ? "Today" : format(selectedDay, "EEEE")}</p>
                  <h2 className="truncate font-display text-base font-bold sm:text-lg">{format(selectedDay, "d MMMM yyyy")}</h2>
                </div>
                {canEdit && <Button size="sm" variant="outline" className="shrink-0 rounded-xl" onClick={() => openCreate(selectedDay)}><Plus className="mr-1 h-3.5 w-3.5" /> Add</Button>}
              </div>
              {selectedEvents.length ? (
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{selectedEvents.map((event, index) => chip(event, "row", index))}</div>
              ) : (
                <button type="button" onClick={() => openCreate(selectedDay)} className="w-full rounded-xl border border-dashed border-border/70 px-4 py-5 text-center text-sm text-muted-foreground transition hover:border-primary/35 hover:bg-muted/25">
                  Nothing planned. {canEdit ? "Click to add something." : ""}
                </button>
              )}
            </section>
          </>
        )}

        {view === "week" && (
          <section className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-card">
            <div className="divide-y divide-border/35 sm:grid sm:grid-cols-7 sm:divide-x sm:divide-y-0">
              {weekDays.map((day) => {
                const dayEvents = eventsForDay(day);
                return (
                  <div key={day.toISOString()} className={`min-w-0 p-2.5 sm:min-h-[420px] sm:p-2 ${isToday(day) ? "bg-primary/[0.04]" : ""}`}>
                    <button type="button" onClick={() => setSelectedDay(day)} className="mb-2 flex w-full items-center gap-2 text-left sm:block sm:text-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{format(day, "EEE")}</span>
                      <span className={`ml-auto flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold sm:mx-auto sm:mt-1 ${isToday(day) ? "bg-primary text-primary-foreground" : ""}`}>{format(day, "d")}</span>
                    </button>
                    <div className="space-y-1.5">
                      {dayEvents.map((event, index) => chip(event, "row", index))}
                      {!dayEvents.length && canEdit && <button type="button" onClick={() => openCreate(day)} className="w-full rounded-lg border border-dashed border-border/50 py-3 text-[10px] text-muted-foreground hover:border-primary/30">+ Add</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {view === "agenda" && (
          <section className="rounded-2xl border border-border/50 bg-card p-3 shadow-card sm:p-4">
            <div className="mb-3 flex items-center justify-between">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Next 45 days</p><h2 className="font-display text-lg font-bold">Agenda</h2></div>
              {canEdit && <Button size="sm" className="rounded-xl" onClick={() => openCreate()}><Plus className="mr-1 h-4 w-4" /> New</Button>}
            </div>
            <div className="space-y-2">
              {agendaEvents.map((event, index) => {
                const date = event.allDay ? londonDateFromIso(event.startDate) : event.startDate.slice(0, 10);
                const previous = index ? agendaEvents[index - 1] : null;
                const previousDate = previous ? (previous.allDay ? londonDateFromIso(previous.startDate) : previous.startDate.slice(0, 10)) : null;
                return (
                  <div key={event.id || `${event.title}-${index}`}>
                    {date !== previousDate && <p className="mb-1 mt-3 px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground first:mt-0">{format(parseISO(`${date}T12:00:00`), "EEEE d MMMM")}</p>}
                    {chip(event, "row", index)}
                  </div>
                );
              })}
              {!agendaEvents.length && <p className="py-10 text-center text-sm text-muted-foreground">Nothing coming up.</p>}
            </div>
          </section>
        )}
      </div>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto rounded-[1.75rem] border-border/55 p-0 shadow-2xl sm:w-full">
          <div className="sticky top-0 z-20 border-b border-border/40 bg-background/95 px-4 pb-3 pt-4 backdrop-blur-xl sm:px-6 sm:pt-5">
            <DialogHeader>
              <div className="flex items-start justify-between gap-3 pr-8">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">{readOnly ? "Calendar item" : editing ? "Edit" : "Create"}</p>
                  <DialogTitle className="mt-0.5 font-display text-xl">{readOnly ? editing?.title : `${editing ? "Edit" : "New"} ${typeLabel(draft.itemType).toLowerCase()}`}</DialogTitle>
                </div>
                {editing?.sharedMirror && <span className="rounded-lg bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">Shared with you</span>}
                {editing?.source === "google" && <span className="rounded-lg bg-blue-500/10 px-2 py-1 text-[10px] font-bold text-blue-600 dark:text-blue-300">Google</span>}
              </div>
            </DialogHeader>
            {!readOnly && (
              <div className="mt-4 grid grid-cols-3 gap-1.5 rounded-2xl bg-muted/65 p-1.5">
                {editorTypeOptions.map((option) => (
                  <button key={option.id} type="button" onClick={() => selectType(option.id)} className={`rounded-xl px-2 py-2 text-left transition ${draft.itemType === option.id ? "bg-card shadow-sm ring-1 ring-border/40" : "hover:bg-card/55"}`}>
                    <span className={`mb-1 flex h-7 w-7 items-center justify-center rounded-lg ${draft.itemType === option.id ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}>{typeIcon(option.id, "h-4 w-4")}</span>
                    <span className="block text-xs font-bold">{option.label}</span>
                    <span className="hidden text-[9px] text-muted-foreground sm:block">{option.hint}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4 px-4 py-4 sm:px-6 sm:py-5">
            <div>
              <Label htmlFor="focus-title" className="sr-only">Title</Label>
              <Input
                id="focus-title"
                value={draft.title}
                disabled={readOnly}
                autoFocus={!editing}
                onChange={(e) => setDraft((current) => ({ ...current, title: e.target.value }))}
                placeholder={draft.itemType === "event" ? "Add title" : draft.itemType === "task" ? "What needs doing?" : "What should I remind you about?"}
                className="h-12 rounded-2xl border-2 bg-card px-4 font-display text-lg font-semibold shadow-soft placeholder:font-normal placeholder:text-muted-foreground/55"
              />
            </div>

            <section className="rounded-2xl border border-border/50 bg-card p-3.5 shadow-soft sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-primary" /><span className="text-sm font-bold">When</span></div>
                <div className="flex items-center gap-2"><Label htmlFor="focus-all-day" className="text-xs text-muted-foreground">All day</Label><Switch id="focus-all-day" checked={draft.allDay} disabled={readOnly} onCheckedChange={setAllDay} /></div>
              </div>
              <div className={`grid gap-2 ${draft.itemType === "event" ? "sm:grid-cols-2" : ""}`}>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{draft.itemType === "event" ? "Starts" : "Due"}</Label>
                  <div className={`grid gap-2 ${draft.allDay ? "" : "grid-cols-[1fr_7.2rem]"}`}>
                    <Input type="date" disabled={readOnly} value={draft.date} onChange={(e) => setDraft((current) => ({ ...current, date: e.target.value, endDate: current.endDate < e.target.value ? e.target.value : current.endDate }))} className="rounded-xl" />
                    {!draft.allDay && <Input type="time" disabled={readOnly} value={draft.startTime} onChange={(e) => setDraft((current) => ({ ...current, startTime: e.target.value }))} className="rounded-xl" />}
                  </div>
                </div>
                {draft.itemType === "event" && (
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ends</Label>
                    <div className={`grid gap-2 ${draft.allDay ? "" : "grid-cols-[1fr_7.2rem]"}`}>
                      <Input type="date" disabled={readOnly} min={draft.date} value={draft.endDate} onChange={(e) => setDraft((current) => ({ ...current, endDate: e.target.value }))} className="rounded-xl" />
                      {!draft.allDay && <Input type="time" disabled={readOnly} value={draft.endTime} onChange={(e) => setDraft((current) => ({ ...current, endTime: e.target.value }))} className="rounded-xl" />}
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-border/50 bg-card p-3.5 shadow-soft sm:p-4">
              <div className="mb-2 flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /><span className="text-sm font-bold">Calendar</span></div>
              <div className="flex flex-wrap gap-2">
                {calendars.map((calendar) => {
                  const selected = draft.calendarId === calendar.id;
                  return (
                    <button key={calendar.id} type="button" disabled={readOnly} onClick={() => setDraft((current) => ({ ...current, calendarId: calendar.id }))} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${selected ? "border-primary/40 bg-primary/8 text-foreground shadow-sm" : "border-border/55 bg-background/55 text-muted-foreground hover:text-foreground"}`}>
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: calendar.color }} />{calendar.name}{selected && <Check className="h-3.5 w-3.5 text-primary" />}
                    </button>
                  );
                })}
                {!readOnly && <button type="button" onClick={() => { setEditorOpen(false); navigate("/calendar-focus/settings"); }} className="rounded-xl border border-dashed border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:border-primary/30 hover:text-primary"><Plus className="mr-1 inline h-3.5 w-3.5" />Calendar</button>}
              </div>
            </section>

            {draft.itemType === "event" && (
              <section className="relative rounded-2xl border border-border/50 bg-card p-3.5 shadow-soft sm:p-4">
                <div className="mb-2 flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /><span className="text-sm font-bold">Location</span></div>
                <Input
                  value={draft.location}
                  disabled={readOnly}
                  onChange={(e) => setDraft((current) => ({ ...current, location: e.target.value, placeId: "", locationLat: undefined, locationLng: undefined, travelMinutes: undefined, travelDistanceMeters: undefined }))}
                  placeholder="Search for an address or place"
                  className="rounded-xl"
                />
                {placeLoading && <p className="mt-1.5 text-[10px] text-muted-foreground">Searching places…</p>}
                {!!suggestions.length && (
                  <div className="absolute left-3.5 right-3.5 z-30 mt-1 overflow-hidden rounded-xl border border-border bg-popover shadow-xl sm:left-4 sm:right-4">
                    {suggestions.slice(0, 6).map((suggestion) => (
                      <button key={suggestion.id} type="button" onClick={() => void selectPlace(suggestion)} className="flex w-full items-start gap-2 border-b border-border/35 px-3 py-2.5 text-left last:border-0 hover:bg-muted/55">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="min-w-0"><span className="block truncate text-xs font-semibold">{suggestion.label}</span>{suggestion.secondary && <span className="block truncate text-[10px] text-muted-foreground">{suggestion.secondary}</span>}</span>
                      </button>
                    ))}
                    <p className="border-t border-border/35 px-3 py-1.5 text-right text-[9px] font-semibold text-muted-foreground">Powered by Google</p>
                  </div>
                )}
                {draft.location && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    {!readOnly && <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={() => void calculateTravel()} disabled={travelLoading}>{travelLoading ? "Calculating…" : draft.travelMinutes ? `${draft.travelMinutes} min · ${distanceLabel(draft.travelDistanceMeters)}` : "Travel from me"}</Button>}
                    <Button size="sm" variant="outline" className="rounded-xl" asChild><a href={googleMapsDirectionsUrl(draft.location, draft.placeId)} target="_blank" rel="noreferrer"><Navigation className="mr-1 h-3.5 w-3.5" /> Google Maps</a></Button>
                    <Button size="sm" variant="ghost" className="rounded-xl" asChild><a href={appleMapsDirectionsUrl(draft.location)} target="_blank" rel="noreferrer">Apple Maps</a></Button>
                  </div>
                )}
                {!googleMapsConfigured() && !readOnly && <p className="mt-2 text-[10px] text-muted-foreground">Address entry and navigation work now. Google autocomplete and live travel time switch on when the Maps browser key is configured.</p>}
              </section>
            )}

            <section className="rounded-2xl border border-border/50 bg-card p-3.5 shadow-soft sm:p-4">
              <div className="mb-2.5 flex items-center justify-between gap-2"><div className="flex items-center gap-2"><Bell className="h-4 w-4 text-primary" /><span className="text-sm font-bold">Notifications</span></div>{!readOnly && <Button type="button" size="sm" variant="ghost" className="h-8 rounded-lg text-xs" onClick={() => setDraft((current) => ({ ...current, notifications: [...current.notifications, { id: crypto.randomUUID(), via: "push", amount: 10, unit: "minutes" }] }))}><Plus className="mr-1 h-3.5 w-3.5" /> Add</Button>}</div>
              <div className="space-y-2">
                {draft.notifications.map((notification) => (
                  <div key={notification.id} className="grid grid-cols-[1fr_1.25fr_1.15fr_auto] items-center gap-1.5 rounded-xl bg-muted/45 p-2">
                    <Input type="number" min={0} disabled={readOnly} value={notification.amount} onChange={(e) => setDraft((current) => ({ ...current, notifications: current.notifications.map((item) => item.id === notification.id ? { ...item, amount: Math.max(0, Number(e.target.value) || 0) } : item) }))} className="h-9 rounded-lg" />
                    <Select disabled={readOnly} value={notification.unit} onValueChange={(unit) => setDraft((current) => ({ ...current, notifications: current.notifications.map((item) => item.id === notification.id ? { ...item, unit: unit as CalendarNotificationPref["unit"] } : item) }))}>
                      <SelectTrigger className="h-9 rounded-lg"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="minutes">minutes</SelectItem><SelectItem value="hours">hours</SelectItem><SelectItem value="days">days</SelectItem></SelectContent>
                    </Select>
                    <Select disabled={readOnly} value={notification.via} onValueChange={(via) => setDraft((current) => ({ ...current, notifications: current.notifications.map((item) => item.id === notification.id ? { ...item, via: via as CalendarNotificationPref["via"] } : item) }))}>
                      <SelectTrigger className="h-9 rounded-lg"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="push">Push</SelectItem><SelectItem value="email">Email</SelectItem><SelectItem value="sms">SMS</SelectItem></SelectContent>
                    </Select>
                    {!readOnly ? <button type="button" aria-label="Remove notification" onClick={() => setDraft((current) => ({ ...current, notifications: current.notifications.filter((item) => item.id !== notification.id) }))} className="rounded-lg p-2 text-muted-foreground hover:bg-background hover:text-destructive"><X className="h-4 w-4" /></button> : <span />}
                  </div>
                ))}
                {!draft.notifications.length && <p className="rounded-xl bg-muted/35 px-3 py-3 text-xs text-muted-foreground">No notification for this item.</p>}
              </div>
            </section>

            {isOwnScope && !editing?.sharedMirror && editing?.source !== "google" && (
              <section className="rounded-2xl border border-border/50 bg-card p-3.5 shadow-soft sm:p-4">
                <div className="mb-2 flex items-center gap-2"><UserRoundPlus className="h-4 w-4 text-primary" /><span className="text-sm font-bold">Share with</span></div>
                <p className="mb-2.5 text-[10px] text-muted-foreground">People you select get a read-only copy on their own calendar, including the same reminders.</p>
                <div className="flex flex-wrap gap-2">
                  {shareUsers.map((user) => {
                    const selected = draft.sharedWithUids.includes(user.id);
                    return (
                      <button key={user.id} type="button" disabled={readOnly} onClick={() => setDraft((current) => ({ ...current, sharedWithUids: selected ? current.sharedWithUids.filter((id) => id !== user.id) : [...current.sharedWithUids, user.id] }))} className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition ${selected ? "border-primary/35 bg-primary/8 text-foreground" : "border-border/50 bg-background/55 text-muted-foreground hover:text-foreground"}`}>
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold ${selected ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{initials(user.name)}</span>{user.name}{selected && <Check className="h-3.5 w-3.5 text-primary" />}
                      </button>
                    );
                  })}
                  {!shareUsers.length && <p className="text-xs text-muted-foreground">No other app users found.</p>}
                </div>
              </section>
            )}

            {draft.itemType === "task" && (
              <section className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-card p-3.5 shadow-soft sm:p-4">
                <div><p className="text-sm font-bold">Completed</p><p className="text-[10px] text-muted-foreground">Keep it on the calendar but visually mark it done.</p></div>
                <Switch checked={draft.completed} disabled={readOnly} onCheckedChange={(completed) => setDraft((current) => ({ ...current, completed }))} />
              </section>
            )}

            <section className="rounded-2xl border border-border/50 bg-card p-3.5 shadow-soft sm:p-4">
              <Label className="mb-2 block text-sm font-bold">Notes</Label>
              <Textarea value={draft.description} disabled={readOnly} onChange={(e) => setDraft((current) => ({ ...current, description: e.target.value }))} placeholder="Add useful details…" className="min-h-[88px] resize-none rounded-xl" />
            </section>

            {readOnly && editing?.sharedMirror && <p className="rounded-xl bg-primary/7 px-3 py-2.5 text-xs text-muted-foreground">This was shared to your calendar. Changes are managed by the person who shared it.</p>}
            {readOnly && editing?.source === "google" && <p className="rounded-xl bg-blue-500/7 px-3 py-2.5 text-xs text-muted-foreground">This event came from Google Calendar. Use the connected Google calendar to edit it; Focus will pick up the synced change.</p>}
          </div>

          <DialogFooter className="sticky bottom-0 z-20 flex-row items-center border-t border-border/40 bg-background/95 px-4 py-3 backdrop-blur-xl sm:px-6">
            {editing?.id && !readOnly && <Button type="button" variant="ghost" className="mr-auto rounded-xl text-destructive hover:text-destructive" onClick={() => void remove()}><Trash2 className="mr-1 h-4 w-4" /> Delete</Button>}
            <Button type="button" variant="ghost" className="rounded-xl" onClick={() => setEditorOpen(false)}>{readOnly ? "Close" : "Cancel"}</Button>
            {!readOnly && <Button type="button" className="rounded-xl bg-gradient-primary px-5 shadow-sm" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : editing ? "Save changes" : `Add ${typeLabel(draft.itemType).toLowerCase()}`}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FeaturePageShell>
  );
}