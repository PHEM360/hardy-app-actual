import { beforeEach, describe, expect, it } from "vitest";
import {
  clearPinThrottle,
  pinThrottleRemaining,
  readPinThrottle,
  recordFailedPin,
} from "@/lib/passwordVaultThrottle";

describe("password vault PIN throttling", () => {
  beforeEach(() => window.localStorage.clear());

  it("backs off persistently after repeated incorrect passcodes", () => {
    const uid = "user-1";
    recordFailedPin(uid, 1_000);
    recordFailedPin(uid, 1_000);
    recordFailedPin(uid, 1_000);
    const fourth = recordFailedPin(uid, 1_000);

    expect(fourth).toEqual({ failures: 4, blockedUntil: 6_000 });
    expect(pinThrottleRemaining(uid, 2_000)).toBe(4_000);
    expect(readPinThrottle(uid).failures).toBe(4);
  });

  it("clears the backoff after a successful unlock", () => {
    recordFailedPin("user-1", 1_000);
    clearPinThrottle("user-1");
    expect(readPinThrottle("user-1")).toEqual({ failures: 0, blockedUntil: 0 });
  });
});
