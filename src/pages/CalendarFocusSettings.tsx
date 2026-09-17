import { useMemo, useState } from "react";
import { Bell, CalendarDays, ChevronLeft, Cloud, MapPin, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCalendar } from "@/hooks/useCalendar";
import { useSharedScope } from "@/hooks/useSharedScope";
import { googleMapsConfigured } from "@/lib/googleMapsClient";
import { startGoogleCalendarConnect, syncGoogleCalendar } from "@/lib/googleCalendarApi";
import type { CalendarNotificationPref } from "@/types/app";

const COLORS = ["#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#ef4444", "#14b8a6"];

type FocusCalendar = { id: string; name: string; color: string; visible?: boolean };
type ReminderPreset = Pick<CalendarNotificationPref, "via" | "amount" | "unit">;
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

const BASE_DEFAULTS: FocusDefaults = {
  timedEvent: [{ via: "push", amount: 30, unit: "minutes" }],
  allDayEvent: [{ via: "push", amount: 12, unit: "hours" }],
  task: [{ via: "push", amount: 30, unit: "minutes" }],
  reminder: [{ via: "push", amount: 0, unit: "minutes" }],
};

function normalizeCalendars(settings: FocusSettings): FocusCalendar[] {
  const stored = Array.isArray(settings.focusCalendars) ? settings.focusCalendars.filter((item) => item?.id && item?.name) : [];
  const personal = stored.find((item) => item.id === "personal") || { id: "personal", name: "Personal", color: "#6366f1", visible: true };
  return [personal, ...stored.filter((item) => item.id !== "personal")];
}

function normalizeDefaults(settings: FocusSettings): FocusDefaults {
  return {
    timedEvent: settings.focusDefaults?.timedEvent?.length ? settings.focusDefaults.timedEvent : BASE_DEFAULTS.timedEvent,
    allDayEvent: settings.focusDefaults?.allDayEvent?.length ? settings.focusDefaults.allDayEvent : BASE_DEFAULTS.allDayEvent,
    task: settings.focusDefaults?.task?.length ? settings.focusDefaults.task : BASE_DEFAULTS.task,
    reminder: settings.focusDefaults?.reminder?.length ? settings.focusDefaults.reminder : BASE_DEFAULTS.reminder,
  };
}

