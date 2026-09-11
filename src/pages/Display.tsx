import { useEffect, useState } from "react";
import { FolderOpen, Maximize, Moon, Sun, WifiOff } from "lucide-react";
import DogLoader from "@/components/DogLoader";
import { useDeviceAuth } from "@/hooks/useDeviceAuth";
import { useDeviceSettings } from "@/hooks/useDeviceSettings";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useAutoUnlockAudio } from "@/hooks/useAutoUnlockAudio";
import { useLocalDisplayFolder } from "@/hooks/useLocalDisplayFolder";
import { DisplayLoginScreen } from "@/components/display/DisplayLoginScreen";
import { AlarmManager } from "@/components/display/AlarmManager";
import { AudioUnlockOverlay } from "@/components/display/AudioUnlockOverlay";
import { RemoteDisplayRuntime } from "@/components/display/RemoteDisplayRuntime";
import { nextNightEndIso, resolveNightMode } from "@/lib/displayNightMode";

export default function Display() {
  const { status, deviceId, pairing, restartPairing } = useDeviceAuth();
  const {
    device,
    loading: settingsLoading,
    updateAlarm,
    updateNightMode,
  } = useDeviceSettings(deviceId);
  const alwaysOn = device?.settings.alwaysOn !== false;
  const { supported: wakeLockSupported, held: wakeLockHeld } = useWakeLock(status === "ready" && alwaysOn);
  const { unlocked: audioUnlocked, tryUnlock: tryUnlockAudio } = useAutoUnlockAudio(status === "ready");
  const localFolder = useLocalDisplayFolder();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const requestFullscreen = () => {
    document.documentElement.requestFullscreen?.().catch(() => {});
  };

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
          It was removed from Remote Displays. Link it again from this screen — you will not need to keep entering a passkey on the display itself.
        </p>
        <button
          type="button"
          onClick={restartPairing}
          className="mt-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
        >
          Link again
        </button>
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

      <AlarmManager alarms={device.settings.alarms} onUpdateAlarm={updateAlarm} />
      <AudioUnlockOverlay
        hasEnabledAlarms={device.settings.alarms.some((a) => a.enabled)}
        unlocked={audioUnlocked}
        onTryUnlock={tryUnlockAudio}
      />

      {/* Low-opacity control cluster — deliberately unobtrusive on an always-on screen */}
      <div
        className="absolute right-4 flex items-center gap-2"
        style={{ bottom: "max(1rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))" }}
      >
        {!wakeLockSupported && alwaysOn && (
          <span className="text-[10px] text-white/25 mr-1 max-w-[10rem] text-right leading-tight hidden sm:block">
            This browser can't keep the screen awake automatically — turn off auto-sleep in the device settings, or use Guided Access / kiosk mode.
          </span>
        )}
        {alwaysOn && wakeLockSupported && !wakeLockHeld && (
          <span className="text-[10px] text-white/25 mr-1 max-w-[10rem] text-right leading-tight hidden sm:block">
            Always-on is on, but the screen lock could not be held. Tap the page, then disable auto-sleep in system settings.
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
