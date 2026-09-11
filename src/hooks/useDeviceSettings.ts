import { useEffect, useState, useCallback } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { WidgetType } from "@/hooks/useDashboardLayout";
import {
  applyPageLayout,
  createDisplayWidget,
  DEFAULT_DISPLAY_PAGES,
  stripUndefined,
  type DisplayPage,
} from "@/lib/displayPages";
import { DEFAULT_NIGHT_MODE, type NightModeSettings } from "@/lib/displayNightMode";

export {
  BACKDROP_LABELS,
  DEFAULT_DISPLAY_PAGES,
  DISPLAY_THEMES,
  DURATION_CHOICES,
  PAGE_LAYOUTS,
  PAGE_PRESETS,
  WIDGET_DESCRIPTIONS,
  WIDGET_LABELS,
  WIDGET_ORDER,
  activeDisplayPages,
  applyPageLayout,
  createDisplayWidget,
  displayTheme,
  durationLabel,
  isPageActiveAt,
  layoutIsResizable,
  layoutSlots,
  pageScheduleLabel,
  stripUndefined,
} from "@/lib/displayPages";
export type { NightModeSettings, NightScreen } from "@/lib/displayNightMode";
export { DEFAULT_NIGHT_MODE } from "@/lib/displayNightMode";

export type {
  DisplayBackdropKind,
  DisplayPage,
  DisplayPageLayout,
  DisplayPagePreset,
  DisplayTheme,
  DisplayWidgetLayout,
  DisplayWidgetType,
} from "@/lib/displayPages";

export type ClockStyle = "digital" | "analog";
export type ClockSize = "medium" | "large" | "xlarge";

export interface ClockSettings {
  style: ClockStyle;
  format24h: boolean;
  showSeconds: boolean;
  showDate: boolean;
  accentColor: string;
  size: ClockSize;
}

export interface Alarm {
  id: string;
  time: string; // "HH:mm", 24h
  days: number[]; // 0=Sun..6=Sat; empty = one-off, fires once then disables itself
  label: string;
  enabled: boolean;
  sunriseMinutes?: number;
  /** Sunrise lights (devices/{id} with deviceType "light") to ramp alongside this alarm. */
  linkedLightIds?: string[];
}

export interface PhotoFrameSettings {
  enabled: boolean;
  intervalSeconds: number;
  shuffle: boolean;
  showCaptions: boolean;
  photoIds: string[];
}

export interface CalendarSceneSettings {
  enabled: boolean;
  daysAhead: number;
}

export interface OverviewSceneSettings {
  enabled: boolean;
  widgets: WidgetType[];
}

export interface SceneRotationSettings {
  rotateSeconds: number;
}

/** A light's own default look for the sunrise ramp — the starting point an alarm's per-alarm override is pre-filled from. */
export interface LightSunriseDefaults {
  rampMinutes: number;
  peakBrightness: number;
  colorFrom: string;
  colorTo: string;
  /** A separate warm-white tint, distinct from the colorFrom/colorTo gradient. */
  warmthColor: string;
}

/** Applied whenever this light is turned on manually without explicit brightness/colour (e.g. a plain on/off flip). */
export interface LightManualDefaults {
  brightness: number;
  colorHex: string;
  /** Minutes after a manual "on" before it auto-offs. 0 = never. */
  autoOffMinutes: number;
}

export interface LightScheduleSettings {
  enabled: boolean;
  onTime: string; // "HH:mm"
  offTime: string; // "HH:mm"
  /** 0=Sun..6=Sat; empty = every day. */
  days: number[];
}

/**
 * An ESP32 sunrise light, paired once and controlled from the cloud via
 * MQTT (see functions/src/sunriseLights.ts). No MQTT password ever lives
 * here — the broker is the sole authority on that credential; this is just
 * enough metadata to address and later revoke it.
 */
