import { describe, expect, it } from "vitest";
import {
  DEFAULT_NIGHT_MODE,
  nextMorningAlarmAt,
  resolveNightMode,
} from "@/lib/displayNightMode";

describe("display night mode", () => {
  const night = { ...DEFAULT_NIGHT_MODE, withAlarms: true };

  it("follows the nightly window, including overnight", () => {
    expect(resolveNightMode(night, [], new Date("2026-08-25T21:30:00")).active).toBe(true);
    expect(resolveNightMode(night, [], new Date("2026-08-26T02:00:00")).active).toBe(true);
    expect(resolveNightMode(night, [], new Date("2026-08-25T10:00:00")).active).toBe(false);
  });

  it("lets a one-tap override win until it expires", () => {
    const on = { ...night, override: "on" as const, overrideUntil: "2026-08-26T07:00:00.000Z" };
    expect(resolveNightMode(on, [], new Date("2026-08-25T16:00:00+01:00")).reason).toBe("override");
    const off = { ...night, override: "off" as const, overrideUntil: "2026-08-26T07:00:00.000Z" };
    expect(resolveNightMode(off, [], new Date("2026-08-25T22:00:00+01:00")).active).toBe(false);
  });

  it("turns on in the evening when a morning alarm is set", () => {
    const alarms = [{ time: "07:00", days: [0, 1, 2, 3, 4, 5, 6], enabled: true }];
    const evening = new Date("2026-08-25T20:15:00");
    expect(nextMorningAlarmAt(alarms, evening)?.getHours()).toBe(7);
    expect(resolveNightMode({ ...night, scheduleEnabled: false }, alarms, evening)).toEqual({
      active: true,
      reason: "alarm",
    });
    expect(resolveNightMode({ ...night, scheduleEnabled: false }, alarms, new Date("2026-08-25T15:00:00")).active)
      .toBe(false);
  });

  it("ignores afternoon alarms for bedtime", () => {
    const alarms = [{ time: "15:00", days: [], enabled: true }];
    expect(resolveNightMode({ ...night, scheduleEnabled: false }, alarms, new Date("2026-08-25T20:00:00")).active)
      .toBe(false);
  });
});
