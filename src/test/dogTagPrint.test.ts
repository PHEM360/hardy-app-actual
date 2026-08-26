import { describe, expect, it } from "vitest";
import type { DogTag } from "@/hooks/useDogTags";
import { DEFAULT_TAG_PROFILE } from "@/hooks/useDogTags";
import {
  A4_HEIGHT_CM,
  A4_WIDTH_CM,
  buildPrintFaces,
  clampPrintCm,
  layoutPrintFaces,
  nextTopAfterPrint,
  normalizePrintPlacement,
  usedStripBottomCm,
} from "@/lib/dogTagPrint";

function tag(partial: Partial<DogTag> = {}): DogTag {
  return {
    id: "tag-1",
    petId: "pet-1",
    ownerId: "owner",
    label: "Collar tag",
    code: "abc",
    slug: "billy",
    shape: "rounded",
    bgColor: "#ffffff",
    fgColor: "#000000",
    stickerText: "Billy",
    sizeCm: 3.5,
    qrSizeCm: 1.8,
    stickerTextSizeCm: 0.35,
    backText: "IF FOUND",
    backTextSizeCm: 0.4,
    profile: DEFAULT_TAG_PROFILE,
    lastScanLocation: null,
    notifyEmails: [],
    notifyUids: [],
    ...partial,
  };
}

describe("dog tag print placement", () => {
  it("starts the first sticker at the chosen top and left offset", () => {
    const faces = buildPrintFaces([{ tag: tag(), petName: "Billy", front: true, back: false }]);
    const placed = layoutPrintFaces(faces, { topCm: 4, leftCm: 1.5, gapCm: 0.4 });
    expect(placed).toHaveLength(1);
    expect(placed[0]).toMatchObject({ xCm: 1.5, yCm: 4, page: 1, side: "front" });
  });

  it("prints front and back in a row from the start position", () => {
    const faces = buildPrintFaces([{ tag: tag(), petName: "Billy", front: true, back: true }]);
    const placed = layoutPrintFaces(faces, { topCm: 0, leftCm: 0, gapCm: 0.4 });
    expect(placed).toHaveLength(2);
    expect(placed[0].xCm).toBe(0);
    expect(placed[1].xCm).toBe(3.9);
    expect(placed[0].yCm).toBe(0);
    expect(placed[1].yCm).toBe(0);
  });

  it("wraps to the next row instead of hanging off the A4 page", () => {
    const faces = buildPrintFaces([
      { tag: tag({ id: "a", sizeCm: 8 }), petName: "Billy", front: true, back: true },
      { tag: tag({ id: "b", petId: "pet-2", sizeCm: 8 }), petName: "Luna", front: true, back: false },
    ]);
    const placed = layoutPrintFaces(faces, { topCm: 2, leftCm: 0.5, gapCm: 0.4 });
    expect(placed[0].yCm).toBe(2);
    expect(placed[1].yCm).toBe(2);
    expect(placed[2].yCm).toBeCloseTo(2 + 8 + 0.4);
    expect(placed[2].xCm).toBe(0.5);
    expect(placed.every((face) => face.xCm + face.widthCm <= A4_WIDTH_CM)).toBe(true);
  });

  it("moves leftover stickers onto a second page and remembers how far down page 1 went", () => {
    const faces = buildPrintFaces(
      Array.from({ length: 8 }, (_, index) => ({
        tag: tag({ id: `t${index}`, sizeCm: 6 }),
        petName: "Billy",
        front: true,
        back: false,
      })),
    );
    const placed = layoutPrintFaces(faces, { topCm: 20, leftCm: 0, gapCm: 0.4 });
    expect(placed.some((face) => face.page === 2)).toBe(true);
    expect(placed.filter((face) => face.page === 2)[0]?.yCm).toBe(0);
    expect(usedStripBottomCm(placed, 1)).toBeGreaterThan(20);
    expect(nextTopAfterPrint(placed, 0.4)).toBeGreaterThan(20);
    expect(nextTopAfterPrint(placed, 0.4)).toBeLessThan(A4_HEIGHT_CM);
  });

  it("treats a cut-off strip as a 4cm skip from the top of the next print", () => {
    expect(normalizePrintPlacement({ topCm: 4, leftCm: 0, gapCm: 0.4 }).topCm).toBe(4);
    expect(clampPrintCm(-2, 10)).toBe(0);
  });
});
