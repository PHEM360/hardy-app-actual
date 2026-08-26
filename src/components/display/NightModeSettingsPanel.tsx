import { Moon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import type { NightModeSettings } from "@/lib/displayNightMode";
import { resolveNightMode, type NightAlarm } from "@/lib/displayNightMode";

export function NightModeSettingsPanel({
  nightMode,
  alarms,
  onChange,
  onActivate,
  onClear,
}: {
  nightMode: NightModeSettings;
  alarms: NightAlarm[];
  onChange: (patch: Partial<NightModeSettings>) => void;
  onActivate: () => void;
  onClear: () => void;
}) {
  const now = new Date();
  const state = resolveNightMode(nightMode, alarms, now);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/30 p-3">
        <div>
          <p className="text-sm font-semibold">{state.active ? "Night mode is on" : "Showing daytime pages"}</p>
          <p className="text-xs text-muted-foreground">
            {state.reason === "schedule" && "Inside the nightly hours you set."}
            {state.reason === "alarm" && "On until the morning alarm."}
            {state.reason === "override" && "Turned on until you switch it off, or morning arrives."}
            {state.reason === "off" && "Photo pages and the rest of the rotation stay on."}
          </p>
        </div>
        {state.active ? (
          <Button type="button" variant="outline" className="rounded-xl" onClick={onClear}>Daytime pages</Button>
        ) : (
          <Button type="button" className="rounded-xl bg-gradient-primary" onClick={onActivate}>
            <Moon className="mr-1.5 h-4 w-4" /> Night mode
          </Button>
        )}
      </div>

      <label className="flex items-center justify-between gap-3 text-sm">
        <span>Every night from</span>
        <Switch
          checked={nightMode.scheduleEnabled}
          onCheckedChange={(value) => onChange({ scheduleEnabled: value })}
          aria-label="Use nightly hours"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs font-semibold text-muted-foreground">
          Starts
          <input
            type="time"
            aria-label="Night mode starts"
            value={nightMode.start}
            onChange={(event) => onChange({ start: event.target.value })}
            className="mt-1 h-10 w-full rounded-xl border border-border bg-input px-3 text-sm"
          />
        </label>
        <label className="text-xs font-semibold text-muted-foreground">
          Until
          <input
            type="time"
            aria-label="Night mode ends"
            value={nightMode.end}
            onChange={(event) => onChange({ end: event.target.value })}
            className="mt-1 h-10 w-full rounded-xl border border-border bg-input px-3 text-sm"
          />
        </label>
      </div>
      <label className="block text-xs font-semibold text-muted-foreground">
        Night screen
        <select
          aria-label="Night screen"
          value={nightMode.screen}
          onChange={(event) => onChange({ screen: event.target.value as NightModeSettings["screen"] })}
          className="mt-1 h-10 w-full rounded-xl border border-border bg-input px-3 text-sm"
        >
          <option value="clock">Clock</option>
          <option value="blank">Nothing — just black</option>
        </select>
      </label>
      <label className="flex items-start justify-between gap-3 text-sm">
        <span>
          <span className="block font-medium">When I set a morning alarm</span>
          <span className="block text-xs text-muted-foreground">Switch to night mode that evening until the alarm.</span>
        </span>
        <Switch
          checked={nightMode.withAlarms}
          onCheckedChange={(value) => onChange({ withAlarms: value })}
          aria-label="Night mode with morning alarms"
        />
      </label>
    </div>
  );
}
