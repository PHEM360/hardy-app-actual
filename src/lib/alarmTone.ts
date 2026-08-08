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

/** Loops a simple two-tone beep until stopAlarmTone() is called. */
export function playAlarmTone() {
  stopAlarmTone();
  const c = getContext();
  let cancelled = false;

  function beep(freq: number, startAt: number, duration: number) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(0.35, startAt + 0.02);
    gain.gain.linearRampToValueAtTime(0, startAt + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(startAt);
    osc.stop(startAt + duration);
  }

  function scheduleCycle() {
    if (cancelled) return;
    const now = c.currentTime + 0.05;
    beep(880, now, 0.25);
    beep(880, now + 0.35, 0.25);
    setTimeout(scheduleCycle, 1200);
  }

  scheduleCycle();
  stopFn = () => {
    cancelled = true;
  };
}

export function stopAlarmTone() {
  stopFn?.();
  stopFn = null;
}
