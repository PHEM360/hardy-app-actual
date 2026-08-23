import { describe, expect, it } from "vitest";
import { getSunriseProgress } from "@/lib/sunriseAlarm";
import type { Alarm } from "@/hooks/useDeviceSettings";

const alarm: Alarm = {
  id: "morning",
  time: "07:00",
  days: [],
  label: "Wake up",
  enabled: true,
  sunriseMinutes: 30,
};

describe("sunrise alarm ramp", () => {
  it("brightens progressively during the configured lead time", () => {
    expect(getSunriseProgress([alarm], new Date("2026-08-23T06:29:59"))).toBe(0);
    expect(getSunriseProgress([alarm], new Date("2026-08-23T06:45:00"))).toBeCloseTo(0.5);
    expect(getSunriseProgress([alarm], new Date("2026-08-23T06:59:00"))).toBeGreaterThan(0.95);
    expect(getSunriseProgress([alarm], new Date("2026-08-23T07:00:00"))).toBe(0);
  });

  it("does not ramp for disabled or non-matching repeating alarms", () => {
    expect(getSunriseProgress([{ ...alarm, enabled: false }], new Date("2026-08-23T06:45:00"))).toBe(0);
    expect(getSunriseProgress([{ ...alarm, days: [1] }], new Date("2026-08-23T06:45:00"))).toBe(0);
  });
});
