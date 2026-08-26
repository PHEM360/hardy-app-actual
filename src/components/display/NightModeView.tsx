import { ClockScene } from "@/components/display/ClockScene";
import { DisplayBackdrop } from "@/components/display/DisplayBackdrop";
import type { ClockSettings } from "@/hooks/useDeviceSettings";
import type { NightScreen } from "@/lib/displayNightMode";

export function NightModeView({
  screen,
  clock,
}: {
  screen: NightScreen;
  clock: ClockSettings;
}) {
  if (screen === "blank") {
    return <div className="absolute inset-0 bg-black" aria-label="Night mode, screen off" />;
  }
  return (
    <div className="absolute inset-0 bg-zinc-950">
      <DisplayBackdrop kind="stars" accent={clock.accentColor} />
      <ClockScene settings={{ ...clock, size: "xlarge", showSeconds: false }} />
    </div>
  );
}
