import { useState } from "react";
import { Link } from "react-router-dom";
import { AlarmClock, Plus, Sunrise, Trash2 } from "lucide-react";
import { toast } from "sonner";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useMyDevices } from "@/hooks/useMyDevices";
import { emptyLightCue, useHouseholdAlarms } from "@/hooks/useHouseholdAlarms";
import type { Alarm, AlarmLightCue } from "@/hooks/useDeviceSettings";
import { ALARM_TONES, previewAlarmTone, type AlarmToneId } from "@/lib/alarmTone";
import { JEWEL } from "@/lib/brandPalette";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function describeDays(days: number[]) {
  if (days.length === 0) return "Once";
  if (days.length === 7) return "Every day";
  if (days.length === 5 && !days.includes(0) && !days.includes(6)) return "Weekdays";
  if (days.length === 2 && days.includes(0) && days.includes(6)) return "Weekends";
  return days.slice().sort().map((day) => DAYS[day]).join(", ");
}

function briToPct(value: number) {
  return Math.max(1, Math.min(100, Math.round((value / 255) * 100)));
}

function pctToBri(value: number) {
  return Math.max(1, Math.min(255, Math.round((value / 100) * 255)));
}

function DayPicker({ days, onToggle }: { days: number[]; onToggle: (day: number) => void }) {
  return (
    <div className="grid grid-cols-7 gap-1">
      {DAYS.map((label, index) => {
        const on = days.includes(index);
        return (
          <button
            key={label}
            type="button"
            onClick={() => onToggle(index)}
            className={`btn-edge h-10 rounded-md text-[11px] font-bold ${on ? "bg-primary text-primary-foreground" : "border border-foreground/20 bg-card text-foreground"}`}
          >
            {label.slice(0, 1)}
          </button>
        );
      })}
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/70">{label}</span>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value) || min)))}
          className="h-11"
        />
        <span className="w-16 shrink-0 text-xs text-foreground/70">{suffix}</span>
      </div>
    </label>
  );
}

