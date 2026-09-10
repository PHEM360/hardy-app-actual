import { useEffect, useState } from "react";
import { Lightbulb, Loader2, Plus, Sunrise, Trash2, Wifi } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDeviceSettings } from "@/hooks/useDeviceSettings";
import { useLightPairing } from "@/hooks/useLightPairing";
import { sendLightCommand } from "@/lib/lightPairingApi";
import type { LinkedDevice } from "@/hooks/useMyDevices";

function LightRow({ light, onForget }: { light: LinkedDevice; onForget: (id: string) => void }) {
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
    <div className="space-y-3 rounded-2xl border border-border/50 bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Lightbulb className={`h-4 w-4 shrink-0 ${manual.on ? "text-amber-400" : "text-muted-foreground"}`} />
          <p className="truncate text-sm font-semibold">{light.label}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Switch checked={manual.on} disabled={pending} onCheckedChange={(value) => void send({ on: value })} />
          <button
            type="button"
            onClick={() => { if (window.confirm(`Disconnect ${light.label}?`)) onForget(light.id); }}
            className="p-1.5 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
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

function AddLightDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { state, start, configure, reset } = useLightPairing();
  const [homeSsid, setHomeSsid] = useState("");
  const [homePassword, setHomePassword] = useState("");

  useEffect(() => {
    if (open) {
      setHomeSsid("");
      setHomePassword("");
      void start();
    } else {
      reset();
    }
    // start/reset are stable across renders; this should only re-run when the dialog opens or closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (state.phase === "claimed") {
      toast.success("Light connected!");
      onOpenChange(false);
    }
  }, [state.phase, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-4 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display"><Sunrise className="h-4 w-4" /> Add a sunrise light</DialogTitle>
        </DialogHeader>

        {(state.phase === "idle" || state.phase === "starting") && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Getting ready…</p>
        )}

        {state.phase === "ready_to_join" && (
          <div className="space-y-3 text-sm">
            <ol className="list-inside list-decimal space-y-2 text-muted-foreground">
              <li>Power on the light. It will broadcast its own WiFi network (usually named "WLED-AP").</li>
              <li>On this device, join that network now — the password is usually <code className="rounded bg-muted px-1">wled1234</code>.</li>
              <li>Come back here and enter your home WiFi details below.</li>
            </ol>
            <div className="space-y-2">
              <Label className="text-xs">Home WiFi name</Label>
              <Input value={homeSsid} onChange={(event) => setHomeSsid(event.target.value)} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Home WiFi password</Label>
              <Input type="password" value={homePassword} onChange={(event) => setHomePassword(event.target.value)} className="h-9 rounded-xl" />
            </div>
            <Button
              className="w-full gap-2 rounded-xl bg-gradient-primary"
              disabled={!homeSsid.trim()}
              onClick={() => void configure(homeSsid.trim(), homePassword)}
            >
              <Wifi className="h-4 w-4" /> Connect the light
            </Button>
          </div>
        )}

        {state.phase === "configuring" && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Sending it your WiFi details…
          </p>
        )}

        {state.phase === "waiting" && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Reconnect this device to your home WiFi — waiting for the light to come online…
          </p>
        )}

        {(state.phase === "error" || state.phase === "expired") && (
          <div className="space-y-3 text-sm">
            <p className="text-destructive">{state.error || "This pairing has expired."}</p>
            <Button variant="outline" className="w-full rounded-xl" onClick={() => void start()}>Try again</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
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
            <p className="text-[11px] text-muted-foreground">Link an ESP32 light, then wake it alongside an alarm below.</p>
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