export interface LightSettings {
  mqttTopic: string;
  mqttUsername?: string;
  brokerCredentialId?: string;
  /** Whether this light can actually show colour — false for the project's own single-channel firmware (see firmware/sunrise-light). Colour controls grey out when false. */
  colorCapable: boolean;
  notes: string;
  manual: { on: boolean; brightness: number; colorHex: string };
  manualDefaults: LightManualDefaults;
  sunrise: LightSunriseDefaults;
  schedule: LightScheduleSettings;
  online: boolean;
  lastReportedAt?: unknown;
  /** Set by scheduleLightAutoOff / a manual-default auto-off; cleared once tickSunriseLights acts on it. */
  autoOffAt?: unknown;
  /** Internal — tickSunriseLights' own record of the schedule's last on/off decision, so it only publishes on a transition, not every tick. */
  scheduleState?: "on" | "off";
}

export interface DeviceSettings {
  clock: ClockSettings;
  alarms: Alarm[];
  photoFrame: PhotoFrameSettings;
  calendar: CalendarSceneSettings;
  overview: OverviewSceneSettings;
  scenes: SceneRotationSettings;
  pages: DisplayPage[];
  nightMode: NightModeSettings;
  light: LightSettings;
}

export const DEFAULT_CLOCK_SETTINGS: ClockSettings = {
  style: "digital",
  format24h: true,
  showSeconds: false,
  showDate: true,
  accentColor: "#7dd3fc",
  size: "large",
};

export const DEFAULT_PHOTO_FRAME_SETTINGS: PhotoFrameSettings = {
  enabled: false,
  intervalSeconds: 20,
  shuffle: true,
  showCaptions: true,
  photoIds: [],
};

export const DEFAULT_KIOSK_WIDGETS: WidgetType[] = ["today", "tasks", "households", "pets"];

export const DEFAULT_CALENDAR_SCENE_SETTINGS: CalendarSceneSettings = { enabled: false, daysAhead: 14 };
export const DEFAULT_OVERVIEW_SCENE_SETTINGS: OverviewSceneSettings = { enabled: false, widgets: DEFAULT_KIOSK_WIDGETS };
export const DEFAULT_SCENE_ROTATION_SETTINGS: SceneRotationSettings = { rotateSeconds: 30 };

export const DEFAULT_LIGHT_SETTINGS: LightSettings = {
  mqttTopic: "",
  colorCapable: false,
  notes: "",
  manual: { on: false, brightness: 180, colorHex: "#ffd27a" },
  manualDefaults: { brightness: 180, colorHex: "#ffd27a", autoOffMinutes: 0 },
  sunrise: { rampMinutes: 20, peakBrightness: 220, colorFrom: "#7c2d12", colorTo: "#fff7c2", warmthColor: "#ffb347" },
  schedule: { enabled: false, onTime: "18:00", offTime: "23:00", days: [] },
  online: false,
};

export interface DeviceDoc {
  id: string;
  uid: string;
  householdId: string | null;
  label: string;
  deviceType: "display" | "light";
  pairedVia: "direct" | "qr";
  revoked: boolean;
  lastSeenAt?: unknown;
  settings: DeviceSettings;
}

function legacyPages(raw: Partial<DeviceSettings> | undefined): DisplayPage[] {
  const pages: DisplayPage[] = [...DEFAULT_DISPLAY_PAGES];
  const rotate = raw?.scenes?.rotateSeconds || 300;
  if (raw?.photoFrame?.enabled) {
    pages.push({
      id: "photos",
      name: "Photos",
      durationSeconds: rotate,
      background: "#09090b",
      layout: "full",
      widgets: [{
        ...createDisplayWidget("photos"),
        id: "photos-main",
        photoIds: raw.photoFrame.photoIds || [],
        photoIntervalSeconds: raw.photoFrame.intervalSeconds || 20,
      }],
    });
  }
  if (raw?.calendar?.enabled) {
    pages.push({
      id: "calendar",
      name: "Calendar",
      durationSeconds: rotate,
      background: "#09090b",
      layout: "full",
      widgets: [{
        ...createDisplayWidget("calendar"),
        id: "calendar-main",
        calendarDaysAhead: raw.calendar.daysAhead || 14,
      }],
    });
  }
  if (raw?.overview?.enabled) {
    pages.push({
      id: "tasks",
      name: "Tasks",
      durationSeconds: rotate,
      background: "#09090b",
      layout: "full",
      widgets: [{ ...createDisplayWidget("tasks"), id: "tasks-main", taskLimit: 10 }],
    });
  }
  return pages;
}