function LightCueEditor({
  cue,
  label,
  onChange,
  onRemove,
}: {
  cue: AlarmLightCue;
  label: string;
  onChange: (patch: Partial<AlarmLightCue>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-foreground/20 bg-card p-3 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <p className="font-display text-sm font-bold">{label}</p>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          <Trash2 /> Remove
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="On brightness" value={briToPct(cue.startBrightness)} min={1} max={100} suffix="percent" onChange={(value) => onChange({ startBrightness: pctToBri(value) })} />
        <NumberField label="Minutes before" value={cue.leadMinutes} min={0} max={180} suffix="mins" onChange={(value) => onChange({ leadMinutes: value })} />
        <NumberField label="Then reach" value={briToPct(cue.peakBrightness)} min={1} max={100} suffix="percent" onChange={(value) => onChange({ peakBrightness: pctToBri(value) })} />
        <NumberField label="After" value={cue.rampMinutes} min={1} max={180} suffix="mins" onChange={(value) => onChange({ rampMinutes: value })} />
      </div>
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/70">Turn off</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onChange({ offMode: "after" })}
            className={`btn-edge rounded-lg px-3 py-2 text-left text-xs font-bold ${cue.offMode === "after" ? "bg-primary text-primary-foreground" : "border border-foreground/20 bg-card"}`}
          >
            After a number of minutes
          </button>
          <button
            type="button"
            onClick={() => onChange({ offMode: "at" })}
            className={`btn-edge rounded-lg px-3 py-2 text-left text-xs font-bold ${cue.offMode === "at" ? "bg-primary text-primary-foreground" : "border border-foreground/20 bg-card"}`}
          >
            At a set time
          </button>
        </div>
        {cue.offMode === "after" ? (
          <NumberField label="Minutes after full brightness" value={cue.offAfterMinutes} min={1} max={240} suffix="mins" onChange={(value) => onChange({ offAfterMinutes: value })} />
        ) : (
          <label className="block space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/70">Off at</span>
            <Input type="time" value={cue.offAt} onChange={(event) => onChange({ offAt: event.target.value })} className="h-11" />
          </label>
        )}
      </div>
    </div>
  );
}

function cueSummary(cue: AlarmLightCue, label: string) {
  const off = cue.offMode === "at"
    ? `off at ${cue.offAt}`
    : `off ${cue.offAfterMinutes} min after full brightness`;
  return `${label}: ${briToPct(cue.startBrightness)}% ${cue.leadMinutes} min before, then ${briToPct(cue.peakBrightness)}% after ${cue.rampMinutes} min, ${off}.`;
}

export default function Alarms() {
  const { alarms, displays, loading, addAlarm, updateAlarm, deleteAlarm } = useHouseholdAlarms();
  const { devices } = useMyDevices();
  const lights = devices.filter((device) => device.deviceType === "light");
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draftTime, setDraftTime] = useState("07:00");
  const [draftLabel, setDraftLabel] = useState("");
  const [draftDays, setDraftDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [draftTone, setDraftTone] = useState<AlarmToneId>("chime");
  const [draftCues, setDraftCues] = useState<AlarmLightCue[]>([]);

  const toggleDay = (days: number[], day: number) => (
    days.includes(day) ? days.filter((item) => item !== day) : [...days, day].sort()
  );

  const saveNew = async () => {
    try {
      await addAlarm({
        time: draftTime,
        days: draftDays,
        label: draftLabel.trim(),
        enabled: true,
        tone: draftTone,
        lightCues: draftCues,
      });
      setAdding(false);
      setDraftLabel("");
      setDraftCues([]);
      toast.success("Alarm saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save that alarm");
    }
  };

  const patch = async (id: string, next: Partial<Alarm>) => {
    try {
      await updateAlarm(id, next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update that alarm");
    }
  };

  return (
    <FeaturePageShell
      title="Alarms"
      subtitle={displays.length === 0 ? "Link a screen so an alarm can ring" : "One set of alarms for every linked screen"}
      icon={<AlarmClock className="h-5 w-5" />}
    >
      <section className="overflow-hidden rounded-xl border border-foreground/20 bg-card shadow-card" style={{ ["--sec" as string]: JEWEL.bronze }}>
        <div className="band px-4 py-3 text-white" style={{ background: JEWEL.bronze }}>
          <h2 className="font-display text-lg font-bold">Your alarms</h2>
        </div>
        <div className="space-y-3 p-4">
          {loading && <p className="text-sm text-foreground/70">Loading alarms…</p>}
          {!loading && displays.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-foreground">Alarms ring on your linked screens. Add one first, then come back here to set the time and tone.</p>
              <Button asChild>
                <Link to="/remote-displays">Link a screen</Link>
              </Button>
            </div>
          )}
          {!loading && displays.length > 0 && alarms.length === 0 && !adding && (
            <p className="text-sm text-foreground/80">No alarms yet. Add one for weekdays, weekends, or a single morning.</p>
          )}

          {alarms.map((alarm) => {
            const open = openId === alarm.id;
            const tone = ALARM_TONES.find((item) => item.id === alarm.tone) || ALARM_TONES[0];
            return (
              <article key={alarm.id} className="rounded-xl border border-foreground/20 bg-card p-3 shadow-card">
                <div className="flex items-center gap-3">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpenId(open ? null : alarm.id)}>
                    <p className="font-display text-3xl font-bold tabular-nums leading-none">{alarm.time}</p>
                    <p className="mt-1 text-xs text-foreground/70">
                      {describeDays(alarm.days)}
                      {alarm.label ? ` · ${alarm.label}` : ""}
                      {` · ${tone.label}`}
                    </p>
                  </button>
                  <Switch checked={alarm.enabled} onCheckedChange={(enabled) => void patch(alarm.id, { enabled })} aria-label={`Turn ${alarm.label || alarm.time} ${alarm.enabled ? "off" : "on"}`} />
                </div>
                {open && (
                  <div className="mt-4 space-y-4 border-t border-foreground/15 pt-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1">
                        <Label>Time</Label>
                        <Input type="time" value={alarm.time} onChange={(event) => void patch(alarm.id, { time: event.target.value })} className="h-11" />
                      </label>
                      <label className="space-y-1">
                        <Label>Name</Label>
                        <Input value={alarm.label} placeholder="Morning" onChange={(event) => void patch(alarm.id, { label: event.target.value })} className="h-11" />
                      </label>
                    </div>
                    <div className="space-y-1">
                      <Label>Repeat</Label>
                      <DayPicker days={alarm.days} onToggle={(day) => void patch(alarm.id, { days: toggleDay(alarm.days, day) })} />
                      <p className="text-[11px] text-foreground/70">Leave every day off and it rings once, then switches itself off.</p>
                    </div>
                    <TonePicker
                      value={alarm.tone || "classic"}
                      onChange={(toneId) => void patch(alarm.id, { tone: toneId })}
                    />
                    <LightPlans
                      cues={alarm.lightCues || []}
                      lights={lights}
                      onChange={(lightCues) => void patch(alarm.id, { lightCues })}
                    />
                    <Button
                      variant="destructive"
                      onClick={() => {
                        void deleteAlarm(alarm.id).catch(() => toast.error("Could not delete that alarm"));
                        setOpenId(null);
                      }}
                    >
                      <Trash2 /> Delete alarm
                    </Button>
                  </div>
                )}
              </article>
            );
          })}

          {displays.length > 0 && !adding && (
            <Button onClick={() => setAdding(true)}>
              <Plus /> Add alarm
            </Button>
          )}

          {adding && (
            <div className="space-y-4 rounded-xl border border-foreground/20 p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <Label>Time</Label>
                  <Input type="time" value={draftTime} onChange={(event) => setDraftTime(event.target.value)} className="h-11" />
                </label>
                <label className="space-y-1">
                  <Label>Name</Label>
                  <Input value={draftLabel} placeholder="Morning" onChange={(event) => setDraftLabel(event.target.value)} className="h-11" />
                </label>
              </div>
              <div className="space-y-1">
                <Label>Repeat</Label>
                <DayPicker days={draftDays} onToggle={(day) => setDraftDays((current) => toggleDay(current, day))} />
              </div>
              <TonePicker value={draftTone} onChange={setDraftTone} />
              <LightPlans cues={draftCues} lights={lights} onChange={setDraftCues} />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setAdding(false)}>Cancel</Button>
                <Button className="flex-1" onClick={() => void saveNew()}>Save alarm</Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </FeaturePageShell>
  );
}

function TonePicker({ value, onChange }: { value: AlarmToneId; onChange: (tone: AlarmToneId) => void }) {
  return (
    <div className="space-y-2">
      <Label>Tone</Label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ALARM_TONES.map((tone) => {
          const on = value === tone.id;
          return (
            <button
              key={tone.id}
              type="button"
              onClick={() => {
                onChange(tone.id);
                void previewAlarmTone(tone.id);
              }}
              className={`btn-edge rounded-lg px-3 py-2 text-left ${on ? "bg-primary text-primary-foreground" : "border border-foreground/20 bg-card text-foreground"}`}
            >
              <span className="block text-xs font-bold">{tone.label}</span>
              <span className={`block text-[10px] ${on ? "text-primary-foreground/80" : "text-foreground/65"}`}>{tone.hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LightPlans({
  cues,
  lights,
  onChange,
}: {
  cues: AlarmLightCue[];
  lights: { id: string; label: string }[];
  onChange: (cues: AlarmLightCue[]) => void;
}) {
  const unused = lights.filter((light) => !cues.some((cue) => cue.lightId === light.id));
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sunrise className="h-4 w-4" />
        <Label>Wake a light</Label>
      </div>
      {lights.length === 0 && (
        <p className="text-xs text-foreground/70">
          No sunrise lights yet. Pair one in <Link to="/connected-devices" className="font-semibold underline">Devices</Link>, then attach it here.
        </p>
      )}
      {cues.map((cue) => {
        const light = lights.find((item) => item.id === cue.lightId);
        return (
          <div key={cue.lightId} className="space-y-2">
            <LightCueEditor
              cue={cue}
              label={light?.label || "Light"}
              onChange={(patch) => onChange(cues.map((item) => (item.lightId === cue.lightId ? { ...item, ...patch } : item)))}
              onRemove={() => onChange(cues.filter((item) => item.lightId !== cue.lightId))}
            />
            <p className="text-[11px] text-foreground/70">{cueSummary(cue, light?.label || "Light")}</p>
          </div>
        );
      })}
      {unused.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {unused.map((light) => (
            <Button key={light.id} type="button" variant="outline" onClick={() => onChange([...cues, emptyLightCue(light.id)])}>
              <Plus /> {light.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
