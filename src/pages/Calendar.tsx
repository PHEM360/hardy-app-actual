import { useState, useMemo, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import {
  CalendarDays, Plus, ChevronLeft, ChevronRight, X, MapPin,
  Bell, Settings, Clock, Users, Trash2, Mail, MessageSquare, Smartphone,
  AlertTriangle, Palette, LayoutGrid, List, Link2, Download, RefreshCw,
  User, Briefcase, HeartPulse, PartyPopper, Sparkles, Cake, Sun, Upload,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths,
  subMonths, addWeeks, subWeeks, parseISO, isAfter, isBefore, startOfDay, endOfDay,
  addDays, subDays,
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
import { useSharedScope } from "@/hooks/useSharedScope";
import { useHouseholdSettings, useHouseholdItems } from "@/hooks/useHousehold";
import { useEffectiveRole } from "@/auth/useEffectiveRole";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { usePets } from "@/hooks/usePets";
import { useTasks } from "@/hooks/useTasks";
import { useCompanies } from "@/hooks/useCompanies";
import { useNotes } from "@/hooks/useNotes";
import { useMail } from "@/hooks/useMail";
import { useCalendarManifest } from "@/hooks/useCalendarManifest";
import {
  disconnectGoogleCalendar,
  listGoogleCalendars,
  saveGoogleCalendarSelection,
  startGoogleCalendarConnect,
  syncGoogleCalendar,
} from "@/lib/googleCalendarApi";
import { applyCalendarMergeRules } from "@/lib/calendarMerge";
import { downloadIcs, eventsToIcs, parseIcsEvents } from "@/lib/calendarIcs";
import { mergedCalendarSubscribeUrl, publishMergedCalendar, syncCalendarFeed } from "@/lib/calendarFeedsApi";
import { weekdayLabels, weekStartsOnValue, workHours } from "@/lib/calendarLayout";
import {
  draftEventsFromMail,
  draftFromPastedText,
  draftToEventInput,
  unsubscribeActionFromText,
} from "@/lib/mailEventDrafts";
import { TimedGrid } from "@/components/calendar/TimedGrid";
import type { CalendarEvent, CalendarEventCategory, CalendarFeed, CalendarSettings } from "@/types/app";

// ─── Constants ────────────────────────────────────────────────────────────────

type CalendarView = CalendarSettings["defaultView"];

function padHour(hour: number) {
  return String(Math.min(23, Math.max(0, hour))).padStart(2, "0");
}

const MEMBER_COLOR_PRESETS = [
  "#ec4899", "#3b82f6", "#f97316", "#10b981",
  "#8b5cf6", "#f59e0b", "#ef4444", "#6366f1",
  "#14b8a6", "#a855f7", "#0ea5e9", "#84cc16",
];

const CAT: Record<CalendarEventCategory, { color: string; bg: string; label: string; chip: string; Icon: typeof User }> = {
  personal: { color: "#6366f1", bg: "bg-[#6366f1]", label: "Personal", chip: "cal-chip-personal", Icon: User },
  family:   { color: "#f59e0b", bg: "bg-[#f59e0b]", label: "Family",   chip: "cal-chip-family",   Icon: Users },
  work:     { color: "#3b82f6", bg: "bg-[#3b82f6]", label: "Work",     chip: "cal-chip-work",     Icon: Briefcase },
  health:   { color: "#10b981", bg: "bg-[#10b981]", label: "Health",   chip: "cal-chip-health",   Icon: HeartPulse },
  social:   { color: "#ec4899", bg: "bg-[#ec4899]", label: "Social",   chip: "cal-chip-social",   Icon: PartyPopper },
  other:    { color: "#8b5cf6", bg: "bg-[#8b5cf6]", label: "Other",    chip: "cal-chip-other",    Icon: Sparkles },
  birthday: { color: "#f43f5e", bg: "bg-[#f43f5e]", label: "Birthday", chip: "cal-chip-birthday", Icon: Cake },
};

function EventChip({
  event,
  color,
  dense = false,
}: {
  event: CalendarEvent;
  color: string;
  dense?: boolean;
}) {
  const time = event.allDay ? "All day" : format(parseISO(event.startDate), "H:mm");
  const meta = CAT[event.category] ?? CAT.other;
  const Icon = meta.Icon;
  return (
    <div
      className={`cal-chip flex min-w-0 items-stretch border border-black/5 shadow-sm ${meta.chip} ${
        event.priority === "urgent" ? "ring-1 ring-red-400/70" : ""
      } ${event.id?.startsWith("__") ? "italic" : ""}`}
      style={{
        ["--cal-chip" as string]: color,
        background: event.category === "birthday"
          ? `linear-gradient(135deg, color-mix(in srgb, ${color} 34%, #fff4e8), color-mix(in srgb, ${color} 10%, hsl(var(--card))))`
          : event.category === "work"
            ? `color-mix(in srgb, ${color} 14%, hsl(var(--card)))`
            : `linear-gradient(135deg, color-mix(in srgb, ${color} 24%, hsl(var(--card))), color-mix(in srgb, ${color} 8%, hsl(var(--card))))`,
        boxShadow: `inset 0 1px 0 color-mix(in srgb, ${color} 28%, white)`,
      }}
    >
      <span className={`relative z-[1] flex shrink-0 items-center justify-center ${dense ? "w-4" : "w-6"}`} style={{ color }}>
        <Icon className={dense ? "h-2.5 w-2.5" : "h-3.5 w-3.5"} />
      </span>
      <div className={`relative z-[1] min-w-0 ${dense ? "px-1 py-0.5 pr-2" : "px-1.5 py-1.5 pr-2.5"}`}>
        <p className={`truncate font-display font-semibold leading-tight text-foreground ${dense ? "text-[9px]" : "text-[11px]"}`}>
          {event.priority === "urgent" ? "! " : ""}{event.title}
        </p>
        <span
          className={`mt-0.5 inline-flex font-semibold ${
            event.category === "health" ? "rounded-full" : event.category === "work" ? "rounded-sm" : "rounded-md"
          } ${dense ? "px-1 text-[7px]" : "px-1.5 text-[9px]"}`}
          style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}
        >
          {time}
        </span>
      </div>
    </div>
  );
}

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
  memberId: string;           // HouseholdMember.id | "all"
  priority: "normal" | "urgent";
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  allDay: boolean;
  invitees: string[];
  notifications: NotifRow[];
}

