import { describe, expect, it } from "vitest";
import { deepenForLightText, readableTextOn } from "@/lib/appThemes";

const DARK = "222 40% 9%";
const LIGHT = "40 40% 97%";

describe("readableTextOn", () => {
  it("puts dark text on a pale custom colour", () => {
    expect(readableTextOn("45 90% 85%")).toBe(DARK);
    expect(readableTextOn("0 0% 100%")).toBe(DARK);
  });

  it("keeps light text on a deep custom colour", () => {
    expect(readableTextOn("176 58% 21%")).toBe(LIGHT);
    expect(readableTextOn("0 0% 0%")).toBe(LIGHT);
  });
});

describe("deepenForLightText", () => {
  it("darkens a pale colour until light text is readable on it", () => {
    const deep = deepenForLightText("45 90% 85%");
    expect(deep.startsWith("45 90% ")).toBe(true);
    expect(readableTextOn(deep)).toBe(LIGHT);
  });

  it("leaves an already deep colour alone", () => {
    expect(deepenForLightText("176 58% 21%")).toBe("176 58% 21%");
  });
});
