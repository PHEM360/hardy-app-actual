import { useState } from "react";
import { Palette, Plus, Sunrise, Trash2, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDeviceSettings } from "@/hooks/useDeviceSettings";
import { describeLightStatus } from "@/lib/deviceStatus";
import { AddLightDialog } from "@/components/display/AddLightDialog";
import type { LinkedDevice } from "@/hooks/useMyDevices";

const STATUS_TONE_CLASS = {
  ok: "text-emerald-500",
  warn: "text-amber-500",
  error: "text-destructive",
};

/**
 * Purely add/status/delete — no manual control here. Every light this app
 * can currently pair runs the project's own single-channel firmware (see
 * firmware/sunrise-light), so "Single colour" is accurate today rather than
 * a real per-device capability check; revisit if/when a multi-colour light
 * becomes pairable. Manual on/off/brightness/colour/sunrise-look controls
 * live on the Connected Devices page instead (LightManualControls).
 */
function LightRow({ light, onForget }: { light: LinkedDevice; onForget: (id: string) => void }) {
  const { device } = useDeviceSettings(light.id);
  if (!device) return null;
  const status = describeLightStatus(device.settings.light);

  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl border border-border/50 bg-muted/30 p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{light.label}</p>
        <p className={`flex items-center gap-1 text-[11px] font-medium ${STATUS_TONE_CLASS[status.tone]}`}>
          {status.online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {status.label}
        </p>
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Palette className="h-3 w-3" /> Single colour
        </p>
      </div>
      <button
        type="button"
        onClick={() => { if (window.confirm(`Disconnect ${light.label}?`)) onForget(light.id); }}
        className="shrink-0 p-1.5 text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export function SunriseLightsPanel({ lights, onForget }: { lights: LinkedDevice[]; onForget: (deviceId: string) => void }) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sunrise className="h-4 w-4 text-amber-500" />
          <div>
            <h2 className="font-display text-base font-bold">Sunrise lights</h2>
            <p className="text-[11px] text-muted-foreground">Add or remove lights here — control them from Connected devices.</p>
          </div>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 rounded-xl" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Add sunrise light
        </Button>
      </div>
      {lights.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sunrise lights linked yet.</p>
      ) : (
        <div className="space-y-2">
          {lights.map((light) => <LightRow key={light.id} light={light} onForget={onForget} />)}
        </div>
      )}
      <AddLightDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
