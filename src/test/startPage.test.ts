import { describe, expect, it } from "vitest";
import { DEFAULT_START_PAGE, isSafeAppPath, resolveStartPage, roleFromUserDoc } from "@/lib/startPage";

describe("start page", () => {
  it("keeps a deep link after login", () => {
    expect(resolveStartPage("/today", "/finance", () => true)).toBe("/finance");
  });

  it("uses the saved page when there is no deep link", () => {
    expect(resolveStartPage("/photos", undefined, () => true)).toBe("/photos");
  });

  it("falls back to Home if the saved page is blocked", () => {
    expect(resolveStartPage("/admin", null, () => false)).toBe(DEFAULT_START_PAGE);
  });

  it("rejects unsafe redirect paths", () => {
    expect(isSafeAppPath("//evil.example")).toBe(false);
    expect(isSafeAppPath("https://evil.example")).toBe(false);
    expect(isSafeAppPath("/today")).toBe(true);
  });

  it("reads admin flags from the user doc", () => {
    expect(roleFromUserDoc({ role: "Superadmin" })).toBe("superadmin");
    expect(roleFromUserDoc({ isAdmin: true })).toBe("admin");
    expect(roleFromUserDoc({})).toBe("member");
  });
});
