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
