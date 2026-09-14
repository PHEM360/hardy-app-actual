import type { LightSettings } from "@/hooks/useDeviceSettings";

export function timestampMs(value: unknown): number {
  if (value && typeof (value as { toMillis?: () => number }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  return 0;
}

export function lastSeenLabel(value: unknown): string {
  const ms = timestampMs(value);
  if (!ms) return "Not seen yet";
  const minutes = Math.max(0, Math.round((Date.now() - ms) / 60_000));
  if (minutes < 2) return "Online now";
  if (minutes < 60) return `Seen ${minutes} minutes ago`;
  if (minutes < 1440) return `Seen ${Math.round(minutes / 60)} hours ago`;
  return `Seen ${Math.round(minutes / 1440)} days ago`;
}

/** Heartbeat from /display is every 5 minutes; treat 10 minutes as still online. */
export const DISPLAY_ONLINE_MS = 10 * 60_000;

export interface DisplayStatus {
  online: boolean;
  label: string;
  detail: string;
  tone: "ok" | "warn" | "error";
}

export function isDisplayOnline(lastSeenAt: unknown): boolean {
  return timestampMs(lastSeenAt) > Date.now() - DISPLAY_ONLINE_MS;
}

export function describeDisplayStatus(lastSeenAt: unknown): DisplayStatus {
  const ms = timestampMs(lastSeenAt);
  if (!ms) {
    return {
      online: false,
      label: "Waiting to connect",
      detail: "Open the display website on the screen and keep the tab open. It appears online as soon as it has linked.",
      tone: "warn",
    };
  }
  if (Date.now() - ms < DISPLAY_ONLINE_MS) {
    return {
      online: true,
      label: "Online now",
      detail: "This screen is receiving your pages live.",
      tone: "ok",
    };
  }
  return {
    online: false,
    label: lastSeenLabel(lastSeenAt),
    detail: "The browser tab may be closed, asleep, or offline. Open the display website on it again — it reconnects on its own.",
    tone: "error",
  };
}

export interface LightStatus {
  online: boolean;
  label: string;
  tone: "ok" | "warn" | "error";
}

/**
 * settings.light.online/lastReportedAt are written once a minute by
 * tickSunriseLights (functions/src/sunriseLights.ts), from the light's own
 * retained MQTT status message — not derived from anything else. A light
 * that has never once reported (lastReportedAt unset) is distinguished from
 * one that reported before and has since gone offline, since those call for
 * different messaging ("finish pairing" vs "check it's powered on").
 */
export function describeLightStatus(light: Pick<LightSettings, "online" | "lastReportedAt">): LightStatus {
  if (light.online) return { online: true, label: "Online", tone: "ok" };
  if (timestampMs(light.lastReportedAt) > 0) {
    return { online: false, label: `Offline · ${lastSeenLabel(light.lastReportedAt)}`, tone: "error" };
  }
  return { online: false, label: "Not connected yet", tone: "warn" };
}
