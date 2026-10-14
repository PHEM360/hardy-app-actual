import { describe, expect, it } from "vitest";
import { alarmCueBrightness, cueBrightness, lightHasAlarmCue, type CueAlarmLike } from "../../functions/src/alarmLightCues";

// 15 July 2026 is a Wednesday. London is on summer time, so 07:00 there is 06:00 UTC.
const at = (hhmm: string, day = "2026-07-15") => new Date(`${day}T${hhmm}:00+01:00`);
const cue = { lightId: "lamp", startBrightness: 20, leadMinutes: 20, peakBrightness: 200, rampMinutes: 20, offMode: "after" as const, offAfterMinutes: 10 };

describe("alarm light cues", () => {
  const daily: CueAlarmLike = { time: "07:00", days: [1, 2, 3, 4, 5], enabled: true, lightCues: [cue] };

  it("is off before the lead in and ramps up to the alarm", () => {
    expect(cueBrightness(daily, cue, at("06:39"))).toBeNull();
    expect(cueBrightness(daily, cue, at("06:40"))).toBe(20);
    expect(cueBrightness(daily, cue, at("06:50"))).toBe(110);
    expect(cueBrightness(daily, cue, at("07:00"))).toBe(200);
  });

  it("stays on after the alarm, then goes off", () => {
    expect(cueBrightness(daily, cue, at("07:09"))).toBe(200);
    expect(cueBrightness(daily, cue, at("07:10"))).toBeNull();
  });

  it("is on when the alarm rings even if the ramp finished early", () => {
    const early = { ...cue, rampMinutes: 5, offAfterMinutes: 5 };
    expect(cueBrightness(daily, early, at("07:00"))).toBe(200);
    expect(cueBrightness(daily, early, at("07:05"))).toBeNull();
  });

  it("comes on at the alarm time when there is no lead in", () => {
    const instant = { ...cue, leadMinutes: 0, rampMinutes: 1 };
    expect(cueBrightness(daily, instant, at("06:59"))).toBeNull();
    expect(cueBrightness(daily, instant, at("07:00"))).toBe(20);
    expect(cueBrightness(daily, instant, at("07:01"))).toBe(200);
  });

  it("skips days the alarm does not ring", () => {
    expect(cueBrightness(daily, cue, at("07:00", "2026-07-18"))).toBeNull();
  });

  it("keeps a one-off alarm's light on after the alarm has switched itself off", () => {
    const fired: CueAlarmLike = { time: "07:00", days: [], enabled: false, lightCues: [cue], lastFiredAt: at("07:00").getTime() };
    expect(alarmCueBrightness([fired], "lamp", at("07:00"))).toBe(200);
    expect(alarmCueBrightness([fired], "lamp", at("07:05"))).toBe(200);
    expect(alarmCueBrightness([fired], "lamp", at("07:10"))).toBe(0);
    expect(lightHasAlarmCue([fired], "lamp", at("07:05").getTime())).toBe(true);
  });

  it("ignores an alarm that is off and never rang", () => {
    const off: CueAlarmLike = { time: "07:00", days: [], enabled: false, lightCues: [cue] };
    expect(alarmCueBrightness([off], "lamp", at("07:00"))).toBe(0);
    expect(lightHasAlarmCue([off], "lamp", at("07:00").getTime())).toBe(false);
  });

  it("does not light up for a one-off alarm set for tomorrow morning", () => {
    const tomorrow: CueAlarmLike = { time: "07:00", days: [], enabled: true, lightCues: [cue] };
    expect(alarmCueBrightness([tomorrow], "lamp", at("21:00"))).toBe(0);
  });

  it("holds until a set off time", () => {
    const until = { ...cue, offMode: "at" as const, offAt: "07:30" };
    expect(cueBrightness(daily, until, at("07:29"))).toBe(200);
    expect(cueBrightness(daily, until, at("07:30"))).toBeNull();
  });

  it("only drives the light named in the cue", () => {
    expect(alarmCueBrightness([daily], "other", at("07:00"))).toBe(0);
  });
});
