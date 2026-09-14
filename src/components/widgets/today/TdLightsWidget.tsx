import { Link } from "react-router-dom";
import { useMyDevices } from "@/hooks/useMyDevices";
import { LightManualControls } from "@/components/display/LightManualControls";
import { TdHead } from "./TdHead";

export function TdLightsWidget() {
  const { devices, loading } = useMyDevices();
  const lights = devices.filter((device) => device.deviceType === "light");

  return (
    <div className="flex h-full min-h-0 flex-col p-3">
      <TdHead emoji="💡" title="Lights" />
      {loading && <p className="text-xs text-muted-foreground">Looking for lights…</p>}
      {!loading && lights.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No sunrise lights yet. Pair one in{" "}
          <Link to="/connected-devices" className="font-semibold text-primary hover:underline">
            Devices
          </Link>
          .
        </p>
      )}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5">
        {lights.map((light) => (
          <div
            key={light.id}
            className="rounded-xl border border-border/50 px-3 py-2.5"
            style={{ background: "color-mix(in srgb, hsl(38,92%,50%) 12%, hsl(var(--card)))" }}
          >
            <p className="mb-2 text-xs font-semibold text-foreground">{light.label}</p>
            <LightManualControls light={light} />
          </div>
        ))}
      </div>
    </div>
  );
}
