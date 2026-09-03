import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  appSessionRequiresAuthentication,
  hasFreshSecurityAuthentication,
  markOpenSessionSatisfied,
  markSecurityAuthentication,
} from "@/lib/securitySession";
import {
  DEFAULT_SECURITY_SETTINGS,
  moduleForPath,
  normalizeSecuritySettings,
} from "@/types/security";

describe("app security sessions", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.useRealTimers();
  });

  it("defaults to requiring a passkey every seven days and protects finance/password modules", () => {
    expect(DEFAULT_SECURITY_SETTINGS.appUnlockIntervalDays).toBe(7);
    expect(DEFAULT_SECURITY_SETTINGS.appUnlockMethod).toBe("passkey");
    expect(DEFAULT_SECURITY_SETTINGS.moduleRequirements.personal_finance).toBe("passkey");
    expect(DEFAULT_SECURITY_SETTINGS.moduleRequirements.passwords).toBe("none");
    expect(normalizeSecuritySettings({
      version: 2,
      moduleRequirements: { passwords: "passkey" },
    }).moduleRequirements.passwords).toBe("none");
    expect(normalizeSecuritySettings({ version: 1, appUnlockIntervalDays: 30 }).appUnlockIntervalDays).toBe(7);
    expect(moduleForPath("/finance/accounts")).toBe("personal_finance");
    expect(moduleForPath("/login-details")).toBe("passwords");
    expect(moduleForPath("/remote-displays")).toBe("remote_displays");
  });

  it("keeps the default session open after a recent passkey", () => {
    expect(appSessionRequiresAuthentication("user-1", DEFAULT_SECURITY_SETTINGS)).toBe(true);
    markSecurityAuthentication("user-1", "passkey");
    expect(appSessionRequiresAuthentication("user-1", DEFAULT_SECURITY_SETTINGS)).toBe(false);
  });

  it("reuses a passkey for seven days but not beyond the configured period", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T10:00:00Z"));
    markSecurityAuthentication("user-1", "passkey");
    vi.advanceTimersByTime(6 * 24 * 60 * 60 * 1000);
    expect(hasFreshSecurityAuthentication("user-1", "passkey", 7)).toBe(true);
    vi.advanceTimersByTime(2 * 24 * 60 * 60 * 1000);
    expect(hasFreshSecurityAuthentication("user-1", "passkey", 7)).toBe(false);
  });

  it("requires one verification per browser session in every-open mode", () => {
    const settings = normalizeSecuritySettings({ appUnlockMode: "every_open" });
    expect(appSessionRequiresAuthentication("user-1", settings)).toBe(true);
    markOpenSessionSatisfied("user-1");
    expect(appSessionRequiresAuthentication("user-1", settings)).toBe(false);
  });
});
