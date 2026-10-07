let ctx: AudioContext | null = null;
let stopFn: (() => void) | null = null;

function getContext(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  return ctx;
}

/** Resumes the shared AudioContext — must be called from within a real user gesture handler. */
export async function unlockAudio(): Promise<boolean> {
  try {
    const c = getContext();
    if (c.state === "suspended") await c.resume();
    return c.state === "running";
  } catch {
    return false;
  }
}

export function isAudioUnlocked(): boolean {
  return ctx?.state === "running";
}

export type AlarmToneId = "classic" | "chime" | "bell" | "pulse" | "soft";

export const ALARM_TONES: { id: AlarmToneId; label: string; hint: string }[] = [
  { id: "classic", label: "Classic", hint: "Two clear beeps" },
  { id: "chime", label: "Chime", hint: "A rising three note chime" },
  { id: "bell", label: "Bell", hint: "A single struck bell" },
  { id: "pulse", label: "Pulse", hint: "A steady low pulse" },
  { id: "soft", label: "Soft", hint: "A quiet morning tone" },
];

export function isAlarmToneId(value: unknown): value is AlarmToneId {
  return ALARM_TONES.some((tone) => tone.id === value);
}

function toneNotes(id: AlarmToneId): { freq: number; at: number; dur: number; type?: OscillatorType; gain?: number }[] {
  if (id === "chime") {
    return [
      { freq: 523, at: 0, dur: 0.28, gain: 0.28 },
      { freq: 659, at: 0.22, dur: 0.28, gain: 0.28 },
      { freq: 784, at: 0.44, dur: 0.42, gain: 0.3 },
    ];
  }
  if (id === "bell") return [{ freq: 784, at: 0, dur: 0.9, type: "triangle", gain: 0.32 }];
  if (id === "pulse") {
    return [
      { freq: 440, at: 0, dur: 0.16, type: "square", gain: 0.12 },
      { freq: 440, at: 0.32, dur: 0.16, type: "square", gain: 0.12 },
      { freq: 440, at: 0.64, dur: 0.16, type: "square", gain: 0.12 },
    ];
  }
  if (id === "soft") {
    return [
      { freq: 392, at: 0, dur: 0.55, gain: 0.16 },
      { freq: 494, at: 0.5, dur: 0.7, gain: 0.14 },
    ];
  }
  return [
    { freq: 880, at: 0, dur: 0.25 },
    { freq: 880, at: 0.35, dur: 0.25 },
  ];
}

function toneGap(id: AlarmToneId) {
  if (id === "bell") return 1600;
  if (id === "soft") return 1800;
  if (id === "chime") return 1500;
  if (id === "pulse") return 1100;
  return 1200;
}

/** Loops the chosen tone until stopAlarmTone() is called. */
export function playAlarmTone(tone: AlarmToneId = "classic") {
  stopAlarmTone();
  const c = getContext();
  const id = isAlarmToneId(tone) ? tone : "classic";
  let cancelled = false;

  function beep(freq: number, startAt: number, duration: number, type: OscillatorType = "sine", level = 0.35) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(level, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.02);
  }

  function scheduleCycle() {
    if (cancelled) return;
    const now = c.currentTime + 0.05;
    for (const note of toneNotes(id)) {
      beep(note.freq, now + note.at, note.dur, note.type, note.gain);
    }
    setTimeout(scheduleCycle, toneGap(id));
  }

  scheduleCycle();
  stopFn = () => {
    cancelled = true;
  };
}

/** Plays one pass of a tone so a person can hear it before saving. */
export async function previewAlarmTone(tone: AlarmToneId) {
  const unlocked = await unlockAudio();
  if (!unlocked) return;
  playAlarmTone(tone);
  window.setTimeout(() => stopAlarmTone(), tone === "soft" || tone === "bell" ? 1400 : 900);
}

export function stopAlarmTone() {
  stopFn?.();
  stopFn = null;
}
