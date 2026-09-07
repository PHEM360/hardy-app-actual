import { describe, expect, it } from "vitest";
import {
  normalizeHeaderPictureMode,
  occasionFromTitle,
  pickTodayOccasion,
  weatherBackdropKind,
} from "@/lib/headerBackdrop";

describe("header backdrop", () => {
  it("keeps an old single photo as one-picture mode", () => {
    expect(normalizeHeaderPictureMode(undefined, true)).toBe("one");
    expect(normalizeHeaderPictureMode(undefined, false)).toBe("off");
    expect(normalizeHeaderPictureMode("album", false)).toBe("album");
  });

  it("maps weather codes to a backdrop kind", () => {
    expect(weatherBackdropKind(0, true)).toBe("clear");
    expect(weatherBackdropKind(0, false)).toBe("night");
    expect(weatherBackdropKind(61, true)).toBe("rain");
    expect(weatherBackdropKind(71, true)).toBe("snow");
    expect(weatherBackdropKind(95, true)).toBe("storm");
  });

  it("picks a celebration scene from today’s events", () => {
    expect(occasionFromTitle("Sam's birthday")?.scene).toBe("hearts");
    expect(occasionFromTitle("New Year’s Eve")?.scene).toBe("fireworks");
    expect(pickTodayOccasion([{ title: "School run" }])?.scene).toBe("confetti");
    expect(pickTodayOccasion([], ["Willow"])?.label).toMatch(/Willow/);
  });
});
