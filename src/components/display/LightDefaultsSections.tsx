import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SmoothRange } from "@/components/ui/smooth-range";
import {
  useDeviceSettings,
  type LightManualDefaults,
  type LightScheduleBlock,
  type LightSunriseDefaults,
} from "@/hooks/useDeviceSettings";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function DayPicker({ days, onToggle }: { days: number[]; onToggle: (day: number) => void }) {
  return (
    <div className="flex gap-1">
      {DAY_LABELS.map((label, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onToggle(i)}
          className={`h-7 w-7 rounded-full text-[11px] font-semibold transition-colors ${
            days.includes(i) ? "bg-primary text-primary-foreground" : "bg-background border border-border text-muted-foreground"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

const RAMP_MINUTE_PRESETS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 75, 90, 120];

function RampMinutesInput({ value, onChange }: { value: number; onChange: (minutes: number) => void }) {
  const [custom, setCustom] = useState(!RAMP_MINUTE_PRESETS.includes(value));

  if (custom) {
    return (
      <div className="flex flex-1 items-center gap-2">
        <input
          type="number"
          min={1}
          max={360}
          value={value}
          onChange={(event) => onChange(Math.max(1, Math.round(Number(event.target.value)) || 1))}
          className="h-9 w-20 rounded-lg border border-border bg-background px-2 text-sm"
        />
        <span className="text-xs text-muted-foreground">minutes</span>
        <button type="button" onClick={() => setCustom(false)} className="text-[11px] font-medium text-primary underline underline-offset-2">
          Use a preset
        </button>
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(event) => {
        if (event.target.value === "other") { setCustom(true); return; }
        onChange(Number(event.target.value));
      }}
      className="h-9 flex-1 rounded-lg border border-border bg-background px-2 text-sm"
    >
      {RAMP_MINUTE_PRESETS.map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
      <option value="other">Other…</option>
    </select>
  );
}

/**
 * A light's own default sunrise look — the starting point every alarm's
 * per-alarm sunrise-light override is pre-filled from (see
 * AlarmSunriseLightSection). Editing here autosaves and is shared between
 * the Remote Displays detail dialog and the Connected Devices page — both
 * read/write the same devices/{id}.settings.light.sunrise field, so a
 * change on either page shows up on both immediately.
 */
export function SunriseDefaultsSection({ deviceId, colorCapable }: { deviceId: string; colorCapable: boolean }) {
  const { device, updateLightSunrise } = useDeviceSettings(deviceId);
  if (!device) return null;
  const sunrise = device.settings.light.sunrise;
  const set = (patch: Partial<LightSunriseDefaults>) => void updateLightSunrise(patch);

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Default sunrise look</p>
      <div className="flex items-center gap-3">
        <Label className="w-24 shrink-0 text-xs">Ramp over</Label>
        <RampMinutesInput value={sunrise.rampMinutes} onChange={(rampMinutes) => set({ rampMinutes })} />
      </div>
      <div className="flex items-center gap-3">
        <Label className="w-24 shrink-0 text-xs">Start brightness</Label>
        <SmoothRange min={1} max={255} value={sunrise.startBrightness} onCommit={(startBrightness) => set({ startBrightness })} className="flex-1" />
      </div>
      <div className="flex items-center gap-3">
        <Label className="w-24 shrink-0 text-xs">Peak brightness</Label>
        <SmoothRange min={1} max={255} value={sunrise.peakBrightness} onCommit={(peakBrightness) => set({ peakBrightness })} className="flex-1" />
      </div>
      <div className="flex items-center gap-3">
        <Label className="w-24 shrink-0 text-xs">From / to</Label>
        <input
          type="color"
          value={sunrise.colorFrom}
          disabled={!colorCapable}
          onChange={(event) => set({ colorFrom: event.target.value })}
          className="h-8 w-14 cursor-pointer rounded-lg border border-border bg-transparent p-0.5 disabled:cursor-not-allowed disabled:opacity-40"
        />
        <input
          type="color"
          value={sunrise.colorTo}
          disabled={!colorCapable}
          onChange={(event) => set({ colorTo: event.target.value })}
          className="h-8 w-14 cursor-pointer rounded-lg border border-border bg-transparent p-0.5 disabled:cursor-not-allowed disabled:opacity-40"
        />
        {!colorCapable && <span className="text-[11px] text-muted-foreground">Single colour — brightness only</span>}
      </div>
      <div className="flex items-center gap-3">
        <Label className="w-24 shrink-0 text-xs">Warmth</Label>
        <input
          type="color"
          value={sunrise.warmthColor}
          disabled={!colorCapable}
          onChange={(event) => set({ warmthColor: event.target.value })}
          className="h-8 w-14 cursor-pointer rounded-lg border border-border bg-transparent p-0.5 disabled:cursor-not-allowed disabled:opacity-40"
        />
      </div>
    </div>
  );
}

/** Applied whenever this light is turned on manually without explicit brightness/colour — see sendLightCommand's turningOnFromOff logic. */
export function ManualDefaultsSection({ deviceId, colorCapable }: { deviceId: string; colorCapable: boolean }) {
  const { device, updateLightManualDefaults } = useDeviceSettings(deviceId);
  if (!device) return null;
  const defaults = device.settings.light.manualDefaults;
  const set = (patch: Partial<LightManualDefaults>) => void updateLightManualDefaults(patch);

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Default manual settings</p>
      <div className="flex items-center gap-3">
        <Label className="w-24 shrink-0 text-xs">Brightness</Label>
        <SmoothRange min={1} max={255} value={defaults.brightness} onCommit={(brightness) => set({ brightness })} className="flex-1" />
      </div>
      <div className="flex items-center gap-3">
        <Label className="w-24 shrink-0 text-xs">Colour</Label>
        <input
          type="color"
          value={defaults.colorHex}
          disabled={!colorCapable}
          onChange={(event) => set({ colorHex: event.target.value })}
          className="h-8 w-14 cursor-pointer rounded-lg border border-border bg-transparent p-0.5 disabled:cursor-not-allowed disabled:opacity-40"
        />
        {!colorCapable && <span className="text-[11px] text-muted-foreground">Single colour</span>}
      </div>
      <div className="flex items-center gap-3">
        <Label className="w-24 shrink-0 text-xs">Auto-off</Label>
        <select
          value={defaults.autoOffMinutes}
          onChange={(event) => set({ autoOffMinutes: Number(event.target.value) })}
          className="h-9 flex-1 rounded-lg border border-border bg-background px-2 text-sm"
        >
          <option value={0}>Never</option>
          {[15, 30, 45, 60, 90, 120].map((minutes) => <option key={minutes} value={minutes}>After {minutes} minutes</option>)}
        </select>
      </div>
    </div>
  );
}

function newScheduleBlock(): LightScheduleBlock {
  return { id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, onTime: "08:00", offTime: "09:00", days: [] };
}

function ScheduleBlockRow({
  block,
  onChange,
  onRemove,
}: {
  block: LightScheduleBlock;
  onChange: (block: LightScheduleBlock) => void;
  onRemove: () => void;
}) {
  const toggleDay = (day: number) => {
    onChange({ ...block, days: block.days.includes(day) ? block.days.filter((d) => d !== day) : [...block.days, day].sort() });
  };

  return (
    <div className="space-y-2 rounded-xl border border-border/50 bg-background p-3">
      <div className="flex items-center gap-2">
        <input
          type="time"
          value={block.onTime}
          onChange={(event) => onChange({ ...block, onTime: event.target.value })}
          className="h-9 flex-1 rounded-lg border border-border bg-background px-2 text-sm"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <input
          type="time"
          value={block.offTime}
          onChange={(event) => onChange({ ...block, offTime: event.target.value })}
          className="h-9 flex-1 rounded-lg border border-border bg-background px-2 text-sm"
        />
        <button type="button" onClick={onRemove} className="shrink-0 p-1.5 text-muted-foreground hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-3">
        <DayPicker days={block.days} onToggle={toggleDay} />
        <span className="text-[11px] text-muted-foreground">{block.days.length === 0 ? "Every day" : "Selected days only"}</span>
      </div>
    </div>
  );
}

/**
 * A recurring on/off schedule, independent of any alarm. Each block is its
 * own on/off window with its own day selection, so different days can have
 * different times (separate blocks per day) and a single day can have more
 * than one on/off cycle (multiple blocks covering that day) — e.g. on
 * 8-9am, off 9am-2pm, on 2pm-3pm. Shared between Remote Displays and
 * Connected Devices, same as the other sections here.
 */
export function ScheduleSection({ deviceId }: { deviceId: string }) {
  const { device, updateLightSchedule } = useDeviceSettings(deviceId);
  if (!device) return null;
  const schedule = device.settings.light.schedule;

  const updateBlock = (id: string, patch: LightScheduleBlock) => {
    void updateLightSchedule({ blocks: schedule.blocks.map((b) => (b.id === id ? patch : b)) });
  };
  const removeBlock = (id: string) => {
    void updateLightSchedule({ blocks: schedule.blocks.filter((b) => b.id !== id) });
  };
  const addBlock = () => void updateLightSchedule({ blocks: [...schedule.blocks, newScheduleBlock()] });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Schedule</p>
        <Switch checked={schedule.enabled} onCheckedChange={(value) => void updateLightSchedule({ enabled: value })} />
      </div>
      {schedule.enabled && (
        <>
          {schedule.blocks.length === 0 ? (
            <p className="text-xs text-muted-foreground">No time blocks yet.</p>
          ) : (
            <div className="space-y-2">
              {schedule.blocks.map((block) => (
                <ScheduleBlockRow key={block.id} block={block} onChange={(patch) => updateBlock(block.id, patch)} onRemove={() => removeBlock(block.id)} />
              ))}
            </div>
          )}
          <Button type="button" variant="outline" size="sm" className="w-full gap-1.5 rounded-lg" onClick={addBlock}>
            <Plus className="h-3.5 w-3.5" /> Add time block
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Leave a block's days unselected to run it every day, or pick specific days to vary times by day. Add more than one
            block to get multiple on/off cycles in a day.
          </p>
        </>
      )}
    </div>
  );
}