function defaultForm(prefillDate?: Date, hour?: number): EventForm {
  const d = prefillDate ? format(prefillDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
  const startHour = hour ?? 9;
  return {
    title: "",
    description: "",
    location: "",
    category: "personal",
    memberId: "all",
    priority: "normal",
    startDate: d,
    startTime: `${padHour(startHour)}:00`,
    endDate: d,
    endTime: `${padHour(startHour + 1)}:00`,
    allDay: false,
    invitees: [],
    notifications: [],
  };
}

// ─── Main component ───────────────────────────────────────────────────────────

const CalendarPage = () => {
  const { scopeUserId, permission: sharePermission, pageTitle, isOwnScope } = useSharedScope("calendar");
  const canEdit = sharePermission === "edit";
  const { events, settings, addEvent, updateEvent, deleteEvent, saveSettings } = useCalendar(scopeUserId ?? undefined);
  const [params, setParams] = useSearchParams();
  const [gcalBusy, setGcalBusy] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [gcalList, setGcalList] = useState<Array<{ id: string; name: string; primary: boolean; selected?: boolean }>>([]);
  const googleSyncStarted = useRef(false);

  useEffect(() => {
    const status = params.get("gcal");
    if (!status) return;
    const next = new URLSearchParams(params);
    next.delete("gcal");
    next.delete("reason");
    setParams(next, { replace: true });
    if (status === "error") {
      toast.error("That Google Calendar login did not finish");
      return;
    }
    if (status !== "connected") return;
    toast.success("Google Calendar linked — fetching your events");
    googleSyncStarted.current = true;
    setGcalBusy(true);
    void (async () => {
      try {
        const list = await listGoogleCalendars(scopeUserId || undefined);
        setGcalList(list);
        const result = await syncGoogleCalendar(scopeUserId || undefined);
        toast.success(
          result.upserted
            ? `Brought in ${result.upserted} Google event${result.upserted === 1 ? "" : "s"}`
            : "Google Calendar is linked. Tick any extra calendars in Settings.",
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Google Calendar linked, but events could not be fetched yet");
      } finally {
        setGcalBusy(false);
      }
    })();
  }, [params, scopeUserId, setParams]);

  useEffect(() => {
    if (!settings.google?.connected || !isOwnScope) return;
    void listGoogleCalendars(scopeUserId || undefined)
      .then(setGcalList)
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Could not list Google calendars");
      });
  }, [isOwnScope, scopeUserId, settings.google?.connected]);

  useEffect(() => {
    if (!settings.google?.connected || !isOwnScope || !canEdit) return;
    if (settings.google.lastSyncAt) return;
    if (googleSyncStarted.current) return;
    googleSyncStarted.current = true;
    setGcalBusy(true);
    void (async () => {
      try {
        const result = await syncGoogleCalendar(scopeUserId || undefined);
        if (result.upserted) {
          toast.success(`Brought in ${result.upserted} Google event${result.upserted === 1 ? "" : "s"}`);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not sync Google Calendar");
      } finally {
        setGcalBusy(false);
      }
    })();
  }, [canEdit, isOwnScope, scopeUserId, settings.google?.connected, settings.google?.lastSyncAt]);
  const { settings: hSettings } = useHouseholdSettings();
  const { items: householdItems } = useHouseholdItems();
  const { pets } = usePets();
  const { tasks } = useTasks();
  const { companies } = useCompanies();
  const { datedNotes } = useNotes(scopeUserId ?? undefined);
  const mail = useMail(scopeUserId);
  const { role } = useEffectiveRole();
  const { isSupported, permission, requestPermission } = usePushNotifications();
  useCalendarManifest(true);

  const isAdmin = role === "admin" || role === "superadmin";

  const [view, setView] = useState<CalendarView>(settings.defaultView ?? "month");
  const [hiddenSources, setHiddenSources] = useState<string[]>([]);
  const [feedDraft, setFeedDraft] = useState({ name: "", url: "" });
  const [feedBusy, setFeedBusy] = useState(false);
  const [icsBusy, setIcsBusy] = useState(false);
  const [pasteDraft, setPasteDraft] = useState("");
  const [dismissedDraftIds, setDismissedDraftIds] = useState<string[]>([]);
  const icsFileRef = useRef<HTMLInputElement>(null);
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
    allDisplayEvents
      .filter((e) => {
        const start = startOfDay(parseISO(e.startDate));
        const end = endOfDay(parseISO(e.endDate));
        return !isAfter(start, endOfDay(day)) && !isBefore(end, startOfDay(day));
      })
      .sort((a, b) => {
        // Urgent events first
        if (a.priority === "urgent" && b.priority !== "urgent") return -1;
        if (b.priority === "urgent" && a.priority !== "urgent") return 1;
        return a.startDate.localeCompare(b.startDate);
      });

  // ─── Navigation ─────────────────────────────────────────────────────────────

  const weekStartsOn = weekStartsOnValue(settings.weekStartsOn);
  const dayHours = workHours(settings.workDayStartHour, settings.workDayEndHour);
  const weekDayNames = weekdayLabels(weekStartsOn);

  const mailDrafts = useMemo(
    () => draftEventsFromMail(mail.messages).filter((draft) => !dismissedDraftIds.includes(draft.id)),
    [mail.messages, dismissedDraftIds],
  );

  const prev = () => {
    if (view === "month") setCurrentDate((d) => subMonths(d, 1));
    else if (view === "day") setCurrentDate((d) => subDays(d, 1));
    else setCurrentDate((d) => subWeeks(d, 1));
  };

  const next = () => {
    if (view === "month") setCurrentDate((d) => addMonths(d, 1));
    else if (view === "day") setCurrentDate((d) => addDays(d, 1));
    else setCurrentDate((d) => addWeeks(d, 1));
  };

  // ─── Dialog openers ─────────────────────────────────────────────────────────

  const openAdd = (day?: Date, hour?: number) => {
    if (!canEdit) return;
    setForm(defaultForm(day ?? selectedDay ?? undefined, hour));
    setEditEvent(null);
    setConfirmDelete(false);
    setAddOpen(true);
  };

  const openEdit = (event: CalendarEvent) => {
    // Virtual events (auto-imported) and birthdays synced from the Birthdays
    // widget are read-only here — manage birthdays from that widget instead,
    // or turn them off entirely via Settings → Birthdays.
    if (event.id?.startsWith("__") || event.source === "birthday") return;
    const { date: sd, time: st } = splitISO(event.startDate);
    const { date: ed, time: et } = splitISO(event.endDate);
    setForm({
      title: event.title,
      description: event.description ?? "",
      location: event.location ?? "",
      category: event.category,
      memberId: event.memberId ?? "all",
      priority: event.priority ?? "normal",
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
    if (!form.title.trim()) {
      toast.error("Add a title first");
      return;
    }
    const startISO = form.allDay
      ? `${form.startDate}T00:00:00.000Z`
      : toISO(form.startDate, form.startTime);
    const endISO = form.allDay
      ? `${form.endDate}T23:59:59.000Z`
      : toISO(form.endDate, form.endTime);

    const payload: Omit<CalendarEvent, "id"> = {
      title: form.title.trim(),
      category: form.category,
      memberId: form.memberId,
      priority: form.priority,
      startDate: startISO,
      endDate: endISO,
      allDay: form.allDay,
      invitees: form.invitees,
      notifications: form.notifications,
    };
    const description = form.description.trim();
    const location = form.location.trim();
    if (description) payload.description = description;
    if (location) payload.location = location;

    setSavingEvent(true);
    try {
      if (editEvent?.id) {
        await updateEvent(editEvent.id, payload);
        toast.success("Event updated");
      } else {
        await addEvent(payload);
        toast.success("Event added");
      }
      closeForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save that event");
    } finally {
      setSavingEvent(false);
    }
  };

  const handleDelete = async () => {
    if (!editEvent?.id) return;
    try {
      await deleteEvent(editEvent.id);
      toast.success("Event deleted");
      closeForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete that event");
    }
  };

  // ─── Month grid ──────────────────────────────────────────────────────────────

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn });
    return eachDayOfInterval({ start, end });
  }, [currentDate, weekStartsOn]);

  // ─── Week grid ───────────────────────────────────────────────────────────────

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn });
    const end = endOfWeek(currentDate, { weekStartsOn });
    return eachDayOfInterval({ start, end });
  }, [currentDate, weekStartsOn]);

  // ─── Member colour helper ────────────────────────────────────────────────────

  const getEventColor = (e: CalendarEvent): string => {
    const mid = e.memberId ?? "all";
    const mc = settings.memberColors?.[mid];
    if (mc) return mc;
    return CAT[e.category]?.color ?? "#6366f1";
  };

  // ─── Auto-imported virtual events (pets + household) ────────────────────────

  const virtualEvents = useMemo<CalendarEvent[]>(() => {
    const vEvents: CalendarEvent[] = [];
    const cutoff = addDays(new Date(), -14);
    const now = new Date();

    // Pet flea & worming next-due dates
    if (settings.autoImport?.pets !== false) {
      pets.forEach((pet) => {
        const computeNext = (
          type: "flea" | "worming",
          options: typeof pet.fleaOptions,
          selectedId: string,
          label: string,
          emoji: string
        ) => {
          const history = pet.treatmentHistory
            .filter((t) => t.type === type && t.dateGiven)
            .sort((a, b) => b.dateGiven.localeCompare(a.dateGiven));
          if (!history.length) return;
          const last = history[0];
          const opt = options.find((o) => o.id === selectedId);
          if (!opt) return;
          const nextDue = addDays(parseISO(last.dateGiven), opt.frequencyDays);
          if (nextDue < cutoff) return;
          vEvents.push({
            id: `__pet_${pet.id}_${type}`,
            title: `${emoji} ${pet.name} — ${label} due`,
            category: "health",
            startDate: nextDue.toISOString(),
            endDate: nextDue.toISOString(),
            allDay: true,
            priority: nextDue < now ? "urgent" : "normal",
          });
        };
        computeNext("flea", pet.fleaOptions, pet.selectedFlea, "Flea Treatment", "🐾");
        computeNext("worming", pet.wormOptions, pet.selectedWorm, "Worming Treatment", "🪱");
      });
    }

    // Household item renewal dates
    if (settings.autoImport?.household !== false) {
      householdItems.forEach((item) => {
        if (!item.endDate) return;
        const due = parseISO(item.endDate);
        if (due < cutoff) return;
        vEvents.push({
          id: `__hs_${item.id}`,
          title: `🏠 ${item.provider ? item.provider + " — " : ""}${item.type} renewal`,
          category: "other",
          startDate: due.toISOString(),
          endDate: due.toISOString(),
          allDay: true,
          priority: due < now ? "urgent" : "normal",
        });
      });
    }

    // Pet insurance renewals
    if (settings.autoImport?.petInsurance !== false) {
      pets.forEach((pet) => {
        if (!pet.insurance?.renewalDate) return;
        const due = parseISO(pet.insurance.renewalDate);
        if (due < cutoff) return;
        vEvents.push({
          id: `__pet_ins_${pet.id}`,
          title: `🐾 ${pet.name} — insurance renewal`,
          category: "health",
          startDate: due.toISOString(),
          endDate: due.toISOString(),
          allDay: true,
          priority: due < now ? "urgent" : "normal",
        });
      });
    }

    // Task due dates
    if (settings.autoImport?.tasks !== false) {
      tasks.forEach((task) => {
        if (!task.dueDate || task.status === "done") return;
        const due = parseISO(task.dueDate);
        if (due < cutoff) return;
        vEvents.push({
          id: `__task_${task.id}`,
          title: `✅ ${task.title}`,
          category: "work" as CalendarEventCategory,
          startDate: due.toISOString(),
          endDate: due.toISOString(),
          allDay: true,
          priority: (task.priority === "high" || due < now) ? "urgent" : "normal",
        });
      });
    }

    // Company insurance & tax filing dates
    if (settings.autoImport?.companies !== false) {
      companies.forEach((co) => {
        // Company tax year start as a reminder (annual)
        if (co.taxYearStart) {
          try {
            const base = parseISO(co.taxYearStart);
            // Show the upcoming tax year start
            const thisYear = new Date(now.getFullYear(), base.getMonth(), base.getDate());
            const nextOccurrence = thisYear < cutoff
              ? new Date(now.getFullYear() + 1, base.getMonth(), base.getDate())
              : thisYear;
            vEvents.push({
              id: `__co_tax_${co.id}`,
              title: `🏢 ${co.name} — tax year start`,
              category: "work" as CalendarEventCategory,
              startDate: nextOccurrence.toISOString(),
              endDate: nextOccurrence.toISOString(),
              allDay: true,
              priority: "normal",
            });
          } catch { /* ignore invalid date */ }
        }
      });
    }

    // Dated notes from the Notes workspace
    if (settings.autoImport?.notes !== false) {
      datedNotes.forEach((note) => {
        if (!note.dueDate || note.locked) return;
        try {
          const due = parseISO(note.dueDate.length === 10 ? `${note.dueDate}T12:00:00` : note.dueDate);
          if (due < cutoff) return;
          vEvents.push({
            id: `__note_${note.id}`,
            title: `📝 ${note.title || "Note"}`,
            category: "personal" as CalendarEventCategory,
            startDate: due.toISOString(),
            endDate: due.toISOString(),
            allDay: true,
            priority: due < now ? "urgent" : "normal",
          });
        } catch { /* ignore invalid date */ }
      });
    }

    return vEvents;
  }, [pets, householdItems, tasks, companies, datedNotes, settings.autoImport]);

  const allDisplayEvents = useMemo(() => {
    const merged = applyCalendarMergeRules(
      [
        ...events.filter((e) => e.source !== "birthday" || settings.autoImport?.birthdays !== false),
        ...virtualEvents,
      ],
      settings.mergeRules,
    );
    return merged.filter((event) => {
      const key = event.feedId ? `feed:${event.feedId}` : (event.source || "local");
      return !hiddenSources.includes(key);
    });
  }, [events, virtualEvents, settings.autoImport?.birthdays, settings.mergeRules, hiddenSources]);

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
      : view === "week"
        ? `${format(weekDays[0], "d MMM")} – ${format(weekDays[6], "d MMM yyyy")}`
        : view === "day"
          ? format(currentDate, "EEEE d MMMM yyyy")
          : "Coming up";

  const sourceChips = [
    { key: "local", label: "Hardy Hub" },
    { key: "google", label: "Google" },
    { key: "import", label: "Subscribed" },
    { key: "birthday", label: "Birthdays" },
    ...(settings.feeds || []).map((feed) => ({ key: `feed:${feed.id}`, label: feed.name })),
  ];

  const toggleSource = (key: string) =>
    setHiddenSources((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));

  const goToDay = (day: Date) => {
    setCurrentDate(day);
    setSelectedDay(day);
    setView("day");
  };

  const confirmMailDraft = async (draftId: string) => {
    const draft = mailDrafts.find((item) => item.id === draftId);
    if (!draft) return;
    try {
      await addEvent(draftToEventInput(draft));
      setDismissedDraftIds((prev) => [...prev, draft.id]);
      toast.success("Event added — you can edit the details if needed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add that event");
    }
  };

  const importIcsFile = async (file: File) => {
    setIcsBusy(true);
    try {
      const parsed = parseIcsEvents(await file.text(), `file_${Date.now()}`);
      if (!parsed.length) {
        toast.error("No events in that file");
        return;
      }
      for (const event of parsed) {
        await addEvent({
          title: event.title,
          description: event.description,
          location: event.location,
          category: event.category || "other",
          startDate: event.startDate,
          endDate: event.endDate,
          allDay: event.allDay,
          source: "import",
          feedId: event.feedId,
          googleEventId: event.googleEventId,
        });
      }
      toast.success(`Imported ${parsed.length} event${parsed.length === 1 ? "" : "s"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not import that calendar file");
    } finally {
      setIcsBusy(false);
      if (icsFileRef.current) icsFileRef.current.value = "";
    }
  };

  const suggestFromPaste = () => {
    const draft = draftFromPastedText(pasteDraft);
    if (!draft) {
      toast.error("Couldn't find a date in that text");
      return;
    }
    setForm({
      ...defaultForm(parseISO(`${draft.suggestedDate}T12:00:00`)),
      title: draft.suggestedTitle,
      startTime: draft.suggestedTime,
      endTime: draft.suggestedEndTime,
      description: draft.notes,
    });
    setEditEvent(null);
    setConfirmDelete(false);
    setAddOpen(true);
    toast.message("Check the event, then create it");
  };

  const editUnsubscribe = editEvent
    ? unsubscribeActionFromText(`${editEvent.description || ""}\n${editEvent.location || ""}`)
    : null;

  // ─── JSX ─────────────────────────────────────────────────────────────────────

  return (
    <FeaturePageShell
      title={pageTitle}
      icon={<CalendarDays className="w-5 h-5" />}
      sharePage="calendar"
    >

      <div className="flex min-w-0 gap-3">
        <aside className="w-[3.4rem] shrink-0 sm:w-[11rem]">
          <nav className="sticky top-2 space-y-1 rounded-2xl border border-border/50 bg-card p-1.5 shadow-card">
            {([
              { id: "day" as const, label: "Day", icon: Sun },
              { id: "week" as const, label: "Week", icon: CalendarDays },
              { id: "month" as const, label: "Month", icon: LayoutGrid },
              { id: "agenda" as const, label: "Agenda", icon: List },
            ]).map((item) => {
              const Icon = item.icon;
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setView(item.id)}
                  className={`flex w-full items-center gap-2 rounded-xl px-1.5 py-2 text-left transition sm:px-2 ${
                    active
                      ? "bg-gradient-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-[color-mix(in_srgb,hsl(var(--primary))_12%,transparent)] hover:text-foreground"
                  }`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? "bg-white/15" : "bg-muted"}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="hidden min-w-0 text-xs font-semibold sm:block">{item.label}</span>
                </button>
              );
            })}
            <div className="hidden space-y-1 border-t border-border/40 pt-2 sm:block">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Shown</p>
              {sourceChips.map((chip) => {
                const on = !hiddenSources.includes(chip.key);
                return (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => toggleSource(chip.key)}
                    className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold ${
                      on ? "bg-primary/10 text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    <span className="truncate">{chip.label}</span>
                    <span className={`h-2 w-2 rounded-full ${on ? "bg-primary" : "bg-border"}`} />
                  </button>
                );
              })}
            </div>
          </nav>
        </aside>
        <div className="min-w-0 flex-1 overflow-x-hidden">
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
          <button
            onClick={() => { setCurrentDate(new Date()); setSelectedDay(new Date()); }}
            className="text-[11px] sm:text-xs font-medium text-primary px-2 sm:px-3 py-1.5 rounded-lg border border-primary/30 hover:bg-primary/10 transition-colors"
          >
            Today
          </button>

          {(isAdmin || isOwnScope) && (
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors"
              aria-label="Calendar settings"
            >
              <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}

          {/* Add event */}
          {canEdit && (
            <button
              onClick={() => openAdd()}
              className="flex items-center gap-1 rounded-lg bg-gradient-primary px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground sm:px-3 sm:text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          )}
        </div>
      </div>

      {mailDrafts.length > 0 && canEdit && (
        <div
          className="mb-3 overflow-hidden rounded-2xl border border-border/60 bg-card p-3 shadow-card"
          style={{ borderLeftWidth: 4, borderLeftColor: "hsl(var(--primary))", background: "color-mix(in srgb, hsl(var(--primary)) 10%, hsl(var(--card)))" }}
        >
          <p className="text-sm font-semibold">Suggested from mail</p>
          <p className="mb-2 text-[11px] text-muted-foreground">Nothing is added until you confirm.</p>
          <div className="space-y-2">
            {mailDrafts.map((draft) => (
              <div key={draft.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/50 bg-card px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{draft.suggestedTitle}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {draft.suggestedDate} · {draft.suggestedTime}–{draft.suggestedEndTime}
                    {draft.from ? ` · ${draft.from}` : ""}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => setDismissedDraftIds((prev) => [...prev, draft.id])}>
                    Skip
                  </Button>
                  <Button size="sm" onClick={() => void confirmMailDraft(draft.id)}>
                    Add event
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Month view ── */}
      {view === "month" && (
        <div
          className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-card"
          style={{ borderLeftWidth: 4, borderLeftColor: "hsl(var(--primary))", background: "color-mix(in srgb, hsl(var(--primary)) 8%, hsl(var(--card)))" }}
        >
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 border-b border-border/40 bg-card">
            {weekDayNames.map((d) => (
              <div key={d} className="py-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-foreground sm:py-3 sm:text-[11px]">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {monthDays.map((day) => {
              const dayEvts = eventsForDay(day);
              const inMonth = isSameMonth(day, currentDate);
              const today = isToday(day);
              const selected = selectedDay && isSameDay(day, selectedDay);

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDay((prev) => (prev && isSameDay(prev, day) ? null : day))}
                  onDoubleClick={() => goToDay(day)}
                  className={`flex min-h-[78px] flex-col border border-border/20 p-1 text-left transition-colors sm:min-h-[104px] sm:p-1.5 md:min-h-[122px] ${
                    !inMonth ? "bg-background/40 text-muted-foreground" : selected ? "bg-primary/12" : today ? "bg-primary/8" : "bg-card hover:bg-primary/5"
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
                      className="mb-0.5"
                      onClick={(ev) => { ev.stopPropagation(); openEdit(e); }}
                    >
                      <EventChip event={e} color={getEventColor(e)} dense />
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

      {/* ── Day view ── */}
      {view === "day" && (
        <TimedGrid
          days={[currentDate]}
          events={allDisplayEvents}
          selectedDate={currentDate}
          workDayStartHour={dayHours.start}
          workDayEndHour={dayHours.end}
          onSelectDay={goToDay}
          onOpenEvent={openEdit}
          onCreateAt={(day, hour) => openAdd(day, hour)}
          accentFor={getEventColor}
        />
      )}

      {/* ── Week view ── */}
      {view === "week" && (
        <>
          <div className="hidden md:block">
            <TimedGrid
              days={weekDays}
              events={allDisplayEvents}
              selectedDate={selectedDay ?? currentDate}
              workDayStartHour={dayHours.start}
              workDayEndHour={dayHours.end}
              onSelectDay={goToDay}
              onOpenEvent={openEdit}
              onCreateAt={(day, hour) => openAdd(day, hour)}
              accentFor={getEventColor}
            />
          </div>
          <div className="rounded-2xl border border-border/40 overflow-hidden bg-card shadow-card md:hidden">
          <div className="grid grid-cols-7 divide-x divide-border/30">
            {weekDays.map((day) => {
              const dayEvts = eventsForDay(day);
              const today = isToday(day);
              const selected = selectedDay && isSameDay(day, selectedDay);

              return (
                <div key={day.toISOString()} className="min-h-[200px] flex flex-col">
                  <button
                    type="button"
                    onClick={() => goToDay(day)}
                    className={`w-full py-2 flex flex-col items-center border-b border-border/30 transition-colors ${
                      today ? "bg-primary/10" : selected ? "bg-primary/5" : "hover:bg-muted/30"
                    }`}
                  >
                    <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">
                      {format(day, "EEE")}
                    </span>
                    <span
                      className={`text-sm font-bold w-7 h-7 rounded-full flex items-center justify-center ${
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
                  <div className="flex-1 p-1 space-y-0.5 overflow-hidden">
                    {dayEvts.map((e) => (
                      <button key={e.id} type="button" onClick={() => openEdit(e)} className="block w-full text-left">
                        <EventChip event={e} color={getEventColor(e)} />
                      </button>
                    ))}
                    <button
                      onClick={() => openAdd(day)}
                      className="w-full text-[9px] text-muted-foreground/50 hover:text-muted-foreground py-0.5 flex items-center justify-center hover:bg-muted/30 rounded transition-colors"
                    >
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        </>
      )}

      {/* ── Day detail panel ── */}
      <AnimatePresence>
        {selectedDay && view !== "day" && (
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
                {eventsForDay(selectedDay).map((e) => {
                  const color = getEventColor(e);
                  return (
                  <button
                    key={e.id}
                    onClick={() => openEdit(e)}
                    className={`w-full text-left flex items-stretch gap-3 p-3 rounded-2xl border transition-colors group ${
                      e.priority === "urgent"
                        ? "border-red-500/30"
                        : "border-black/5"
                    } ${e.id?.startsWith("__") ? "cursor-default" : ""}`}
                    style={{
                      background: `linear-gradient(135deg, color-mix(in srgb, ${color} 20%, hsl(var(--card))), color-mix(in srgb, ${color} 7%, hsl(var(--card))))`,
                      boxShadow: `inset 0 1px 0 color-mix(in srgb, ${color} 24%, white)`,
                    }}
                  >
                    <div
                      className="w-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {e.priority === "urgent" && (
                          <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                        )}
                        <p className="text-sm font-display font-semibold text-card-foreground">{e.title}</p>
                        {e.id?.startsWith("__") && (
                          <span className="text-[9px] text-muted-foreground border border-border/40 px-1 py-0.5 rounded">auto</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {e.allDay ? (
                          <span className="text-[10px] font-semibold flex items-center gap-1" style={{ color }}>
                            <Clock className="w-3 h-3" /> All day
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold flex items-center gap-1" style={{ color }}>
                            <Clock className="w-3 h-3" />
                            {format(parseISO(e.startDate), "H:mm")} – {format(parseISO(e.endDate), "H:mm")}
                          </span>
                        )}
                        {e.location && (
                          <span className="text-[10px] text-foreground/70 flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 flex-shrink-0" />{e.location}
                          </span>
                        )}
                        {e.invitees && e.invitees.length > 0 && (
                          <span className="text-[10px] text-foreground/70 flex items-center gap-1">
                            <Users className="w-3 h-3" /> {e.invitees.join(", ")}
                          </span>
                        )}
                      </div>
                      {e.description && (
                        <p className="text-[11px] text-foreground/70 mt-1 line-clamp-2">{e.description}</p>
                      )}
                    </div>
                    <span
                      className="text-[9px] font-bold px-2 py-1 rounded-full text-white self-start flex-shrink-0"
                      style={{ backgroundColor: color }}
                    >
                      {e.memberId && e.memberId !== "all"
                        ? hSettings.members.find((m) => m.id === e.memberId)?.name ?? e.memberId
                        : CAT[e.category]?.label ?? "Event"}
                    </span>
                  </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {view === "agenda" && (
        <div className="space-y-2">
          {Array.from({ length: 21 }, (_, index) => addDays(startOfDay(currentDate), index)).map((day) => {
            const dayEvts = eventsForDay(day);
            if (!dayEvts.length && !isToday(day)) return null;
            return (
              <div
                key={day.toISOString()}
                className="rounded-2xl border border-border/50 bg-card p-3 shadow-card"
                style={{ borderLeftWidth: 4, borderLeftColor: isToday(day) ? "hsl(var(--primary))" : "transparent" }}
              >
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {isToday(day) ? "Today · " : ""}{format(day, "EEEE d MMMM")}
                </p>
                {dayEvts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing planned</p>
                ) : (
                  <div className="space-y-1.5">
                    {dayEvts.map((e) => (
                      <button key={e.id} type="button" onClick={() => openEdit(e)} className="block w-full text-left">
                        <EventChip event={e} color={getEventColor(e)} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
        </div>
      </div>

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

            {/* Who is this for? (member colour picker) */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5" /> Who is this for?
              </Label>
              <div className="flex flex-wrap gap-2">
                {/* Everyone / shared option */}
                <button
                  onClick={() => setForm((f) => ({ ...f, memberId: "all" }))}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-semibold text-white transition-all ${
                    form.memberId === "all" ? "ring-2 ring-offset-2 ring-offset-background scale-105" : "opacity-70"
                  }`}
                  style={{ backgroundColor: settings.memberColors?.["all"] ?? "#f59e0b" }}
                >
                  👨‍👩‍👧 Everyone
                </button>
                {hSettings.members.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setForm((f) => ({ ...f, memberId: m.id }))}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-semibold text-white transition-all ${
                      form.memberId === m.id ? "ring-2 ring-offset-2 ring-offset-background scale-105" : "opacity-70"
                    }`}
                    style={{ backgroundColor: settings.memberColors?.[m.id] ?? "#6366f1" }}
                  >
                    {m.emoji && m.emoji + " "}{m.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-border/30 bg-muted/20">
              <div>
                <p className="text-sm font-medium">Mark as urgent</p>
                <p className="text-[11px] text-muted-foreground">Highlighted with red border on calendar</p>
              </div>
              <Switch
                checked={form.priority === "urgent"}
                onCheckedChange={(v) => setForm((f) => ({ ...f, priority: v ? "urgent" : "normal" }))}
              />
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

            {editUnsubscribe?.http && (
              <a
                href={editUnsubscribe.http}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
              >
                Unsubscribe from this list
              </a>
            )}
            {editUnsubscribe?.mailto && !editUnsubscribe.http && (
              <a href={`mailto:${editUnsubscribe.mailto}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                Unsubscribe by email
              </a>
            )}

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
                    value={n.amount || ""}
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
                  Email & SMS use the channels you enable in Notification Settings.
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
              <Button type="button" variant="outline" className="flex-1" onClick={closeForm}>
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={() => void handleSave()}
                disabled={!form.title.trim() || savingEvent}
              >
                {savingEvent ? "Saving…" : editEvent ? "Save changes" : "Create event"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Settings dialog ── */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-4 h-4" /> Calendar Settings
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-1">

            {/* Default view */}
            <div className="space-y-1.5">
              <Label>Default view</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(["day", "week", "month", "agenda"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => saveSettings({ ...settings, defaultView: v })}
                    className={`py-2 rounded-xl text-sm font-medium border transition-colors capitalize ${
                      settings.defaultView === v
                        ? "bg-gradient-primary text-primary-foreground border-transparent"
                        : "border-border/50 text-muted-foreground hover:bg-[color-mix(in_srgb,hsl(var(--primary))_12%,transparent)]"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Week starts on</Label>
              <div className="flex gap-2">
                {([{ value: 1 as const, label: "Monday" }, { value: 0 as const, label: "Sunday" }]).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => saveSettings({ ...settings, weekStartsOn: option.value })}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                      weekStartsOn === option.value
                        ? "bg-gradient-primary text-primary-foreground border-transparent"
                        : "border-border/50 text-muted-foreground hover:bg-[color-mix(in_srgb,hsl(var(--primary))_12%,transparent)]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Day starts</Label>
                <Input
                  type="number"
                  min={0}
                  max={22}
                  value={dayHours.start}
                  onChange={(e) => saveSettings({ ...settings, workDayStartHour: Number(e.target.value) })}
                  className="h-9 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Day ends</Label>
                <Input
                  type="number"
                  min={1}
                  max={23}
                  value={dayHours.end}
                  onChange={(e) => saveSettings({ ...settings, workDayEndHour: Number(e.target.value) })}
                  className="h-9 rounded-xl"
                />
              </div>
            </div>

            {/* Member colours */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5" /> Member colours
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Each member gets a colour for their calendar events.
              </p>

              {/* Everyone / shared */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20 border border-border/30">
                <div className="flex items-center gap-2">
                  <div
                    className="w-5 h-5 rounded-full border-2 border-white shadow"
                    style={{ backgroundColor: settings.memberColors?.["all"] ?? "#f59e0b" }}
                  />
                  <span className="text-sm font-medium">👨‍👩‍👧 Everyone (shared)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex gap-1 flex-wrap max-w-[140px]">
                    {MEMBER_COLOR_PRESETS.slice(0, 6).map((c) => (
                      <button
                        key={c}
                        onClick={() => saveSettings({
                          ...settings,
                          memberColors: { ...(settings.memberColors ?? {}), all: c },
                        })}
                        className={`w-5 h-5 rounded-full border-2 transition-transform ${
                          (settings.memberColors?.["all"] ?? "#f59e0b") === c
                            ? "border-foreground scale-110"
                            : "border-transparent hover:scale-110"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <input
                    type="color"
                    value={settings.memberColors?.["all"] ?? "#f59e0b"}
                    onChange={(e) => saveSettings({
                      ...settings,
                      memberColors: { ...(settings.memberColors ?? {}), all: e.target.value },
                    })}
                    className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent"
                    title="Custom colour"
                  />
                </div>
              </div>

              {hSettings.members.map((m, idx) => (
                <div key={m.id} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20 border border-border/30">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded-full border-2 border-white shadow"
                      style={{ backgroundColor: settings.memberColors?.[m.id] ?? MEMBER_COLOR_PRESETS[idx % MEMBER_COLOR_PRESETS.length] }}
                    />
                    <span className="text-sm font-medium">{m.emoji && m.emoji + " "}{m.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex gap-1 flex-wrap max-w-[140px]">
                      {MEMBER_COLOR_PRESETS.slice(0, 6).map((c) => (
                        <button
                          key={c}
                          onClick={() => saveSettings({
                            ...settings,
                            memberColors: { ...(settings.memberColors ?? {}), [m.id]: c },
                          })}
                          className={`w-5 h-5 rounded-full border-2 transition-transform ${
                            (settings.memberColors?.[m.id] ?? MEMBER_COLOR_PRESETS[idx % MEMBER_COLOR_PRESETS.length]) === c
                              ? "border-foreground scale-110"
                              : "border-transparent hover:scale-110"
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <input
                      type="color"
                      value={settings.memberColors?.[m.id] ?? MEMBER_COLOR_PRESETS[idx % MEMBER_COLOR_PRESETS.length]}
                      onChange={(e) => saveSettings({
                        ...settings,
                        memberColors: { ...(settings.memberColors ?? {}), [m.id]: e.target.value },
                      })}
                      className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent"
                      title="Custom colour"
                    />
                  </div>
                </div>
              ))}

              {hSettings.members.length === 0 && (
                <p className="text-[11px] text-muted-foreground italic">
                  Add household members in Households settings to assign individual colours.
                </p>
              )}
            </div>

            {isOwnScope && canEdit && (
              <div className="space-y-3 rounded-2xl border border-border/50 bg-card p-3">
                <p className="text-sm font-semibold">Bring calendars in</p>
                <p className="text-[11px] text-muted-foreground">
                  Google login is the full two-way sync. Outlook, Exchange and iCloud use a published ICS / webcal link — no Microsoft Graph login.
                </p>
                {settings.google?.connected ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Linked as {settings.google.email || "Google"}.</p>
                    {settings.google.lastError && (
                      <p className="text-xs text-destructive">{settings.google.lastError}</p>
                    )}
                    {settings.google.lastSyncAt && !settings.google.lastError && (
                      <p className="text-[10px] text-muted-foreground">
                        Last synced {new Date(settings.google.lastSyncAt).toLocaleString("en-GB")}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" disabled={gcalBusy} onClick={async () => {
                        setGcalBusy(true);
                        try {
                          const result = await syncGoogleCalendar(scopeUserId || undefined);
                          toast.success(result.upserted ? `Synced ${result.upserted} event${result.upserted === 1 ? "" : "s"}` : "Already up to date");
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Could not sync");
                        } finally {
                          setGcalBusy(false);
                        }
                      }}>{gcalBusy ? "Syncing…" : "Sync Google"}</Button>
                      <Button size="sm" variant="ghost" disabled={gcalBusy} onClick={async () => {
                        setGcalBusy(true);
                        try {
                          await disconnectGoogleCalendar();
                          toast.success("Google Calendar disconnected");
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Could not disconnect");
                        } finally {
                          setGcalBusy(false);
                        }
                      }}>Disconnect</Button>
                    </div>
                    {gcalList.map((item) => {
                      const selected = (settings.google?.selectedCalendarIds || ["primary"]).includes(item.id) ||
                        (item.primary && (settings.google?.selectedCalendarIds || []).includes("primary"));
                      return (
                        <label key={item.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={selected}
                            onCheckedChange={async (checked) => {
                              const current = settings.google?.selectedCalendarIds || ["primary"];
                              const next = checked
                                ? [...new Set([...current, item.id])]
                                : current.filter((id) => id !== item.id && !(item.primary && id === "primary"));
                              setGcalBusy(true);
                              try {
                                await saveGoogleCalendarSelection(next.length ? next : [item.id], item.primary ? item.id : settings.google?.calendarId, scopeUserId || undefined);
                                const result = await syncGoogleCalendar(scopeUserId || undefined);
                                if (result.upserted) {
                                  toast.success(`Synced ${result.upserted} event${result.upserted === 1 ? "" : "s"}`);
                                }
                              } catch (err) {
                                toast.error(err instanceof Error ? err.message : "Could not update that calendar");
                              } finally {
                                setGcalBusy(false);
                              }
                            }}
                          />
                          {item.name}{item.primary ? " (main)" : ""}
                        </label>
                      );
                    })}
                    {!gcalList.length && (
                      <p className="text-[11px] text-muted-foreground">
                        Your Google calendars should appear here. If this stays empty, tap Sync Google — or reconnect Google Calendar.
                      </p>
                    )}
                  </div>
                ) : (
                  <Button size="sm" disabled={gcalBusy} onClick={async () => {
                    setGcalBusy(true);
                    try {
                      window.location.href = await startGoogleCalendarConnect();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Could not start Google Calendar");
                      setGcalBusy(false);
                    }
                  }}>Connect Google Calendar</Button>
                )}

                <div className="space-y-2 border-t border-border/40 pt-3">
                  <p className="text-xs font-semibold">ICS / iCloud / Outlook / Exchange</p>
                  <p className="text-[11px] text-muted-foreground">
                    Outlook: calendar → Share → Publish a calendar, then paste the ICS link. Exchange is the same ICS URL. iCloud: Calendar → Sharing → Public Calendar.
                  </p>
                  <Input placeholder="Name (e.g. Outlook)" value={feedDraft.name} onChange={(e) => setFeedDraft((d) => ({ ...d, name: e.target.value }))} className="h-9 rounded-xl" />
                  <Input placeholder="https:// or webcal:// calendar link" value={feedDraft.url} onChange={(e) => setFeedDraft((d) => ({ ...d, url: e.target.value }))} className="h-9 rounded-xl" />
                  <Button size="sm" disabled={feedBusy || !feedDraft.url} onClick={async () => {
                    const feed: CalendarFeed = {
                      id: `feed_${Date.now()}`,
                      name: feedDraft.name.trim() || "Calendar",
                      url: feedDraft.url.trim(),
                      kind: /icloud/i.test(feedDraft.url) ? "icloud" : /outlook|office|exchange/i.test(`${feedDraft.url} ${feedDraft.name}`) ? "exchange" : "ics",
                      enabled: true,
                    };
                    setFeedBusy(true);
                    try {
                      await saveSettings({ feeds: [...(settings.feeds || []), feed] });
                      const result = await syncCalendarFeed(feed);
                      toast.success(`Added ${result.upserted} events`);
                      setFeedDraft({ name: "", url: "" });
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Could not add that calendar");
                    } finally {
                      setFeedBusy(false);
                    }
                  }}>
                    <Link2 className="mr-1 h-3.5 w-3.5" /> Add calendar
                  </Button>
                  {(settings.feeds || []).map((feed) => (
                    <div key={feed.id} className="flex items-center justify-between gap-2 rounded-xl border border-border/40 px-2.5 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{feed.name}</p>
                        <p className="truncate text-[10px] text-muted-foreground">{feed.lastSyncAt ? `Synced ${new Date(feed.lastSyncAt).toLocaleString("en-GB")}` : feed.url}</p>
                      </div>
                      <div className="flex gap-1">
                        <button type="button" className="rounded-lg p-1.5 hover:bg-muted" onClick={async () => {
                          setFeedBusy(true);
                          try {
                            await syncCalendarFeed(feed);
                            toast.success("Calendar updated");
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Could not sync");
                          } finally {
                            setFeedBusy(false);
                          }
                        }}>
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" className="rounded-lg p-1.5 hover:bg-muted" onClick={() => saveSettings({ feeds: (settings.feeds || []).filter((item) => item.id !== feed.id) })}>
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="space-y-2 border-t border-border/40 pt-3">
                    <p className="text-xs font-semibold">Import an .ics file</p>
                    <input
                      ref={icsFileRef}
                      type="file"
                      accept=".ics,text/calendar"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void importIcsFile(file);
                      }}
                    />
                    <Button size="sm" variant="outline" disabled={icsBusy} onClick={() => icsFileRef.current?.click()}>
                      <Upload className="mr-1 h-3.5 w-3.5" /> {icsBusy ? "Importing…" : "Choose ICS file"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Merge rules</Label>
              <p className="text-[11px] text-muted-foreground">Decide what makes it into the one calendar you actually use.</p>
              <label className="flex items-center justify-between rounded-xl border border-border/40 px-3 py-2 text-sm">
                Hide duplicate titles on the same day
                <Switch checked={settings.mergeRules?.hideDuplicates !== false} onCheckedChange={(v) => saveSettings({ mergeRules: { ...settings.mergeRules, hideDuplicates: v } })} />
              </label>
              <label className="flex items-center justify-between rounded-xl border border-border/40 px-3 py-2 text-sm">
                Hide public-holiday all-day events
                <Switch checked={settings.mergeRules?.hideAllDayHolidays === true} onCheckedChange={(v) => saveSettings({ mergeRules: { ...settings.mergeRules, hideAllDayHolidays: v } })} />
              </label>
              <label className="flex items-center justify-between rounded-xl border border-border/40 px-3 py-2 text-sm">
                Hide likely junk invites
                <Switch
                  aria-label="Hide likely junk invites"
                  checked={settings.mergeRules?.hideLikelyJunk === true}
                  onCheckedChange={(v) => saveSettings({ mergeRules: { ...settings.mergeRules, hideLikelyJunk: v } })}
                />
              </label>
              <Input
                placeholder="Hide titles containing… (comma separated)"
                defaultValue={(settings.mergeRules?.hideTitleContains || []).join(", ")}
                onBlur={(e) => saveSettings({
                  mergeRules: {
                    ...settings.mergeRules,
                    hideTitleContains: e.target.value.split(",").map((item) => item.trim()).filter(Boolean),
                  },
                })}
                className="h-9 rounded-xl"
              />
            </div>

            {isOwnScope && (
              <div className="space-y-2 rounded-2xl border border-border/50 bg-card p-3">
                <p className="text-sm font-semibold">One calendar to share</p>
                <p className="text-[11px] text-muted-foreground">
                  Download or subscribe to the merged calendar on your phone so you can hide the five others.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => downloadIcs("hardy-hub.ics", eventsToIcs(allDisplayEvents))}>
                    <Download className="mr-1 h-3.5 w-3.5" /> Download ICS
                  </Button>
                  <Button size="sm" onClick={async () => {
                    try {
                      const published = await publishMergedCalendar();
                      await saveSettings({ mergeShareToken: published.token });
                      await navigator.clipboard.writeText(published.url);
                      toast.success("Subscribe link copied");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Could not publish");
                    }
                  }}>
                    Copy subscribe link
                  </Button>
                </div>
                {settings.mergeShareToken && (
                  <p className="break-all text-[10px] text-muted-foreground">{mergedCalendarSubscribeUrl(settings.mergeShareToken)}</p>
                )}
              </div>
            )}

            <div className="space-y-2 rounded-2xl border border-border/50 bg-card p-3">
              <p className="text-sm font-semibold">Suggest an event from text</p>
              <p className="text-[11px] text-muted-foreground">
                Paste a mail or invite. We guess a date and time — you still confirm before it is created.
              </p>
              <Textarea
                rows={3}
                value={pasteDraft}
                onChange={(e) => setPasteDraft(e.target.value)}
                placeholder="Parents evening, 14 September 2026 at 6pm"
                className="resize-none rounded-xl"
              />
              <Button size="sm" variant="outline" disabled={!pasteDraft.trim()} onClick={suggestFromPaste}>
                Review suggested event
              </Button>
            </div>

            <div className="space-y-2 rounded-2xl border border-border/50 bg-card p-3">
              <p className="text-sm font-semibold">Add Calendar to your home screen</p>
              <p className="text-[11px] text-muted-foreground">
                Open this page on your phone, then use your browser’s Add to Home Screen. While you are here, Hardy Hub offers a calendar-first icon and start page.
              </p>
            </div>

            {/* Auto-import */}
            <div className="space-y-2">
              <Label>Auto-import events</Label>
              <p className="text-[11px] text-muted-foreground">
                Show dates from other areas of the app on your calendar.
              </p>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20 border border-border/30">
                <div>
                  <p className="text-sm font-medium">🐾 Pet treatments</p>
                  <p className="text-[11px] text-muted-foreground">Flea &amp; worming due dates</p>
                </div>
                <Switch
                  checked={settings.autoImport?.pets !== false}
                  onCheckedChange={(v) => saveSettings({
                    ...settings,
                    autoImport: { ...(settings.autoImport ?? {}), pets: v },
                  })}
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20 border border-border/30">
                <div>
                  <p className="text-sm font-medium">🏠 Household renewals</p>
                  <p className="text-[11px] text-muted-foreground">Insurance &amp; utility renewal dates</p>
                </div>
                <Switch
                  checked={settings.autoImport?.household !== false}
                  onCheckedChange={(v) => saveSettings({
                    ...settings,
                    autoImport: { ...(settings.autoImport ?? {}), household: v },
                  })}
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20 border border-border/30">
                <div>
                  <p className="text-sm font-medium">🐶 Pet insurance</p>
                  <p className="text-[11px] text-muted-foreground">Pet insurance renewal dates</p>
                </div>
                <Switch
                  checked={settings.autoImport?.petInsurance !== false}
                  onCheckedChange={(v) => saveSettings({
                    ...settings,
                    autoImport: { ...(settings.autoImport ?? {}), petInsurance: v },
                  })}
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20 border border-border/30">
                <div>
                  <p className="text-sm font-medium">✅ Task due dates</p>
                  <p className="text-[11px] text-muted-foreground">Tasks with a due date set</p>
                </div>
                <Switch
                  checked={settings.autoImport?.tasks !== false}
                  onCheckedChange={(v) => saveSettings({
                    ...settings,
                    autoImport: { ...(settings.autoImport ?? {}), tasks: v },
                  })}
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20 border border-border/30">
                <div>
                  <p className="text-sm font-medium">🏢 Company dates</p>
                  <p className="text-[11px] text-muted-foreground">Tax year starts for each company</p>
                </div>
                <Switch
                  checked={settings.autoImport?.companies !== false}
                  onCheckedChange={(v) => saveSettings({
                    ...settings,
                    autoImport: { ...(settings.autoImport ?? {}), companies: v },
                  })}
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20 border border-border/30">
                <div>
                  <p className="text-sm font-medium">📝 Notes dates</p>
                  <p className="text-[11px] text-muted-foreground">Dated notes from the Notes workspace</p>
                </div>
                <Switch
                  checked={settings.autoImport?.notes !== false}
                  onCheckedChange={(v) => saveSettings({
                    ...settings,
                    autoImport: { ...(settings.autoImport ?? {}), notes: v },
                  })}
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20 border border-border/30">
                <div>
                  <p className="text-sm font-medium">🎂 Birthdays</p>
                  <p className="text-[11px] text-muted-foreground">Birthdays shared with you from the Birthdays widget</p>
                </div>
                <Switch
                  checked={settings.autoImport?.birthdays !== false}
                  onCheckedChange={(v) => saveSettings({
                    ...settings,
                    autoImport: { ...(settings.autoImport ?? {}), birthdays: v },
                  })}
                />
              </div>
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
