import { useState } from "react";
import { format } from "date-fns";
import { Plus, Trash2, X } from "lucide-react";
import { usePets } from "@/hooks/usePets";
import { useCalendar } from "@/hooks/useCalendar";
import { useActiveHousehold } from "@/hooks/useActiveHousehold";
import { useMyHouseholds } from "@/hooks/useHouseholds";
import { useAppUsers } from "@/hooks/useAppUsers";
import { useBirthdays } from "@/hooks/useBirthdays";
import { upcomingBirthdays } from "@/lib/todayInsights";
import { nextOccurrenceLabel } from "@/lib/birthdayDates";
import { MAX_BIRTHDAY_REMINDERS, type Birthday, type BirthdaySharing } from "@/types/birthdays";
import type { NotifChannel, ReminderConfig, ReminderUnit } from "@/types/notifications";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TdHead } from "./TdHead";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const UNITS: ReminderUnit[] = ["days", "weeks", "months"];
const CHANNEL_OPTIONS: { value: NotifChannel; label: string }[] = [
  { value: "push", label: "Push" },
  { value: "email", label: "Email" },
  { value: "sms", label: "Text" },
];

function newReminder(): ReminderConfig {
  return { id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, mode: "onDayAt", timeOfDay: "09:00", channels: ["push"] };
}

function daysInMonth(month: number) {
  return new Date(2024, month, 0).getDate();
}

