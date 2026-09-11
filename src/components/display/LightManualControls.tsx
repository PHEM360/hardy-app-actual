import { useState } from "react";
import { motion } from "framer-motion";
import { Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { useDeviceSettings } from "@/hooks/useDeviceSettings";
import { sendLightCommand } from "@/lib/lightPairingApi";
import type { LinkedDevice } from "@/hooks/useMyDevices";

function LightToggle({ on, pending, onChange }: { on: boolean; pending: boolean; onChange: (value: boolean) => void }) {
  return (
    <motion.button
      type="button"
      disabled={pending}
      onClick={() => onChange(!on)}
      whileTap={{ scale: 0.95 }}
      aria-pressed={on}
      aria-label={on ? "Turn light off" : "Turn light on"}
      className={`relative h-9 w-16 shrink-0 rounded-full border-2 transition-colors duration-300 disabled:opacity-60 ${
        on
          ? "border-amber-400 bg-gradient-to-r from-amber-400 to-orange-400 shadow-[0_0_16px_rgba(251,191,36,0.55)]"
          : "border-border bg-muted"
      }`}
    >
      <motion.span
        animate={{ x: on ? 30 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className={`absolute top-0.5 flex h-7 w-7 items-center justify-center rounded-full shadow-md ${on ? "bg-white" : "bg-background"}`}
      >
        <Lightbulb className={`h-4 w-4 ${on ? "text-amber-500" : "text-muted-foreground"}`} />
      </motion.span>
    </motion.button>
  );
}

/**
 * Quick, everyday manual control: on/off and brightness/colour, for a light
 * already turned on. Its own default sunrise look, default manual settings,
 * and schedule live in LightDefaultsSections instead (shown alongside this
 * on the Connected Devices page, and in the Remote Displays detail dialog),
 * since those are edited far less often than a plain on/off/brightness flip.
 */
export function LightManualControls({ light }: { light: LinkedDevice }) {
  const { device } = useDeviceSettings(light.id);
  const [pending, setPending] = useState(false);
  if (!device) return null;
  const { manual, colorCapable } = device.settings.light;

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
        <LightToggle on={manual.on} pending={pending} onChange={(value) => void send({ on: value })} />
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
          disabled={!colorCapable}
          onChange={(event) => void send({ colorHex: event.target.value })}
          className="h-8 w-14 cursor-pointer rounded-lg border border-border bg-transparent p-0.5 disabled:cursor-not-allowed disabled:opacity-40"
        />
        {!colorCapable && <span className="text-[11px] text-muted-foreground">Single colour — can't be changed</span>}
      </div>
    </div>
  );
}
