import { addLondonDays, dayOfWeekFor, londonNow, londonTimeOn } from "./londonTime";

// The light plan attached to an alarm: when the light comes on, how bright it
// gets, and when it goes off again. Kept free of Firebase so it can be tested.

export interface AlarmLightCueLike {
  lightId: string;
  startBrightness?: number;
  leadMinutes?: number;
  peakBrightness?: number;
  rampMinutes?: number;
  offMode?: "after" | "at";
  offAfterMinutes?: number;
  offAt?: string;
}

export interface CueAlarmLike {
  time: string;
  days: number[];
  enabled: boolean;
  lightCues?: AlarmLightCueLike[];
  /**
   * When a one-off alarm last rang (ms). A one-off alarm switches itself off
   * the moment it rings, so without this its light would be cut off at the
   * exact minute it is meant to be on.
   */
  lastFiredAt?: number;
}

const FIRED_MEMORY_MS = 24 * 60 * 60_000;

function clockOnDate(dateStr: string, hhmm: string, notBeforeMs: number): number {
  let at = londonTimeOn(dateStr, hhmm);
  if (at <= notBeforeMs) at = londonTimeOn(addLondonDays(dateStr, 1), hhmm);
  return at;
}

function recentlyFired(alarm: CueAlarmLike, nowMs: number): boolean {
  const fired = Number(alarm.lastFiredAt || 0);
  return fired > 0 && fired <= nowMs && nowMs - fired < FIRED_MEMORY_MS;
}

/** True while an alarm's light plan can still matter: it is on, or it rang within the last day. */
export function alarmDrivesLights(alarm: CueAlarmLike, nowMs: number): boolean {
  return alarm.enabled || recentlyFired(alarm, nowMs);
}

/** The times this alarm rings (or rang) that could have a light window open right now. */
function candidateRings(alarm: CueAlarmLike, now: Date): { dateStr: string; alarmMs: number }[] {
  const rings: { dateStr: string; alarmMs: number }[] = [];
  const nowMs = now.getTime();
  const { dateStr: today } = londonNow(now);
  if (alarm.enabled) {
    for (const offset of [-1, 0, 1]) {
      const dateStr = addLondonDays(today, offset);
      // A one-off alarm that is still on has not rung yet, so yesterday is not one of its rings.
      if (offset < 0 && alarm.days.length === 0) continue;
      if (alarm.days.length > 0 && !alarm.days.includes(dayOfWeekFor(dateStr))) continue;
      rings.push({ dateStr, alarmMs: londonTimeOn(dateStr, alarm.time) });
    }
  }
  if (recentlyFired(alarm, nowMs)) {
    const fired = new Date(Number(alarm.lastFiredAt));
    const { dateStr } = londonNow(fired);
    rings.push({ dateStr, alarmMs: londonTimeOn(dateStr, alarm.time) });
  }
  return rings;
}

/**
 * Brightness this light should be at for one alarm cue, or null when the
 * cue is not in its on window. The light comes on `leadMinutes` before the
 * alarm at `startBrightness`, reaches `peakBrightness` after `rampMinutes`,
 * then stays there until it turns off after a delay or at a clock time.
 */
export function cueBrightness(alarm: CueAlarmLike, cue: AlarmLightCueLike, now: Date): number | null {
  const lead = Math.max(0, cue.leadMinutes || 0);
  const ramp = Math.max(1, cue.rampMinutes || 1);
  const startBri = Math.max(1, Math.min(255, cue.startBrightness || 1));
  const peakBri = Math.max(1, Math.min(255, cue.peakBrightness || 220));
  const nowMs = now.getTime();
  let brightest: number | null = null;
  for (const { dateStr, alarmMs } of candidateRings(alarm, now)) {
    const startMs = alarmMs - lead * 60_000;
    const peakMs = startMs + ramp * 60_000;
    const offMs = cue.offMode === "at" && cue.offAt
      ? clockOnDate(dateStr, cue.offAt, Math.max(startMs, alarmMs))
      : Math.max(peakMs, alarmMs) + Math.max(1, cue.offAfterMinutes || 10) * 60_000;
    if (nowMs < startMs || nowMs >= offMs) continue;
    const brightness = nowMs >= peakMs
      ? peakBri
      : Math.round(startBri + (peakBri - startBri) * ((nowMs - startMs) / (peakMs - startMs)));
    brightest = Math.max(brightest ?? 0, brightness);
  }
  return brightest;
}

/** The brightest any alarm wants this light right now. 0 means no alarm wants it on. */
export function alarmCueBrightness(alarms: CueAlarmLike[], lightId: string, now: Date): number {
  let brightest = 0;
  for (const alarm of alarms) {
    if (!alarm.lightCues?.length || !alarmDrivesLights(alarm, now.getTime())) continue;
    for (const cue of alarm.lightCues) {
      if (cue.lightId !== lightId) continue;
      const brightness = cueBrightness(alarm, cue, now);
      if (brightness) brightest = Math.max(brightest, brightness);
    }
  }
  return brightest;
}

/** Whether any alarm that still matters has a plan for this light. */
export function lightHasAlarmCue(alarms: CueAlarmLike[], lightId: string, nowMs: number): boolean {
  return alarms.some((alarm) => alarmDrivesLights(alarm, nowMs) && alarm.lightCues?.some((cue) => cue.lightId === lightId));
}
