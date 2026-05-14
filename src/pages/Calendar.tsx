import { useState, useMemo, useRef, useEffect } from "react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import {
  CalendarDays, Plus, ChevronLeft, ChevronRight, X, MapPin,
  Bell, Settings, Clock, Users, Trash2, ChevronDown, Mail, MessageSquare, Smartphone,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths,
  subMonths, addWeeks, subWeeks, parseISO, isAfter, isBefore, startOfDay, endOfDay,
} from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useCalendar } from "@/hooks/useCalendar";
import { useHouseholdSettings } from "@/hooks/useHousehold";
import { useUserRole } from "@/auth/useUserRole";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import type { CalendarEvent, CalendarEventCategory, CalendarNotificationPref } from "@/types/app";

// ─── Constants ────────────────────────────────────────────────────────────────

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const CAT: Record<CalendarEventCategory, { color: string; bg: string; label: string }> = {
  personal: { color: "#6366f1", bg: "bg-[#6366f1]", label: "Personal" },
  family:   { color: "#f59e0b", bg: "bg-[#f59e0b]", label: "Family"   },
  work:     { color: "#3b82f6", bg: "bg-[#3b82f6]", label: "Work"     },
  health:   { color: "#10b981", bg: "bg-[#10b981]", label: "Health"   },
  social:   { color: "#ec4899", bg: "bg-[#ec4899]", label: "Social"   },
  other:    { color: "#8b5cf6", bg: "bg-[#8b5cf6]", label: "Other"    },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toISO(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

function splitISO(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = format(d, "yyyy-MM-dd");
  const time = format(d, "HH:mm");
  return { date, time };
}

function newId() {
  return `n${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Default form ─────────────────────────────────────────────────────────────

type NotifRow = { id: string; via: "push" | "email" | "sms"; amount: number; unit: "minutes" | "hours" | "days" };

interface EventForm {
  title: string;
  description: string;
  location: string;
  category: CalendarEventCategory;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  allDay: boolean;
  invitees: string[];
  notifications: NotifRow[];
}

function defaultForm(prefillDate?: Date): EventForm {
  const d = prefillDate ? format(prefillDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
  return {
    title: "",
    description: "",
    location: "",
    category: "personal",
    startDate: d,
    startTime: "09:00",
    endDate: d,
    endTime: "10:00",
    allDay: false,
    invitees: [],
    notifications: [],
  };
}

// ─── Main component ───────────────────────────────────────────────────────────

const CalendarPage = () => {
  const { events, settings, addEvent, updateEvent, deleteEvent, saveSettings } = useCalendar();
  const { settings: hSettings } = useHouseholdSettings();
  const { role } = useUserRole();
  const { isSupported, permission, requestPermission } = usePushNotifications();

  const isAdmin = role === "admin" || role === "superadmin";

  const [view, setView] = useState<"month" | "week">(settings.defaultView ?? "month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Form state
  const [form, setForm] = useState<EventForm>(defaultForm());

  // Push notification timer refs
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Schedule push notifications for upcoming events
  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (permission !== "granted") return;

    events.forEach((e) => {
      const pushNotifs = (e.notifications ?? []).filter((n) => n.via === "push");
      if (!pushNotifs.length) return;
      const eventStart = new Date(e.startDate).getTime();
      pushNotifs.forEach((n) => {
        const msPerUnit = { minutes: 60_000, hours: 3_600_000, days: 86_400_000 };
        const delay = eventStart - n.amount * msPerUnit[n.unit] - Date.now();
        if (delay <= 0) return;
        const id = setTimeout(() => {
          if (Notification.permission !== "granted") return;
          new Notification(`📅 ${e.title}`, {
            body: `Starts in ${n.amount} ${n.unit}${e.location ? ` · ${e.location}` : ""}`,
            icon: "/favicon.ico",
          });
        }, delay);
        timers.current.push(id);
      });
    });
    return () => timers.current.forEach(clearTimeout);
  }, [events, permission]);

  // Sync view when settings change
  useEffect(() => {
    setView(settings.defaultView ?? "month");
  }, [settings.defaultView]);

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const eventsForDay = (day: Date) =>
    events
      .filter((e) => {
        const start = startOfDay(parseISO(e.startDate));
        const end = endOfDay(parseISO(e.endDate));
        return !isAfter(start, endOfDay(day)) && !isBefore(end, startOfDay(day));
      })
      .sort((a, b) => a.startDate.localeCompare(b.startDate));

  // ─── Navigation ─────────────────────────────────────────────────────────────

  const prev = () =>
    view === "month"
      ? setCurrentDate((d) => subMonths(d, 1))
      : setCurrentDate((d) => subWeeks(d, 1));

  const next = () =>
    view === "month"
      ? setCurrentDate((d) => addMonths(d, 1))
      : setCurrentDate((d) => addWeeks(d, 1));

  // ─── Dialog openers ─────────────────────────────────────────────────────────

  const openAdd = (day?: Date) => {
    setForm(defaultForm(day ?? selectedDay ?? undefined));
    setEditEvent(null);
    setConfirmDelete(false);
    setAddOpen(true);
  };

  const openEdit = (event: CalendarEvent) => {
    const { date: sd, time: st } = splitISO(event.startDate);
    const { date: ed, time: et } = splitISO(event.endDate);
    setForm({
      title: event.title,
      description: event.description ?? "",
      location: event.location ?? "",
      category: event.category,
      startDate: sd,
      startTime: st,
      endDate: ed,
      endTime: et,
      allDay: event.allDay ?? false,
      invitees: event.invitees ?? [],
      notifications: (event.notifications ?? []).map((n) => ({ ...n })),
    });
    setEditEvent(event);
    setConfirmDelete(false);
    setAddOpen(true);
  };

  const closeForm = () => {
    setAddOpen(false);
    setEditEvent(null);
    setConfirmDelete(false);
  };

  // ─── Save / delete ──────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.title.trim()) return;
    const startISO = form.allDay
      ? `${form.startDate}T00:00:00.000Z`
      : toISO(form.startDate, form.startTime);
    const endISO = form.allDay
      ? `${form.endDate}T23:59:59.000Z`
      : toISO(form.endDate, form.endTime);

    const payload: Omit<CalendarEvent, "id"> = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      location: form.location.trim() || undefined,
      category: form.category,
      startDate: startISO,
      endDate: endISO,
      allDay: form.allDay,
      invitees: form.invitees,
      notifications: form.notifications,
    };

    if (editEvent?.id) {
      await updateEvent(editEvent.id, payload);
    } else {
      await addEvent(payload);
    }
    closeForm();
  };

  const handleDelete = async () => {
    if (editEvent?.id) {
      await deleteEvent(editEvent.id);
      closeForm();
    }
  };

  // ─── Month grid ──────────────────────────────────────────────────────────────

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // ─── Week grid ───────────────────────────────────────────────────────────────

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // ─── Notification row helpers ────────────────────────────────────────────────

  const addNotifRow = () =>
    setForm((f) => ({
      ...f,
      notifications: [...f.notifications, { id: newId(), via: "push", amount: 30, unit: "minutes" }],
    }));

  const removeNotifRow = (id: string) =>
    setForm((f) => ({ ...f, notifications: f.notifications.filter((n) => n.id !== id) }));

  const updateNotifRow = (id: string, patch: Partial<NotifRow>) =>
    setForm((f) => ({
      ...f,
      notifications: f.notifications.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    }));

  // ─── Invitee toggle ──────────────────────────────────────────────────────────

  const toggleInvitee = (name: string) =>
    setForm((f) => ({
      ...f,
      invitees: f.invitees.includes(name)
        ? f.invitees.filter((i) => i !== name)
        : [...f.invitees, name],
    }));

  // ─── Header label ────────────────────────────────────────────────────────────

  const headerLabel =
    view === "month"
      ? format(currentDate, "MMMM yyyy")
      : `${format(weekDays[0], "d MMM")} – ${format(weekDays[6], "d MMM yyyy")}`;

  // ─── JSX ─────────────────────────────────────────────────────────────────────

  return (
    <FeaturePageShell title="Calendar" icon={<CalendarDays className="w-5 h-5" />}>

      {/* ── Top navigation bar ── */}
      <div className="flex items-center justify-between mb-3 sm:mb-4 px-1">
        <div className="flex items-center gap-1">
          <button
            onClick={prev}
            className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="text-sm sm:text-base font-semibold text-card-foreground min-w-[130px] sm:min-w-[180px] text-center hover:text-primary transition-colors"
          >
            {headerLabel}
          </button>
          <button
            onClick={next}
            className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors"
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Month / Week toggle */}
          <div className="flex rounded-lg border border-border/50 overflow-hidden text-[11px] sm:text-xs font-semibold">
            {(["month", "week"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-2.5 sm:px-3 py-1.5 capitalize transition-colors ${
                  view === v
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Today shortcut */}
          <button
            onClick={() => { setCurrentDate(new Date()); setSelectedDay(new Date()); }}
            className="text-[11px] sm:text-xs font-medium text-primary px-2 sm:px-3 py-1.5 rounded-lg border border-primary/30 hover:bg-primary/10 transition-colors"
          >
            Today
          </button>

          {/* Settings (admin only) */}
          {isAdmin && (
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors"
            >
              <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}

          {/* Add event */}
          <button
            onClick={() => openAdd()}
            className="flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-primary-foreground bg-primary px-2.5 sm:px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>
      </div>

      {/* ── Month view ── */}
      {view === "month" && (
        <div className="rounded-2xl border border-border/40 overflow-hidden bg-card shadow-soft">
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 border-b border-border/40 bg-muted/30">
            {WEEK_DAYS.map((d) => (
              <div key={d} className="text-center text-[10px] sm:text-xs font-semibold text-muted-foreground py-2 sm:py-3">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 divide-x divide-y divide-border/30">
            {monthDays.map((day) => {
              const dayEvts = eventsForDay(day);
              const inMonth = isSameMonth(day, currentDate);
              const today = isToday(day);
              const selected = selectedDay && isSameDay(day, selectedDay);

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDay((prev) => (prev && isSameDay(prev, day) ? null : day))}
                  className={`min-h-[72px] sm:min-h-[90px] md:min-h-[110px] lg:min-h-[130px] p-1 sm:p-1.5 text-left flex flex-col transition-colors ${
                    !inMonth ? "bg-muted/10" : selected ? "bg-primary/5" : "bg-card hover:bg-muted/20"
                  }`}
                >
                  <span
                    className={`text-[11px] sm:text-xs font-semibold w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center mb-0.5 ${
                      today
                        ? "bg-primary text-primary-foreground"
                        : selected
                        ? "ring-2 ring-primary text-primary"
                        : inMonth
                        ? "text-card-foreground"
                        : "text-muted-foreground/50"
                    }`}
                  >
                    {format(day, "d")}
                  </span>

                  {dayEvts.slice(0, 3).map((e) => (
                    <div
                      key={e.id}
                      onClick={(ev) => { ev.stopPropagation(); openEdit(e); }}
                      className="w-full text-[9px] sm:text-[10px] font-medium px-1 sm:px-1.5 py-0.5 rounded mb-0.5 truncate text-white leading-tight"
                      style={{ backgroundColor: CAT[e.category]?.color }}
                    >
                      {!e.allDay && format(parseISO(e.startDate), "H:mm") + " "}
                      {e.title}
                    </div>
                  ))}
                  {dayEvts.length > 3 && (
                    <span className="text-[8px] sm:text-[9px] text-muted-foreground px-1">
                      +{dayEvts.length - 3} more
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Week view ── */}
      {view === "week" && (
        <div className="rounded-2xl border border-border/40 overflow-hidden bg-card shadow-soft">
          <div className="grid grid-cols-7 divide-x divide-border/30">
            {weekDays.map((day) => {
              const dayEvts = eventsForDay(day);
              const today = isToday(day);
              const selected = selectedDay && isSameDay(day, selectedDay);

              return (
                <div key={day.toISOString()} className="min-h-[200px] sm:min-h-[280px] md:min-h-[380px] flex flex-col">
                  {/* Day header */}
                  <button
                    onClick={() => setSelectedDay((prev) => (prev && isSameDay(prev, day) ? null : day))}
                    className={`w-full py-2 sm:py-3 flex flex-col items-center border-b border-border/30 transition-colors ${
                      today ? "bg-primary/10" : selected ? "bg-primary/5" : "hover:bg-muted/30"
                    }`}
                  >
                    <span className="text-[9px] sm:text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                      {format(day, "EEE")}
                    </span>
                    <span
                      className={`text-sm sm:text-base font-bold w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${
                        today
                          ? "bg-primary text-primary-foreground"
                          : selected
                          ? "ring-2 ring-primary text-primary"
                          : "text-card-foreground"
                      }`}
                    >
                      {format(day, "d")}
                    </span>
                  </button>

                  {/* Events */}
                  <div className="flex-1 p-1 sm:p-1.5 space-y-0.5 overflow-hidden">
                    {dayEvts.map((e) => (
                      <button
                        key={e.id}
                        onClick={() => openEdit(e)}
                        className="w-full text-[9px] sm:text-[10px] font-medium px-1.5 py-1 rounded text-white text-left truncate block"
                        style={{ backgroundColor: CAT[e.category]?.color }}
                      >
                        {!e.allDay && format(parseISO(e.startDate), "H:mm") + " "}
                        {e.title}
                      </button>
                    ))}
                    <button
                      onClick={() => openAdd(day)}
                      className="w-full text-[9px] sm:text-[10px] text-muted-foreground/50 hover:text-muted-foreground py-0.5 flex items-center justify-center hover:bg-muted/30 rounded transition-colors"
                    >
                      <Plus className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Day detail panel ── */}
      <AnimatePresence>
        {selectedDay && (
          <motion.div
            key="day-panel"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="mt-4 rounded-2xl bg-card border border-border/40 shadow-soft overflow-hidden"
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-muted/20">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {format(selectedDay, "EEEE")}
                </p>
                <p className="text-base font-bold text-card-foreground">
                  {format(selectedDay, "d MMMM yyyy")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openAdd(selectedDay)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-primary-foreground bg-primary px-2.5 py-1.5 rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Events list */}
            {eventsForDay(selectedDay).length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">No events — tap Add to create one</p>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {eventsForDay(selectedDay).map((e) => (
                  <button
                    key={e.id}
                    onClick={() => openEdit(e)}
                    className="w-full text-left flex items-stretch gap-3 p-3 rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors group"
                  >
                    {/* Category colour bar */}
                    <div
                      className="w-1 rounded-full flex-shrink-0"
                      style={{ backgroundColor: CAT[e.category]?.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-card-foreground">{e.title}</p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {e.allDay ? (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" /> All day
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(parseISO(e.startDate), "H:mm")} – {format(parseISO(e.endDate), "H:mm")}
                          </span>
                        )}
                        {e.location && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 flex-shrink-0" />{e.location}
                          </span>
                        )}
                        {e.invitees && e.invitees.length > 0 && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Users className="w-3 h-3" /> {e.invitees.join(", ")}
                          </span>
                        )}
                      </div>
                      {e.description && (
                        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{e.description}</p>
                      )}
                    </div>
                    <span
                      className="text-[9px] font-bold px-2 py-1 rounded-full text-white self-start flex-shrink-0"
                      style={{ backgroundColor: CAT[e.category]?.color }}
                    >
                      {CAT[e.category]?.label}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Add / Edit event dialog ── */}
      <Dialog open={addOpen} onOpenChange={closeForm}>
        <DialogContent
          aria-describedby={undefined}
          className="max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle>{editEvent ? "Edit Event" : "New Event"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">

            {/* Title */}
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input
                placeholder="Event title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>

            {/* All-day toggle */}
            <div className="flex items-center justify-between">
              <Label>All day</Label>
              <Switch
                checked={form.allDay}
                onCheckedChange={(v) => setForm((f) => ({ ...f, allDay: v }))}
              />
            </div>

            {/* Start */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, startDate: e.target.value, endDate: e.target.value }))
                  }
                />
              </div>
              {!form.allDay && (
                <div className="space-y-1.5">
                  <Label>Start time</Label>
                  <Input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                  />
                </div>
              )}
            </div>

            {/* End */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>End date</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  min={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </div>
              {!form.allDay && (
                <div className="space-y-1.5">
                  <Label>End time</Label>
                  <Input
                    type="time"
                    value={form.endTime}
                    onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                  />
                </div>
              )}
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label>Category</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(CAT) as [CalendarEventCategory, typeof CAT["personal"]][]).map(
                  ([key, val]) => (
                    <button
                      key={key}
                      onClick={() => setForm((f) => ({ ...f, category: key }))}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-semibold text-white transition-all ${
                        form.category === key ? "ring-2 ring-offset-2 ring-offset-background scale-105" : "opacity-70"
                      }`}
                      style={{ backgroundColor: val.color }}
                    >
                      {val.label}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Location
              </Label>
              <Input
                placeholder="Address or place name"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                placeholder="Notes or details…"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="resize-none"
              />
            </div>

            {/* Invite household members */}
            {hSettings.members.length > 0 && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Invite members
                </Label>
                <div className="flex flex-wrap gap-2">
                  {hSettings.members.map((m) => (
                    <label
                      key={m.id}
                      className="flex items-center gap-1.5 cursor-pointer select-none"
                    >
                      <Checkbox
                        checked={form.invitees.includes(m.name)}
                        onCheckedChange={() => toggleInvitee(m.name)}
                      />
                      <span className="text-sm">{m.emoji && m.emoji + " "}{m.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Notifications */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5" /> Notifications
                </Label>
                <button
                  onClick={addNotifRow}
                  className="text-[11px] text-primary font-medium flex items-center gap-1 hover:underline"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>

              {form.notifications.length === 0 && (
                <p className="text-[11px] text-muted-foreground">No reminders — tap Add to set one</p>
              )}

              {form.notifications.map((n) => (
                <div key={n.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/30 border border-border/30">
                  {/* Via icon */}
                  <Select
                    value={n.via}
                    onValueChange={(v) => updateNotifRow(n.id, { via: v as NotifRow["via"] })}
                  >
                    <SelectTrigger className="w-28 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="push">
                        <span className="flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5" /> Push</span>
                      </SelectItem>
                      <SelectItem value="email">
                        <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Email</span>
                      </SelectItem>
                      <SelectItem value="sms">
                        <span className="flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> SMS</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <Input
                    type="number"
                    min={1}
                    value={n.amount}
                    onChange={(e) => updateNotifRow(n.id, { amount: Number(e.target.value) })}
                    className="h-8 w-16 text-xs text-center"
                  />

                  <Select
                    value={n.unit}
                    onValueChange={(v) => updateNotifRow(n.id, { unit: v as NotifRow["unit"] })}
                  >
                    <SelectTrigger className="w-24 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minutes">mins</SelectItem>
                      <SelectItem value="hours">hours</SelectItem>
                      <SelectItem value="days">days</SelectItem>
                    </SelectContent>
                  </Select>

                  <span className="text-[10px] text-muted-foreground">before</span>

                  <button onClick={() => removeNotifRow(n.id)} className="ml-auto text-muted-foreground hover:text-destructive transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {/* Push permission nudge */}
              {form.notifications.some((n) => n.via === "push") && permission !== "granted" && isSupported && (
                <div className="p-2.5 rounded-xl bg-warning/10 border border-warning/30">
                  <p className="text-[11px] text-warning font-medium mb-1.5">
                    Push permission needed for push reminders
                  </p>
                  <button
                    onClick={requestPermission}
                    className="text-[11px] font-semibold text-primary hover:underline"
                  >
                    Grant permission →
                  </button>
                </div>
              )}
              {form.notifications.some((n) => n.via === "email" || n.via === "sms") && (
                <p className="text-[10px] text-muted-foreground">
                  ✉️ Email & SMS reminders require backend configuration — stored for future use.
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              {editEvent && (
                <>
                  {confirmDelete ? (
                    <Button variant="destructive" size="sm" onClick={handleDelete} className="flex-shrink-0">
                      Confirm delete
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmDelete(true)}
                      className="text-destructive border-destructive/30 hover:bg-destructive/10 flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </>
              )}
              <Button variant="outline" className="flex-1" onClick={closeForm}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleSave}
                disabled={!form.title.trim()}
              >
                {editEvent ? "Save changes" : "Create event"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Settings dialog ── */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-4 h-4" /> Calendar Settings
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>Default view</Label>
              <div className="flex gap-2">
                {(["month", "week"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => saveSettings({ defaultView: v })}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors capitalize ${
                      settings.defaultView === v
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border/50 text-muted-foreground hover:bg-muted/30"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Calendar events are stored per user. Household sharing and additional
                category management can be added in a future update.
              </p>
            </div>

            <Button className="w-full" onClick={() => setSettingsOpen(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </FeaturePageShell>
  );
};

export default CalendarPage;
