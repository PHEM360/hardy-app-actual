import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Mail, MessageSquare, Smartphone, Plus, Trash2, ChevronLeft, Check, MonitorSmartphone } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { useNotificationPrefs } from "@/hooks/useNotificationPrefs";
import { useFcmToken } from "@/hooks/useFcmToken";
import { useAuth } from "@/auth/AuthContext";
import {
  NotificationPrefs,
  NotifChannel,
  ReminderConfig,
  ReminderUnit,
  DEFAULT_NOTIF_PREFS,
} from "@/types/notifications";

// ── Helper ────────────────────────────────────────────────────────────────────

function newReminderId() {
  return `r_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

const UNITS: ReminderUnit[] = ["minutes", "hours", "days", "weeks", "months", "years"];

// ── Channel pill ──────────────────────────────────────────────────────────────

function ChannelPills({
  value,
  onChange,
  available,
}: {
  value: NotifChannel[];
  onChange: (v: NotifChannel[]) => void;
  available: { channel: NotifChannel; label: string; enabled: boolean }[];
}) {
  const toggle = (c: NotifChannel) => {
    if (value.includes(c)) {
      onChange(value.filter((x) => x !== c));
    } else {
      onChange([...value, c]);
    }
  };
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {available.map(({ channel, label, enabled }) => {
        const active = value.includes(channel) && enabled;
        return (
          <button
            key={channel}
            type="button"
            disabled={!enabled}
            onClick={() => toggle(channel)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              !enabled
                ? "opacity-30 cursor-not-allowed bg-muted border-border text-muted-foreground"
                : active
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── Reminder row ──────────────────────────────────────────────────────────────

function ReminderRow({
  reminder,
  onChange,
  onDelete,
  channelAvailability,
}: {
  reminder: ReminderConfig;
  onChange: (r: ReminderConfig) => void;
  onDelete: () => void;
  channelAvailability: { channel: NotifChannel; label: string; enabled: boolean }[];
}) {
  const upd = (patch: Partial<ReminderConfig>) => onChange({ ...reminder, ...patch });

  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-2.5">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => upd({ mode: "onDayAt" })}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            reminder.mode === "onDayAt"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-muted border-border text-muted-foreground hover:border-primary/40"
          }`}
        >
          On the day at
        </button>
        <button
          type="button"
          onClick={() => upd({ mode: "relative" })}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            reminder.mode === "relative"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-muted border-border text-muted-foreground hover:border-primary/40"
          }`}
        >
          Relative to due date
        </button>
      </div>

      {/* Fields */}
      {reminder.mode === "onDayAt" ? (
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground w-14 flex-shrink-0">Time</Label>
          <Input
            type="time"
            value={reminder.timeOfDay}
            onChange={(e) => upd({ timeOfDay: e.target.value })}
            className="h-8 text-sm w-28"
          />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              type="number"
              min={1}
              value={reminder.relativeAmount ?? 1}
              onChange={(e) => upd({ relativeAmount: Math.max(1, Number(e.target.value)) })}
              className="h-8 text-sm w-16"
            />
            <Select
              value={reminder.relativeUnit ?? "days"}
              onValueChange={(v) => upd({ relativeUnit: v as ReminderUnit })}
            >
              <SelectTrigger className="h-8 text-sm w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={reminder.relativeDirection ?? "before"}
              onValueChange={(v) => upd({ relativeDirection: v as "before" | "after" })}
            >
              <SelectTrigger className="h-8 text-sm w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="before">before</SelectItem>
                <SelectItem value="after">after</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">due date</span>
          </div>
          {/* For relative days+ show time-of-day; for minutes/hours no extra time needed */}
          {(reminder.relativeUnit === "days" ||
            reminder.relativeUnit === "weeks" ||
            reminder.relativeUnit === "months" ||
            reminder.relativeUnit === "years" ||
            !reminder.relativeUnit) && (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground w-14 flex-shrink-0">At time</Label>
              <Input
                type="time"
                value={reminder.timeOfDay}
                onChange={(e) => upd({ timeOfDay: e.target.value })}
                className="h-8 text-sm w-28"
              />
            </div>
          )}
        </div>
      )}

      {/* Channels */}
      <div>
        <Label className="text-xs text-muted-foreground">Notify via</Label>
        <ChannelPills
          value={reminder.channels}
          onChange={(c) => upd({ channels: c })}
          available={channelAvailability}
        />
      </div>

      {/* Delete */}
      <div className="flex justify-end pt-0.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg"
        >
          <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
        </Button>
      </div>
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────

function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border/60 bg-card p-4 space-y-3 ${className}`}>
      {children}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NotificationSettings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { prefs, loading, saving, savePrefs } = useNotificationPrefs();
  const [local, setLocal] = useState<NotificationPrefs | null>(null);
  const [saved, setSaved] = useState(false);

  // Register this device's FCM token whenever push is enabled (syncs across devices via Firestore)
  const { registerToken } = useFcmToken(prefs.push.enabled);

  // Use local draft while editing; fall back to server prefs
  const draft = local ?? prefs;
  const upd = (patch: Partial<NotificationPrefs>) => setLocal({ ...draft, ...patch });

  const channelAvailability = [
    { channel: "email" as NotifChannel, label: "Email", enabled: draft.email.enabled },
    { channel: "sms" as NotifChannel, label: "SMS", enabled: draft.sms.enabled },
    { channel: "push" as NotifChannel, label: "Push", enabled: draft.push.enabled },
  ];

  const handleSave = async () => {
    await savePrefs(draft);
    setLocal(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) {
    return (
      <FeaturePageShell title="Notification Settings" icon={<Bell className="w-5 h-5" />}>
        <div className="p-6 text-muted-foreground text-sm">Loading…</div>
      </FeaturePageShell>
    );
  }

  return (
    <FeaturePageShell title="Notification Settings" icon={<Bell className="w-5 h-5" />}>
      <div className="px-4 py-4 pb-24 max-w-5xl mx-auto">

        {/* ── Two-column grid on md+, single column on mobile ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">

          {/* ── Left column ── */}
          <div className="space-y-4">

            {/* Contact channels */}
            <SectionCard>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-gradient-primary flex items-center justify-center text-white text-[10px] flex-shrink-0">C</span>
                Notification channels
              </h3>
              <p className="text-xs text-muted-foreground -mt-1">
                Enable the channels you want to use. These must be switched on before they appear as options per event.
              </p>

              {/* Email */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <Label className="text-sm font-medium">Email</Label>
                  </div>
                  <Switch
                    checked={draft.email.enabled}
                    onCheckedChange={(v) => upd({ email: { ...draft.email, enabled: v } })}
                  />
                </div>
                {draft.email.enabled && (
                  <Input
                    type="email"
                    placeholder={user?.email ?? "your@email.com"}
                    value={draft.email.address}
                    onChange={(e) => upd({ email: { ...draft.email, address: e.target.value } })}
                    className="h-8 text-sm"
                  />
                )}
              </div>

              {/* SMS */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    <Label className="text-sm font-medium">SMS</Label>
                  </div>
                  <Switch
                    checked={draft.sms.enabled}
                    onCheckedChange={(v) => upd({ sms: { ...draft.sms, enabled: v } })}
                  />
                </div>
                {draft.sms.enabled && (
                  <Input
                    type="tel"
                    placeholder="07911 123456"
                    value={draft.sms.phone}
                    onChange={(e) => upd({ sms: { ...draft.sms, phone: e.target.value } })}
                    className="h-8 text-sm"
                  />
                )}
              </div>

              {/* Push */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MonitorSmartphone className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <Label className="text-sm font-medium">Push notifications</Label>
                      <p className="text-xs text-muted-foreground">All your signed-in devices</p>
                    </div>
                  </div>
                  <Switch
                    checked={draft.push.enabled}
                    onCheckedChange={(v) => {
                      upd({ push: { enabled: v } });
                      // Called directly inside this tap handler (not from an
                      // effect after prefs are saved) because Safari/iOS only
                      // honours a permission prompt when it traces back to a
                      // real user gesture — see useFcmToken.ts.
                      if (v) registerToken();
                    }}
                  />
                </div>
                {draft.push.enabled && (
                  <div className="pl-6 space-y-2">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Each device registers itself when you open the app. Notifications reach every device where you're signed in and have allowed alerts.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => registerToken()}
                    >
                      Register this device
                    </Button>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Push is already on, so flipping the switch won't retry registration — tap this instead,
                      especially on iPhone/iPad, where it must be triggered by a tap.
                    </p>
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Task due reminders */}
            <SectionCard>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-amber-500 flex items-center justify-center text-white text-[10px] flex-shrink-0">!</span>
                  Task due reminders
                </h3>
                <Switch
                  checked={draft.events.taskDue.enabled}
                  onCheckedChange={(v) =>
                    upd({ events: { ...draft.events, taskDue: { ...draft.events.taskDue, enabled: v } } })
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground -mt-1">
                Reminders when a task is approaching its due date. You can add multiple per task.
              </p>

              {draft.events.taskDue.enabled && (
                <div className="space-y-2 pt-1">
                  {draft.events.taskDue.reminders.map((r) => (
                    <ReminderRow
                      key={r.id}
                      reminder={r}
                      channelAvailability={channelAvailability}
                      onChange={(updated) =>
                        upd({
                          events: {
                            ...draft.events,
                            taskDue: {
                              ...draft.events.taskDue,
                              reminders: draft.events.taskDue.reminders.map((x) =>
                                x.id === updated.id ? updated : x
                              ),
                            },
                          },
                        })
                      }
                      onDelete={() =>
                        upd({
                          events: {
                            ...draft.events,
                            taskDue: {
                              ...draft.events.taskDue,
                              reminders: draft.events.taskDue.reminders.filter((x) => x.id !== r.id),
                            },
                          },
                        })
                      }
                    />
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      upd({
                        events: {
                          ...draft.events,
                          taskDue: {
                            ...draft.events.taskDue,
                            reminders: [
                              ...draft.events.taskDue.reminders,
                              {
                                id: newReminderId(),
                                mode: "onDayAt",
                                timeOfDay: "09:00",
                                relativeAmount: 1,
                                relativeUnit: "days",
                                relativeDirection: "before",
                                channels: channelAvailability.filter((c) => c.enabled).map((c) => c.channel),
                              },
                            ],
                          },
                        },
                      })
                    }
                    className="w-full rounded-xl h-8 text-xs gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add reminder
                  </Button>
                </div>
              )}
            </SectionCard>

          </div>

          {/* ── Right column ── */}
          <div className="space-y-4">

            <EventCard
              title="Task completed"
              description="Notify when a task is marked as done."
              prefs={draft.events.taskCompleted}
              channelAvailability={channelAvailability}
              onChange={(ev) => upd({ events: { ...draft.events, taskCompleted: ev } })}
            />

            <EventCard
              title="New task added"
              description="Notify when a new task is created."
              prefs={draft.events.taskAdded}
              channelAvailability={channelAvailability}
              onChange={(ev) => upd({ events: { ...draft.events, taskAdded: ev } })}
            />

            {/* Daily digest */}
            <SectionCard>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-blue-500 flex items-center justify-center text-white text-[10px] flex-shrink-0">D</span>
                  Daily digest
                </h3>
                <Switch
                  checked={draft.events.dailyDigest.enabled}
                  onCheckedChange={(v) =>
                    upd({ events: { ...draft.events, dailyDigest: { ...draft.events.dailyDigest, enabled: v } } })
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground -mt-1">
                A daily summary of tasks due today, sent at a time you choose.
              </p>
              {draft.events.dailyDigest.enabled && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-14 flex-shrink-0">Send at</Label>
                    <Input
                      type="time"
                      value={draft.events.dailyDigest.time}
                      onChange={(e) =>
                        upd({
                          events: {
                            ...draft.events,
                            dailyDigest: { ...draft.events.dailyDigest, time: e.target.value },
                          },
                        })
                      }
                      className="h-8 text-sm w-28"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Notify via</Label>
                    <ChannelPills
                      value={draft.events.dailyDigest.channels}
                      onChange={(c) =>
                        upd({
                          events: {
                            ...draft.events,
                            dailyDigest: { ...draft.events.dailyDigest, channels: c },
                          },
                        })
                      }
                      available={channelAvailability}
                    />
                  </div>
                </div>
              )}
            </SectionCard>

          </div>
        </div>

        {/* ── Save / Reset — full width below grid ── */}
        <div className="flex gap-2 pt-4 max-w-sm">
          <Button
            variant="outline"
            className="flex-1 rounded-xl h-10 text-sm"
            onClick={() => setLocal(null)}
            disabled={!local || saving}
          >
            Reset
          </Button>
          <Button
            className="flex-1 rounded-xl h-10 text-sm gap-1.5 bg-gradient-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              "Saving…"
            ) : saved ? (
              <><Check className="w-4 h-4" /> Saved</>
            ) : (
              "Save settings"
            )}
          </Button>
        </div>

      </div>
    </FeaturePageShell>
  );
}

// ── Simple event card (completed / added) ─────────────────────────────────────

function EventCard({
  title,
  description,
  prefs,
  channelAvailability,
  onChange,
}: {
  title: string;
  description: string;
  prefs: { enabled: boolean; channels: NotifChannel[] };
  channelAvailability: { channel: NotifChannel; label: string; enabled: boolean }[];
  onChange: (p: { enabled: boolean; channels: NotifChannel[] }) => void;
}) {
  return (
    <SectionCard>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="w-5 h-5 rounded-md bg-green-500 flex items-center justify-center text-white text-[10px] flex-shrink-0">✓</span>
          {title}
        </h3>
        <Switch
          checked={prefs.enabled}
          onCheckedChange={(v) => onChange({ ...prefs, enabled: v })}
        />
      </div>
      <p className="text-xs text-muted-foreground -mt-1">{description}</p>
      {prefs.enabled && (
        <div>
          <Label className="text-xs text-muted-foreground">Notify via</Label>
          <ChannelPills
            value={prefs.channels}
            onChange={(c) => onChange({ ...prefs, channels: c })}
            available={channelAvailability}
          />
        </div>
      )}
    </SectionCard>
  );
}
