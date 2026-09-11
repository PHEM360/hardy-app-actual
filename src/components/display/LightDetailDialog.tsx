import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useDeviceSettings } from "@/hooks/useDeviceSettings";
import { describeLightStatus } from "@/lib/deviceStatus";
import { SunriseDefaultsSection, ManualDefaultsSection, ScheduleSection } from "@/components/display/LightDefaultsSections";
import type { LinkedDevice } from "@/hooks/useMyDevices";

export function LightDetailDialog({
  light,
  open,
  onOpenChange,
  onRename,
  onForget,
}: {
  light: LinkedDevice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRename: (id: string, label: string) => void;
  onForget: (id: string) => void;
}) {
  const { device, updateLightMeta } = useDeviceSettings(light?.id ?? null);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (light) setName(light.label);
  }, [light]);
  useEffect(() => {
    if (device) setNotes(device.settings.light.notes);
  }, [device]);

  if (!light) return null;
  const status = device ? describeLightStatus(device.settings.light) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-4 max-h-[85vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Light details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="flex items-center gap-2">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => { if (name.trim() && name.trim() !== light.label) onRename(light.id, name.trim()); }}
              className="h-9 flex-1 rounded-xl font-semibold"
              aria-label="Light name"
            />
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Disconnect ${light.label}?`)) {
                  onForget(light.id);
                  onOpenChange(false);
                }
              }}
              className="shrink-0 p-2 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          {status && <p className="text-xs text-muted-foreground">{status.label}</p>}

          {device && (
            <>
              <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/30 p-3">
                <div>
                  <Label className="text-xs">Multi-colour capable</Label>
                  <p className="text-[11px] text-muted-foreground">Off = single colour, brightness only (matches the project's own firmware).</p>
                </div>
                <Switch
                  checked={device.settings.light.colorCapable}
                  onCheckedChange={(value) => void updateLightMeta({ colorCapable: value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Notes</Label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  onBlur={() => void updateLightMeta({ notes })}
                  rows={2}
                  placeholder="e.g. Kids' bedroom, north wall"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                />
              </div>

              <SunriseDefaultsSection deviceId={light.id} colorCapable={device.settings.light.colorCapable} />
              <ManualDefaultsSection deviceId={light.id} colorCapable={device.settings.light.colorCapable} />
              <ScheduleSection deviceId={light.id} />
            </>
          )}

          <Button variant="outline" className="w-full rounded-xl" onClick={() => onOpenChange(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