export default function CalendarFocusSettings() {
  const navigate = useNavigate();
  const { scopeUserId, pageTitle, permission } = useSharedScope("calendar");
  const canEdit = permission === "edit";
  const { events, settings: rawSettings, saveSettings, updateEvent } = useCalendar(scopeUserId ?? undefined);
  const settings = rawSettings as typeof rawSettings & FocusSettings;
  const calendars = useMemo(() => normalizeCalendars(settings), [settings.focusCalendars]);
  const defaults = useMemo(() => normalizeDefaults(settings), [settings.focusDefaults]);
  const [newCalendar, setNewCalendar] = useState("");
  const [newColor, setNewColor] = useState(COLORS[1]);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const saveCalendars = async (next: FocusCalendar[]) => {
    await saveSettings({ focusCalendars: next } as any);
  };

  const addCalendar = async () => {
    const name = newCalendar.trim();
    if (!name) return;
    const id = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "calendar"}-${Date.now().toString(36)}`;
    await saveCalendars([...calendars, { id, name, color: newColor, visible: true }]);
    setNewCalendar("");
    toast.success(`${name} calendar added`);
  };

  const removeCalendar = async (calendar: FocusCalendar) => {
    if (calendar.id === "personal") return;
    const affected = events.filter((event) => (event as any).calendarId === calendar.id && !(event as any).sharedMirror);
    try {
      await Promise.all(affected.map((event) => event.id ? updateEvent(event.id, { calendarId: "personal" } as any) : Promise.resolve()));
      await saveCalendars(calendars.filter((item) => item.id !== calendar.id));
      toast.success(`${calendar.name} removed${affected.length ? ` · ${affected.length} item${affected.length === 1 ? "" : "s"} moved to Personal` : ""}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove that calendar");
    }
  };

  const updateDefault = async (key: keyof FocusDefaults, patch: Partial<ReminderPreset>) => {
    const current = defaults[key][0] || BASE_DEFAULTS[key][0];
    const next: FocusDefaults = { ...defaults, [key]: [{ ...current, ...patch, via: "push" }] };
    await saveSettings({ focusDefaults: next } as any);
  };

  const connectGoogle = async () => {
    setConnecting(true);
    try {
      window.location.href = await startGoogleCalendarConnect();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not connect Google Calendar");
      setConnecting(false);
    }
  };

  const syncGoogle = async () => {
    setSyncing(true);
    try {
      const result = await syncGoogleCalendar(scopeUserId ?? undefined);
      toast.success(`Google Calendar synced · ${result.upserted} updated`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sync Google Calendar");
    } finally {
      setSyncing(false);
    }
  };

  const defaultRows: Array<{ key: keyof FocusDefaults; label: string; hint: string }> = [
    { key: "timedEvent", label: "Timed events", hint: "Meetings, appointments and anything with a start time" },
    { key: "allDayEvent", label: "All-day events", hint: "Birthdays, leave and day-long entries" },
    { key: "task", label: "Tasks", hint: "Things you need to get done" },
    { key: "reminder", label: "Reminders", hint: "Simple prompts" },
  ];

  return (
    <FeaturePageShell
      title={`${pageTitle} settings`}
      subtitle="Keep the everyday calendar simple, and put the choices here"
      icon={<SettingsIcon />}
      action={<Button variant="outline" size="sm" className="rounded-xl" onClick={() => navigate("/calendar-focus")}><ChevronLeft className="mr-1 h-4 w-4" /> Calendar</Button>}
    >
      <div className="mx-auto max-w-4xl space-y-4">
        <section className="rounded-3xl border border-border/50 bg-card p-4 shadow-card sm:p-5">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><CalendarDays className="h-5 w-5" /></div>
            <div><h2 className="font-display text-lg font-bold">Your calendars</h2><p className="text-sm text-muted-foreground">Focus starts with Personal only. Add calendars when they are useful; they become one-tap choices in the new-item box.</p></div>
          </div>
          <div className="space-y-2">
            {calendars.map((calendar) => (
              <div key={calendar.id} className="flex items-center gap-3 rounded-2xl border border-border/45 bg-background/45 px-3 py-2.5">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: calendar.color }} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{calendar.name}</span>
                <span className="hidden text-[10px] text-muted-foreground sm:inline">{calendar.id === "personal" ? "Default" : "Custom"}</span>
                <Switch checked={calendar.visible !== false} disabled={!canEdit} onCheckedChange={(visible) => void saveCalendars(calendars.map((item) => item.id === calendar.id ? { ...item, visible } : item))} aria-label={`Show ${calendar.name}`} />
                {calendar.id !== "personal" && canEdit && <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive" onClick={() => void removeCalendar(calendar)} aria-label={`Delete ${calendar.name}`}><Trash2 className="h-4 w-4" /></Button>}
              </div>
            ))}
          </div>
          {canEdit && (
            <div className="mt-4 rounded-2xl bg-muted/40 p-3">
              <Label className="mb-2 block text-xs font-bold">Add a calendar</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input value={newCalendar} onChange={(e) => setNewCalendar(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void addCalendar(); }} placeholder="e.g. Work, Family, BGM Medical" className="h-10 flex-1 rounded-xl bg-card" />
                <Button className="rounded-xl" onClick={() => void addCalendar()} disabled={!newCalendar.trim()}><Plus className="mr-1 h-4 w-4" /> Add</Button>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {COLORS.map((color) => <button key={color} type="button" onClick={() => setNewColor(color)} className={`h-6 w-6 rounded-full border-2 transition ${newColor === color ? "scale-110 border-foreground" : "border-transparent"}`} style={{ background: color }} aria-label={`Use ${color}`} />)}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-border/50 bg-card p-4 shadow-card sm:p-5">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Bell className="h-5 w-5" /></div>
            <div><h2 className="font-display text-lg font-bold">Default notifications</h2><p className="text-sm text-muted-foreground">These are applied automatically when you create something. You can still change or remove them on any individual item.</p></div>
          </div>
          <div className="divide-y divide-border/35 overflow-hidden rounded-2xl border border-border/45">
            {defaultRows.map((row) => {
              const rule = defaults[row.key][0] || BASE_DEFAULTS[row.key][0];
              return (
                <div key={row.key} className="grid gap-2 bg-background/35 p-3 sm:grid-cols-[1fr_6rem_8rem] sm:items-center">
                  <div><p className="text-sm font-semibold">{row.label}</p><p className="text-[10px] text-muted-foreground">{row.hint}</p></div>
                  <Input type="number" min={0} disabled={!canEdit} value={rule.amount} onChange={(e) => void updateDefault(row.key, { amount: Math.max(0, Number(e.target.value) || 0) })} className="h-9 rounded-xl" />
                  <Select disabled={!canEdit} value={rule.unit} onValueChange={(unit) => void updateDefault(row.key, { unit: unit as ReminderPreset["unit"] })}>
                    <SelectTrigger className="h-9 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="minutes">minutes before</SelectItem><SelectItem value="hours">hours before</SelectItem><SelectItem value="days">days before</SelectItem></SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/35 px-3 py-2.5">
            <p className="text-xs text-muted-foreground">Defaults use push notifications. Email/SMS can be selected on an individual item.</p>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => navigate("/notification-settings")}>Device notification settings</Button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-border/50 bg-card p-4 shadow-card sm:p-5">
            <div className="mb-3 flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-300"><Cloud className="h-5 w-5" /></div><div><h2 className="font-display text-lg font-bold">Google Calendar</h2><p className="text-xs text-muted-foreground">Optional two-way calendar integration.</p></div></div>
            {rawSettings.google?.connected ? (
              <>
                <div className="mb-3 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">Connected{rawSettings.google.email ? ` · ${rawSettings.google.email}` : ""}</div>
                <div className="flex flex-wrap gap-2"><Button size="sm" className="rounded-xl" disabled={syncing} onClick={() => void syncGoogle()}>{syncing ? "Syncing…" : "Sync now"}</Button><Button size="sm" variant="outline" className="rounded-xl" onClick={() => navigate("/calendar")}>Advanced Google / subscribed calendars</Button></div>
              </>
            ) : (
              <div className="flex flex-wrap gap-2"><Button size="sm" className="rounded-xl" disabled={connecting} onClick={() => void connectGoogle()}>{connecting ? "Opening Google…" : "Connect Google Calendar"}</Button><Button size="sm" variant="ghost" className="rounded-xl" onClick={() => navigate("/calendar")}>Other calendar integrations</Button></div>
            )}
          </div>

          <div className="rounded-3xl border border-border/50 bg-card p-4 shadow-card sm:p-5">
            <div className="mb-3 flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><MapPin className="h-5 w-5" /></div><div><h2 className="font-display text-lg font-bold">Places & travel</h2><p className="text-xs text-muted-foreground">Address suggestions and traffic-aware drive time.</p></div></div>
            <div className={`rounded-xl px-3 py-2 text-xs font-semibold ${googleMapsConfigured() ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>{googleMapsConfigured() ? "Google Places & Routes enabled" : "Manual addresses enabled · Google Maps key not configured"}</div>
            <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">Navigation links work either way. Live autocomplete and travel-time estimates require the browser Maps key and location permission on the device.</p>
          </div>
        </section>
      </div>
    </FeaturePageShell>
  );
}

function SettingsIcon() {
  return <CalendarDays className="h-5 w-5" />;
}
