import { useEffect, useState } from "react";
import { Maximize, WifiOff } from "lucide-react";
import DogLoader from "@/components/DogLoader";
import { useDeviceAuth } from "@/hooks/useDeviceAuth";
import { useDeviceSettings } from "@/hooks/useDeviceSettings";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useAutoUnlockAudio } from "@/hooks/useAutoUnlockAudio";
import { DisplayLoginScreen } from "@/components/display/DisplayLoginScreen";
import { AlarmManager } from "@/components/display/AlarmManager";
import { AudioUnlockOverlay } from "@/components/display/AudioUnlockOverlay";
import { RemoteDisplayRuntime } from "@/components/display/RemoteDisplayRuntime";

export default function Display() {
  const { status, deviceId, pairing, restartPairing } = useDeviceAuth();
  const {
    device,
    loading: settingsLoading,
    updateAlarm,
  } = useDeviceSettings(deviceId);
  const { supported: wakeLockSupported } = useWakeLock(status === "ready");
  const { unlocked: audioUnlocked, tryUnlock: tryUnlockAudio } = useAutoUnlockAudio(status === "ready");
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
      <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950">
        <DogLoader text="Starting display…" />
      </div>
    );
  }

  if (status === "revoked") {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-zinc-950 gap-4 px-6 text-center">
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
      <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950">
        <DogLoader text="Loading your display…" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-zinc-950 relative overflow-hidden select-none">
      <RemoteDisplayRuntime device={device} />

      <AlarmManager alarms={device.settings.alarms} onUpdateAlarm={updateAlarm} />
      <AudioUnlockOverlay
        hasEnabledAlarms={device.settings.alarms.some((a) => a.enabled)}
        unlocked={audioUnlocked}
        onTryUnlock={tryUnlockAudio}
      />

      {/* Low-opacity control cluster — deliberately unobtrusive on an always-on screen */}
      <div className="absolute bottom-4 right-4 flex items-center gap-2">
        {!wakeLockSupported && (
          <span className="text-[10px] text-white/25 mr-1 max-w-[10rem] text-right leading-tight hidden sm:block">
            This browser can't keep the screen awake automatically — disable auto-sleep in the device's system settings.
          </span>
        )}
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