function ReminderEditor({ reminder, onChange, onDelete }: { reminder: ReminderConfig; onChange: (r: ReminderConfig) => void; onDelete: () => void }) {
  const upd = (patch: Partial<ReminderConfig>) => onChange({ ...reminder, ...patch });
  const toggleChannel = (c: NotifChannel) => {
    upd({ channels: reminder.channels.includes(c) ? reminder.channels.filter((x) => x !== c) : [...reminder.channels, c] });
  };
  return (
    <div className="rounded-xl border border-border/50 bg-muted/30 p-2.5 space-y-2">
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => upd({ mode: "onDayAt" })}
          className={`flex-1 rounded-lg py-1 text-[11px] font-semibold ${reminder.mode === "onDayAt" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
        >
          On the day
        </button>
        <button
          type="button"
          onClick={() => upd({ mode: "relative", relativeAmount: reminder.relativeAmount ?? 1, relativeUnit: reminder.relativeUnit ?? "days", relativeDirection: "before" })}
          className={`flex-1 rounded-lg py-1 text-[11px] font-semibold ${reminder.mode === "relative" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
        >
          Before
        </button>
      </div>
      {reminder.mode === "relative" && (
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            min={1}
            value={reminder.relativeAmount ?? 1}
            onChange={(e) => upd({ relativeAmount: e.target.value === "" ? undefined : Math.max(1, Number(e.target.value)) })}
            className="h-8 w-14 rounded-lg text-xs"
          />
          <Select value={reminder.relativeUnit ?? "days"} onValueChange={(v) => upd({ relativeUnit: v as ReminderUnit })}>
            <SelectTrigger className="h-8 flex-1 rounded-lg text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-[11px] text-muted-foreground">before</span>
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <Label className="text-[10px] text-muted-foreground shrink-0">At</Label>
        <Input type="time" value={reminder.timeOfDay} onChange={(e) => upd({ timeOfDay: e.target.value })} className="h-8 w-24 rounded-lg text-xs" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {CHANNEL_OPTIONS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => toggleChannel(c.value)}
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${reminder.channels.includes(c.value) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="flex justify-end">
        <button type="button" onClick={onDelete} className="flex items-center gap-1 text-[10px] font-semibold text-destructive">
          <Trash2 className="h-3 w-3" /> Remove
        </button>
      </div>
    </div>
  );
}

function BirthdayFormDialog({
  open,
  onOpenChange,
  editing,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Birthday | null;
  onSave: (data: Omit<Birthday, "id" | "createdBy" | "createdAt" | "updatedAt">) => Promise<void>;
}) {
  const { activeHouseholdId } = useActiveHousehold();
  const { households } = useMyHouseholds();
  const appUsers = useAppUsers();
  const household = households.find((h) => h.id === activeHouseholdId);
  const memberUsers = (household?.memberIds || []).map((uid) => appUsers.find((u) => u.id === uid)).filter(Boolean) as typeof appUsers;

  const [name, setName] = useState(editing?.name ?? "");
  const [month, setMonth] = useState(editing?.month ?? new Date().getMonth() + 1);
  const [day, setDay] = useState(editing?.day ?? new Date().getDate());
  const [birthYear, setBirthYear] = useState(editing?.birthYear ? String(editing.birthYear) : "");
  const [sharing, setSharing] = useState<BirthdaySharing>(editing?.sharedWith ?? { mode: "none" });
  const [reminders, setReminders] = useState<ReminderConfig[]>(editing?.reminders ?? [newReminder()]);
  const [saving, setSaving] = useState(false);

  const someUids = sharing.mode === "some" ? sharing.uids ?? [] : [];

  const toggleMember = (uid: string) => {
    const next = someUids.includes(uid) ? someUids.filter((u) => u !== uid) : [...someUids, uid];
    setSharing({ mode: "some", uids: next });
  };

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        month,
        day,
        birthYear: birthYear ? Number(birthYear) : null,
        householdId: activeHouseholdId,
        sharedWith: sharing,
        reminders: reminders.slice(0, MAX_BIRTHDAY_REMINDERS),
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-4 max-h-[85vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{editing ? "Edit birthday" : "Add birthday"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 rounded-xl" placeholder="e.g. Grandma Jean" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Month</Label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="h-9 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Day</Label>
              <Select value={String(day)} onValueChange={(v) => setDay(Number(v))}>
                <SelectTrigger className="h-9 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: daysInMonth(month) }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Year born (optional)</Label>
            <Input
              type="number"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              className="h-9 rounded-xl"
              placeholder="e.g. 1958"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Share with</Label>
            <div className="flex gap-1.5">
              {(["none", "some", "all"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSharing(m === "some" ? { mode: "some", uids: someUids } : { mode: m })}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-semibold capitalize ${sharing.mode === m ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  {m === "all" ? "Everyone" : m}
                </button>
              ))}
            </div>
            {sharing.mode === "some" && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {memberUsers.length === 0 && <p className="text-[11px] text-muted-foreground">No other household members found.</p>}
                {memberUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleMember(u.id)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${someUids.includes(u.id) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                  >
                    {u.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Reminders ({reminders.length}/{MAX_BIRTHDAY_REMINDERS})</Label>
              {reminders.length < MAX_BIRTHDAY_REMINDERS && (
                <button
                  type="button"
                  onClick={() => setReminders((r) => [...r, newReminder()])}
                  className="flex items-center gap-1 text-[11px] font-semibold text-primary"
                >
                  <Plus className="h-3 w-3" /> Add reminder
                </button>
              )}
            </div>
            <div className="space-y-2">
              {reminders.map((r, i) => (
                <ReminderEditor
                  key={r.id}
                  reminder={r}
                  onChange={(next) => setReminders((prev) => prev.map((x, idx) => (idx === i ? next : x)))}
                  onDelete={() => setReminders((prev) => prev.filter((_, idx) => idx !== i))}
                />
              ))}
            </div>
          </div>

          <Button className="w-full rounded-xl bg-gradient-primary" disabled={!name.trim() || saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save birthday"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TdBirthdaysWidget() {
  const { pets } = usePets();
  const { events } = useCalendar();
  const { activeHouseholdId } = useActiveHousehold();
  const { birthdays, addBirthday, updateBirthday, deleteBirthday } = useBirthdays(activeHouseholdId);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Birthday | null>(null);

  const legacyItems = upcomingBirthdays({ pets, events, withinDays: 14 });
  const managed = birthdays
    .map((b) => ({ ...b, label: nextOccurrenceLabel(b.month, b.day) }))
    .filter((b) => b.label.days <= 14)
    .sort((a, b) => a.label.days - b.label.days);

  const openAdd = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (b: Birthday) => { setEditing(b); setFormOpen(true); };

  return (
    <div className="h-full flex flex-col p-3">
      <TdHead
        emoji="🎂"
        title="Birthdays"
        action={
          <button type="button" onClick={openAdd} className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title="Add birthday">
            <Plus className="h-3.5 w-3.5" />
          </button>
        }
      />
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
        {managed.length === 0 && legacyItems.length === 0 && (
          <p className="text-xs text-muted-foreground">No birthdays in the next 2 weeks.</p>
        )}
        {managed.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => openEdit(b)}
            className="flex w-full items-center justify-between gap-2 rounded-xl bg-background/60 border border-border/40 px-2.5 py-1.5 text-left hover:border-primary/40"
          >
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{b.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {b.sharedWith.mode === "all" ? "Shared with household" : b.sharedWith.mode === "some" ? "Shared" : "Private"}
              </p>
            </div>
            <span className="text-[10px] font-semibold text-primary flex-shrink-0">
              {b.label.days === 0 ? "Today" : b.label.days === 1 ? "Tomorrow" : format(b.label.date, "d MMM")}
            </span>
          </button>
        ))}
        {legacyItems.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl bg-background/60 border border-border/40 px-2.5 py-1.5">
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{item.name}</p>
              <p className="text-[10px] text-muted-foreground">{item.kind === "pet" ? "Pet" : "Calendar"}</p>
            </div>
            <span className="text-[10px] font-semibold text-primary flex-shrink-0">
              {item.days === 0 ? "Today" : item.days === 1 ? "Tomorrow" : format(item.date, "d MMM")}
            </span>
          </div>
        ))}
      </div>

      {editing && (
        <button
          type="button"
          onClick={() => { void deleteBirthday(editing.id); setFormOpen(false); }}
          className="mt-2 flex items-center justify-center gap-1 rounded-lg border border-destructive/30 py-1 text-[10px] font-semibold text-destructive"
        >
          <X className="h-3 w-3" /> Delete this birthday
        </button>
      )}

      <BirthdayFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        onSave={async (data) => {
          if (editing) await updateBirthday(editing.id, data);
          else await addBirthday(data);
        }}
      />
    </div>
  );
}
