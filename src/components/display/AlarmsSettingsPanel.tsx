import { useState } from "react";
import { Plus, Sunrise, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Alarm } from "@/hooks/useDeviceSettings";

export interface AlarmLightOption {
  id: string;
  label: string;
}

function LightPicker({
  lights,
  selected,
  onToggle,
}: {
  lights: AlarmLightOption[];
  selected: string[];
  onToggle: (lightId: string) => void;
}) {
  if (lights.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
        <Sunrise className="h-3 w-3" /> Also wake
      </p>
      <div className="flex flex-wrap gap-1.5">
        {lights.map((light) => {
          const active = selected.includes(light.id);
          return (
            <button
              key={light.id}
              type="button"
              onClick={() => onToggle(light.id)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                active ? "bg-primary text-primary-foreground" : "bg-background border border-border text-muted-foreground"
              }`}
            >
              {light.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function describeDays(days: number[]): string {
  if (days.length === 0) return "Once";
  if (days.length === 7) return "Every day";
  if (days.length === 5 && !days.includes(0) && !days.includes(6)) return "Weekdays";
  if (days.length === 2 && days.includes(0) && days.includes(6)) return "Weekends";
  return days
    .slice()
    .sort()
    .map((d) => DAY_LABELS[d])
    .join(" ");
}

export function AlarmsSettingsPanel({
  alarms,
  lights = [],
  onAdd,
  onUpdate,
  onDelete,
}: {
  alarms: Alarm[];
  lights?: AlarmLightOption[];
  onAdd: (alarm: Omit<Alarm, "id">) => void;
  onUpdate: (id: string, patch: Partial<Alarm>) => void;
  onDelete: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draftTime, setDraftTime] = useState("07:00");
  const [draftLabel, setDraftLabel] = useState("");
  const [draftDays, setDraftDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [draftSunriseMinutes, setDraftSunriseMinutes] = useState(30);
  const [draftLightIds, setDraftLightIds] = useState<string[]>([]);

  const toggleDraftDay = (d: number) => {
    setDraftDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  };
  const toggleDraftLight = (lightId: string) => {
    setDraftLightIds((prev) => (prev.includes(lightId) ? prev.filter((x) => x !== lightId) : [...prev, lightId]));
  };
  const toggleAlarmLight = (alarm: Alarm, lightId: string) => {
    const current = alarm.linkedLightIds || [];
    onUpdate(alarm.id, {
      linkedLightIds: current.includes(lightId) ? current.filter((x) => x !== lightId) : [...current, lightId],
    });
  };

  const submit = () => {
    onAdd({
      time: draftTime, days: draftDays, label: draftLabel, enabled: true,
      sunriseMinutes: draftSunriseMinutes, linkedLightIds: draftLightIds,
    });
    setAdding(false);
    setDraftLabel("");
    setDraftLightIds([]);
  };

  return (
    <div className="space-y-3">
      {alarms.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">No alarms set.</p>
      )}

      {alarms.map((alarm) => (
        <div key={alarm.id} className="p-3 rounded-xl bg-muted/50 border border-border/40 space-y-2">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-lg font-semibold tabular-nums">{alarm.time}</p>
              <p className="text-xs text-muted-foreground truncate">
                {describeDays(alarm.days)}
                {alarm.label ? ` · ${alarm.label}` : ""}
                {alarm.sunriseMinutes ? ` · Sunrise ${alarm.sunriseMinutes}m` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Switch checked={alarm.enabled} onCheckedChange={(v) => onUpdate(alarm.id, { enabled: v })} />
              <button onClick={() => onDelete(alarm.id)} className="p-1.5 text-muted-foreground hover:text-destructive">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          <LightPicker lights={lights} selected={alarm.linkedLightIds || []} onToggle={(lightId) => toggleAlarmLight(alarm, lightId)} />
        </div>
      ))}

      {adding ? (
        <div className="p-3 rounded-xl bg-muted/50 border border-border/40 space-y-3">
          <div className="flex items-center gap-3">
            <Label className="text-xs w-16">Time</Label>
            <input
              type="time"
              value={draftTime}
              onChange={(e) => setDraftTime(e.target.value)}
              className="h-9 rounded-lg bg-background border border-border px-2 text-sm flex-1"
            />
          </div>
          <div className="flex items-center gap-3">
            <Label className="text-xs w-16">Sunrise</Label>
            <select
              value={draftSunriseMinutes}
              onChange={(e) => setDraftSunriseMinutes(Number(e.target.value))}
              className="h-9 flex-1 rounded-lg border border-border bg-background px-2 text-sm"
            >
              <option value={0}>Off</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>60 minutes</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <Label className="text-xs w-16">Label</Label>
            <Input
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
              placeholder="e.g. School run"
              className="h-9 rounded-lg text-sm flex-1"
            />
          </div>
          <div className="flex items-center gap-3">
            <Label className="text-xs w-16">Repeat</Label>
            <div className="flex gap-1">
              {DAY_LABELS.map((label, i) => (
                <button
                  key={i}
                  onClick={() => toggleDraftDay(i)}
                  className={`w-7 h-7 rounded-full text-[11px] font-semibold transition-colors ${
                    draftDays.includes(i) ? "bg-primary text-primary-foreground" : "bg-background border border-border text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">No days selected = fires once, then turns off.</p>
          <LightPicker lights={lights} selected={draftLightIds} onToggle={toggleDraftLight} />
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" className="flex-1 rounded-lg" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button size="sm" className="flex-1 rounded-lg" onClick={submit}>
              Add alarm
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="w-full rounded-xl gap-2" onClick={() => setAdding(true)}>
          <Plus className="w-4 h-4" /> Add alarm
        </Button>
      )}
    </div>
  );
}
