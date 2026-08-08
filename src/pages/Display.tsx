import { useEffect, useState } from "react";
import { Settings as SettingsIcon, Maximize, WifiOff } from "lucide-react";
import DogLoader from "@/components/DogLoader";
import { useDeviceAuth } from "@/hooks/useDeviceAuth";
import { useDeviceSettings } from "@/hooks/useDeviceSettings";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useHouseholdPhotos } from "@/hooks/useHouseholdPhotos";
import { useHouseholdCalendar } from "@/hooks/useHouseholdCalendar";
import { useAutoUnlockAudio } from "@/hooks/useAutoUnlockAudio";
import { SceneRotator } from "@/components/display/SceneRotator";
import { DisplaySettingsSheet } from "@/components/display/DisplaySettingsSheet";
import { DisplayLoginScreen } from "@/components/display/DisplayLoginScreen";
import { AlarmManager } from "@/components/display/AlarmManager";
import { AudioUnlockOverlay } from "@/components/display/AudioUnlockOverlay";

export default function Display() {
  const { status, deviceId, signInError, signInDirect, forgetThisDevice, pairing, restartPairing } = useDeviceAuth();
  const {
    device,
    loading: settingsLoading,
    updateClockSettings,
    updatePhotoFrameSettings,
    addAlarm,
    updateAlarm,
    deleteAlarm,
    renameDevice,
    updateCalendarSettings,
    updateOverviewSettings,
    updateSceneSettings,
  } = useDeviceSettings(deviceId);
  const { photos, loading: photosLoading, addPhotos, deletePhoto } = useHouseholdPhotos(device?.householdId ?? null);
  const {
    events: calendarEvents,
    loading: calendarLoading,
    error: calendarError,
  } = useHouseholdCalendar(device?.settings.calendar.enabled ? device.householdId : null);
  const { supported: wakeLockSupported } = useWakeLock(status === "ready");
  const { unlocked: audioUnlocked, tryUnlock: tryUnlockAudio } = useAutoUnlockAudio(status === "ready");
  const [settingsOpen, setSettingsOpen] = useState(false);
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
          It was removed from Linked Displays in Settings. Sign in again below to reconnect it.
        </p>
      </div>
    );
  }

  if (status === "signed_out") {
    return (
      <DisplayLoginScreen
        error={signInError}
        onSignIn={signInDirect}
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
      <SceneRotator
        device={device}
        photos={photos}
        calendarEvents={calendarEvents}
        calendarLoading={calendarLoading}
        calendarError={calendarError}
      />

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
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
          aria-label="Display settings"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </div>

      <DisplaySettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        deviceLabel={device.label}
        onRename={renameDevice}
        onForgetDevice={forgetThisDevice}
        clockSettings={device.settings.clock}
        onChangeClock={updateClockSettings}
        alarms={device.settings.alarms}
        onAddAlarm={addAlarm}
        onUpdateAlarm={updateAlarm}
        onDeleteAlarm={deleteAlarm}
        photoFrameSettings={device.settings.photoFrame}
        onChangePhotoFrame={updatePhotoFrameSettings}
        photos={photos}
        photosLoading={photosLoading}
        onAddPhotos={addPhotos}
        onDeletePhoto={deletePhoto}
        hasHousehold={!!device.householdId}
        calendarSettings={device.settings.calendar}
        onChangeCalendar={updateCalendarSettings}
        overviewSettings={device.settings.overview}
        onChangeOverview={updateOverviewSettings}
        sceneSettings={device.settings.scenes}
        onChangeScenes={updateSceneSettings}
      />
    </div>
  );
}