function mergeSettings(raw: Partial<DeviceSettings> | undefined): DeviceSettings {
  return {
    clock: { ...DEFAULT_CLOCK_SETTINGS, ...(raw?.clock ?? {}) },
    alarms: Array.isArray(raw?.alarms) ? raw.alarms : [],
    photoFrame: { ...DEFAULT_PHOTO_FRAME_SETTINGS, ...(raw?.photoFrame ?? {}) },
    calendar: { ...DEFAULT_CALENDAR_SCENE_SETTINGS, ...(raw?.calendar ?? {}) },
    overview: { ...DEFAULT_OVERVIEW_SCENE_SETTINGS, ...(raw?.overview ?? {}) },
    scenes: { ...DEFAULT_SCENE_ROTATION_SETTINGS, ...(raw?.scenes ?? {}) },
    pages: (Array.isArray(raw?.pages) && raw.pages.length > 0 ? raw.pages : legacyPages(raw)).map(applyPageLayout),
    nightMode: { ...DEFAULT_NIGHT_MODE, ...(raw?.nightMode ?? {}) },
    light: {
      ...DEFAULT_LIGHT_SETTINGS,
      ...(raw?.light ?? {}),
      manual: { ...DEFAULT_LIGHT_SETTINGS.manual, ...(raw?.light?.manual ?? {}) },
      manualDefaults: { ...DEFAULT_LIGHT_SETTINGS.manualDefaults, ...(raw?.light?.manualDefaults ?? {}) },
      sunrise: { ...DEFAULT_LIGHT_SETTINGS.sunrise, ...(raw?.light?.sunrise ?? {}) },
      schedule: { ...DEFAULT_LIGHT_SETTINGS.schedule, ...(raw?.light?.schedule ?? {}) },
    },
  };
}

