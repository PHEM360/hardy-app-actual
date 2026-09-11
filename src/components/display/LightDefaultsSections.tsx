import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useDeviceSettings, type LightManualDefaults, type LightScheduleSettings, type LightSunriseDefaults } from "@/hooks/useDeviceSettings";

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
        <select
          value={sunrise.rampMinutes}
          onChange={(event) => set({ rampMinutes: Number(event.target.value) })}
          className="h-9 flex-1 rounded-lg border border-border bg-background px-2 text-sm"
        >
          {[10, 15, 20, 30, 45, 60].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
        </select>
      </div>
      <div className="flex items-center gap-3">
        <Label className="w-24 shrink-0 text-xs">Peak brightness</Label>
        <input
          type="range"
          min={1}
          max={255}
          value={sunrise.peakBrightness}
          onChange={(event) => set({ peakBrightness: Number(event.target.value) })}
          className="flex-1"
        />
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
        <input
          type="range"
          min={1}
          max={255}
          value={defaults.brightness}
          onChange={(event) => set({ brightness: Number(event.target.value) })}
          className="flex-1"
        />
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

/** A recurring daily/weekly on-off schedule, independent of any alarm. */
export function ScheduleSection({ deviceId }: { deviceId: string }) {
  const { device, updateLightSchedule } = useDeviceSettings(deviceId);
  if (!device) return null;
  const schedule = device.settings.light.schedule;
  const set = (patch: Partial<LightScheduleSettings>) => void updateLightSchedule(patch);
  const toggleDay = (day: number) => {
    set({ days: schedule.days.includes(day) ? schedule.days.filter((d) => d !== day) : [...schedule.days, day].sort() });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Schedule</p>
        <Switch checked={schedule.enabled} onCheckedChange={(value) => set({ enabled: value })} />
      </div>
      {schedule.enabled && (
        <>
          <div className="flex items-center gap-3">
            <Label className="w-24 shrink-0 text-xs">On at</Label>
            <input
              type="time"
              value={schedule.onTime}
              onChange={(event) => set({ onTime: event.target.value })}
              className="h-9 flex-1 rounded-lg border border-border bg-background px-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-3">
            <Label className="w-24 shrink-0 text-xs">Off at</Label>
            <input
              type="time"
              value={schedule.offTime}
              onChange={(event) => set({ offTime: event.target.value })}
              className="h-9 flex-1 rounded-lg border border-border bg-background px-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-3">
            <Label className="w-24 shrink-0 text-xs">Days</Label>
            <DayPicker days={schedule.days} onToggle={toggleDay} />
          </div>
          <p className="text-[11px] text-muted-foreground">No days selected = every day.</p>
        </>
      )}
    </div>
  );
}
