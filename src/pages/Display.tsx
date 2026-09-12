import { useEffect } from "react";
import { FolderOpen, Maximize, Moon, Sun, WifiOff } from "lucide-react";
import DogLoader from "@/components/DogLoader";
import { useDeviceAuth } from "@/hooks/useDeviceAuth";
import { useDeviceSettings } from "@/hooks/useDeviceSettings";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useAutoFullscreen } from "@/hooks/useAutoFullscreen";
import { useLocalDisplayFolder } from "@/hooks/useLocalDisplayFolder";
import { DisplayLoginScreen } from "@/components/display/DisplayLoginScreen";
import { AlarmManager } from "@/components/display/AlarmManager";
import { AlarmRingingOverlay } from "@/components/display/AlarmRingingOverlay";
import { FullscreenHintOverlay } from "@/components/display/FullscreenHintOverlay";
import { RemoteDisplayRuntime } from "@/components/display/RemoteDisplayRuntime";
import { nextNightEndIso, resolveNightMode } from "@/lib/displayNightMode";

/**
 * Swaps in the display-only manifest (fullscreen, start_url=/display) while
 * this page is open, so "Add to Home Screen" on the kiosk itself creates a
 * shortcut that opens straight into the display with no browser chrome,
 * instead of the whole app's dashboard-first, standalone-only manifest.
 */
function useDisplayManifest() {
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const previousHref = link?.getAttribute("href") || "/manifest.webmanifest";
    link?.setAttribute("href", "/display.webmanifest");
    return () => {
      link?.setAttribute("href", previousHref);
    };
  }, []);
}

export default function Display() {
  const { status, deviceId, pairing, restartPairing } = useDeviceAuth();
  const {
    device,
    loading: settingsLoading,
    updateNightMode,
  } = useDeviceSettings(deviceId);
  const keepAwake = device?.settings.control.keepAwake !== false;
  const { supported: wakeLockSupported } = useWakeLock(status === "ready" && keepAwake);
  const { isFullscreen, supported: fullscreenSupported, requestFullscreen } = useAutoFullscreen(status === "ready");
  const localFolder = useLocalDisplayFolder();
  useDisplayManifest();

  if (status === "loading") {
    return (
      <div className="min-h-[100dvh] w-full bg-zinc-950">
        <DogLoader fullPage text="Starting display…" />
      </div>
    );
  }

  if (status === "revoked") {
    return (
      <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center" style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <WifiOff className="w-10 h-10 text-white/40" />
        <p className="text-white text-lg font-semibold">This display was disconnected</p>
        <p className="text-white/50 text-sm max-w-sm">
          It was removed from Remote Displays. Refresh this page to securely link it again.
        </p>
      </div>
    );
  }

  if (status === "signed_out") {
    return (
      <DisplayLoginScreen
        pairing={pairing}
        onRestartPairing={restartPairing}
      />
    );
  }

  if (settingsLoading || !device) {
    return (
      <div className="min-h-[100dvh] w-full bg-zinc-950">
        <DogLoader fullPage text="Loading your display…" />
      </div>
    );
  }

  const night = resolveNightMode(device.settings.nightMode, device.settings.alarms, new Date());

  return (
    <div className="relative h-[100svh] min-h-[100dvh] w-full select-none overflow-hidden bg-zinc-950">
      <RemoteDisplayRuntime device={device} extraPhotos={localFolder.photos} />

      <AlarmManager alarms={device.settings.alarms} />
      <AlarmRingingOverlay uid={device.uid} />
      <FullscreenHintOverlay
        supported={fullscreenSupported}
        isFullscreen={isFullscreen}
        offset={device.settings.alarms.some((a) => a.enabled)}
        onRequest={requestFullscreen}
      />

      {/* Low-opacity control cluster — deliberately unobtrusive on an always-on screen */}
      <div
        className="absolute right-4 flex items-center gap-2"
        style={{ bottom: "max(1rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))" }}
      >
        {keepAwake && !wakeLockSupported && (
          <span className="text-[10px] text-white/25 mr-1 max-w-[10rem] text-right leading-tight hidden sm:block">
            This browser can't keep the screen awake automatically — disable auto-sleep in the device's system settings.
          </span>
        )}
        {localFolder.supported && (
          <button
            type="button"
            onClick={() => void (localFolder.folderName ? localFolder.clearFolder() : localFolder.pickFolder())}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
            aria-label={localFolder.folderName ? `Stop using ${localFolder.folderName}` : "Use a photo folder on this computer"}
            title={localFolder.folderName ? `Using ${localFolder.folderName}` : "Use a folder on this computer"}
          >
            <FolderOpen className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            const now = new Date();
            void updateNightMode(night.active
              ? { override: "off", overrideUntil: nextNightEndIso(device.settings.nightMode, now) }
              : { override: "on", overrideUntil: nextNightEndIso(device.settings.nightMode, now) });
          }}
          className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
          aria-label={night.active ? "Leave night mode" : "Night mode"}
        >
          {night.active ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        {!isFullscreen && (
          <button
            onClick={requestFullscreen}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
            aria-label="Enter fullscreen"
          >
            <Maximize className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
