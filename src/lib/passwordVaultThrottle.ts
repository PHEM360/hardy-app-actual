interface PinThrottleState {
  failures: number;
  blockedUntil: number;
}

const PREFIX = "hardy-hub-password-vault-pin:";
const MAX_DELAY_MS = 15 * 60 * 1000;

function key(userId: string) {
  return `${PREFIX}${userId}`;
}

export function readPinThrottle(userId: string): PinThrottleState {
  if (typeof window === "undefined") return { failures: 0, blockedUntil: 0 };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key(userId)) || "{}") as Partial<PinThrottleState>;
    return {
      failures: Number.isFinite(parsed.failures) ? Math.max(0, Number(parsed.failures)) : 0,
      blockedUntil: Number.isFinite(parsed.blockedUntil) ? Math.max(0, Number(parsed.blockedUntil)) : 0,
    };
  } catch {
    return { failures: 0, blockedUntil: 0 };
  }
}

export function recordFailedPin(userId: string, now = Date.now()) {
  const current = readPinThrottle(userId);
  const failures = current.failures + 1;
  const delay = failures < 4
    ? 0
    : Math.min(MAX_DELAY_MS, 5_000 * (2 ** (failures - 4)));
  const next = { failures, blockedUntil: now + delay };
  window.localStorage.setItem(key(userId), JSON.stringify(next));
  return next;
}

export function clearPinThrottle(userId: string) {
  if (typeof window !== "undefined") window.localStorage.removeItem(key(userId));
}

export function pinThrottleRemaining(userId: string, now = Date.now()) {
  return Math.max(0, readPinThrottle(userId).blockedUntil - now);
}
