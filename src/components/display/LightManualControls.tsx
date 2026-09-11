import { useState } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useDeviceSettings } from "@/hooks/useDeviceSettings";
import { sendLightCommand } from "@/lib/lightPairingApi";
import type { LinkedDevice } from "@/hooks/useMyDevices";

/**
 * Manual, no-alarm-needed control for a sunrise light: on/off, brightness,
 * colour, and its default sunrise look (used by the once-a-minute ramp).
 * Lives on the Connected Devices page — src/components/display/
 * SunriseLightsPanel.tsx is a pure add/status/delete list and intentionally
 * has none of this.
 */
export function LightManualControls({ light }: { light: LinkedDevice }) {
  const { device, updateLightSunrise } = useDeviceSettings(light.id);
  const [pending, setPending] = useState(false);
  if (!device) return null;
  const { manual, sunrise } = device.settings.light;

  const send = async (patch: { on?: boolean; brightness?: number; colorHex?: string }) => {
    setPending(true);
    try {
      await sendLightCommand(light.id, patch);
    } catch {
      toast.error("Could not reach that light.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">On</Label>
        <Switch checked={manual.on} disabled={pending} onCheckedChange={(value) => void send({ on: value })} />
      </div>
      <div className="flex items-center gap-3">
        <Label className="w-20 shrink-0 text-xs">Brightness</Label>
        <input
          type="range"
          min={1}
          max={255}
          value={manual.brightness}
          onChange={(event) => void send({ brightness: Number(event.target.value) })}
          className="flex-1"
        />
      </div>
      <div className="flex items-center gap-3">
        <Label className="w-20 shrink-0 text-xs">Colour</Label>
        <input
          type="color"
          value={manual.colorHex}
          onChange={(event) => void send({ colorHex: event.target.value })}
          className="h-8 w-14 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
        />
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer font-semibold text-muted-foreground">Sunrise look</summary>
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-3">
            <Label className="w-20 shrink-0 text-xs">Ramp over</Label>
            <select
              value={sunrise.rampMinutes}
              onChange={(event) => void updateLightSunrise({ rampMinutes: Number(event.target.value) })}
              className="h-8 flex-1 rounded-lg border border-border bg-background px-2 text-xs"
            >
              {[10, 15, 20, 30, 45, 60].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <Label className="w-20 shrink-0 text-xs">From / to</Label>
            <input
              type="color"
              value={sunrise.colorFrom}
              onChange={(event) => void updateLightSunrise({ colorFrom: event.target.value })}
              className="h-8 w-14 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
            />
            <input
              type="color"
              value={sunrise.colorTo}
              onChange={(event) => void updateLightSunrise({ colorTo: event.target.value })}
              className="h-8 w-14 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
            />
          </div>
        </div>
      </details>
    </div>
  );
}
