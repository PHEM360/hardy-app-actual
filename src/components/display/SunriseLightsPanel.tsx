import { useState } from "react";
import { Palette, Plus, Sunrise, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDeviceSettings } from "@/hooks/useDeviceSettings";
import { describeLightStatus } from "@/lib/deviceStatus";
import { AddLightDialog } from "@/components/display/AddLightDialog";
import { LightDetailDialog } from "@/components/display/LightDetailDialog";
import type { LinkedDevice } from "@/hooks/useMyDevices";

const STATUS_TONE_CLASS = {
  ok: "text-emerald-500",
  warn: "text-amber-500",
  error: "text-destructive",
};

/**
 * Purely add/status/delete — no manual control here. Tapping a light opens
 * LightDetailDialog (rename, delete, colour capability, default sunrise
 * look, default manual settings, schedule). Manual on/off/brightness/colour
 * controls for everyday use live on the Connected Devices page instead.
 */
function LightRow({ light, onOpen }: { light: LinkedDevice; onOpen: (light: LinkedDevice) => void }) {
  const { device } = useDeviceSettings(light.id);
  if (!device) return null;
  const status = describeLightStatus(device.settings.light);

  return (
    <button
      type="button"
      onClick={() => onOpen(light)}
      className="flex w-full items-center justify-between gap-2 rounded-2xl border border-border/50 bg-muted/30 p-3 text-left transition hover:border-primary/40 hover:bg-muted/50"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{light.label}</p>
        <p className={`flex items-center gap-1 text-[11px] font-medium ${STATUS_TONE_CLASS[status.tone]}`}>
          {status.online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {status.label}
        </p>
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Palette className="h-3 w-3" /> {device.settings.light.colorCapable ? "Multi-colour" : "Single colour"}
        </p>
      </div>
    </button>
  );
}

export function SunriseLightsPanel({
  lights,
  onRename,
  onForget,
}: {
  lights: LinkedDevice[];
  onRename: (id: string, label: string) => void;
  onForget: (deviceId: string) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [detailLight, setDetailLight] = useState<LinkedDevice | null>(null);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sunrise className="h-4 w-4 text-amber-500" />
          <div>
            <h2 className="font-display text-base font-bold">Sunrise lights</h2>
            <p className="text-[11px] text-muted-foreground">Tap a light for its details — control it day-to-day from Connected devices.</p>
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
          {lights.map((light) => <LightRow key={light.id} light={light} onOpen={setDetailLight} />)}
        </div>
      )}
      <AddLightDialog open={addOpen} onOpenChange={setAddOpen} onPaired={onRename} />
      <LightDetailDialog
        light={detailLight}
        open={detailLight !== null}
        onOpenChange={(open) => { if (!open) setDetailLight(null); }}
        onRename={onRename}
        onForget={onForget}
      />
    </div>
  );
}
