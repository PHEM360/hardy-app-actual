import { describe, expect, it } from "vitest";
import { formatUkNumber, prettyNumber } from "@/lib/phoneNumbers";

describe("phone numbers", () => {
  it("turns UK mobiles into E.164", () => {
    expect(formatUkNumber("07700 900123")).toBe("+447700900123");
    expect(formatUkNumber("+44 7700 900123")).toBe("+447700900123");
  });

  it("pretty-prints a UK mobile", () => {
    expect(prettyNumber("+447700900123")).toBe("07700 900 123");
  });
});
