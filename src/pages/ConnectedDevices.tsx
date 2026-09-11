import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Cable, ExternalLink, MonitorSmartphone, Plus, Sunrise, Trash2, Wifi, WifiOff } from "lucide-react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Button } from "@/components/ui/button";
import { useMyDevices, type LinkedDevice } from "@/hooks/useMyDevices";
import { useDeviceSettings } from "@/hooks/useDeviceSettings";
import { lastSeenLabel, timestampMs, describeLightStatus } from "@/lib/deviceStatus";
import { AddLightDialog } from "@/components/display/AddLightDialog";
import { LightManualControls } from "@/components/display/LightManualControls";
import { SunriseDefaultsSection, ManualDefaultsSection, ScheduleSection } from "@/components/display/LightDefaultsSections";

const STATUS_TONE_CLASS = {
  ok: "text-emerald-500",
  warn: "text-amber-500",
  error: "text-destructive",
};

function DisplayRow({ device, onForget }: { device: LinkedDevice; onForget: (id: string) => void }) {
  const online = timestampMs(device.lastSeenAt) > Date.now() - 10 * 60_000;
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl border border-border/50 bg-muted/30 p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{device.label}</p>
        <p className={`flex items-center gap-1 text-[11px] font-medium ${online ? "text-emerald-500" : "text-muted-foreground"}`}>
          {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {lastSeenLabel(device.lastSeenAt)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button asChild size="sm" variant="outline" className="gap-1.5 rounded-lg">
          <Link to="/remote-displays"><ExternalLink className="h-3.5 w-3.5" /> Manage screen</Link>
        </Button>
        <button
          type="button"
          onClick={() => { if (window.confirm(`Disconnect ${device.label}?`)) onForget(device.id); }}
          className="p-1.5 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function LightRow({ device, onForget }: { device: LinkedDevice; onForget: (id: string) => void }) {
  const { device: full } = useDeviceSettings(device.id);
  const status = full ? describeLightStatus(full.settings.light) : null;
  const on = full?.settings.light.manual.on ?? false;

  return (
    <motion.div
      animate={
        on
          ? { boxShadow: ["0 0 18px -6px rgba(251,191,36,0.45)", "0 0 34px -6px rgba(251,146,60,0.75)", "0 0 18px -6px rgba(251,191,36,0.45)"] }
          : { boxShadow: "0 0 0px 0px rgba(251,191,36,0)" }
      }
      transition={on ? { duration: 2.6, repeat: Infinity, ease: "easeInOut" } : { duration: 0.4 }}
      className={`space-y-3 rounded-2xl border p-3 transition-colors duration-500 ${
        on
          ? "border-amber-400/60 bg-gradient-to-br from-amber-400/15 via-orange-400/8 to-transparent"
          : "border-border/50 bg-muted/30"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <motion.div
            animate={on ? { scale: [1, 1.12, 1] } : { scale: 1 }}
            transition={on ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
            className={`shrink-0 ${on ? "text-amber-500" : "text-muted-foreground"}`}
          >
            <Sunrise className="h-4 w-4" />
          </motion.div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{device.label}</p>
            {status && (
              <p className={`flex items-center gap-1 text-[11px] font-medium ${STATUS_TONE_CLASS[status.tone]}`}>
                {status.online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {status.label}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => { if (window.confirm(`Disconnect ${device.label}?`)) onForget(device.id); }}
          className="shrink-0 p-1.5 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <LightManualControls light={device} />
      {full && (
        <details className="text-xs">
          <summary className="cursor-pointer font-semibold text-muted-foreground">Defaults &amp; schedule</summary>
          <div className="mt-3 space-y-4">
            <SunriseDefaultsSection deviceId={device.id} colorCapable={full.settings.light.colorCapable} />
            <ManualDefaultsSection deviceId={device.id} colorCapable={full.settings.light.colorCapable} />
            <ScheduleSection deviceId={device.id} />
          </div>
        </details>
      )}
    </motion.div>
  );
}

export default function ConnectedDevices() {
  const { devices, loading, renameDevice, forgetDevice } = useMyDevices();
  const [addLightOpen, setAddLightOpen] = useState(false);
  const displays = devices.filter((d) => d.deviceType === "display");
  const lights = devices.filter((d) => d.deviceType === "light");

  return (
    <FeaturePageShell title="Connected devices" subtitle="Everything paired to your account, grouped by type" icon={<Cable className="h-5 w-5" />}>
      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading devices…</p>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MonitorSmartphone className="h-4 w-4 text-sky-500" />
                <h2 className="font-display text-base font-bold">Displays</h2>
              </div>
              <Button asChild size="sm" variant="outline" className="gap-1.5 rounded-xl">
                <Link to="/remote-displays"><Plus className="h-3.5 w-3.5" /> Add a screen</Link>
              </Button>
            </div>
            {displays.length === 0 ? (
              <p className="text-sm text-muted-foreground">No screens linked yet.</p>
            ) : (
              <div className="space-y-2">
                {displays.map((device) => <DisplayRow key={device.id} device={device} onForget={forgetDevice} />)}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sunrise className="h-4 w-4 text-amber-500" />
                <h2 className="font-display text-base font-bold">Sunrise lights</h2>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5 rounded-xl" onClick={() => setAddLightOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Add sunrise light
              </Button>
            </div>
            {lights.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sunrise lights linked yet.</p>
            ) : (
              <div className="space-y-2">
                {lights.map((device) => <LightRow key={device.id} device={device} onForget={forgetDevice} />)}
              </div>
            )}
          </div>
        </div>
      )}
      <AddLightDialog open={addLightOpen} onOpenChange={setAddLightOpen} onPaired={renameDevice} />
    </FeaturePageShell>
  );
}