/** Live devices/{deviceId} doc — read/edit from the device itself or from the website's Settings page. */
export function useDeviceSettings(deviceId: string | null) {
  const [device, setDevice] = useState<DeviceDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!deviceId) {
      setDevice(null);
      setLoading(false);
      return;
    }
    const ref = doc(db, "devices", deviceId);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setDevice(null);
        setLoading(false);
        return;
      }
      const data = snap.data() as {
        uid: string;
        householdId?: string | null;
        label?: string;
        deviceType?: string;
        pairedVia?: string;
        revoked?: boolean;
        lastSeenAt?: unknown;
        settings?: Partial<DeviceSettings>;
      };
      setDevice({
        id: snap.id,
        uid: data.uid,
        householdId: data.householdId ?? null,
        label: data.label || (data.deviceType === "light" ? "Sunrise light" : "Display"),
        deviceType: data.deviceType === "light" ? "light" : "display",
        pairedVia: data.pairedVia === "qr" ? "qr" : "direct",
        revoked: data.revoked === true,
        lastSeenAt: data.lastSeenAt,
        settings: mergeSettings(data.settings),
      });
      setLoading(false);
    }, () => {
      // e.g. permission-denied while a sign-in is still propagating — fail
      // open to "no device yet" rather than hanging on a loading state forever.
      setDevice(null);
      setLoading(false);
    });
    return unsub;
  }, [deviceId]);

  const updateClockSettings = useCallback(
    async (patch: Partial<ClockSettings>) => {
      if (!deviceId || !device) return;
      await updateDoc(doc(db, "devices", deviceId), {
        "settings.clock": { ...device.settings.clock, ...patch },
      });
    },
    [deviceId, device]
  );

  const updatePhotoFrameSettings = useCallback(
    async (patch: Partial<PhotoFrameSettings>) => {
      if (!deviceId || !device) return;
      await updateDoc(doc(db, "devices", deviceId), {
        "settings.photoFrame": { ...device.settings.photoFrame, ...patch },
      });
    },
    [deviceId, device]
  );

  const saveAlarms = useCallback(
    async (alarms: Alarm[]) => {
      if (!deviceId) return;
      await updateDoc(doc(db, "devices", deviceId), { "settings.alarms": alarms });
    },
    [deviceId]
  );

  const addAlarm = useCallback(
    async (alarm: Omit<Alarm, "id">) => {
      if (!deviceId || !device) return;
      const next: Alarm = { ...alarm, id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}` };
      await saveAlarms([...device.settings.alarms, next]);
    },
    [deviceId, device, saveAlarms]
  );

  const updateAlarm = useCallback(
    async (id: string, patch: Partial<Alarm>) => {
      if (!device) return;
      await saveAlarms(device.settings.alarms.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    },
    [device, saveAlarms]
  );

  const deleteAlarm = useCallback(
    async (id: string) => {
      if (!device) return;
      await saveAlarms(device.settings.alarms.filter((a) => a.id !== id));
    },
    [device, saveAlarms]
  );

  const renameDevice = useCallback(
    async (label: string) => {
      if (!deviceId || !label.trim()) return;
      await updateDoc(doc(db, "devices", deviceId), { label: label.trim() });
    },
    [deviceId]
  );

  const updateCalendarSettings = useCallback(
    async (patch: Partial<CalendarSceneSettings>) => {
      if (!deviceId || !device) return;
      await updateDoc(doc(db, "devices", deviceId), {
        "settings.calendar": { ...device.settings.calendar, ...patch },
      });
    },
    [deviceId, device]
  );

  const updateOverviewSettings = useCallback(
    async (patch: Partial<OverviewSceneSettings>) => {
      if (!deviceId || !device) return;
      await updateDoc(doc(db, "devices", deviceId), {
        "settings.overview": { ...device.settings.overview, ...patch },
      });
    },
    [deviceId, device]
  );

  const updateSceneSettings = useCallback(
    async (patch: Partial<SceneRotationSettings>) => {
      if (!deviceId || !device) return;
      await updateDoc(doc(db, "devices", deviceId), {
        "settings.scenes": { ...device.settings.scenes, ...patch },
      });
    },
    [deviceId, device]
  );

  const updateNightMode = useCallback(
    async (patch: Partial<NightModeSettings>) => {
      if (!deviceId || !device) return;
      await updateDoc(doc(db, "devices", deviceId), {
        "settings.nightMode": { ...device.settings.nightMode, ...patch },
      });
    },
    [deviceId, device]
  );

  const updateLightSunrise = useCallback(
    async (patch: Partial<LightSettings["sunrise"]>) => {
      if (!deviceId || !device) return;
      await updateDoc(doc(db, "devices", deviceId), {
        "settings.light.sunrise": { ...device.settings.light.sunrise, ...patch },
      });
    },
    [deviceId, device]
  );

  const updateLightMeta = useCallback(
    async (patch: { colorCapable?: boolean; notes?: string }) => {
      if (!deviceId) return;
      const update: Record<string, unknown> = {};
      if (patch.colorCapable !== undefined) update["settings.light.colorCapable"] = patch.colorCapable;
      if (patch.notes !== undefined) update["settings.light.notes"] = patch.notes;
      await updateDoc(doc(db, "devices", deviceId), update);
    },
    [deviceId]
  );

  const updateLightManualDefaults = useCallback(
    async (patch: Partial<LightManualDefaults>) => {
      if (!deviceId || !device) return;
      await updateDoc(doc(db, "devices", deviceId), {
        "settings.light.manualDefaults": { ...device.settings.light.manualDefaults, ...patch },
      });
    },
    [deviceId, device]
  );

  const updateLightSchedule = useCallback(
    async (patch: Partial<LightScheduleSettings>) => {
      if (!deviceId || !device) return;
      await updateDoc(doc(db, "devices", deviceId), {
        "settings.light.schedule": { ...device.settings.light.schedule, ...patch },
      });
    },
    [deviceId, device]
  );

  const updatePages = useCallback(
    async (pages: DisplayPage[]) => {
      if (!deviceId) return;
      // Clearing an optional setting leaves undefined behind, which Firestore
      // rejects for the whole document, so drop those keys instead.
      await updateDoc(doc(db, "devices", deviceId), { "settings.pages": stripUndefined(pages) });
    },
    [deviceId]
  );

  return {
    device,
    loading,
    updateClockSettings,
    updatePhotoFrameSettings,
    addAlarm,
    updateAlarm,
    deleteAlarm,
    renameDevice,
    updateCalendarSettings,
    updateOverviewSettings,
    updateSceneSettings,
    updateNightMode,
    updateLightSunrise,
    updateLightMeta,
    updateLightManualDefaults,
    updateLightSchedule,
    updatePages,
  };
}
