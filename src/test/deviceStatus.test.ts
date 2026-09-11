import { describe, expect, it } from "vitest";
import { describeLightStatus, lastSeenLabel, timestampMs } from "@/lib/deviceStatus";

function fakeTimestamp(msAgo: number) {
  const ms = Date.now() - msAgo;
  return { toMillis: () => ms };
}

describe("timestampMs", () => {
  it("reads a Firestore-Timestamp-shaped value", () => {
    expect(timestampMs(fakeTimestamp(60_000))).toBeGreaterThan(0);
  });

  it("returns 0 for anything else", () => {
    expect(timestampMs(undefined)).toBe(0);
    expect(timestampMs(null)).toBe(0);
    expect(timestampMs("not a timestamp")).toBe(0);
  });
});

describe("lastSeenLabel", () => {
  it("describes recent activity as online now", () => {
    expect(lastSeenLabel(fakeTimestamp(30_000))).toBe("Online now");
  });

  it("describes minutes/hours/days ago at the right granularity", () => {
    expect(lastSeenLabel(fakeTimestamp(10 * 60_000))).toBe("Seen 10 minutes ago");
    expect(lastSeenLabel(fakeTimestamp(3 * 60 * 60_000))).toBe("Seen 3 hours ago");
    expect(lastSeenLabel(fakeTimestamp(2 * 24 * 60 * 60_000))).toBe("Seen 2 days ago");
  });

  it("falls back to 'Not seen yet' when there's no timestamp", () => {
    expect(lastSeenLabel(undefined)).toBe("Not seen yet");
  });
});

describe("describeLightStatus", () => {
  it("reports online when the light says so, regardless of lastReportedAt", () => {
    const status = describeLightStatus({ online: true, lastReportedAt: undefined });
    expect(status).toEqual({ online: true, label: "Online", tone: "ok" });
  });

  it("distinguishes 'never connected' from 'went offline'", () => {
    const neverConnected = describeLightStatus({ online: false, lastReportedAt: undefined });
    expect(neverConnected).toEqual({ online: false, label: "Not connected yet", tone: "warn" });

    const wentOffline = describeLightStatus({ online: false, lastReportedAt: fakeTimestamp(5 * 60_000) });
    expect(wentOffline.online).toBe(false);
    expect(wentOffline.tone).toBe("error");
    expect(wentOffline.label).toBe("Offline · Seen 5 minutes ago");
  });
});
