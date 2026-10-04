import { describe, expect, it } from "vitest";
import { feeReviewDue, providerFeeSource } from "@/lib/providerFeeReview";

describe("provider fee review", () => {
  it("recognises the priority providers", () => {
    expect(providerFeeSource("My Vanguard ISA")?.label).toBe("Vanguard");
    expect(providerFeeSource("Interactive Investor")?.url).toContain("ii.co.uk");
    expect(providerFeeSource("True Potential Wealth")?.label).toBe("True Potential");
  });

  it("limits routine reviews to once in a calendar month", () => {
    expect(feeReviewDue("2026-10-01T00:00:00Z", new Date("2026-10-31T00:00:00Z"))).toBe(false);
    expect(feeReviewDue("2026-09-30T00:00:00Z", new Date("2026-10-01T00:00:00Z"))).toBe(true);
  });
});
